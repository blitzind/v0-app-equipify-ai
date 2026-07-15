/** GE-AIOS-SUPPORTED-SERVICE-VERTICALS-PROJECTION-1B — Canonical Supported Service Verticals registry (client-safe, provider-neutral). */

import type { BusinessProfileSupportedServiceVerticalRef } from "@/lib/growth/business-profile/business-profile-types"

export const GROWTH_SUPPORTED_SERVICE_VERTICALS_REGISTRY_QA_MARKER =
  "ge-aios-supported-service-verticals-registry-1b-v1" as const

export const SUPPORTED_SERVICE_VERTICAL_IDS = [
  "medical_equipment",
  "hvac_r",
  "electrical",
  "plumbing",
  "field_service",
  "garage_door",
  "locksmith",
  "property_management",
  "appliance_repair",
  "commercial_equipment",
  "fire_security",
  "specialty_contractors",
  "septic",
  "av_installation",
  "mep",
  "calibration_inspection",
  "commercial_hvac",
  "commercial_kitchen",
  "industrial_equipment",
  "facility_maintenance",
  "biomedical_equipment",
  "elevator_lift",
  "generator_power",
  "equipment_rental",
  "refrigeration_service",
  "fleet_mobile_equipment",
  "material_handling",
] as const

export type SupportedServiceVerticalId = (typeof SUPPORTED_SERVICE_VERTICAL_IDS)[number]

export const OPERATIONAL_CAPABILITIES = [
  "dispatch",
  "technicians",
  "work_orders",
  "recurring_maintenance",
  "preventive_maintenance",
  "inspections",
  "service_contracts",
  "installations",
  "warranties",
  "customer_assets",
  "compliance",
  "calibration",
  "assets",
  "pm",
] as const

export type OperationalCapability = (typeof OPERATIONAL_CAPABILITIES)[number]

export type SupportedServiceVerticalDefinition = {
  id: SupportedServiceVerticalId
  label: string
  operationalFocus: OperationalCapability[]
  profileMatchPatterns: readonly string[]
  industryAliases: readonly string[]
  topicSeedPhrases: readonly string[]
  naicsHints?: readonly string[]
}

function vertical(
  input: SupportedServiceVerticalDefinition,
): SupportedServiceVerticalDefinition {
  return input
}

