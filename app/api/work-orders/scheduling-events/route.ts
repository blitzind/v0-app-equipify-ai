import { NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { canAccessAssignedWorkResource, isAssignedWorkOnly } from "@/lib/permissions/technician-scope"
import {
  listSchedulingEventsForWorkOrder,
  recordSchedulingEvent,
  type SchedulingEventInput,
  type SchedulingEventSeverity,
  type SchedulingEventType,
} from "@/lib/dispatch/scheduling-events"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED_TYPES = new Set<SchedulingEventType>([
  "note",
  "reschedule",
  "reassign",
  "unassign",
  "quick_add",
  "conflict_acknowledged",
  "system_observation",
])

const ALLOWED_SEVERITY = new Set<SchedulingEventSeverity>(["info", "warning", "critical"])

/**
 * Phase 2: scheduling notes / actions log API for dispatch + service-schedule.
 *
 * Additive: nothing in dispatch persistence (`work_orders` updates) calls this
 * route. Operators (and future timeline UIs) write here when they want to
 * capture context — e.g. "Customer requested earlier slot", "Conflict
 * acknowledged: Sandra has 2 jobs at 09:00, this one is short".
 *
 * RLS enforced via the caller's Supabase session (no service-role bypass);
 * `is_org_member` + `has_org_role(['owner','admin','manager','tech'])` gate
 * inserts in the migration policy.
 */

export async function GET(request: NextRequest) {
  const workOrderId = request.nextUrl.searchParams.get("workOrderId")?.trim() ?? ""
  if (!UUID_RE.test(workOrderId)) {
    return NextResponse.json({ error: "Invalid workOrderId" }, { status: 400 })
  }
  const limitParam = Number.parseInt(
    request.nextUrl.searchParams.get("limit") ?? "",
    10,
  )
  const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 100)) : 25

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: wo } = await supabase
    .from("work_orders")
    .select("id, organization_id")
    .eq("id", workOrderId)
    .maybeSingle()
  const workOrder = wo as { id: string; organization_id: string } | null
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  const capGate = await requireAnyOrgPermission(workOrder.organization_id, [
    "canViewAllWorkOrders",
    "canViewAssignedWorkOrdersOnly",
    "canManageDispatch",
  ])
  if ("error" in capGate) return capGate.error
  const allowedWorkOrder = await canAccessAssignedWorkResource(supabase, {
    organizationId: workOrder.organization_id,
    userId: user.id,
    permissions: capGate.permissions,
    resource: { workOrderId },
  })
  if (!allowedWorkOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }

  const events = await listSchedulingEventsForWorkOrder(supabase, workOrderId, limit)
  return NextResponse.json({ events })
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Partial<SchedulingEventInput> & { workOrderId?: string } = {}
  try {
    body = (await request.json()) as Partial<SchedulingEventInput> & { workOrderId?: string }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const organizationId = body.organizationId?.trim() ?? ""
  const workOrderId = (body.workOrderId ?? body.workOrderId)?.toString().trim() ?? ""
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "Invalid organizationId" }, { status: 400 })
  }
  if (!UUID_RE.test(workOrderId)) {
    return NextResponse.json({ error: "Invalid workOrderId" }, { status: 400 })
  }

  // Phase 2 (Permissions): scheduling notes / actions are mutations against
  // the work order timeline. Allow techs to add their own notes (canEditWorkOrders)
  // and dispatch managers (canManageDispatch) — viewers stay read-only.
  const capGate = await requireAnyOrgPermission(organizationId, [
    "canEditWorkOrders",
    "canManageDispatch",
  ])
  if ("error" in capGate) return capGate.error
  const eventType = (body.eventType ?? "note") as SchedulingEventType
  if (!ALLOWED_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Invalid eventType" }, { status: 400 })
  }
  const assignedOnly = isAssignedWorkOnly(capGate.permissions)
  const allowedWorkOrder = await canAccessAssignedWorkResource(supabase, {
    organizationId,
    userId: user.id,
    permissions: capGate.permissions,
    resource: { workOrderId },
  })
  if (!allowedWorkOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 })
  }
  if (assignedOnly && eventType !== "note") {
    return NextResponse.json(
      { error: "insufficient_permissions", message: "Technicians can add notes only on assigned schedule records." },
      { status: 403 },
    )
  }
  const severity = (body.severity ?? "info") as SchedulingEventSeverity
  if (!ALLOWED_SEVERITY.has(severity)) {
    return NextResponse.json({ error: "Invalid severity" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 })
  }

  const event = await recordSchedulingEvent(supabase, {
    organizationId,
    workOrderId,
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    actorKind: "operator",
    eventType,
    severity,
    message,
    metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  })

  if (!event) {
    return NextResponse.json(
      { error: "Could not record scheduling event (RLS or table unavailable)" },
      { status: 403 },
    )
  }

  return NextResponse.json({ event }, { status: 201 })
}
