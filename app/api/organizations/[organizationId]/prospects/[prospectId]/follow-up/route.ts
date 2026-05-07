import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { parseOptionalIso, optionalString } from "@/lib/prospects/server-helpers"
import type { CommunicationChannel } from "@/lib/notifications/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_CHANNELS: CommunicationChannel[] = ["email", "sms", "in_app", "system"]

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * POST /api/organizations/{org}/prospects/{prospectId}/follow-up
 *
 * Logs a follow-up touch on a prospect:
 *   1. Writes a `communication_events` row tied back to the prospect via
 *      `related_entity_type='prospect'` + `metadata.prospect_id`. This is
 *      the same logger used by work order / quote / invoice email surfaces,
 *      so the future "Communications" timeline picks it up for free.
 *   2. Updates `prospects.last_contacted_at` and (optionally)
 *      `prospects.next_follow_up_at` so the dashboard's overdue/today
 *      buckets reflect the touch.
 *   3. Optionally bumps `prospects.status` (e.g. "new" → "contacted").
 *
 * Body:
 *   {
 *     channel: "email" | "sms" | "in_app" | "system",      // default "system"
 *     summary: string,                                     // required
 *     body?: string | null,
 *     next_follow_up_at?: string | null,                   // ISO
 *     advance_status?: ProspectStatus,                     // optional
 *   }
 *
 * Gated by `canManageProspects`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

  let body: {
    channel?: string
    summary?: string
    body?: string | null
    next_follow_up_at?: string | null
    advance_status?: string
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const summary = optionalString(body.summary, 500)
  if (!summary) return jsonError("summary is required.", 400)

  const channel: CommunicationChannel = ALLOWED_CHANNELS.includes(
    (body.channel ?? "system") as CommunicationChannel,
  )
    ? ((body.channel ?? "system") as CommunicationChannel)
    : "system"

  const followUp = parseOptionalIso(body.next_follow_up_at)
  if (followUp === "invalid") {
    return jsonError("next_follow_up_at must be a valid ISO date.", 400)
  }

  // Confirm the prospect belongs to this org (RLS would block, but we want
  // a friendly 404 for the UI rather than a row-level update of zero rows).
  const { data: prospect, error: lookupError } = await supabase
    .from("prospects")
    .select("id, status, company_name, contact_email")
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()

  if (lookupError) return jsonError(lookupError.message, 500, "query_failed")
  if (!prospect) return jsonError("Prospect not found.", 404, "not_found")

  // 1. Persist the communication event. Provider 'manual' for staff-logged
  //    touches keeps reporting clean and matches workflow logging callers.
  const eventTypeByChannel: Record<CommunicationChannel, string> = {
    email: "prospect_followup_email",
    sms: "prospect_followup_sms",
    in_app: "prospect_followup_note",
    push: "prospect_followup_note",
    system: "prospect_followup_note",
  }
  const title = `Follow-up · ${prospect.company_name as string}`
  const eventResult = await logCommunicationEvent(supabase, {
    organizationId,
    channel,
    direction: "outbound",
    eventType: eventTypeByChannel[channel],
    title: title.slice(0, 200),
    summary,
    body: optionalString(body.body, 4000),
    audience: "organization",
    countsTowardUnread: false,
    deliveryStatus: "sent",
    recipientKind: "external",
    recipientAddress: optionalString(prospect.contact_email),
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

  if (eventResult.error) {
    return jsonError(eventResult.error, 500, "log_failed")
  }

  // 2 + 3. Update prospect timestamps and (optionally) advance status.
  const update: Record<string, unknown> = {
    last_contacted_at: new Date().toISOString(),
  }
  if (followUp !== null) update.next_follow_up_at = followUp

  if (typeof body.advance_status === "string") {
    const advanceTo = body.advance_status.toLowerCase()
    const allowed = new Set(["new", "contacted", "follow_up", "quoted", "won", "lost"])
    if (allowed.has(advanceTo)) update.status = advanceTo
  } else if (prospect.status === "new") {
    // First touch defaults to "contacted" so the pipeline progresses
    // without an extra click.
    update.status = "contacted"
  }

  const { error: updateError } = await supabase
    .from("prospects")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", prospectId)

  if (updateError) return jsonError(updateError.message, 500, "update_failed")

  return NextResponse.json({ ok: true, communication_event_id: eventResult.id })
}