export const SUPPORTED_SERVICE_VERTICALS_REGISTRY: readonly SupportedServiceVerticalDefinition[] = [
  vertical({
    id: "medical_equipment",
    label: "Medical Equipment",
    operationalFocus: ["assets", "compliance", "calibration", "preventive_maintenance", "pm"],
    profileMatchPatterns: ["medical equipment", "hospital equipment", "healthcare equipment service"],
    industryAliases: ["Medical equipment service", "Medical equipment", "Healthcare equipment service"],
    topicSeedPhrases: ["medical equipment service", "medical equipment maintenance"],
    naicsHints: ["811219", "811210"],
  }),
  vertical({
    id: "hvac_r",
    label: "HVAC-R",
    operationalFocus: ["service_contracts", "dispatch", "preventive_maintenance", "pm"],
    profileMatchPatterns: ["hvac service", "hvac-r", "hvac contractor", "mechanical service"],
    industryAliases: ["HVAC service", "HVAC contractors", "Mechanical service"],
    topicSeedPhrases: ["hvac service", "hvac maintenance contracts"],
    naicsHints: ["238220"],
  }),
  vertical({
    id: "electrical",
    label: "Electrical",
    operationalFocus: ["installations", "inspections", "warranties", "dispatch"],
    profileMatchPatterns: ["electrical service", "electrical contractor"],
    industryAliases: ["Electrical service", "Electrical contractors"],
    topicSeedPhrases: ["electrical service", "electrical contractor maintenance"],
    naicsHints: ["238210"],
  }),
  vertical({
    id: "plumbing",
    label: "Plumbing",
    operationalFocus: ["dispatch", "recurring_maintenance", "preventive_maintenance"],
    profileMatchPatterns: ["plumbing service", "plumbing contractor"],
    industryAliases: ["Plumbing service", "Plumbing contractors"],
    topicSeedPhrases: ["plumbing service", "plumbing maintenance"],
    naicsHints: ["238220"],
  }),
  vertical({
    id: "field_service",
    label: "Field Service",
    operationalFocus: ["dispatch", "technicians", "work_orders", "customer_assets", "assets"],
    profileMatchPatterns: [
      "field service",
      "mobile field service",
      "field operations",
      "field-operations",
    ],
    industryAliases: ["Field service", "Field service companies", "Field operations"],
    topicSeedPhrases: ["field service management", "field service operations"],
  }),
  vertical({
    id: "garage_door",
    label: "Garage Door",
    operationalFocus: ["installations", "dispatch", "recurring_maintenance"],
    profileMatchPatterns: ["garage door"],
    industryAliases: ["Garage door service", "Garage door repair"],
    topicSeedPhrases: ["garage door service", "garage door installation"],
  }),
  vertical({
    id: "locksmith",
    label: "Locksmith",
    operationalFocus: ["dispatch", "installations", "customer_assets"],
    profileMatchPatterns: ["locksmith", "access control service"],
    industryAliases: ["Locksmith", "Access control service", "Commercial access"],
    topicSeedPhrases: ["locksmith service", "commercial access control service"],
  }),
  vertical({
    id: "property_management",
    label: "Property Management",
    operationalFocus: ["recurring_maintenance", "work_orders", "dispatch", "assets"],
    profileMatchPatterns: ["property maintenance", "property management", "property manag"],
    industryAliases: ["Property maintenance", "Property management", "Property management maintenance"],
    topicSeedPhrases: ["property maintenance service", "multi-site property maintenance"],
  }),
  vertical({
    id: "appliance_repair",
    label: "Appliance Repair",
    operationalFocus: ["dispatch", "warranties", "work_orders"],
    profileMatchPatterns: ["appliance repair", "appliance service"],
    industryAliases: ["Appliance repair", "Appliance service"],
    topicSeedPhrases: ["appliance repair service", "appliance maintenance dispatch"],
    naicsHints: ["811412"],
  }),
  vertical({
    id: "commercial_equipment",
    label: "Commercial Equipment",
    operationalFocus: ["assets", "pm", "preventive_maintenance", "service_contracts"],
    profileMatchPatterns: ["commercial equipment"],
    industryAliases: ["Commercial equipment service", "Commercial equipment maintenance"],
    topicSeedPhrases: ["commercial equipment service", "commercial equipment maintenance"],
  }),
  vertical({
    id: "fire_security",
    label: "Fire & Security",
    operationalFocus: ["inspections", "compliance", "service_contracts"],
    profileMatchPatterns: [
      "fire protection",
      "fire and safety",
      "fire & security",
      "security systems service",
      "fire protection and safety",
    ],
    industryAliases: [
      "Fire protection and safety inspection",
      "Fire & Security",
      "Security systems service",
    ],
    topicSeedPhrases: ["fire protection inspection", "security systems service"],
  }),
  vertical({
    id: "specialty_contractors",
    label: "Specialty Contractors",
    operationalFocus: ["work_orders", "assets", "dispatch", "pm"],
    profileMatchPatterns: [
      "specialty contractor",
      "industrial maintenance contractor",
      "building systems service",
      "building automation",
    ],
    industryAliases: [
      "Specialty contractors",
      "Industrial maintenance contractors",
      "Building systems service",
      "Building automation service",
    ],
    topicSeedPhrases: ["specialty contractor equipment service", "building systems maintenance"],
  }),
  vertical({
    id: "septic",
    label: "Septic",
    operationalFocus: ["recurring_maintenance", "dispatch", "service_contracts"],
    profileMatchPatterns: ["septic"],
    industryAliases: ["Septic service", "Septic pumping"],
    topicSeedPhrases: ["septic pumping service", "septic maintenance schedules"],
  }),
  vertical({
    id: "av_installation",
    label: "A/V Installation",
    operationalFocus: ["installations", "dispatch", "customer_assets"],
    profileMatchPatterns: ["a/v installation", "av installation", "audio visual"],
    industryAliases: ["A/V installation", "AV installation", "Audio visual installation"],
    topicSeedPhrases: ["av installation service", "audio visual support"],
  }),
  vertical({
    id: "mep",
    label: "MEP",
    operationalFocus: ["dispatch", "work_orders", "pm", "assets"],
    profileMatchPatterns: ["\\bmep\\b", "mechanical, electrical and plumbing"],
    industryAliases: ["MEP", "MEP service", "Mechanical electrical plumbing operations"],
    topicSeedPhrases: ["mep service operations", "mechanical electrical plumbing service"],
  }),
  vertical({
    id: "calibration_inspection",
    label: "Calibration & Inspection",
    operationalFocus: ["calibration", "inspections", "compliance"],
    profileMatchPatterns: ["calibration", "inspection service", "testing laborator"],
    industryAliases: ["Calibration & Inspection", "Calibration service", "Inspection services"],
    topicSeedPhrases: ["calibration service", "equipment inspection compliance"],
    naicsHints: ["541380"],
  }),
  vertical({
    id: "commercial_hvac",
    label: "Commercial HVAC",
    operationalFocus: ["service_contracts", "pm", "recurring_maintenance", "dispatch"],
    profileMatchPatterns: ["commercial hvac"],
    industryAliases: ["Commercial HVAC", "Commercial HVAC service"],
    topicSeedPhrases: ["commercial hvac maintenance", "commercial hvac pm contracts"],
    naicsHints: ["238220"],
  }),
  vertical({
    id: "commercial_kitchen",
    label: "Commercial Kitchen",
    operationalFocus: ["dispatch", "assets", "pm", "work_orders"],
    profileMatchPatterns: ["commercial kitchen", "kitchen equipment"],
    industryAliases: ["Commercial kitchen equipment repair", "Commercial kitchen service"],
    topicSeedPhrases: ["commercial kitchen equipment service", "kitchen equipment repair"],
  }),
  vertical({
    id: "industrial_equipment",
    label: "Industrial Equipment",
    operationalFocus: ["assets", "pm", "preventive_maintenance", "service_contracts"],
    profileMatchPatterns: [
      "industrial equipment",
      "compressor service",
      "pump service",
      "industrial maintenance",
    ],
    industryAliases: [
      "Industrial equipment service",
      "Compressor service",
      "Pump service",
      "Industrial maintenance",
    ],
    topicSeedPhrases: ["industrial equipment service", "industrial equipment maintenance"],
    naicsHints: ["811310"],
  }),
  vertical({
    id: "facility_maintenance",
    label: "Facility Maintenance",
    operationalFocus: ["recurring_maintenance", "work_orders", "dispatch", "assets", "pm"],
    profileMatchPatterns: ["facilities maintenance", "facility maintenance"],
    industryAliases: ["Facilities maintenance", "Facility maintenance"],
    topicSeedPhrases: ["facility maintenance service", "multi-site facility maintenance"],
  }),
  vertical({
    id: "biomedical_equipment",
    label: "Biomedical Equipment",
    operationalFocus: ["calibration", "compliance", "preventive_maintenance", "assets"],
    profileMatchPatterns: ["biomedical", "biomed", "clinical engineering", "medical equipment service"],
    industryAliases: [
      "Biomedical and medical equipment service",
      "Biomedical equipment service",
      "Biomedical service",
    ],
    topicSeedPhrases: ["biomedical equipment service", "biomedical equipment maintenance"],
    naicsHints: ["811219", "811210"],
  }),
  vertical({
    id: "elevator_lift",
    label: "Elevator & Lift",
    operationalFocus: ["inspections", "compliance", "preventive_maintenance", "pm"],
    profileMatchPatterns: ["elevator service", "elevator and lift", "lift service"],
    industryAliases: ["Elevator service", "Elevator & Lift", "Lift service"],
    topicSeedPhrases: ["elevator maintenance service", "elevator inspection maintenance"],
  }),
  vertical({
    id: "generator_power",
    label: "Generator & Power",
    operationalFocus: ["pm", "inspections", "preventive_maintenance"],
    profileMatchPatterns: ["generator service", "generator and power", "power systems service"],
    industryAliases: ["Generator service", "Generator & Power", "Generator maintenance"],
    topicSeedPhrases: ["generator service", "generator load testing maintenance"],
  }),
  vertical({
    id: "equipment_rental",
    label: "Equipment Rental",
    operationalFocus: ["assets", "inspections", "customer_assets"],
    profileMatchPatterns: ["equipment rental"],
    industryAliases: [
      "Equipment rental companies with service departments",
      "Equipment rental service",
    ],
    topicSeedPhrases: ["equipment rental service department", "rental equipment inspection service"],
  }),
  vertical({
    id: "refrigeration_service",
    label: "Refrigeration Service",
    operationalFocus: ["dispatch", "pm", "preventive_maintenance", "assets"],
    profileMatchPatterns: ["refrigeration service", "refrigeration repair", "walk-in"],
    industryAliases: ["Refrigeration service", "Refrigeration repair", "Commercial refrigeration"],
    topicSeedPhrases: ["refrigeration service", "commercial refrigeration maintenance"],
  }),
  vertical({
    id: "fleet_mobile_equipment",
    label: "Fleet & Mobile Equipment",
    operationalFocus: ["assets", "inspections", "preventive_maintenance", "dispatch"],
    profileMatchPatterns: ["fleet maintenance", "mobile equipment maintenance", "fleet and mobile"],
    industryAliases: ["Fleet maintenance", "Mobile equipment maintenance", "Fleet & Mobile Equipment"],
    topicSeedPhrases: ["fleet maintenance service", "mobile equipment maintenance"],
  }),
  vertical({
    id: "material_handling",
    label: "Material Handling",
    operationalFocus: ["assets", "pm", "inspections", "dispatch"],
    profileMatchPatterns: ["material-handling", "material handling", "forklift"],
    industryAliases: [
      "Forklift and material-handling service",
      "Material handling service",
      "Forklift service",
    ],
    topicSeedPhrases: ["forklift service", "material handling equipment maintenance"],
    naicsHints: ["811310"],
  }),
] as const

