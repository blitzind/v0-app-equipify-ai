/** Technician mobile push alert types — stored in communication_events.event_type and metadata. */
export const TECHNICIAN_PUSH_ALERT_TYPES = [
  "work_assigned",
  "schedule_changed",
  "urgent_callback",
  "notes_added",
  "signature_needed",
] as const

export type TechnicianPushAlertType = (typeof TECHNICIAN_PUSH_ALERT_TYPES)[number]

export function isTechnicianPushAlertType(value: string): value is TechnicianPushAlertType {
  return (TECHNICIAN_PUSH_ALERT_TYPES as readonly string[]).includes(value)
}
