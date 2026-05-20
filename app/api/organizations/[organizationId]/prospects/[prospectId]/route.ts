import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/prospects/types"
import {
  PROSPECT_SELECT_COLUMNS,
  optionalString,
  optionalUuid,
  optionalWebsite,
  parseOptionalCents,
  parseOptionalIso,
} from "@/lib/prospects/server-helpers"
import { enrichProspectRows } from "@/lib/prospects/member-profiles"
import { recordProspectStatusChange } from "@/lib/prospects/status-events"
import type { ProspectRow } from "@/lib/prospects/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "bad_request") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * PATCH /api/organizations/{org}/prospects/{prospectId}
 *
 * Partial update of a prospect — any combination of pipeline status,
 * next_follow_up_at, contact details, notes, and estimated value. Gated by
 * `canManageProspects`. RLS prevents cross-org leakage.
 */
export async function PATCH(
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

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const update: Record<string, unknown> = {}

  if (typeof body.company_name === "string") {
    const trimmed = body.company_name.trim()
    if (!trimmed) return jsonError("company_name cannot be empty.", 400)
    update.company_name = trimmed
  }

  if ("contact_name" in body) update.contact_name = optionalString(body.contact_name)
  if ("contact_email" in body) update.contact_email = optionalString(body.contact_email)
  if ("contact_phone" in body) update.contact_phone = optionalString(body.contact_phone)
  if ("lead_source" in body) update.lead_source = optionalString(body.lead_source)
  if ("notes" in body) update.notes = optionalString(body.notes)

  if ("website" in body) {
    const website = optionalWebsite(body.website)
    if (website === "invalid") return jsonError("website must be a valid URL.", 400)
    update.website = website
  }
  if ("address_line1" in body) update.address_line1 = optionalString(body.address_line1, 400)
  if ("address_line2" in body) update.address_line2 = optionalString(body.address_line2, 400)
  if ("city" in body) update.city = optionalString(body.city, 120)
  if ("state" in body) update.state = optionalString(body.state, 80)
  if ("postal_code" in body) update.postal_code = optionalString(body.postal_code, 32)
  if ("country" in body) update.country = optionalString(body.country, 120)

  if ("lost_reason" in body) update.lost_reason = optionalString(body.lost_reason, 2000)

  if ("status" in body) {
    const status = typeof body.status === "string" ? body.status.toLowerCase() : ""
    if (!PROSPECT_STATUSES.includes(status as ProspectStatus)) {
      return jsonError("Invalid status.", 400)
    }
    update.status = status
  }

  const skipQualificationGuard = body.skip_qualification_guard === true

  if ("next_follow_up_at" in body) {
    const value = parseOptionalIso(body.next_follow_up_at)
    if (value === "invalid") return jsonError("next_follow_up_at must be a valid ISO date.", 400)
    update.next_follow_up_at = value
  }

  if ("estimated_value_cents" in body) {
    const value = parseOptionalCents(body.estimated_value_cents)
    if (value === "invalid") {
      return jsonError("estimated_value_cents must be a non-negative integer.", 400)
    }
    update.estimated_value_cents = value
  }

  if ("assigned_to_user_id" in body) {
    const value = optionalUuid(body.assigned_to_user_id)
    if (value === "invalid") return jsonError("assigned_to_user_id must be a valid UUID.", 400)
    update.assigned_to_user_id = value
  }

  if ("last_contacted_by_user_id" in body) {
    const value = optionalUuid(body.last_contacted_by_user_id)
    if (value === "invalid") return jsonError("last_contacted_by_user_id must be a valid UUID.", 400)
    update.last_contacted_by_user_id = value
  }

  if ("next_action_owner_user_id" in body) {
    const value = optionalUuid(body.next_action_owner_user_id)
    if (value === "invalid") return jsonError("next_action_owner_user_id must be a valid UUID.", 400)
    update.next_action_owner_user_id = value
  }

  if (Object.keys(update).length === 0) {
    return jsonError("No editable fields supplied.", 400)
  }

  const { data: previous } = await supabase
    .from("prospects")
    .select("status, company_name, estimated_value_cents, notes, lost_reason")
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .maybeSingle()

  if (!previous) return jsonError("Prospect not found.", 404, "not_found")

  const prevStatus = previous.status as ProspectStatus
  const nextStatus = (update.status ?? prevStatus) as ProspectStatus

  if (nextStatus === "lost" && prevStatus !== "lost") {
    const fromUpdate =
      typeof update.lost_reason === "string" ? update.lost_reason.trim() : ""
    const fromBody = typeof body.lost_reason === "string" ? body.lost_reason.trim() : ""
    const lr = (fromUpdate || fromBody).slice(0, 2000)
    if (!lr) {
      return jsonError(
        "A lost reason is required when moving a prospect to Lost.",
        400,
        "lost_reason_required",
      )
    }
    update.lost_reason = lr
  }

  if (
    !skipQualificationGuard &&
    update.status &&
    (nextStatus === "qualified" || nextStatus === "proposal_sent") &&
    prevStatus !== nextStatus
  ) {
    const mergedEst =
      update.estimated_value_cents !== undefined
        ? update.estimated_value_cents
        : (previous.estimated_value_cents as number | null)
    const mergedNotes =
      update.notes !== undefined
        ? (update.notes as string | null)
        : ((previous.notes as string | null) ?? null)
    const hasValue = mergedEst != null && mergedEst > 0
    const hasNotes = Boolean(mergedNotes?.trim())
    if (!hasValue && !hasNotes) {
      return jsonError(
        "Add an estimated value or notes on the prospect before moving to Qualified or Proposal sent.",
        422,
        "qualification_required",
      )
    }
  }

  if (nextStatus === "contacted" && prevStatus !== "contacted") {
    update.last_contacted_at = new Date().toISOString()
    update.last_contacted_by_user_id = userId
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .select(PROSPECT_SELECT_COLUMNS)
    .single()

  if (error || !data) return jsonError(error?.message ?? "Prospect not found.", 404, "not_found")

  if (update.status && prevStatus !== update.status) {
    const lostMeta =
      (update.status as ProspectStatus) === "lost" && typeof update.lost_reason === "string"
        ? { lost_reason: update.lost_reason }
        : {}
    await recordProspectStatusChange({
      supabase,
      organizationId,
      prospectId,
      companyName: (data as { company_name: string }).company_name ?? previous.company_name,
      previousStatus: prevStatus,
      nextStatus: update.status as ProspectStatus,
      reason: "manual_edit",
      actorUserId: userId,
      extraMetadata: Object.keys(lostMeta).length ? lostMeta : undefined,
    })
  }

  const [prospect] = await enrichProspectRows(supabase, organizationId, [data as ProspectRow])
  return NextResponse.json({ prospect })
}

/**
 * DELETE /api/organizations/{org}/prospects/{prospectId}
 *
 * Soft-archive: stamps `archived_at` rather than deleting. We choose
 * archive over hard-delete so converted prospects can still surface in
 * audit trails and downstream Growth tooling. Gated by
 * `canManageProspects` (managers can archive their own pipeline).
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; prospectId: string }> },
) {
  const { organizationId, prospectId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(prospectId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageProspects")
  if ("error" in gate) return gate.error
  const { supabase } = gate

  const { error } = await supabase
    .from("prospects")
    .update({ archived_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", prospectId)

  if (error) return jsonError(error.message, 500, "update_failed")
  return NextResponse.json({ ok: true })
}
