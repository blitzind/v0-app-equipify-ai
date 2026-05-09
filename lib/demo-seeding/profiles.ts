import {
  WORKSPACE_INDUSTRY_DEFINITIONS,
  WORKSPACE_INDUSTRY_KEYS,
  type WorkspaceIndustryKey,
  type WorkspaceIndustryDefinition,
  type WorkspaceEquipmentExample,
} from "@/lib/workspace-industry-registry"

/**
 * Canonical industry keys for workspace onboarding, org.industry, and demo seed routing.
 * Aliased as `DemoIndustryKey` for historical imports (`lib/demo-seeding/*`).
 */
export const INDUSTRY_KEYS = WORKSPACE_INDUSTRY_KEYS

/** @deprecated Prefer `WorkspaceIndustryKey`; kept for seed modules and settings UI imports */
export type DemoIndustryKey = WorkspaceIndustryKey

export type { WorkspaceIndustryKey }

type MaintenancePlanExample = {
  name: string
  intervalValue: number
  intervalUnit: "month" | "year"
}

type DashboardMetricTargets = {
  customers: number
  equipment: number
  workOrders: number
  maintenancePlans: number
}

export type DemoIndustryProfile = {
  industry: WorkspaceIndustryKey
  demoCompanyName: string
  customerTypes: string[]
  equipmentAssetTypes: Array<{ name: string; category: string; manufacturer: string }>
  workOrderTitleExamples: string[]
  maintenancePlanExamples: MaintenancePlanExample[]
  technicianSpecialties: string[]
  dashboardMetricTargets: DashboardMetricTargets
}

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

/** Rich biomedical profile — overrides registry placeholders for `biomedical_medical_equipment` */
const MEDICAL_PROFILE: DemoIndustryProfile = {
  industry: "biomedical_medical_equipment",
  demoCompanyName: "Precision Biomedical Services",
  customerTypes: [
    "Valley Regional Hospital",
    "Summit Surgical Center",
    "Greenview Family Clinic",
    "Riverstone Imaging Center",
    "Oak Ridge Dental Group",
    "Blue Harbor Rehab Center",
    "Starlight Urgent Care",
    "Northside Pediatrics",
    "Cedar Grove Endoscopy Center",
    "Maple Street Dialysis Clinic",
    "Lakeside Cardiology Associates",
    "Horizon Women's Health Pavilion",
    "Redwood Community Hospital",
    "Clearwater Veterans Clinic",
    "Pinecrest Sleep Disorders Lab",
    "Meadowbrook Outpatient Surgery",
    "Cascade Orthopedic Institute",
    "Silverline Oncology Infusion Center",
    "Pacific Coast Orthopedic Surgery Center",
    "Harborview Community Health Center",
    "Sierra Peak Ambulatory Surgery",
    "Golden State Wound & Hyperbaric",
    "Mission View Imaging Partners",
    "Westgate Medical Plaza",
    "Coastal Pediatric Specialty Center",
  ],
  equipmentAssetTypes: [
    { name: "IntelliVue MX750 Patient Monitor", category: "Patient Monitoring", manufacturer: "Philips" },
    { name: "CARESCAPE B850 Monitor", category: "Patient Monitoring", manufacturer: "GE HealthCare" },
    { name: "BeneVision N17 OR Monitor", category: "Patient Monitoring", manufacturer: "Mindray" },
    { name: "MA 27 / MA 28 Audiometer", category: "Diagnostics / Audiology", manufacturer: "Maico" },
    { name: "AMSCO 400 Steam Sterilizer", category: "Sterilization", manufacturer: "STERIS" },
    { name: "HSG-A 9102 Autoclave", category: "Sterilization", manufacturer: "Getinge" },
    { name: "V-PRO maX Low-Temperature Sterilizer", category: "Sterilization", manufacturer: "STERIS" },
    { name: "Alaris 8100 Pump Module", category: "Infusion", manufacturer: "BD" },
    { name: "Plum 360 Large Volume Pump", category: "Infusion", manufacturer: "ICU Medical" },
    { name: "Spectrum IQ Infusion System", category: "Infusion", manufacturer: "Baxter" },
    { name: "X Series Defibrillator", category: "Emergency Care", manufacturer: "ZOLL" },
    { name: "LIFEPAK 15 Defibrillator", category: "Emergency Care", manufacturer: "Physio-Control" },
    { name: "MAC 5500 HD ECG", category: "Diagnostics", manufacturer: "GE HealthCare" },
    { name: "AT-102 Plus ECG", category: "Diagnostics", manufacturer: "Schiller" },
    { name: "LOGIQ E10 Ultrasound", category: "Imaging", manufacturer: "GE HealthCare" },
    { name: "Mobilett Elara Max Portable X-Ray", category: "Imaging QA", manufacturer: "Siemens Healthineers" },
    { name: "TOR DEN Digital QA Phantom Suite", category: "Imaging QA", manufacturer: "Fluke Biomedical" },
    { name: "UniPulse Defib Analyzer", category: "Biomedical Test Equipment", manufacturer: "Rigel Medical" },
    { name: "Allegra X-30R Centrifuge", category: "Laboratory", manufacturer: "Beckman Coulter" },
    { name: "5702 Series General Purpose Centrifuge", category: "Laboratory", manufacturer: "Eppendorf" },
  ],
  workOrderTitleExamples: [
    "Annual electrical safety & performance verification",
    "Quarterly infusion pump calibration",
    "Sterilizer chamber temperature variance investigation",
    "Patient monitor arrhythmia alarm verification",
    "Portable X-ray QA detector calibration",
    "Audiometer daily bioacoustic calibration check",
    "Defibrillator battery replacement",
    "Sterilizer Bowie-Dick / BI failure investigation",
    "Imaging phantom QA — mammography flat panel",
    "ECG lead noise troubleshooting — ICU telemetry",
    "Low-temp sterilizer vaporizer maintenance",
    "Biomed analyzer annual verification (defib energy)",
  ],
  maintenancePlanExamples: [
    { name: "Annual Electrical Safety Verification", intervalValue: 1, intervalUnit: "year" },
    { name: "Quarterly Infusion Pump PM", intervalValue: 3, intervalUnit: "month" },
    { name: "Monthly Monitor Inspection", intervalValue: 1, intervalUnit: "month" },
    { name: "Semi-Annual Sterilizer QA", intervalValue: 6, intervalUnit: "month" },
  ],
  technicianSpecialties: [
    "Biomedical Equipment",
    "Calibration",
    "Imaging QA",
    "Sterilization Systems",
    "Electrical Safety",
    "Infusion Systems",
  ],
  dashboardMetricTargets: { customers: 25, equipment: 68, workOrders: 150, maintenancePlans: 22 },
}

function buildDemoProfiles(): Record<WorkspaceIndustryKey, DemoIndustryProfile> {
  const out = {} as Record<WorkspaceIndustryKey, DemoIndustryProfile>
  for (const key of WORKSPACE_INDUSTRY_KEYS) {
    if (key === "biomedical_medical_equipment") {
      out[key] = MEDICAL_PROFILE
    } else {
      out[key] = starterProfileFromDefinition(WORKSPACE_INDUSTRY_DEFINITIONS[key])
    }
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
    /** Former umbrella — maps to dedicated key */
    equipment_service: "equipment_service_repair",
    "equipment-service": "equipment_service_repair",
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
  return WORKSPACE_INDUSTRY_KEYS.map((k) => ({
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
