import { DEMO_INDUSTRY_PROFILES } from "@/lib/demo-seeding/profiles"
import {
  WORKSPACE_INDUSTRY_DEFINITIONS,
  type WorkspaceIndustryKey,
} from "@/lib/workspace-industry-registry"

/**
 * Industry-aware copy and taxonomy for the Add Equipment flow (and related surfaces).
 * Uses the same demo/registry primitives as onboarding seeds so UI and sample data stay aligned.
 */
export type EquipmentFormPlaceholders = {
  name: string
  manufacturer: string
  model: string
  serialNumber: string
  location: string
  serviceInterval: string
  subcategory: string
  notes: string
}

export type EquipmentFormIndustryUi = {
  industryKey: WorkspaceIndustryKey
  equipmentTypes: readonly string[]
  placeholders: EquipmentFormPlaceholders
  subcategoryHint: string
  serviceSiteLocationHint: string
  calibrationDueLabel: string
  calibrationIntervalPlaceholder: string
  emphasizeCalibrationCompliance: boolean
}

const GENERIC_SERVICE_CATEGORIES = [
  "HVAC",
  "Electrical",
  "Plumbing",
  "Mechanical",
  "Refrigeration",
  "Fire Safety",
  "Controls",
  "Pump",
]

function normalizeTypeKey(t: string): string {
  return t.trim().toLowerCase()
}

/** Preserves order of first argument; appends unseen items from second; always ends with Other. */
export function orderedUniqueEquipmentTypes(preferred: readonly string[], extra: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  function pushUnique(raw: string) {
    const t = raw.trim()
    if (!t) return
    const k = normalizeTypeKey(t)
    if (seen.has(k)) return
    seen.add(k)
    out.push(t)
  }
  for (const t of preferred) pushUnique(t)
  for (const t of extra) pushUnique(t)
  if (!seen.has("other")) pushUnique("Other")
  return out
}

function collectCategoriesFromDemoAndRegistry(key: WorkspaceIndustryKey): string[] {
  const profile = DEMO_INDUSTRY_PROFILES[key]
  const def = WORKSPACE_INDUSTRY_DEFINITIONS[key]
  const found: string[] = []
  if (!profile || !def) return found
  for (const ex of profile.equipmentAssetTypes) {
    if (ex.category?.trim()) found.push(ex.category.trim())
  }
  for (const c of def.defaultServiceCategories ?? []) {
    if (c?.trim()) found.push(c.trim())
  }
  return found
}

function placeholdersFromFirstAssets(
  key: WorkspaceIndustryKey,
  overrides: Partial<EquipmentFormPlaceholders>,
): EquipmentFormPlaceholders {
  const profile = DEMO_INDUSTRY_PROFILES[key]
  const def = WORKSPACE_INDUSTRY_DEFINITIONS[key]
  const first = profile.equipmentAssetTypes[0]
  const second = profile.equipmentAssetTypes[1]
  const ex0 = def.defaultEquipmentExamples[0]
  const ex1 = def.defaultEquipmentExamples[1]
  const nameSource = first ?? ex0
  const mfgSource =
    first?.manufacturer?.trim() ? first : second?.manufacturer?.trim() ? second : ex0?.manufacturer?.trim() ? ex0 : ex1

  const defaultName = nameSource ? `e.g. ${nameSource.name}` : "e.g. Equipment asset name"
  const defaultMfg =
    mfgSource && "manufacturer" in mfgSource && mfgSource.manufacturer?.trim()
      ? `e.g. ${mfgSource.manufacturer.trim()}`
      : "e.g. Manufacturer"

  return {
    name: overrides.name ?? defaultName,
    manufacturer: overrides.manufacturer ?? defaultMfg,
    model: overrides.model ?? "e.g. Model / catalog number",
    serialNumber: overrides.serialNumber ?? "e.g. SN-1234567",
    location: overrides.location ?? "e.g. Suite, floor, or site area",
    serviceInterval: overrides.serviceInterval ?? "e.g. Quarterly PM or annual inspection",
    subcategory: overrides.subcategory ?? "Optional refinement for filters and reporting",
    notes: overrides.notes ?? "Technician context, accessories, warranty, compliance notes…",
  }
}