const REGISTRY_BY_ID = new Map(
  SUPPORTED_SERVICE_VERTICALS_REGISTRY.map((entry) => [entry.id, entry]),
)

function normalizeMatchText(value: string): string {
  return value.trim().toLowerCase()
}

function patternMatchesIndustry(pattern: string, industryLabel: string): boolean {
  const normalized = normalizeMatchText(industryLabel)
  if (pattern.startsWith("\\b")) {
    return new RegExp(pattern, "i").test(industryLabel)
  }
  return normalized.includes(normalizeMatchText(pattern))
}

export type ResolvedSupportedServiceVertical = {
  id: string
  label: string
  operationalFocus: OperationalCapability[]
  industryAliases: string[]
  topicSeedPhrases: string[]
  naicsHints: string[]
  profileLabels: string[]
  registryBacked: boolean
}

function slugifyVerticalId(label: string): string {
  return (
    "profile:" +
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80)
  )
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function resolveRegistryVerticalForIndustryLabel(
  industryLabel: string,
): SupportedServiceVerticalDefinition[] {
  const normalized = normalizeMatchText(industryLabel)
  const matches: SupportedServiceVerticalDefinition[] = []
  for (const definition of SUPPORTED_SERVICE_VERTICALS_REGISTRY) {
    if (
      definition.profileMatchPatterns.some((pattern) => patternMatchesIndustry(pattern, industryLabel)) ||
      definition.industryAliases.some((alias) => normalizeMatchText(alias) === normalized) ||
      normalizeMatchText(definition.label) === normalized
    ) {
      matches.push(definition)
    }
  }
  return matches
}

