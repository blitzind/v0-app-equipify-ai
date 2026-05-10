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
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgOperationalRead(organizationId)
  if (isGateError(gate)) return gate.error

  const customerId = new URL(request.url).searchParams.get("customerId")?.trim() ?? ""
  let q = gate.supabase
    .from("org_service_contracts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: false })

  if (customerId && UUID_RE.test(customerId)) {
    q = q.eq("customer_id", customerId)
  }

  const { data, error } = await q
  if (error) return jsonError(error.message, 500)

  return NextResponse.json({ contracts: data ?? [] })
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

  const customerId = typeof body.customer_id === "string" ? body.customer_id.trim() : ""
  if (!UUID_RE.test(customerId)) return jsonError("customer_id is required.", 400)

  const contract_name =
    typeof body.contract_name === "string" ? body.contract_name.trim() : ""
  if (contract_name.length < 1) return jsonError("contract_name is required.", 400)

  const start_date = typeof body.start_date === "string" ? body.start_date.trim().slice(0, 10) : ""
  const end_date = typeof body.end_date === "string" ? body.end_date.trim().slice(0, 10) : ""
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || !/^\d{4}-\d{2}-\d{2}$/.test(end_date)) {
    return jsonError("start_date and end_date must be YYYY-MM-DD.", 400)
  }
  if (end_date < start_date) return jsonError("end_date must be on or after start_date.", 400)

  const statusRaw = typeof body.status === "string" ? body.status.trim().toLowerCase() : "draft"
  const status = (STATUS_SET.has(statusRaw as ServiceContractStatusDb) ? statusRaw : "draft") as ServiceContractStatusDb

  const coverageRaw =
    typeof body.coverage_type === "string" ? body.coverage_type.trim().toLowerCase() : "full_service"
  const coverage_type = (
    COVERAGE_SET.has(coverageRaw as ServiceContractCoverageTypeDb) ? coverageRaw : "full_service"
  ) as ServiceContractCoverageTypeDb

  let customer_location_id: string | null = null
  if (body.customer_location_id === null) {
    customer_location_id = null
  } else if (typeof body.customer_location_id === "string" && UUID_RE.test(body.customer_location_id.trim())) {
    customer_location_id = body.customer_location_id.trim()
  }

  let equipment_id: string | null = null
  if (body.equipment_id === null) {
    equipment_id = null
  } else if (typeof body.equipment_id === "string" && UUID_RE.test(body.equipment_id.trim())) {
    equipment_id = body.equipment_id.trim()
  }

  const contract_number =
    typeof body.contract_number === "string" && body.contract_number.trim()
      ? body.contract_number.trim().slice(0, 120)
      : null

  const notes =
    typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 8000) : null

  const sla_response_hours =
    typeof body.sla_response_hours === "number" && body.sla_response_hours > 0
      ? Math.round(body.sla_response_hours)
      : null
  const sla_resolution_hours =
    typeof body.sla_resolution_hours === "number" && body.sla_resolution_hours > 0
      ? Math.round(body.sla_resolution_hours)
      : null

  const { data: cust } = await gate.supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()

  if (!cust) return jsonError("Customer not found.", 404)

  if (customer_location_id) {
    const { data: loc } = await gate.supabase
      .from("customer_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("id", customer_location_id)
      .maybeSingle()
    if (!loc) return jsonError("customer_location_id does not belong to this customer.", 400)
  }

  if (equipment_id) {
    const { data: eq } = await gate.supabase
      .from("equipment")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .eq("id", equipment_id)
      .maybeSingle()
    if (!eq) return jsonError("equipment_id does not belong to this customer.", 400)
  }

  const row = {
    organization_id: organizationId,
    customer_id: customerId,
    customer_location_id,
    equipment_id,
    contract_name,
    contract_number,
    start_date,
    end_date,
    status,
    coverage_type,
    sla_response_hours,
    sla_resolution_hours,
    notes,
  }

  const { data: inserted, error } = await gate.supabase
    .from("org_service_contracts")
    .insert(row)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 400)

  return NextResponse.json({ contract: inserted })
}