function buildDerived(key: WorkspaceIndustryKey): EquipmentFormIndustryUi {
  const extras = collectCategoriesFromDemoAndRegistry(key)
  const seed = extras.length >= 4 ? [...extras] : [...extras, ...GENERIC_SERVICE_CATEGORIES]
  const types = orderedUniqueEquipmentTypes(seed, [])
  const emphasize =
    key === "calibration_inspection" ||
    key === "biomedical_medical_equipment" ||
    key === "fire_security"
  return {
    industryKey: key,
    equipmentTypes: types,
    placeholders: placeholdersFromFirstAssets(key, {}),
    subcategoryHint: "Refines the primary type for reporting and filters.",
    serviceSiteLocationHint:
      "Customer address on file. Use the field below for room, floor, rooftop, or department.",
    calibrationDueLabel: emphasize ? "Next calibration / compliance due" : "Next inspection / compliance due",
    calibrationIntervalPlaceholder: "e.g. 12",
    emphasizeCalibrationCompliance: emphasize,
  }
}

const BIOMEDICAL_UI: EquipmentFormIndustryUi = {
  industryKey: "biomedical_medical_equipment",
  equipmentTypes: orderedUniqueEquipmentTypes(
    [
      "Patient Monitor",
      "ECG",
      "Ventilator",
      "Infusion Pump",
      "Defibrillator",
      "Sterilizer",
      "Autoclave",
      "Audiometer",
      "Ultrasound",
      "Anesthesia Machine",
      "Surgical Table",
      "Imaging",
      "Lab Equipment",
      "Endoscopy",
      "Dialysis Machine",
      "Dental Equipment",
    ],
    collectCategoriesFromDemoAndRegistry("biomedical_medical_equipment"),
  ),
  placeholders: placeholdersFromFirstAssets("biomedical_medical_equipment", {
    name: "e.g. GE MAC 5500 HD ECG",
    manufacturer: "e.g. Philips, GE HealthCare, Mindray",
    model: "e.g. IntelliVue MX450",
    serialNumber: "e.g. UM-4482910",
    location: "e.g. ICU Bed 12 · Imaging Suite 2 · Sterile Processing",
    serviceInterval: "e.g. Annual electrical safety · quarterly infusion PM",
    subcategory: "e.g. Telemetry cart · Sterile processing · MODALITY-A",
    notes: "Compliance recalls, electrical safety class, accessories, OEM service bulletins…",
  }),
  subcategoryHint:
    "Optional refinement for modality, care area, or asset line (helps reporting and filters).",
  serviceSiteLocationHint:
    "Customer address on file. Use the field below for department, bed, suite, or procedural area.",
  calibrationDueLabel: "Next calibration / compliance due",
  calibrationIntervalPlaceholder: "e.g. 12",
  emphasizeCalibrationCompliance: true,
}

const HVAC_UI: EquipmentFormIndustryUi = {
  industryKey: "hvac_r",
  equipmentTypes: orderedUniqueEquipmentTypes(
    [
      "Rooftop Unit",
      "Split System",
      "Air Handler",
      "Packaged Unit",
      "Chiller",
      "Boiler",
      "Cooling Tower",
      "Heat Pump",
      "VRF / VRV",
      "Exhaust Fan",
      "Make-up Air Unit",
      "Fan Coil",
      "Ductless Mini-Split",
      "Walk-In Cooler",
      "Walk-In Freezer",
      "Ice Machine",
      "Refrigeration Rack",
      "Hydronic Pump",
      "Controls / BAS",
    ],
    collectCategoriesFromDemoAndRegistry("hvac_r"),
  ),
  placeholders: placeholdersFromFirstAssets("hvac_r", {
    name: "e.g. RTU-12 · Primary air handler",
    manufacturer: "e.g. Carrier, Trane, Lennox, Daikin",
    model: "e.g. 50XC-060 · Voyager TCD300",
    serialNumber: "e.g. 2411-882-A12",
    location: "e.g. Roof — Building A · Kitchen make-up",
    serviceInterval: "e.g. Every 90 days (filters + coils)",
    subcategory: "e.g. RTU · cooling tower cell · VAV box",
    notes: "Refrigerant type, BAS trends, filter sizes, warranty, recurring PM context…",
  }),
  subcategoryHint: "Refines the primary type (e.g. RTU vs split vs chiller) for filters and reporting.",
  serviceSiteLocationHint:
    "Customer address on file. Use the field below for mechanical room, roof, suite, or department.",
  calibrationDueLabel: "Next inspection / compliance due",
  calibrationIntervalPlaceholder: "e.g. 12",
  emphasizeCalibrationCompliance: false,
}

