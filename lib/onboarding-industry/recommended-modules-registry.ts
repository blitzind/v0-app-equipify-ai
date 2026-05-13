import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import type { RecommendedModuleDefinition } from "@/lib/onboarding-industry/golden-path-types"

const DEFAULT_MODULES: RecommendedModuleDefinition[] = [
  { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "Assets and service history" },
  { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Dispatchable jobs" },
  { moduleKey: "customers", label: "Customers", href: "/customers", blurb: "Accounts and sites" },
  { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "PM agreements" },
  { moduleKey: "dispatch", label: "Dispatch", href: "/dispatch", blurb: "Technician workload" },
  { moduleKey: "reports", label: "Reports", href: "/reports", blurb: "Operational KPIs" },
]

const BY_INDUSTRY: Partial<Record<WorkspaceIndustryKey, RecommendedModuleDefinition[]>> = {
  equipment_rental: [
    { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "Rental fleet register" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Turnarounds & inspections" },
    { moduleKey: "dispatch", label: "Dispatch", href: "/dispatch", blurb: "Yard and field coordination" },
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "PM on rental assets" },
    { moduleKey: "inventory", label: "Inventory", href: "/inventory", blurb: "Parts and staging" },
    { moduleKey: "purchase_orders", label: "Purchase orders", href: "/purchase-orders", blurb: "Procurement" },
  ],
  calibration_inspection: [
    { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "Traceable instruments" },
    { moduleKey: "certificates", label: "Certificates", href: "/settings/imports/certificates", blurb: "Imports & releases" },
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "Calibration cadence" },
    { moduleKey: "reports", label: "Reports", href: "/reports", blurb: "Compliance-ready summaries" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Inspection jobs" },
  ],
  property_management: [
    { moduleKey: "equipment", label: "Locations & assets", href: "/equipment", blurb: "Building systems" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Tenant and shared requests" },
    { moduleKey: "portal", label: "Customer portal", href: "/settings/portal", blurb: "Tenant-facing intake" },
    { moduleKey: "maintenance_plans", label: "Preventive maintenance", href: "/maintenance-plans", blurb: "PM contracts" },
    { moduleKey: "service_schedule", label: "Service schedule", href: "/service-schedule", blurb: "Rounds and SLAs" },
  ],
  hvac_r: [
    { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "RTUs, splits, racks" },
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "PM agreements" },
    { moduleKey: "service_schedule", label: "Service schedule", href: "/service-schedule", blurb: "Seasonal density" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Jobs & refrigerant work" },
    { moduleKey: "dispatch", label: "Dispatch", href: "/dispatch", blurb: "Technician routing" },
    { moduleKey: "reports", label: "Reports", href: "/reports", blurb: "Operational KPIs" },
  ],
  refrigeration_service: [
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Emergency + rack jobs" },
    { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "Walk-ins & compressors" },
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "Refrigeration PM" },
    { moduleKey: "service_schedule", label: "Service schedule", href: "/service-schedule", blurb: "Coverage windows" },
    { moduleKey: "dispatch", label: "Dispatch", href: "/dispatch", blurb: "Emergency response" },
  ],
  material_handling: [
    { moduleKey: "equipment", label: "Equipment", href: "/equipment", blurb: "Forklifts & attachments" },
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "Battery & PM programs" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "Inspections & repairs" },
    { moduleKey: "service_schedule", label: "Service schedule", href: "/service-schedule", blurb: "Warehouse routes" },
    { moduleKey: "dispatch", label: "Dispatch", href: "/dispatch", blurb: "Shop and field" },
  ],
  generator_power: [
    { moduleKey: "maintenance_plans", label: "Maintenance plans", href: "/maintenance-plans", blurb: "Generator PM" },
    { moduleKey: "work_orders", label: "Work orders", href: "/work-orders", blurb: "ATS & inspections" },
    { moduleKey: "quotes", label: "Quotes", href: "/quotes", blurb: "Test & commissioning" },
    { moduleKey: "invoices", label: "Invoices", href: "/invoices", blurb: "Project billing" },
    { moduleKey: "reports", label: "Reports", href: "/reports", blurb: "Fleet reliability" },
  ],
}

export function recommendedModulesForIndustry(key: WorkspaceIndustryKey): RecommendedModuleDefinition[] {
  return BY_INDUSTRY[key] ?? DEFAULT_MODULES
}
