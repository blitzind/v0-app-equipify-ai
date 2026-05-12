/** Shared preview types for AIden `schedule_maintenance_visit` (client + server). */

import type { WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"

export type ScheduleMaintenanceVisitPreviewCustomer = {
  id: string
  companyName: string
  billingAddressLine1: string | null
  billingCity: string | null
  billingState: string | null
  billingPostalCode: string | null
}

export type ScheduleMaintenanceVisitPreviewEquipment = {
  id: string
  name: string
  serialNumber: string | null
}

export type ScheduleMaintenanceVisitPreviewPayload = {
  customer: ScheduleMaintenanceVisitPreviewCustomer
  /** One-line service address for staff. */
  locationSummary: string
  equipment: ScheduleMaintenanceVisitPreviewEquipment | null
  serviceTypeUi: WorkOrderType
  priorityUi: WorkOrderPriority
  serviceReason: string
  durationMinutes: number | null
  /** YYYY-MM-DD; required before execute (user may fill in preview). */
  suggestedDate: string
  /** HH:MM 24h style for display; stored with normalizeTimeForDb. */
  suggestedTime: string
  /** True when the date was inferred (e.g. plan next due) vs parsed from the user message. */
  dateSuggested: boolean
  technicianSelectionId: string | null
  technicianLabel: string | null
  notes: string
  maintenancePlanId: string | null
}
