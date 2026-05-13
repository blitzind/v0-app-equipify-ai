import type { WorkspaceEquipmentExample, WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

export type MaintenancePlanExample = {
  name: string
  intervalValue: number
  intervalUnit: "month" | "year"
}

export type DashboardMetricTargets = {
  customers: number
  equipment: number
  workOrders: number
  maintenancePlans: number
}

/** Industry-specific primitives used by `seed-demo-content` to synthesize sample rows. */
export type DemoIndustryProfile = {
  industry: WorkspaceIndustryKey
  demoCompanyName: string
  customerTypes: string[]
  equipmentAssetTypes: WorkspaceEquipmentExample[]
  workOrderTitleExamples: string[]
  maintenancePlanExamples: MaintenancePlanExample[]
  technicianSpecialties: string[]
  dashboardMetricTargets: DashboardMetricTargets
}
