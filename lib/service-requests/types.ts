export type ServiceRequestStatus =
  | "new"
  | "reviewing"
  | "needs_info"
  | "approved"
  | "converted"
  | "declined"
  | "archived"

export type ServiceRequestSource = "internal" | "portal" | "public_link"

export type ServiceRequestUrgency = "low" | "normal" | "high" | "critical"

export type InternalNoteEntry = {
  at: string
  user_id: string
  text: string
}
