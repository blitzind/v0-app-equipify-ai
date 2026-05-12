/** Shared preview types for AIden `create_follow_up_task` (client + server). */

export type CreateFollowUpTaskEntityType =
  | "customer"
  | "work_order"
  | "invoice"
  | "quote"
  | "equipment"
  | "maintenance_plan"
  | "prospect"

export type CreateFollowUpTaskPreviewRecord = {
  entityType: CreateFollowUpTaskEntityType
  entityId: string
  label: string
  customerId: string | null
  customerName: string | null
}

export type CreateFollowUpTaskPreviewPayload = {
  title: string
  notes: string
  /** Calendar date YYYY-MM-DD (local intent; stored as scheduled_for noon UTC). */
  dueDate: string
  /** ISO timestamp written to `follow_up_tasks.scheduled_for`. */
  scheduledForIso: string
  assigneeUserId: string | null
  assigneeLabel: string | null
  reason: string
  relatedRecord: CreateFollowUpTaskPreviewRecord
}
