import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  isGateError,
  requireOrgOperationalRead,
} from "@/lib/service-contracts/api-gate"
import type { ServiceContractCoverageTypeDb, ServiceContractStatusDb } from "@/lib/service-contracts/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const STATUS_SET = new Set<ServiceContractStatusDb>([
  "draft",
  "active",
  "suspended",
  "expired",
  "cancelled",
])

const COVERAGE_SET = new Set<ServiceContractCoverageTypeDb>([
  "full_service",
  "labor_only",
  "parts_and_labor",
  "inspection_only",
  "emergency",
  "pm_only",
  "other",
])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; contractId: string }> },
) {
  const { organizationId, contractId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(contractId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgOperationalRead(organizationId)
  if (isGateError(gate)) return gate.error

  const { data, error } = await gate.supabase
    .from("org_service_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", contractId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!data) return jsonError("Not found.", 404)

  return NextResponse.json({ contract: data })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; contractId: string }> },
) {
  const { organizationId, contractId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(contractId)) {
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

  const { data: existing, error: exErr } = await gate.supabase
    .from("org_service_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", contractId)
    .maybeSingle()

  if (exErr) return jsonError(exErr.message, 500)
  if (!existing) return jsonError("Not found.", 404)

  const customerId = (existing as { customer_id: string }).customer_id

  const patch: Record<string, unknown> = {}

  if (typeof body.contract_name === "string" && body.contract_name.trim()) {
    patch.contract_name = body.contract_name.trim()
  }
  if (body.contract_number !== undefined) {
    patch.contract_number =
      typeof body.contract_number === "string" && body.contract_number.trim()
        ? body.contract_number.trim().slice(0, 120)
        : null
  }
  if (typeof body.start_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.start_date.trim())) {
    patch.start_date = body.start_date.trim().slice(0, 10)
  }
  if (typeof body.end_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.end_date.trim())) {
    patch.end_date = body.end_date.trim().slice(0, 10)
  }
  if (typeof body.status === "string") {
    const s = body.status.trim().toLowerCase()
    if (STATUS_SET.has(s as ServiceContractStatusDb)) patch.status = s
  }
  if (typeof body.coverage_type === "string") {
    const c = body.coverage_type.trim().toLowerCase()
    if (COVERAGE_SET.has(c as ServiceContractCoverageTypeDb)) patch.coverage_type = c
  }
  if (body.notes !== undefined) {
    patch.notes =
      typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 8000) : null
  }
  if (body.sla_response_hours === null) {
    patch.sla_response_hours = null
  } else if (typeof body.sla_response_hours === "number" && body.sla_response_hours > 0) {
    patch.sla_response_hours = Math.round(body.sla_response_hours)
  }
  if (body.sla_resolution_hours === null) {
    patch.sla_resolution_hours = null
  } else if (typeof body.sla_resolution_hours === "number" && body.sla_resolution_hours > 0) {
    patch.sla_resolution_hours = Math.round(body.sla_resolution_hours)
  }

  if (body.customer_location_id === null) {
    patch.customer_location_id = null
  } else if (typeof body.customer_location_id === "string" && UUID_RE.test(body.customer_location_id.trim())) {
    const lid = body.customer_location_id.trim()
    const { data: loc } = await gate.supabase
      .from("customer_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("id", lid)
      .maybeSingle()
    if (!loc) return jsonError("customer_location_id invalid.", 400)
    patch.customer_location_id = lid
  }

  if (body.equipment_id === null) {
    patch.equipment_id = null
  } else if (typeof body.equipment_id === "string" && UUID_RE.test(body.equipment_id.trim())) {
    const eid = body.equipment_id.trim()
    const { data: eq } = await gate.supabase
      .from("equipment")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("id", eid)
      .maybeSingle()
    if (!eq) return jsonError("equipment_id invalid.", 400)
    patch.equipment_id = eid
  }

  const nextStart = (patch.start_date as string | undefined) ?? (existing as { start_date: string }).start_date
  const nextEnd = (patch.end_date as string | undefined) ?? (existing as { end_date: string }).end_date
  if (nextEnd < nextStart) return jsonError("end_date must be on or after start_date.", 400)

  if (Object.keys(patch).length === 0) return jsonError("No valid fields.", 400)

  const { data: updated, error } = await gate.supabase
    .from("org_service_contracts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", contractId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 400)

  return NextResponse.json({ contract: updated })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; contractId: string }> },
) {
  const { organizationId, contractId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(contractId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  const { error } = await gate.supabase
    .from("org_service_contracts")
    .delete()
    .eq("organization_id", organizationId)
    .eq("id", contractId)

  if (error) return jsonError(error.message, 400)

  return NextResponse.json({ ok: true })
}
