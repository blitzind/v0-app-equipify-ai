import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { findCustomersByRequesterIdentity } from "@/lib/service-requests/customer-dedupe"
import { logServiceRequestTimeline } from "@/lib/service-requests/log-communication"
import { logCommunicationEvent } from "@/lib/notifications/log-event"
import { resolveCustomerLocationIdForWorkOrder } from "@/lib/customer-locations/resolve-for-work-order"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

type CreateCustomerPayload = {
  company_name: string
  contact_name?: string
  email?: string
  phone?: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string; requestId: string }> },
) {
  const { organizationId, requestId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(requestId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canManageDispatch")
  if ("error" in gate) return gate.error

  let body: {
    confirm?: boolean
    customer_id?: string | null
    create_customer?: CreateCustomerPayload | null
    force_create_customer?: boolean
    customer_location_id?: string | null
    equipment_id?: string | null
    create_equipment?: { name: string } | null
    work_order?: {
      title: string
      priority?: string
      type?: string
      problem_reported?: string
    }
    save_communication_draft?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return jsonError("Invalid JSON.", 400)
  }

  if (body.confirm !== true) {
    return jsonError('Set confirm: true after reviewing the request — work orders are not created automatically.', 400)
  }

  const { data: reqRow, error: rErr } = await gate.supabase
    .from("org_service_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle()

  if (rErr) return jsonError(rErr.message, 500)
  if (!reqRow) return jsonError("Request not found.", 404)

  if ((reqRow as { status: string }).status === "converted") {
    return jsonError("This request was already converted.", 409)
  }

  const sr = reqRow as {
    customer_id: string | null
    requester_email: string | null
    requester_name: string | null
    issue_summary: string
    description: string | null
  }

  let customerId = typeof body.customer_id === "string" && UUID_RE.test(body.customer_id.trim()) ?
      body.customer_id.trim()
    : sr.customer_id

  if (!customerId && body.create_customer?.company_name?.trim()) {
    const cc = body.create_customer
    const email = typeof cc.email === "string" ? cc.email.trim() : ""
    const company = cc.company_name.trim()
    const matches = await findCustomersByRequesterIdentity(
      gate.supabase,
      organizationId,
      email || sr.requester_email,
      company,
    )
    if (matches.length > 0 && !body.force_create_customer) {
      return jsonError(
        "Possible duplicate customers found. Pick an existing customer or pass force_create_customer: true.",
        409,
        { matches },
      )
    }

    const { data: custIns, error: cErr } = await gate.supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        company_name: company.slice(0, 240),
        status: "active",
        notes: "Created from service request intake.",
        created_by: gate.userId,
      })
      .select("id")
      .maybeSingle()

    if (cErr) return jsonError(cErr.message, 500)
    customerId = (custIns as { id: string } | null)?.id ?? null
    if (!customerId) return jsonError("Could not create customer.", 500)

    const contactName =
      (typeof cc.contact_name === "string" && cc.contact_name.trim()) ||
      sr.requester_name ||
      "Primary contact"
    const { error: ctErr } = await gate.supabase.from("customer_contacts").insert({
      organization_id: organizationId,
      customer_id: customerId,
      full_name: contactName.slice(0, 200),
      email: email || sr.requester_email || null,
      phone: typeof cc.phone === "string" ? cc.phone.trim() || null : null,
      is_primary: true,
    })
    if (ctErr) return jsonError(ctErr.message, 500)
  }

  if (!customerId) {
    return jsonError("customer_id or create_customer is required to open a work order.", 400)
  }

  const { data: custOk } = await gate.supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("id", customerId)
    .maybeSingle()
  if (!custOk) return jsonError("Customer not found in organization.", 400)

  let equipmentId: string | null =
    typeof body.equipment_id === "string" && UUID_RE.test(body.equipment_id.trim()) ?
      body.equipment_id.trim()
    : null

  if (equipmentId) {
    const { data: eq } = await gate.supabase
      .from("equipment")
      .select("id, customer_id")
      .eq("organization_id", organizationId)
      .eq("id", equipmentId)
      .maybeSingle()
    if (!eq) return jsonError("Equipment not found.", 400)
    if ((eq as { customer_id: string }).customer_id !== customerId) {
      return jsonError("Equipment does not belong to the selected customer.", 400)
    }
  }

  if (!equipmentId && body.create_equipment?.name?.trim()) {
    const nm = body.create_equipment.name.trim().slice(0, 240)
    const { data: eqIns, error: eqErr } = await gate.supabase
      .from("equipment")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        name: nm,
        status: "active",
        notes: "Created from service request intake.",
        created_by: gate.userId,
      })
      .select("id")
      .maybeSingle()
    if (eqErr) return jsonError(eqErr.message, 500)
    equipmentId = (eqIns as { id: string } | null)?.id ?? null
  }

  const wo = body.work_order
  const title =
    typeof wo?.title === "string" && wo.title.trim().length > 0 ?
      wo.title.trim().slice(0, 500)
    : sr.issue_summary.slice(0, 500)

  const priority =
    typeof wo?.priority === "string" && ["low", "normal", "high", "critical"].includes(wo.priority) ?
      wo.priority
    : "normal"

  const type =
    typeof wo?.type === "string" &&
    ["repair", "pm", "inspection", "install", "emergency"].includes(wo.type) ?
      wo.type
    : "repair"

  const problem_reported =
    typeof wo?.problem_reported === "string" && wo.problem_reported.trim().length > 0 ?
      wo.problem_reported.trim().slice(0, 4000)
    : sr.issue_summary

  const notesParts = [
    `Converted from service request ${requestId}.`,
    sr.description ? `Original description:\n${sr.description}` : null,
  ].filter(Boolean)
  const notes = notesParts.join("\n\n").slice(0, 12000)

  const repairLog = {
    problemReported: problem_reported,
    diagnosis: "",
    partsUsed: [],
    laborHours: 0,
    technicianNotes: "",
    photos: [],
    signatureDataUrl: "",
    signedBy: "",
    signedAt: "",
    tasks: [],
  }

  const srLocationId = (reqRow as { customer_location_id?: string | null }).customer_location_id ?? null
  const resolvedLocationId = await resolveCustomerLocationIdForWorkOrder(
    gate.supabase,
    organizationId,
    customerId,
    {
      explicit: body.customer_location_id,
      equipmentId,
      fallbackFromRequest: srLocationId,
    },
  )

  const { data: woIns, error: woErr } = await gate.supabase
    .from("work_orders")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      customer_location_id: resolvedLocationId,
      equipment_id: equipmentId,
      title,
      status: "open",
      priority,
      type,
      problem_reported,
      notes,
      repair_log: repairLog,
      created_by: gate.userId,
    })
    .select("id, work_order_number")
    .maybeSingle()

  if (woErr) return jsonError(woErr.message, 500)
  const woId = (woIns as { id: string } | null)?.id
  if (!woId) return jsonError("Work order insert failed.", 500)

  const { error: upErr } = await gate.supabase
    .from("org_service_requests")
    .update({
      status: "converted",
      customer_id: customerId,
      customer_location_id:
        typeof body.customer_location_id === "string" && UUID_RE.test(body.customer_location_id.trim()) ?
          body.customer_location_id.trim()
        : (reqRow as { customer_location_id: string | null }).customer_location_id,
      equipment_id: equipmentId,
      converted_work_order_id: woId,
      converted_customer_id: customerId,
      converted_equipment_id: equipmentId,
    })
    .eq("organization_id", organizationId)
    .eq("id", requestId)

  if (upErr) return jsonError(upErr.message, 500)

  await logServiceRequestTimeline({
    supabase: gate.supabase,
    organizationId,
    serviceRequestId: requestId,
    customerId,
    title: "Service request converted to work order",
    summary: title.slice(0, 280),
    body: `Work order ${woId}`,
    eventType: "service_request_converted",
    createdBy: gate.userId,
    metadata: { work_order_id: woId },
  })

  if (body.save_communication_draft) {
    await logCommunicationEvent(gate.supabase, {
      organizationId,
      channel: "email",
      direction: "outbound",
      eventType: "communication_draft",
      title: `Follow-up: ${title.slice(0, 200)}`,
      summary: "Draft from service request conversion (not sent).",
      body: null,
      audience: "organization",
      countsTowardUnread: false,
      deliveryStatus: "pending",
      recipientKind: "customer",
      recipientCustomerId: customerId,
      relatedEntityType: "work_order",
      relatedEntityId: woId,
      provider: "manual",
      metadata: {
        is_draft: true,
        source: "service_request_convert",
        service_request_id: requestId,
        drafted_by: gate.userId,
        drafted_at: new Date().toISOString(),
      },
      createdBy: gate.userId,
    })
  }

  return NextResponse.json({
    ok: true,
    work_order_id: woId,
    work_order_number: (woIns as { work_order_number?: number | null }).work_order_number ?? null,
    customer_id: customerId,
    equipment_id: equipmentId,
  })
}
