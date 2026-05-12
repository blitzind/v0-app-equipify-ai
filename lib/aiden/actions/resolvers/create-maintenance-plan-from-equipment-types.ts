/** Shared preview types for AIden `create_maintenance_plan_from_equipment` (client + server). */

import type { PlanInterval, WorkOrderPriority, WorkOrderType } from "@/lib/mock-data"

export type CreateMaintenancePlanFromEquipmentPreviewCustomer = {
  id: string
  companyName: string
}

export type CreateMaintenancePlanFromEquipmentPreviewEquipment = {
  id: string
  name: string
  serialNumber: string | null
  category: string | null
  location: string | null
}

export type CreateMaintenancePlanFromEquipmentPreviewPayload = {
  customer: CreateMaintenancePlanFromEquipmentPreviewCustomer
  equipment: CreateMaintenancePlanFromEquipmentPreviewEquipment
  planName: string
  intervalUi: PlanInterval
  customIntervalDays: number
  nextDueDate: string
  lastServiceDate: string | null
  serviceScope: string
  estimatedDurationMinutes: number | null
  workOrderTypeUi: WorkOrderType
  workOrderPriorityUi: WorkOrderPriority
  preferredServiceTime: string
  technicianSelectionId: string | null
  technicianLabel: string | null
  autoCreateWorkOrder: boolean
  notes: string
}
