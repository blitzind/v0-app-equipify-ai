/** Shared response shape for `/api/organizations/:id/reports/analytics` and client consumers. */

export type ReportSummary = {
  periodRevenueCents: number
  workOrdersCreated: number
  workOrdersCompleted: number
  workOrdersInProgress: number
  /** Average days from created_at to completed_at for WOs completed in range (null if none). */
  avgCompletionDays: number | null
  overdueInvoicesCount: number
  overdueInvoicesAmountCents: number
  activeMaintenancePlans: number
  maintenancePlansOverdue: number
  pmWorkOrdersCompletedInPeriod: number
  /** Approximation: share of active PM plans whose next_due_date is not before today. */
  maintenanceScheduleHealthPct: number | null
  warrantyExpiringInPeriod: number
  repeatRepairEquipmentCount: number
}

export type RevenueMonthPoint = { monthKey: string; monthLabel: string; revenueCents: number }

export type TrendWeekPoint = { weekLabel: string; weekStart: string; count: number }

export type WorkOrderTypeSlice = { type: string; count: number }

export type TechnicianPerfRow = {
  userId: string
  name: string
  completedCount: number
  laborPartsCents: number
}

export type CustomerRevenueRow = {
  customerId: string
  name: string
  revenueCents: number
  workOrderCount: number
}

export type EquipmentCategoryRow = {
  category: string
  workOrderCount: number
  distinctEquipment: number
  /** Higher values imply more service touches per asset in the window (rough utilization signal). */
  touchesPerAsset: number | null
}

export type EquipmentTypeCustomerRow = {
  customerId: string
  customerName: string
  equipmentCount: number
  workOrderCount: number
  revenueCents: number
}

export type EquipmentTypePerformanceRow = {
  equipmentType: string
  equipmentCount: number
  workOrderCount: number
  completedWorkOrderCount: number
  openWorkOrderCount: number
  calibrationCount: number
  invoiceCount: number
  linkedRevenueCents: number
  unlinkedRevenueCents: number
  averageRevenuePerWorkOrderCents: number | null
  lastServiceDate: string | null
  nextDueCount: number
  topCustomers: EquipmentTypeCustomerRow[]
}

export type MaintenanceComplianceSlice = {
  label: string
  count: number
}

export type WarrantyExpiryRow = {
  equipmentId: string
  equipmentName: string
  customerName: string
  expires: string
  daysLeft: number
}

export type OverdueInvoiceRow = {
  id: string
  invoiceNumber: string
  customerName: string
  amountCents: number
  dueDate: string | null
  status: string
  daysOverdue: number
}

export type RepeatRepairAnalyticRow = {
  equipmentId: string
  equipmentName: string
  customerName: string
  repairs: number
  lastRepair: string
  issue: string
}

export type EquipmentDueMonthPoint = { monthLabel: string; count: number }

export type ReportAnalyticsResponse = {
  from: string
  to: string
  summary: ReportSummary
  revenueByMonth: RevenueMonthPoint[]
  workOrdersByWeek: TrendWeekPoint[]
  workOrdersByType: WorkOrderTypeSlice[]
  technicians: TechnicianPerfRow[]
  topCustomers: CustomerRevenueRow[]
  equipmentByCategory: EquipmentCategoryRow[]
  equipmentTypePerformance: EquipmentTypePerformanceRow[]
  maintenanceMix: MaintenanceComplianceSlice[]
  warrantiesExpiring: WarrantyExpiryRow[]
  overdueInvoices: OverdueInvoiceRow[]
  repeatRepairs: RepeatRepairAnalyticRow[]
  equipmentPmDueByMonth: EquipmentDueMonthPoint[]
}
