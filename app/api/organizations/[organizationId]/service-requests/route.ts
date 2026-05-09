import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  canReadServiceRequestQueue,
  filterServiceRequestsForMember,
} from "@/lib/service-requests/list-filter"
import { findCustomersByRequesterIdentity } from "@/lib/service-requests/customer-dedupe"
import { logServiceRequestTimeline } from "@/lib/service-requests/log-communication"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManageDispatch",
    "canViewAllWorkOrders",
    "canViewOperationalReports",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  if (!canReadServiceRequestQueue(gate.permissions)) {
    return jsonError("You do not have access to service requests.", 403)
  }

  const sp = new URL(request.url).searchParams
  const status = sp.get("status")?.trim()
  const urgency = sp.get("urgency")?.trim()
  const source = sp.get("source")?.trim()

  let q = gate.supabase
    .from("org_service_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (status && status !== "all") q = q.eq("status", status)
  if (urgency && urgency !== "all") q = q.eq("urgency", urgency)
  if (source && source !== "all") q = q.eq("source", source)

  const { data, error } = await q
  if (error) return jsonError(error.message, 500)

  const filtered = filterServiceRequestsForMember(data ?? [], gate.permissions, gate.userId)
  return NextResponse.json({ requests: filtered })
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

  const issue_summary = typeof body.issue_summary === "string" ? body.issue_summary.trim() : ""
  if (issue_summary.length < 3) return jsonError("issue_summary is required.", 400)

  const description = typeof body.description === "string" ? body.description.trim() : null
  const urgency =
    typeof body.urgency === "string" && ["low", "normal", "high", "critical"].includes(body.urgency)
      ? body.urgency
      : "normal"

  let customer_id: string | null =
    typeof body.customer_id === "string" && UUID_RE.test(body.customer_id.trim()) ?
      body.customer_id.trim()
    : null
  const customer_location_id =
    typeof body.customer_location_id === "string" && UUID_RE.test(body.customer_location_id.trim()) ?
      body.customer_location_id.trim()
    : null
  const equipment_id =
    typeof body.equipment_id === "string" && UUID_RE.test(body.equipment_id.trim()) ?
      body.equipment_id.trim()
    : null

  if (customer_id) {
    const { data: c } = await gate.supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("id", customer_id)
      .maybeSingle()
    if (!c) return jsonError("Customer not found.", 400)
  }

  const requester_name = typeof body.requester_name === "string" ? body.requester_name.trim() : null
  const requester_email = typeof body.requester_email === "string" ? body.requester_email.trim() : null
  const requester_phone = typeof body.requester_phone === "string" ? body.requester_phone.trim() : null
  const preferred_service_window =
    typeof body.preferred_service_window === "string" ? body.preferred_service_window.trim() : null

  if (!customer_id && requester_email) {
    const matches = await findCustomersByRequesterIdentity(
      gate.supabase,
      organizationId,
      requester_email,
      null,
    )
    if (matches.length === 1) customer_id = matches[0].customer_id
  }

  const insertRow = {
    organization_id: organizationId,
    customer_id,
    customer_location_id,
    equipment_id,
    portal_user_id: null,
    requester_name,
    requester_email,
    requester_phone,
    issue_summary: issue_summary.slice(0, 500),
    description: description ? description.slice(0, 12000) : null,
    urgency,
    preferred_service_window: preferred_service_window ? preferred_service_window.slice(0, 500) : null,
    attachments: Array.isArray(body.attachments) ? body.attachments : [],
    status: "new",
    source: "internal",
    assigned_to_user_id: null,
    converted_work_order_id: null,
    converted_customer_id: null,
    converted_equipment_id: null,
    internal_notes_log: [],
    created_by_user_id: gate.userId,
    is_sample: false,
  }

  const { data: row, error } = await gate.supabase
    .from("org_service_requests")
    .insert(insertRow)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  const id = (row as { id: string } | null)?.id
  if (!id) return jsonError("Insert failed.", 500)

  await logServiceRequestTimeline({
    supabase: gate.supabase,
    organizationId,
    serviceRequestId: id,
    customerId: customer_id,
    title: "Service request received",
    summary: issue_summary.slice(0, 300),
    eventType: "service_request_received",
    createdBy: gate.userId,
  })

  return NextResponse.json({ request: row })
}