const ELECTRICAL_UI: EquipmentFormIndustryUi = {
  industryKey: "electrical",
  equipmentTypes: orderedUniqueEquipmentTypes(
    [
      "Panel",
      "Switchgear",
      "Generator",
      "UPS",
      "ATS",
      "Transformer",
      "Motor Control Center",
      "Disconnect",
      "Lighting",
      "EVSE",
      "Emergency Lighting",
      "Power Meter",
      "Relay / Protection",
    ],
    collectCategoriesFromDemoAndRegistry("electrical"),
  ),
  placeholders: placeholdersFromFirstAssets("electrical", {
    name: "e.g. Main service disconnect MSB-1",
    manufacturer: "e.g. Square D, Eaton, Schneider",
    model: "e.g. NQOD panelboard catalog",
    location: "e.g. Electrical room 101 · Rooftop gen-pad",
    serviceInterval: "e.g. Annual IR thermography · monthly gen exercise",
    subcategory: "e.g. Normal / emergency · branch panel LA-3B",
    notes: "Arc flash boundary notes, feeder IDs, net metering, permit / AHJ context…",
  }),
  subcategoryHint: "Refines distribution vs loads vs emergency circuits for reporting.",
  serviceSiteLocationHint:
    "Customer address on file. Use below for electrical room, rooftop pad, or suite panel.",
  calibrationDueLabel: "Next inspection / compliance due",
  calibrationIntervalPlaceholder: "e.g. 12",
  emphasizeCalibrationCompliance: false,
}

const GARAGE_DOOR_UI: EquipmentFormIndustryUi = {
  industryKey: "garage_door",
  equipmentTypes: orderedUniqueEquipmentTypes(
    [
      "Sectional Door",
      "Rolling Steel Door",
      "High-Speed Door",
      "Dock Leveler",
      "Gate Operator",
      "Fire Door",
      "Sliding / Hangar Door",
      "Door Operator",
      "Safety Sensors & Edge",
      "Counter Shutter",
    ],
    collectCategoriesFromDemoAndRegistry("garage_door"),
  ),
  placeholders: placeholdersFromFirstAssets("garage_door", {
    name: "e.g. Dock Door 14 — High-speed roll-up",
    manufacturer: "e.g. Rytec, CornellCookson, LiftMaster",
    model: "e.g. Apex 2SE controller",
    location: "e.g. Receiving lane 3 · Gate house A",
    serviceInterval: "e.g. Monthly safety inspection",
    subcategory: "e.g. Spring assembly · loop detector · weather seal",
    notes: "Cycle counts, safety device model, spring specs, UL listing notes…",
  }),
  subcategoryHint: "Refines door family and hardware package for reporting and PM routing.",
  serviceSiteLocationHint: "Customer address on file. Use below for bay, lane, or gate ID.",
  calibrationDueLabel: "Next safety / compliance inspection",
  calibrationIntervalPlaceholder: "e.g. 12",
  emphasizeCalibrationCompliance: false,
}

const CURATED: Partial<Record<WorkspaceIndustryKey, EquipmentFormIndustryUi>> = {
  biomedical_medical_equipment: BIOMEDICAL_UI,
  hvac_r: HVAC_UI,
  electrical: ELECTRICAL_UI,
  garage_door: GARAGE_DOOR_UI,
}

export function getEquipmentFormIndustryUi(key: WorkspaceIndustryKey): EquipmentFormIndustryUi {
  return CURATED[key] ?? buildDerived(key)
}
