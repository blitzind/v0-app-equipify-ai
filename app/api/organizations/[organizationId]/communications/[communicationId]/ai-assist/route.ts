import { NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { recordAidenUsageEvent } from "@/lib/aiden/usage-events"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { getOrganizationSubscription } from "@/lib/billing/subscriptions"
import { deriveCommunicationCenterKind } from "@/lib/communications/communication-kind"
import { communicationEventInAssignedScope } from "@/lib/communications/feed-scope"
import { isFinancialRow } from "@/lib/communications/feed"
import { runAiTask } from "@/lib/ai/server"
import { requireFeatureAccess } from "@/lib/billing/server-guard"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import { getOrgPermissionsForRole, normalizeOrgMemberRole } from "@/lib/permissions/model"
import {
  isAssignedWorkOnly,
  loadAssignedWorkScope,
} from "@/lib/permissions/technician-scope"
import type { CommunicationEventRow } from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  action: z.enum(["summarize", "draft_reply", "regenerate_tone"]),
  tone: z.enum(["professional", "friendly", "concise"]).optional(),
})

const OutputSchema = z.object({
  text: z.string().max(12000),
})

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: code ?? "error", message }, { status })
}

function buildPrompt(
  action: z.infer<typeof BodySchema>["action"],
  row: CommunicationEventRow,
  tone: string | undefined,
): { system: string; user: string } {
  const channel = row.channel
  const dir = row.direction
  const title = row.title
  const summary = row.summary ?? ""
  const body = row.body ?? ""
  const kind = deriveCommunicationCenterKind(row)

  const baseContext = [
    `Channel: ${channel}`,
    `Direction: ${dir}`,
    `Category (derived): ${kind}`,
    `Title: ${title}`,
    summary ? `Summary: ${summary}` : null,
    body ? `Body:\n${body.slice(0, 8000)}` : null,
  ]
    .filter(Boolean)
    .join("\n")

  switch (action) {
    case "summarize":
      return {
        system: `You help service-desk staff understand communication history. Summarize for internal use only. Do not invent customer names, amounts, or dates not in the input. Output plain text, bullet list OK, max ~400 words.`,
        user: `${baseContext}\n\nProvide a concise summary of what happened and what may need follow-up.`,
      }
    case "draft_reply":
      return {
        system: `Draft a customer-facing reply email body only (no Subject line required in output). The organization will review and send manually — NEVER imply the message was sent. Do not invent invoice numbers, dollar amounts, or appointments not given. Plain text.`,
        user: `${baseContext}\n\nWrite an appropriate reply the team can paste after review.`,
      }
    case "regenerate_tone":
      return {
        system: `Rewrite the draft message in a ${tone ?? "professional"} tone for external customers. Keep facts identical — do not invent details. Plain text only.`,
        user: `${baseContext}\n\nRewrite the body/summary content with the requested tone.`,
      }
    default:
      return { system: "", user: baseContext }
  }
}

/**
 * Phase 28 — AI assist for communications (summarize / draft / rewrite).
 * Never sends mail; outputs text for human approval only.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; communicationId: string }> },
) {
  const { organizationId, communicationId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(communicationId)) {
    return jsonError("Invalid identifier.", 400)
  }

  const parsedBody = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsedBody.success) return jsonError(parsedBody.error.message, 400, "invalid_body")

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return jsonError("Unauthorized.", 401)

  const isPlatformAdmin = isPlatformAdminEmail(user.email)
  const rawRole = isPlatformAdmin
    ? "owner"
    : await getOrganizationMemberRole(supabase, user.id, organizationId)
  const role = normalizeOrgMemberRole(rawRole)
  if (!role && !isPlatformAdmin) return jsonError("Forbidden.", 403)
  const permissions = getOrgPermissionsForRole(role)
  if (!permissions.canViewCommunications && !isPlatformAdmin) {
    return jsonError("Forbidden.", 403)
  }

  const { data, error } = await supabase
    .from("communication_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", communicationId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Communication not found.", 404)

  const row = data as CommunicationEventRow

  const canBilling =
    Boolean(permissions.canViewFinancials || permissions.canViewBilling) || isPlatformAdmin
  if (isFinancialRow(row) && !canBilling) {
    return jsonError("Billing access required for this communication.", 403)
  }

  if (!isPlatformAdmin && isAssignedWorkOnly(permissions)) {
    const scope = await loadAssignedWorkScope(supabase, {
      organizationId,
      userId: user.id,
    })
    if (!communicationEventInAssignedScope(row, scope)) {
      return jsonError("Forbidden.", 403)
    }
  }

  if (!isPlatformAdmin) {
    const planGate = await requireFeatureAccess(supabase, organizationId, "ai")
    if (!planGate.ok) {
      return jsonError(planGate.message, planGate.httpStatus, planGate.code)
    }
  }

  const prompt = buildPrompt(parsedBody.data.action, row, parsedBody.data.tone)
  const started = Date.now()

  const result = await runAiTask({
    task: "customer_email",
    organizationId,
    input: {
      system: `${prompt.system}\n\nRespond with a single JSON object only: {"text":"..."} where text is your full answer (plain text inside the string, use \\n for newlines).`,
      user: `[communication_ai_assist]\n${prompt.user}`,
    },
    schema: OutputSchema,
    taskOverrides: { structuredMode: "json_object" },
    cacheSchemaVersion: `comm_ai_assist_${parsedBody.data.action}_v1`,
  })

  if (!result.ok) {
    return jsonError(result.error.message || "AI generation failed.", 502, "ai_failed")
  }

  try {
    const subscription = await getOrganizationSubscription(supabase, organizationId)
    const planTier = getEffectivePlanId(subscription?.plan_id ?? "solo", subscription)
    void recordAidenUsageEvent({
      organizationId,
      userId: user.id,
      featureKey: "communication_center_ai",
      planTier,
      promptTokens: result.usage.promptTokens,
      completionTokens: result.usage.completionTokens,
      durationMs: Date.now() - started,
      metadata: {
        action: parsedBody.data.action,
        communication_id: communicationId,
        tone: parsedBody.data.tone ?? null,
      },
    })
  } catch {
    /* best-effort audit */
  }

  return NextResponse.json({
    ok: true,
    text: result.output.text,
    action: parsedBody.data.action,
  })
}
