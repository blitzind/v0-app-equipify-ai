import { normalizeTimeForDb } from "@/lib/work-orders/db-map"

/** Persist helper — maps DB status transitions when assigning schedule + technician. */
export function buildSchedulePatch(args: {
  scheduledOn: string
  scheduledTimeHhMm: string | null
  previousStatus: string
  /** Legacy: selection is auth user id only (pre-technicians table). */
  assignedUserId?: string | null
  /** Prefer this when resolved via `workOrderAssignmentColumns` (technician row id or legacy user id). */
  assignment?: { assigned_technician_id: string | null; assigned_user_id: string | null }
}) {
  const resolved =
    args.assignment ??
    ({
      assigned_technician_id: null,
      assigned_user_id: args.assignedUserId ?? null,
    } satisfies { assigned_technician_id: string | null; assigned_user_id: string | null })

  const patch: Record<string, unknown> = {
    scheduled_on: args.scheduledOn,
    scheduled_time:
      args.scheduledTimeHhMm != null ? normalizeTimeForDb(args.scheduledTimeHhMm) : null,
    assigned_technician_id: resolved.assigned_technician_id,
    assigned_user_id: resolved.assigned_user_id,
    updated_at: new Date().toISOString(),
  }
  const hasAssignee =
    Boolean(resolved.assigned_technician_id) || Boolean(resolved.assigned_user_id)
  if (hasAssignee && args.previousStatus === "open") {
    patch.status = "scheduled"
  }
  return patch
}
