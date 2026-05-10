import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  isGateError,
  requireOrgOperationalRead,
} from "@/lib/service-contracts/api-gate"
import type { EquipmentWarrantyStatusDb } from "@/lib/equipment-warranties/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_SET = new Set<EquipmentWarrantyStatusDb>(["active", "expired", "void"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; warrantyId: string }> },
) {
  const { organizationId, warrantyId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(warrantyId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgOperationalRead(organizationId)
  if (isGateError(gate)) return gate.error

  const { data, error } = await gate.supabase
    .from("org_equipment_warranties")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", warrantyId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Not found.", 404)
  return NextResponse.json({ warranty: data })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; warrantyId: string }> },
) {
  const { organizationId, warrantyId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(warrantyId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const patch: Record<string, unknown> = {}

  if (typeof body.warranty_provider === "string") {
    const v = body.warranty_provider.trim()
    if (!v) return jsonError("warranty_provider cannot be empty.", 400)
    patch.warranty_provider = v
  }
  if (body.start_date === null) patch.start_date = null
  else if (typeof body.start_date === "string") {
    const s = body.start_date.trim().slice(0, 10)
    patch.start_date = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
  }
  if (typeof body.end_date === "string") {
    const e = body.end_date.trim().slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e)) return jsonError("end_date must be YYYY-MM-DD.", 400)
    patch.end_date = e
  }
  if (typeof body.status === "string") {
    const s = body.status.trim()
    if (!STATUS_SET.has(s as EquipmentWarrantyStatusDb)) return jsonError("Invalid status.", 400)
    patch.status = s
  }
  if (body.coverage_summary === null) patch.coverage_summary = null
  else if (typeof body.coverage_summary === "string") {
    patch.coverage_summary = body.coverage_summary.trim() || null
  }
  if (body.reference_number === null) patch.reference_number = null
  else if (typeof body.reference_number === "string") {
    patch.reference_number = body.reference_number.trim() || null
  }
  if (body.notes === null) patch.notes = null
  else if (typeof body.notes === "string") {
    patch.notes = body.notes.trim() || null
  }

  if (Object.keys(patch).length === 0) return jsonError("No valid fields to update.", 400)

  const { data: cur } = await gate.supabase
    .from("org_equipment_warranties")
    .select("start_date, end_date")
    .eq("organization_id", organizationId)
    .eq("id", warrantyId)
    .maybeSingle()
  if (!cur) return jsonError("Not found.", 404)

  const nextStart =
    patch.start_date !== undefined ? (patch.start_date as string | null) : (cur.start_date as string | null)
  const nextEnd =
    patch.end_date !== undefined ? (patch.end_date as string) : (cur.end_date as string).slice(0, 10)
  if (nextStart && nextStart > nextEnd) {
    return jsonError("start_date must be on or before end_date.", 400)
  }

  const { data, error } = await gate.supabase
    .from("org_equipment_warranties")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", warrantyId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Not found.", 404)
  return NextResponse.json({ warranty: data })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; warrantyId: string }> },
) {
  const { organizationId, warrantyId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(warrantyId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  const { error } = await gate.supabase
    .from("org_equipment_warranties")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", warrantyId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true })
}
