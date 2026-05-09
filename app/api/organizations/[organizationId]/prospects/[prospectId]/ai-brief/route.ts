import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { runAiTask } from "@/lib/ai/server"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { formatProspectStatus } from "@/lib/prospects/format"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

const briefSchema = z
  .object({
    summary: z.string(),
    next_steps: z.array(z.string()),
  })
  .transform((d) => ({
    summary: d.summary.trim(),
    next_steps: d.next_steps.map((s) => s.trim()).filter(Boolean).slice(0, 8),
  }))
  .superRefine((d, ctx) => {
    if (!d.summary) ctx.addIssue({ code: "custom", path: ["summary"], message: "summary required" })
  })

const BRIEF_SYSTEM = `You are assisting field-service sales reps. Given prospect facts and recent activity, produce a concise operational brief — no marketing fluff, no automated outreach promises. Use short sentences.`

/**
 * POST …/ai-brief — lightweight lead summary + next-step suggestions (human-reviewed only).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

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

  const { data: events } = await supabase
    .from("communication_events")
    .select("event_type, channel, summary, created_at")
    .eq("organization_id", organizationId)
    .eq("related_entity_type", "prospect")
    .eq("related_entity_id", prospectId)
    .order("created_at", { ascending: false })
    .limit(8)

  const est =
    prospect.estimated_value_cents != null
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          Number(prospect.estimated_value_cents) / 100,
        )
      : "unknown"

  const recent = (events ?? [])
    .map((e) => {
      const s = (e as { summary?: string | null }).summary?.trim()
      const t = (e as { event_type?: string | null }).event_type ?? "event"
      return s ? `${t}: ${s}` : t
    })
    .filter(Boolean)
    .join("\n")

  const userPrompt = [
    `Company: ${prospect.company_name}`,
    `Contact: ${(prospect.contact_name as string | null) ?? "n/a"} · ${(prospect.contact_email as string | null) ?? "n/a"}`,
    `Stage: ${formatProspectStatus(prospect.status as string)}`,
    `Lead source: ${(prospect.lead_source as string | null) ?? "n/a"}`,
    `Est. value: ${est}`,
    `Notes: ${(prospect.notes as string | null) ?? "none"}`,
    `Recent timeline:\n${recent || "(none logged)"}`,
    `Return JSON only with keys summary (string) and next_steps (array of short strings, max 5 items).`,
  ].join("\n")

  try {
    const result = await runAiTask({
      task: "customer_email",
      organizationId,
      input: {
        system: BRIEF_SYSTEM,
        user: userPrompt,
      },
      schema: briefSchema,
      taskOverrides: { structuredMode: "json_object" },
      cacheSchemaVersion: "prospect_ai_brief_v1",
    })

    if (!result.ok) {
      const message = result.error.message
      if (message.includes("No AI provider is configured")) {
        return NextResponse.json(
          {
            ok: false,
            error: "not_configured",
            message:
              "AI briefs require OPENAI_API_KEY (and optional Anthropic/Google keys). Ask your admin to configure providers.",
          },
          { status: 503 },
        )
      }
      const planBlocked = result.meta.escalationReasons.includes("plan_blocked")
      const budgetBlocked = result.meta.escalationReasons.includes("budget_exceeded")
      if (planBlocked) {
        return NextResponse.json(
          { ok: false, error: "plan_blocked", message: "AI briefs are not included on your current plan." },
          { status: 402 },
        )
      }
      if (budgetBlocked) {
        return NextResponse.json(
          { ok: false, error: "budget_exceeded", message: "Monthly AI budget reached." },
          { status: 402 },
        )
      }
      return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
    }

    const out = result.output

    await logCommunicationEvent(supabase, {
      organizationId,
      channel: "system",
      direction: "outbound",
      eventType: "prospect_ai_brief_generated",
      title: `AI lead brief · ${prospect.company_name as string}`,
      summary: out.summary.slice(0, 400),
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "sent",
      recipientKind: "none",
      relatedEntityType: "prospect",
      relatedEntityId: prospectId,
      provider: "manual",
      metadata: { prospect_id: prospectId },
      sentAt: new Date().toISOString(),
      createdBy: userId,
    })

    return NextResponse.json({ ok: true, summary: out.summary, next_steps: out.next_steps })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "generation_failed", message }, { status: 500 })
  }
}
