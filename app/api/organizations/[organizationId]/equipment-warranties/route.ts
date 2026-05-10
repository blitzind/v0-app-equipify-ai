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
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgOperationalRead(organizationId)
  if (isGateError(gate)) return gate.error

  const equipmentId = new URL(request.url).searchParams.get("equipmentId")?.trim() ?? ""
  if (!UUID_RE.test(equipmentId)) return jsonError("Invalid or missing equipmentId.", 400)

  const { data, error } = await gate.supabase
    .from("org_equipment_warranties")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("equipment_id", equipmentId)
    .order("end_date", { ascending: false })

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ warranties: data ?? [] })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  const equipmentId = typeof body.equipment_id === "string" ? body.equipment_id.trim() : ""
  const warrantyProvider =
    typeof body.warranty_provider === "string" ? body.warranty_provider.trim() : ""
  const endDate = typeof body.end_date === "string" ? body.end_date.trim().slice(0, 10) : ""
  const startDateRaw = typeof body.start_date === "string" ? body.start_date.trim().slice(0, 10) : ""
  const startDate =
    startDateRaw && /^\d{4}-\d{2}-\d{2}$/.test(startDateRaw) ? startDateRaw : null
  const statusRaw = typeof body.status === "string" ? body.status.trim() : "active"
  const status = STATUS_SET.has(statusRaw as EquipmentWarrantyStatusDb)
    ? (statusRaw as EquipmentWarrantyStatusDb)
    : null
  const coverageSummary =
    typeof body.coverage_summary === "string" ? body.coverage_summary.trim() : ""
  const referenceNumber =
    typeof body.reference_number === "string" ? body.reference_number.trim() : ""
  const notes = typeof body.notes === "string" ? body.notes.trim() : ""

  if (!UUID_RE.test(equipmentId)) return jsonError("Invalid equipment.", 400)
  if (!warrantyProvider) return jsonError("warranty_provider is required.", 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return jsonError("end_date must be YYYY-MM-DD.", 400)
  if (startDate && startDate > endDate) return jsonError("start_date must be on or before end_date.", 400)
  if (!status) return jsonError("Invalid status.", 400)

  const { data: eqOk } = await gate.supabase
    .from("equipment")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", equipmentId)
    .is("archived_at", null)
    .maybeSingle()
  if (!eqOk) return jsonError("Equipment not found for this organization.", 404)

  const { data, error } = await gate.supabase
    .from("org_equipment_warranties")
    .insert({
      organization_id: organizationId,
      equipment_id: equipmentId,
      warranty_provider: warrantyProvider,
      start_date: startDate,
      end_date: endDate,
      status,
      coverage_summary: coverageSummary || null,
      reference_number: referenceNumber || null,
      notes: notes || null,
    })
    .select("*")
    .single()

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ warranty: data })
}
