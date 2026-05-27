import { normalizeTimeForDb } from "@/lib/work-orders/db-map"

/** Persist helper — maps DB status transitions when assigning schedule + technician. */
export function buildSchedulePatch(args: {
  scheduledOn: string
  scheduledTimeHhMm: string | null
  scheduledEndTimeHhMm?: string | null
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
    scheduled_end_time:
      args.scheduledEndTimeHhMm != null && args.scheduledEndTimeHhMm.trim()
        ? normalizeTimeForDb(args.scheduledEndTimeHhMm)
        : null,
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

/** Update schedule fields while keeping existing assignment columns (bulk date/time edits). */
export function buildDispatchPreserveAssignmentSchedulePatch(args: {
  assigned_technician_id: string | null | undefined
  assigned_user_id: string | null | undefined
  scheduledOn: string
  scheduledTimeHhMm: string | null
  scheduledEndTimeHhMm?: string | null
}) {
  return {
    scheduled_on: args.scheduledOn,
    scheduled_time:
      args.scheduledTimeHhMm != null ? normalizeTimeForDb(args.scheduledTimeHhMm) : null,
    scheduled_end_time:
      args.scheduledEndTimeHhMm != null && args.scheduledEndTimeHhMm.trim()
        ? normalizeTimeForDb(args.scheduledEndTimeHhMm)
        : null,
    assigned_technician_id: args.assigned_technician_id ?? null,
    assigned_user_id: args.assigned_user_id ?? null,
    updated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>
}

/**
 * Set time only; keeps assignment. Uses the work order's existing `scheduled_on`, or
 * `fallbackDateYmd` when the row has no date yet.
 */
export function buildDispatchTimeOnlyPatch(args: {
  assigned_technician_id: string | null | undefined
  assigned_user_id: string | null | undefined
  scheduled_on: string | null | undefined
  fallbackDateYmd: string
  scheduledTimeHhMm: string | null
  scheduledEndTimeHhMm?: string | null
}) {
  const head = args.scheduled_on?.trim()
  const on =
    head && head.length >= 10 ? head.slice(0, 10) : args.fallbackDateYmd.trim().slice(0, 10)
  return {
    scheduled_on: on,
    scheduled_time:
      args.scheduledTimeHhMm != null ? normalizeTimeForDb(args.scheduledTimeHhMm) : null,
    scheduled_end_time:
      args.scheduledEndTimeHhMm != null && args.scheduledEndTimeHhMm.trim()
        ? normalizeTimeForDb(args.scheduledEndTimeHhMm)
        : null,
    assigned_technician_id: args.assigned_technician_id ?? null,
    assigned_user_id: args.assigned_user_id ?? null,
    updated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>
}

/** Clear both assignment FKs; leaves schedule + status unchanged (dispatcher may reassign the same window). */
export function buildDispatchUnassignPatch() {
  return {
    assigned_technician_id: null,
    assigned_user_id: null,
    updated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>
}

export function buildDispatchStatusOnlyPatch(nextStatus: string) {
  return {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  } satisfies Record<string, unknown>
}
