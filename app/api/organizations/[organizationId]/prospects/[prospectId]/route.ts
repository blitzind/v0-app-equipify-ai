import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { PROSPECT_STATUSES, type ProspectStatus } from "@/lib/prospects/types"
import {
  PROSPECT_SELECT_COLUMNS,
  optionalString,
  parseOptionalCents,
  parseOptionalIso,
} from "@/lib/prospects/server-helpers"

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
  const { supabase } = gate

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

  if ("status" in body) {
    const status = typeof body.status === "string" ? body.status.toLowerCase() : ""
    if (!PROSPECT_STATUSES.includes(status as ProspectStatus)) {
      return jsonError("Invalid status.", 400)
    }
    update.status = status
  }

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

  if (Object.keys(update).length === 0) {
    return jsonError("No editable fields supplied.", 400)
  }

  const { data, error } = await supabase
    .from("prospects")
    .update(update)
    .eq("organization_id", organizationId)
    .eq("id", prospectId)
    .select(PROSPECT_SELECT_COLUMNS)
    .single()

  if (error || !data) return jsonError(error?.message ?? "Prospect not found.", 404, "not_found")

  return NextResponse.json({ prospect: data })
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