export function resolveSupportedServiceVerticalDefinition(
  id: string,
): SupportedServiceVerticalDefinition | null {
  return REGISTRY_BY_ID.get(id as SupportedServiceVerticalId) ?? null
}

export function resolveSupportedServiceVerticalsFromProfile(input: {
  targetIndustries: readonly string[]
  explicitVerticals?: readonly BusinessProfileSupportedServiceVerticalRef[] | null
}): ResolvedSupportedServiceVertical[] {
  const byId = new Map<string, ResolvedSupportedServiceVertical>()

  const mergeVertical = (entry: ResolvedSupportedServiceVertical) => {
    const existing = byId.get(entry.id)
    if (!existing) {
      byId.set(entry.id, entry)
      return
    }
    byId.set(entry.id, {
      ...existing,
      profileLabels: uniqueStrings([...existing.profileLabels, ...entry.profileLabels]),
      industryAliases: uniqueStrings([...existing.industryAliases, ...entry.industryAliases]),
      topicSeedPhrases: uniqueStrings([...existing.topicSeedPhrases, ...entry.topicSeedPhrases]),
      naicsHints: uniqueStrings([...existing.naicsHints, ...entry.naicsHints]),
      operationalFocus: uniqueStrings([
        ...existing.operationalFocus,
        ...entry.operationalFocus,
      ]) as OperationalCapability[],
    })
  }

  for (const explicit of input.explicitVerticals ?? []) {
    const definition = resolveSupportedServiceVerticalDefinition(explicit.id)
    if (definition) {
      mergeVertical({
        id: definition.id,
        label: explicit.label.trim() || definition.label,
        operationalFocus: [...definition.operationalFocus],
        industryAliases: uniqueStrings([...definition.industryAliases, explicit.label]),
        topicSeedPhrases: [...definition.topicSeedPhrases],
        naicsHints: [...(definition.naicsHints ?? [])],
        profileLabels: [explicit.label.trim() || definition.label],
        registryBacked: true,
      })
      continue
    }
    mergeVertical({
      id: explicit.id.trim() || slugifyVerticalId(explicit.label),
      label: explicit.label.trim(),
      operationalFocus: ["dispatch", "technicians", "work_orders", "recurring_maintenance"],
      industryAliases: [explicit.label.trim()],
      topicSeedPhrases: [explicit.label.trim()],
      naicsHints: [],
      profileLabels: [explicit.label.trim()],
      registryBacked: false,
    })
  }

  for (const industryLabel of input.targetIndustries) {
    const trimmed = industryLabel.trim()
    if (!trimmed) continue

    const registryMatches = resolveRegistryVerticalForIndustryLabel(trimmed)
    if (registryMatches.length > 0) {
      for (const definition of registryMatches) {
        mergeVertical({
          id: definition.id,
          label: definition.label,
          operationalFocus: [...definition.operationalFocus],
          industryAliases: uniqueStrings([...definition.industryAliases, trimmed]),
          topicSeedPhrases: [...definition.topicSeedPhrases],
          naicsHints: [...(definition.naicsHints ?? [])],
          profileLabels: [trimmed],
          registryBacked: true,
        })
      }
      continue
    }

    mergeVertical({
      id: slugifyVerticalId(trimmed),
      label: trimmed,
      operationalFocus: ["dispatch", "technicians", "work_orders", "recurring_maintenance"],
      industryAliases: [trimmed],
      topicSeedPhrases: [trimmed],
      naicsHints: [],
      profileLabels: [trimmed],
      registryBacked: false,
    })
  }

  return [...byId.values()]
}

