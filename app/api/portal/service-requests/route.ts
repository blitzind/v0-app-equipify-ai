import { NextResponse } from "next/server"
import { getRequestMeta, requirePortalSession } from "@/lib/portal/require-portal-session"
import { logPortalActivity } from "@/lib/portal/activity-log"
import { portalDisplayStatus } from "@/lib/service-requests/portal-display-status"
import { logServiceRequestTimeline } from "@/lib/service-requests/log-communication"
import type { ServiceRequestStatus } from "@/lib/service-requests/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PostBody = {
  issue_summary?: string
  description?: string | null
  message?: string
  equipmentId?: string | null
  customerLocationId?: string | null
  urgency?: string | null
  preferred_service_window?: string | null
}

function mapUrgency(raw: string | null | undefined): string {
  const u = (raw ?? "normal").trim().toLowerCase()
  if (u === "low" || u === "normal" || u === "high" || u === "critical") return u
  const cap = (raw ?? "").trim()
  if (cap === "Low") return "low"
  if (cap === "High") return "high"
  if (cap === "Critical") return "critical"
  return "normal"
}

export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  const { data: fullRows, error } = await svc
    .from("org_service_requests")
    .select("id, issue_summary, urgency, status, created_at")
    .eq("organization_id", portalUser.organization_id)
    .eq("customer_id", portalUser.customer_id)
    .eq("portal_user_id", portalUser.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const items = (fullRows ?? []).map((r) => {
    const row = r as {
      id: string
      issue_summary: string
      urgency: string
      status: string
      created_at: string
    }
    return {
      id: row.id,
      issue_summary: row.issue_summary,
      urgency: row.urgency,
      created_at: row.created_at,
      /** Customer-safe status — internal workflow is not exposed. */
      status_label: portalDisplayStatus(row.status as ServiceRequestStatus),
    }
  })

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  let body: PostBody
  try {
    body = (await request.json()) as PostBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  let issue_summary = typeof body.issue_summary === "string" ? body.issue_summary.trim() : ""
  const description =
    typeof body.description === "string" ? body.description.trim() : typeof body.message === "string" ?
      body.message.trim()
    : ""

  if (!issue_summary && description) {
    const firstLine = description.split("\n").map((l) => l.trim()).find(Boolean) ?? description
    issue_summary = firstLine.slice(0, 200)
  }

  if (!issue_summary || issue_summary.length < 3) {
    return NextResponse.json({ error: "Please add a short summary of the issue." }, { status: 400 })
  }

  if (description.length < 5) {
    return NextResponse.json({ error: "Please describe the issue (at least a few words)." }, { status: 400 })
  }

  if (description.length > 8000) {
    return NextResponse.json({ error: "Description is too long." }, { status: 400 })
  }

  const { svc, portalUser } = ctx

  let equipmentId: string | null = null
  let equipmentCustomerLocationId: string | null = null
  if (body.equipmentId && UUID_RE.test(String(body.equipmentId))) {
    const { data: eq } = await svc
      .from("equipment")
      .select("id, customer_location_id")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("id", body.equipmentId)
      .eq("is_archived", false)
      .maybeSingle()
    if (eq) {
      equipmentId = (eq as { id: string }).id
      equipmentCustomerLocationId = (eq as { customer_location_id: string | null }).customer_location_id
    }
  }

  let customerLocationId: string | null = null
  const locCandidate =
    typeof body.customerLocationId === "string" && UUID_RE.test(body.customerLocationId.trim()) ?
      body.customerLocationId.trim()
    : null
  if (locCandidate) {
    const { data: loc } = await svc
      .from("customer_locations")
      .select("id")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("id", locCandidate)
      .is("archived_at", null)
      .maybeSingle()
    if (loc) customerLocationId = locCandidate
  }
  if (!customerLocationId && equipmentCustomerLocationId && UUID_RE.test(equipmentCustomerLocationId)) {
    const { data: locOk } = await svc
      .from("customer_locations")
      .select("id")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("id", equipmentCustomerLocationId)
      .is("archived_at", null)
      .maybeSingle()
    if (locOk) customerLocationId = equipmentCustomerLocationId
  }
  if (!customerLocationId) {
    const { data: defLoc } = await svc
      .from("customer_locations")
      .select("id")
      .eq("organization_id", portalUser.organization_id)
      .eq("customer_id", portalUser.customer_id)
      .eq("is_default", true)
      .is("archived_at", null)
      .maybeSingle()
    customerLocationId = (defLoc as { id: string } | null)?.id ?? null
  }

  const urgency = mapUrgency(body.urgency ?? null)
  const preferred =
    typeof body.preferred_service_window === "string" ? body.preferred_service_window.trim().slice(0, 500) : null

  const { data: inserted, error: insErr } = await svc
    .from("org_service_requests")
    .insert({
      organization_id: portalUser.organization_id,
      customer_id: portalUser.customer_id,
      customer_location_id: customerLocationId,
      equipment_id: equipmentId,
      portal_user_id: portalUser.id,
      requester_name: portalUser.display_name,
      requester_email: portalUser.email,
      requester_phone: null,
      issue_summary: issue_summary.slice(0, 500),
      description: description.slice(0, 8000),
      urgency,
      preferred_service_window: preferred,
      attachments: [],
      status: "new",
      source: "portal",
      assigned_to_user_id: null,
      converted_work_order_id: null,
      converted_customer_id: null,
      converted_equipment_id: null,
      internal_notes_log: [],
      created_by_user_id: null,
      is_sample: false,
    })
    .select("id")
    .maybeSingle()

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  const newId = (inserted as { id: string } | null)?.id
  if (newId) {
    await logServiceRequestTimeline({
      supabase: svc,
      organizationId: portalUser.organization_id,
      serviceRequestId: newId,
      customerId: portalUser.customer_id,
      title: "Portal service request received",
      summary: issue_summary.slice(0, 300),
      eventType: "service_request_received",
      createdBy: null,
      metadata: { portal_user_id: portalUser.id },
    })
  }

  const meta = await getRequestMeta()
  await logPortalActivity(svc, {
    organizationId: portalUser.organization_id,
    portalUserId: portalUser.id,
    action: "service_request_submitted",
    path: "/api/portal/service-requests",
    metadata: {
      service_request_id: newId,
      equipmentId,
      urgency,
    },
    ip: meta.ip,
    userAgent: meta.userAgent,
  })

  return NextResponse.json({
    ok: true,
    id: newId,
    message: "Your request was submitted. The service team will follow up shortly.",
  })
}
