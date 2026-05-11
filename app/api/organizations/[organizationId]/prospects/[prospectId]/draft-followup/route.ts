import { NextResponse } from "next/server"
import { z } from "zod"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { runAiTask } from "@/lib/ai/server"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { formatProspectStatus } from "@/lib/prospects/format"
import {
  PROSPECT_FOLLOWUP_SYSTEM_PROMPT,
  buildProspectFollowupUserPrompt,
} from "@/lib/prospects/ai-followup-prompt"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

const draftSchema = z
  .object({
    subject: z.string(),
    body: z.string(),
  })
  .transform((d) => ({ subject: d.subject.trim(), body: d.body.trim() }))
  .superRefine((d, ctx) => {
    if (!d.subject) ctx.addIssue({ code: "custom", path: ["subject"], message: "subject required" })
    if (!d.body) ctx.addIssue({ code: "custom", path: ["body"], message: "body required" })
  })

const TIMELINE_LIMIT = 5

/**
 * POST /api/organizations/{org}/prospects/{prospectId}/draft-followup
 *
 * AI-assisted follow-up email draft for a prospect.
 *
 * - Reuses the existing `customer_email` AI task (model selection, plan
 *   gate, monthly budget, and usage logging are inherited).
 * - Prompt body is prospect-specific (`lib/prospects/ai-followup-prompt.ts`)
 *   so we can iterate on prospect tone independently of the central email
 *   prompt registry.
 * - Pulls a small slice of the prospect's recent `communication_events`
 *   timeline so the model can reference prior touches accurately.
 * - **Never auto-sends.** This route only returns text for human review.
 *   The user copies / opens it in their mail client.
 * - Logs a `prospect_ai_draft_generated` audit row in `communication_events`
 *   so the timeline shows AI usage without storing the draft body itself.
 *
 * Permissions:
 *   - `requireOrgPermission("canManageProspects")` — staff-side only.
 *   - Growth+ **`ai`** via `requireFeatureAccess` (non–platform-admin); budget/task gating inside `runAiTask`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const rawBody = await request.json().catch(() => null)
  let aiOpsRecommendationKey: string | null = null
  if (
    rawBody &&
    typeof rawBody === "object" &&
    "aiOpsRecommendationKey" in rawBody &&
    typeof (rawBody as { aiOpsRecommendationKey?: unknown }).aiOpsRecommendationKey === "string"
  ) {
    aiOpsRecommendationKey = (rawBody as { aiOpsRecommendationKey: string }).aiOpsRecommendationKey.trim().slice(
      0,
      220,
    )
    if (!aiOpsRecommendationKey.length) aiOpsRecommendationKey = null
  }

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  const isPlatformAdmin = Boolean(authUser?.email && isPlatformAdminEmail(authUser.email))
  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) return jsonError(planGate.message, planGate.httpStatus, planGate.code)
  }

  const { data: prospect, error: lookupError } = await supabase
    .from("prospects")
    .select(
      "id, company_name, contact_name, contact_email, status, lead_source, notes, estimated_value_cents, last_contacted_at, next_follow_up_at",
    )
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()

  if (lookupError) return jsonError(lookupError.message, 500, "query_failed")
  if (!prospect) return jsonError("Prospect not found.", 404, "not_found")

  // Pull a small recent timeline for grounding.
  const { data: events } = await supabase
    .from("communication_events")
    .select("event_type, channel, summary, created_at, metadata")
    .eq("organization_id", organizationId)
    .eq("related_entity_type", "prospect")
    .eq("related_entity_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(TIMELINE_LIMIT * 2)

  const now = Date.now()
  const daysSinceLastContact =
    typeof prospect.last_contacted_at === "string"
      ? Math.max(
          0,
          Math.floor((now - Date.parse(prospect.last_contacted_at)) / (1000 * 60 * 60 * 24)),
        )
      : null
  const daysUntilFollowUp =
    typeof prospect.next_follow_up_at === "string"
      ? Math.floor((Date.parse(prospect.next_follow_up_at) - now) / (1000 * 60 * 60 * 24))
      : null

  const estimatedValueLabel =
    prospect.estimated_value_cents != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          Number(prospect.estimated_value_cents) / 100,
        )
      : null

  const recentTimeline = (events ?? [])
    .map((e) => {
      const summary = (e as { summary?: string | null }).summary?.trim()
      const channel = (e as { channel?: string | null }).channel
      const eventType = (e as { event_type?: string | null }).event_type ?? "event"
      return summary
        ? `${eventType} (${channel ?? "n/a"}): ${summary}`
        : `${eventType} (${channel ?? "n/a"})`
    })
    .filter(Boolean)
    .slice(0, TIMELINE_LIMIT)

  const userPrompt = buildProspectFollowupUserPrompt({
    companyName: prospect.company_name as string,
    contactName: (prospect.contact_name as string | null) ?? null,
    status: formatProspectStatus(prospect.status as string),
    leadSource: (prospect.lead_source as string | null) ?? null,
    daysSinceLastContact,
    daysUntilFollowUp,
    estimatedValueLabel,
    notes: (prospect.notes as string | null) ?? null,
    recentTimeline,
  })

  let draft: { subject: string; body: string }
  let draftUsage: { promptTokens: number; completionTokens: number } | null = null
  try {
    const result = await runAiTask({
      task: "customer_email",
      organizationId,
      input: {
        system: PROSPECT_FOLLOWUP_SYSTEM_PROMPT,
        user: userPrompt,
      },
      schema: draftSchema,
      taskOverrides: { structuredMode: "json_object" },
      cacheSchemaVersion: "prospect_followup_draft_v1",
    })

    if (!result.ok) {
      const message = result.error.message
      if (message.includes("No AI provider is configured")) {
        return NextResponse.json(
          {
            ok: false,
            error: "not_configured",
            message:
              "AI follow-up drafts require OPENAI_API_KEY (and optional Anthropic/Google keys). Ask your admin to configure providers.",
          },
          { status: 503 },
        )
      }
      const planBlocked = result.meta.escalationReasons.includes("plan_blocked")
      const budgetBlocked = result.meta.escalationReasons.includes("budget_exceeded")
      if (planBlocked) {
        return NextResponse.json(
          { ok: false, error: "plan_blocked", message: "AI drafting is not included on your current plan." },
          { status: 402 },
        )
      }
      if (budgetBlocked) {
        return NextResponse.json(
          { ok: false, error: "budget_exceeded", message: "Monthly AI budget reached. Try again next month or raise the cap." },
          { status: 402 },
        )
      }
      return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
    }

    draft = result.output
    draftUsage = {
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
  }

  // Audit log — record that an AI draft was generated, but never store the
  // draft body itself in `communication_events` so the org timeline does
  // not double-count un-sent messages or leak PII.
  await logCommunicationEvent(supabase, {
    organizationId,
    channel: "system",
    direction: "outbound",
    eventType: "prospect_ai_draft_generated",
    title: `AI follow-up draft generated · ${prospect.company_name as string}`,
    summary: `Subject: ${draft.subject}`.slice(0, 500),
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "none",
    relatedEntityType: "prospect",
    relatedEntityId: prospectId,
    provider: "manual",
    metadata: {
      prospect_id: prospectId,
      prospect_status: prospect.status,
    },
    sentAt: new Date().toISOString(),
    createdBy: userId,
  })

  if (aiOpsRecommendationKey) {
    try {
      const subscription = await getOrganizationSubscription(supabase, organizationId)
      const planTier = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
      void recordAidenUsageEvent({
        organizationId,
        userId,
        featureKey: "operational_insight_interaction",
        planTier,
        promptTokens: draftUsage?.promptTokens ?? 0,
        completionTokens: draftUsage?.completionTokens ?? 0,
        metadata: {
          kind: "draft_followup",
          recommendation_key: aiOpsRecommendationKey,
          prospect_id: prospectId,
        },
      })
    } catch {
      /* best-effort */
    }
  }

  return NextResponse.json({ ok: true, subject: draft.subject, body: draft.body })
}
