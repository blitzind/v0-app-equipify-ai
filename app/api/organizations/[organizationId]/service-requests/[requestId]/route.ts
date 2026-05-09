import { NextResponse } from "next/server"
import { requireAnyOrgPermission, requireOrgPermission } from "@/lib/api/require-org-permission"
import { hasOrgPermission } from "@/lib/permissions/model"
import type { InternalNoteEntry } from "@/lib/service-requests/types"
import { logServiceRequestTimeline } from "@/lib/service-requests/log-communication"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string; requestId: string }> },
) {
  const { organizationId, requestId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(requestId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManageDispatch",
    "canViewAllWorkOrders",
    "canViewOperationalReports",
    "canViewAssignedWorkOrdersOnly",
  ])
  if ("error" in gate) return gate.error

  const { data: row, error } = await gate.supabase
    .from("org_service_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  if (!row) return jsonError("Not found.", 404)

  const techScoped =
    hasOrgPermission(gate.permissions, "canViewAssignedWorkOrdersOnly") &&
    !hasOrgPermission(gate.permissions, "canViewAllWorkOrders")

  if (techScoped) {
    if ((row as { assigned_to_user_id: string | null }).assigned_to_user_id !== gate.userId) {
      return jsonError("Not found.", 404)
    }
  }

  return NextResponse.json({ request: row })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; requestId: string }> },
) {
  const { organizationId, requestId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(requestId)) {
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
    .from("org_service_requests")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .maybeSingle()

  if (exErr) return jsonError(exErr.message, 500)
  if (!existing) return jsonError("Not found.", 404)

  const prevStatus = (existing as { status: string }).status
  const patch: Record<string, unknown> = {}

  if (typeof body.status === "string") {
    const allowed = ["new", "reviewing", "needs_info", "approved", "converted", "declined", "archived"]
    if (!allowed.includes(body.status)) return jsonError("Invalid status.", 400)
    patch.status = body.status
  }

  if (body.assigned_to_user_id === null) {
    patch.assigned_to_user_id = null
  } else if (typeof body.assigned_to_user_id === "string" && UUID_RE.test(body.assigned_to_user_id.trim())) {
    patch.assigned_to_user_id = body.assigned_to_user_id.trim()
  }

  const noteText = typeof body.internal_note_text === "string" ? body.internal_note_text.trim() : ""
  let nextLog = (existing as { internal_notes_log?: unknown }).internal_notes_log
  if (!Array.isArray(nextLog)) nextLog = []
  if (noteText.length > 0) {
    const entry: InternalNoteEntry = {
      at: new Date().toISOString(),
      user_id: gate.userId,
      text: noteText.slice(0, 4000),
    }
    nextLog = [...nextLog, entry]
    patch.internal_notes_log = nextLog

    await logServiceRequestTimeline({
      supabase: gate.supabase,
      organizationId,
      serviceRequestId: requestId,
      customerId: (existing as { customer_id: string | null }).customer_id,
      title: "Internal note on service request",
      summary: noteText.slice(0, 280),
      body: noteText.slice(0, 8000),
      eventType: "service_request_internal_note",
      createdBy: gate.userId,
    })
  }

  if (Object.keys(patch).length === 0) {
    return jsonError("No valid fields to update.", 400)
  }

  const { data: updated, error } = await gate.supabase
    .from("org_service_requests")
    .update(patch)
    .eq("organization_id", organizationId)
    .eq("id", requestId)
    .select("*")
    .maybeSingle()

  if (error) return jsonError(error.message, 500)

  const newStatus = (updated as { status: string }).status
  if (newStatus === "needs_info" && prevStatus !== "needs_info") {
    await logServiceRequestTimeline({
      supabase: gate.supabase,
      organizationId,
      serviceRequestId: requestId,
      customerId: (existing as { customer_id: string | null }).customer_id,
      title: "Service request needs more information",
      summary: "Dispatch marked this request as awaiting customer or site details.",
      eventType: "service_request_needs_info",
      createdBy: gate.userId,
    })
  }

  return NextResponse.json({ request: updated })
}