const QUALIFICATION_CAPABILITY_PATTERNS: ReadonlyArray<{
  pattern: RegExp
  capability: OperationalCapability
}> = [
  { pattern: /dispatch/i, capability: "dispatch" },
  { pattern: /technician|maintenance personnel|field service personnel/i, capability: "technicians" },
  { pattern: /work order/i, capability: "work_orders" },
  { pattern: /recurring service|service contract|service agreement/i, capability: "service_contracts" },
  { pattern: /preventive maintenance|\bpm\b|recurring maintenance/i, capability: "preventive_maintenance" },
  { pattern: /recurring maintenance|recurring service/i, capability: "recurring_maintenance" },
  { pattern: /inspection|deficienc/i, capability: "inspections" },
  { pattern: /install/i, capability: "installations" },
  { pattern: /warrant/i, capability: "warranties" },
  { pattern: /customer-owned|customer asset|installed-base|installed base/i, capability: "customer_assets" },
  { pattern: /fleet|asset tracking|equipment history/i, capability: "assets" },
  { pattern: /compliance|regulatory|traceability/i, capability: "compliance" },
  { pattern: /calibrat/i, capability: "calibration" },
]

export function extractOperationalCapabilitiesFromQualificationCriteria(
  criteria: readonly string[],
): OperationalCapability[] {
  const found = new Set<OperationalCapability>()
  for (const line of criteria) {
    for (const { pattern, capability } of QUALIFICATION_CAPABILITY_PATTERNS) {
      if (pattern.test(line)) found.add(capability)
    }
  }
  return [...found]
}

export function extractOperationalCapabilitiesFromKeywords(
  keywords: readonly string[],
): OperationalCapability[] {
  return extractOperationalCapabilitiesFromQualificationCriteria(keywords)
}

export function mergeOperationalCapabilities(
  ...groups: readonly OperationalCapability[][]
): OperationalCapability[] {
  const found = new Set<OperationalCapability>()
  for (const group of groups) {
    for (const capability of group) found.add(capability)
  }
  return [...found]
}

export function buildIndustryAliasesFromVerticals(
  verticals: readonly ResolvedSupportedServiceVertical[],
): string[] {
  return uniqueStrings(verticals.flatMap((vertical) => vertical.industryAliases))
}

export function buildTopicSeedPhrasesFromVerticals(
  verticals: readonly ResolvedSupportedServiceVertical[],
): string[] {
  return uniqueStrings(verticals.flatMap((vertical) => vertical.topicSeedPhrases))
}

export function buildProspectSearchPrimaryQueryLabel(
  verticals: readonly ResolvedSupportedServiceVertical[],
): string {
  if (verticals.length === 0) return "customer-facing equipment service organizations"
  if (verticals.length === 1) {
    return verticals[0]!.profileLabels[0] ?? verticals[0]!.label
  }
  if (verticals.length <= 3) {
    return verticals.map((vertical) => vertical.label).join(", ")
  }
  return `customer-facing equipment service organizations (${verticals.length} supported service verticals)`
}
