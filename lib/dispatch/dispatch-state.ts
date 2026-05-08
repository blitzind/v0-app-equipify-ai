export type DispatchStateInput = {
  status?: string | null
  customerId?: string | null
  scheduledOn?: string | null
  scheduledTime?: string | null
  assignedUserId?: string | null
  assignedTechnicianId?: string | null
  archivedAt?: string | null
}

export type DispatchState = {
  label: "Unscheduled" | "Scheduled" | "In progress" | "Completed" | "Invoiced" | "Canceled"
  needsAssignment: boolean
  needsScheduling: boolean
  readyToDispatch: boolean
  dispatchIncomplete: boolean
  overdueUnscheduled: boolean
}

const ACTIVE_STATUSES = new Set(["open", "scheduled", "in_progress"])

function ymdToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function deriveDispatchState(input: DispatchStateInput): DispatchState {
  const status = (input.status ?? "").trim().toLowerCase()
  const hasAssignee = Boolean(input.assignedUserId || input.assignedTechnicianId)
  const hasDate = Boolean(input.scheduledOn?.trim())
  const hasTime = Boolean(input.scheduledTime?.trim())
  const active = ACTIVE_STATUSES.has(status)
  const needsAssignment = active && !hasAssignee
  const needsScheduling = active && (!hasDate || !hasTime)
  const overdueUnscheduled = active && (!hasDate || (input.scheduledOn ?? "") < ymdToday())
  const readyToDispatch = Boolean(input.customerId) && active && (needsAssignment || needsScheduling)

  let label: DispatchState["label"] = "Unscheduled"
  if (input.archivedAt || status === "cancelled" || status === "canceled") label = "Canceled"
  else if (status === "invoiced") label = "Invoiced"
  else if (status === "completed" || status === "completed_pending_signature") label = "Completed"
  else if (status === "in_progress") label = "In progress"
  else if (hasDate || hasAssignee || status === "scheduled") label = "Scheduled"

  return {
    label,
    needsAssignment,
    needsScheduling,
    readyToDispatch,
    dispatchIncomplete: active && (needsAssignment || needsScheduling),
    overdueUnscheduled,
  }
}
