import {
  WORKSPACE_INDUSTRY_DEFINITIONS,
  WORKSPACE_INDUSTRY_KEYS,
  type WorkspaceIndustryKey,
  type WorkspaceIndustryDefinition,
  type WorkspaceEquipmentExample,
} from "@/lib/workspace-industry-registry"
import type { DemoIndustryProfile, MaintenancePlanExample } from "@/lib/demo-seeding/demo-profile-model"
import { DEMO_PROFILE_OVERRIDES } from "@/lib/demo-seeding/industry-demo-profile-overrides"

/**
 * Canonical industry keys for workspace onboarding, org.industry, and demo seed routing.
 * Aliased as `DemoIndustryKey` for historical imports (`lib/demo-seeding/*`).
 */
export const INDUSTRY_KEYS = WORKSPACE_INDUSTRY_KEYS

/** @deprecated Prefer `WorkspaceIndustryKey`; kept for seed modules and settings UI imports */
export type DemoIndustryKey = WorkspaceIndustryKey

export type { WorkspaceIndustryKey }

export type {
  MaintenancePlanExample,
  DashboardMetricTargets,
  DemoIndustryProfile,
} from "@/lib/demo-seeding/demo-profile-model"

function maintenancePlansFromNames(names: string[]): MaintenancePlanExample[] {
  return names.map((name, i) => ({
    name,
    intervalValue: i % 2 === 0 ? 1 : 3,
    intervalUnit: "month" as const,
  }))
}

function starterProfileFromDefinition(def: WorkspaceIndustryDefinition): DemoIndustryProfile {
  const names =
    def.defaultMaintenancePlanExampleNames.length > 0
      ? def.defaultMaintenancePlanExampleNames
      : ["Monthly PM inspection", "Quarterly operational audit"]
  return {
    industry: def.key,
    demoCompanyName: def.suggestedDemoCompanyName,
    customerTypes: def.defaultCustomerTypes,
    equipmentAssetTypes: def.defaultEquipmentExamples as WorkspaceEquipmentExample[],
    workOrderTitleExamples: def.defaultWorkOrderExamples,
    maintenancePlanExamples: maintenancePlansFromNames(names),
    technicianSpecialties: def.defaultTechnicianSkillTags,
    dashboardMetricTargets: { customers: 22, equipment: 56, workOrders: 34, maintenancePlans: 22 },
  }
}

function buildDemoProfiles(): Record<WorkspaceIndustryKey, DemoIndustryProfile> {
  const out = {} as Record<WorkspaceIndustryKey, DemoIndustryProfile>
  for (const key of WORKSPACE_INDUSTRY_KEYS) {
    const override = DEMO_PROFILE_OVERRIDES[key]
    out[key] = override ?? starterProfileFromDefinition(WORKSPACE_INDUSTRY_DEFINITIONS[key])
  }
  return out
}

/**
 * Demo bundle profiles keyed by canonical workspace industry.
 * New verticals without bespoke content use registry-derived lightweight defaults so seed never fails.
 */
export const DEMO_INDUSTRY_PROFILES: Record<WorkspaceIndustryKey, DemoIndustryProfile> = buildDemoProfiles()

/**
 * Merge registry aliases with legacy stored/query-string keys so existing org rows normalize safely.
 * Unknown values resolve to `commercial_equipment`.
 */
function buildAliasMap(): Record<string, WorkspaceIndustryKey> {
  const map: Record<string, WorkspaceIndustryKey> = {}

  for (const key of WORKSPACE_INDUSTRY_KEYS) {
    map[key] = key
    const def = WORKSPACE_INDUSTRY_DEFINITIONS[key]
    for (const a of def.aliases) {
      const norm = a.trim().toLowerCase().replace(/-/g, "_")
      map[norm] = key
    }
  }

  // Legacy keys present in DB / older URLs before canonical registry (Phase B)
  Object.assign(map, {
    medical_equipment: "biomedical_medical_equipment",
    commercial_equipment: "commercial_equipment",
    hvac_r: "hvac_r",
    garage_door: "garage_door",
    property_management: "property_management",
    appliance_repair: "appliance_repair",
    fire_security: "fire_security",
    av_installation: "av_installation",
    equipment_service: "commercial_equipment",
    "equipment-service": "commercial_equipment",
    "commercial-hvac": "hvac_r",
    commercial_hvac: "hvac_r",
    "facility-maintenance": "facility_maintenance",
    facility_maintenance: "facility_maintenance",
    "biomedical-equipment": "biomedical_medical_equipment",
    biomedical_equipment: "biomedical_medical_equipment",
    "industrial-equipment": "industrial_equipment",
    industrial_equipment: "industrial_equipment",
    industrial_service: "industrial_equipment",
    "industrial-service": "industrial_equipment",
    "equipment-rental": "equipment_rental",
    equipment_rental: "equipment_rental",
    "refrigeration-service": "refrigeration_service",
    refrigeration_service: "refrigeration_service",
    "fleet-mobile-equipment": "fleet_mobile_equipment",
    fleet_mobile_equipment: "fleet_mobile_equipment",
    "material-handling": "material_handling",
    material_handling: "material_handling",
    "elevator-service": "elevator_service",
    elevator_service: "elevator_service",
    "generator-power-systems": "generator_power",
    generator_power_systems: "generator_power",
    "calibration-inspection": "calibration_inspection",
    calibration_inspection: "calibration_inspection",
    equipment_service_repair: "commercial_equipment",
    commercial_kitchen_equipment: "commercial_equipment",
    commercial_kitchen: "commercial_equipment",
    other: "commercial_equipment",
  })

  return map
}

const INDUSTRY_ALIAS_MAP = buildAliasMap()

export function normalizeIndustryKey(value: string | null | undefined): WorkspaceIndustryKey {
  if (!value) return "commercial_equipment"
  const normalized = value.trim().toLowerCase().replace(/-/g, "_")
  return INDUSTRY_ALIAS_MAP[normalized] ?? "commercial_equipment"
}

/** Dropdown labels for onboarding / Settings → Sample data (human-readable sector titles) */
export function workspaceIndustrySelectOptions(): { value: WorkspaceIndustryKey; label: string }[] {
  return WORKSPACE_INDUSTRY_KEYS.filter((k) => k !== "equipment_service_repair").map((k) => ({
    value: k,
    label: WORKSPACE_INDUSTRY_DEFINITIONS[k].label,
  }))
}

/** @deprecated Use `workspaceIndustrySelectOptions` — kept for API/demo-data */
export function demoIndustrySelectOptions(): { value: WorkspaceIndustryKey; label: string }[] {
  return workspaceIndustrySelectOptions()
}

/** Setup paragraph on onboarding workspace step */
export function getIndustrySetupCopy(key: string): string {
  const k = normalizeIndustryKey(key)
  return WORKSPACE_INDUSTRY_DEFINITIONS[k].sampleSetupCopy
}

export { isRichDemoProfileIndustry, RICH_DEMO_INDUSTRY_KEYS } from "@/lib/demo-seeding/industry-demo-profile-overrides"
