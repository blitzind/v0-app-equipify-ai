import { normalizeTimeForDb } from "@/lib/work-orders/db-map"

/** Persist helper — maps DB status transitions when assigning schedule + technician. */
export function buildSchedulePatch(args: {
  scheduledOn: string
  scheduledTimeHhMm: string | null
  assignedUserId: string | null
  previousStatus: string
}) {
  const patch: Record<string, unknown> = {
    scheduled_on: args.scheduledOn,
    scheduled_time:
      args.scheduledTimeHhMm != null ? normalizeTimeForDb(args.scheduledTimeHhMm) : null,
    assigned_user_id: args.assignedUserId,
    updated_at: new Date().toISOString(),
  }
  if (args.assignedUserId && args.previousStatus === "open") {
    patch.status = "scheduled"
  }
  return patch
}
