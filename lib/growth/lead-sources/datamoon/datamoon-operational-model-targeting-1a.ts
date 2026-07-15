/** GE-AIOS-DATAMOON-OPERATIONAL-MODEL-TARGETING-1A — Provider-neutral operational intent → DataMoon topic targeting (client-safe). */

import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import type { OperationalCapability } from "@/lib/growth/business-profile/supported-service-verticals"
import { DATAMOON_MAX_TOPIC_IDS } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_OPERATIONAL_MODEL_TARGETING_1A_QA_MARKER =
  "ge-aios-datamoon-operational-model-targeting-1a-v1" as const

export const DATAMOON_OPERATIONAL_TARGETING_STRATEGY_VERSION = "1a-v1" as const

export type DatamoonOperationalVerticalClusterDefinition = {
  id: string
  label: string
  verticalIds: readonly string[]
  broadeningAnchors: readonly string[]
}

/** Deterministic vertical clusters for autonomous audience rotation. */
export const DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS: readonly DatamoonOperationalVerticalClusterDefinition[] = [
  {
    id: "medical_biomedical",
    label: "Medical & Biomedical Equipment",
    verticalIds: ["medical_equipment", "biomedical_equipment", "calibration_inspection"],
    broadeningAnchors: [
      "medical equipment service",
      "biomedical equipment maintenance",
      "equipment calibration services",
      "preventive maintenance contracts",
      "clinical equipment service",
    ],
  },
  {
    id: "hvac_mechanical",
    label: "Commercial HVAC & Mechanical",
    verticalIds: ["hvac_r", "commercial_hvac", "refrigeration_service", "mep"],
    broadeningAnchors: [
      "commercial hvac maintenance",
      "hvac preventive maintenance",
      "field service operations",
      "service dispatch operations",
      "recurring maintenance contracts",
    ],
  },
  {
    id: "industrial_material",
    label: "Industrial & Material Handling",
    verticalIds: ["industrial_equipment", "material_handling", "commercial_equipment", "equipment_rental"],
    broadeningAnchors: [
      "industrial equipment maintenance",
      "material handling service",
      "preventive maintenance program",
      "asset lifecycle management",
      "service agreement management",
    ],
  },
  {
    id: "fire_security_compliance",
    label: "Fire, Security & Compliance",
    verticalIds: ["fire_security", "generator_power", "calibration_inspection"],
    broadeningAnchors: [
      "fire protection inspection",
      "security systems service",
      "equipment compliance inspections",
      "generator maintenance service",
      "inspection documentation",
    ],
  },
  {
    id: "field_service_trades",
    label: "Field Service & Trades",
    verticalIds: [
      "field_service",
      "plumbing",
      "electrical",
      "specialty_contractors",
      "garage_door",
      "locksmith",
      "septic",
    ],
    broadeningAnchors: [
      "field service operations",
      "service dispatch operations",
      "preventive maintenance contracts",
      "work order management",
      "recurring maintenance contracts",
    ],
  },
  {
    id: "facility_property",
    label: "Facility & Property Maintenance",
    verticalIds: ["facility_maintenance", "property_management", "elevator_lift"],
    broadeningAnchors: [
      "facility maintenance service",
      "property maintenance operations",
      "elevator maintenance service",
      "preventive maintenance program",
      "multi-site property maintenance",
    ],
  },
  {
    id: "commercial_kitchen_fleet",
    label: "Commercial Kitchen & Fleet",
    verticalIds: ["commercial_kitchen", "fleet_mobile_equipment", "appliance_repair", "av_installation"],
    broadeningAnchors: [
      "commercial kitchen equipment service",
      "fleet maintenance operations",
      "appliance repair service",
      "field service operations",
      "preventive maintenance contracts",
    ],
  },
] as const

export const OPERATIONAL_CAPABILITY_TOPIC_PHRASES: Record<OperationalCapability, string> = {
  dispatch: "service dispatch operations",
  technicians: "field technician operations",
  work_orders: "work order management",
  recurring_maintenance: "recurring maintenance contracts",
  preventive_maintenance: "preventive maintenance contracts",
  inspections: "equipment inspection services",
  service_contracts: "service agreement management",
  installations: "equipment installation service",
  warranties: "equipment warranty service",
  customer_assets: "customer asset management",
  compliance: "equipment compliance inspections",
  calibration: "equipment calibration services",
  assets: "asset lifecycle management",
  pm: "preventive maintenance program",
}

export type DatamoonOperationalTargetingTranslation = {
  operationalCluster: string
  selectedVerticalIds: string[]
  topicPhrases: string[]
  operationalConcepts: string[]
  industryAliasesUsed: string[]
  qualificationCriteriaUsed: string[]
  qualificationTopics: string[]
  resolvedTopicQueries: string[]
  clusterBroadeningAnchors: string[]
  rotationIndex: number
}

export type DatamoonOperationalTargetingStrategyMetadata = {
  version: typeof DATAMOON_OPERATIONAL_TARGETING_STRATEGY_VERSION
  operationalCluster: string
  selectedVerticalCluster: string
  selectedVerticalIds: string[]
  topicPhrases: string[]
  industryAliases: string[]
  operationalConcepts: string[]
  qualificationTopics: string[]
  rotationIndex: number
  resolvedTopicQueries?: string[]
  resolvedTopicIds?: string[]
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const key = normalizeKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function verticalTopicPhrasesForCluster(
  projection: BusinessProfileLeadDiscoveryProjection,
  cluster: DatamoonOperationalVerticalClusterDefinition,
): string[] {
  const verticalIds = new Set(cluster.verticalIds)
  return uniqueStrings(
    projection.supportedServiceVerticals
      .filter((vertical) => verticalIds.has(vertical.id))
      .flatMap((vertical) => vertical.topicSeedPhrases),
  )
}

function verticalIndustryAliasesForCluster(
  projection: BusinessProfileLeadDiscoveryProjection,
  cluster: DatamoonOperationalVerticalClusterDefinition,
): string[] {
  const verticalIds = new Set(cluster.verticalIds)
  return uniqueStrings(
    projection.supportedServiceVerticals
      .filter((vertical) => verticalIds.has(vertical.id))
      .flatMap((vertical) => vertical.industryAliases),
  )
}

function verticalIdsForCluster(
  projection: BusinessProfileLeadDiscoveryProjection,
  cluster: DatamoonOperationalVerticalClusterDefinition,
): string[] {
  const clusterIds = new Set(cluster.verticalIds)
  return projection.supportedServiceVerticals
    .map((vertical) => vertical.id)
    .filter((id) => clusterIds.has(id))
}

export function translateOperationalCapabilityToTopicPhrase(capability: OperationalCapability): string {
  return OPERATIONAL_CAPABILITY_TOPIC_PHRASES[capability]
}

export function translateQualificationCriteriaToTopicPhrases(criteria: readonly string[]): string[] {
  const output: string[] = []
  for (const entry of criteria) {
    const lower = entry.trim().toLowerCase()
    if (!lower) continue
    if (/preventive maintenance|\bpm\b/.test(lower)) output.push("preventive maintenance contracts")
    if (/asset history|asset lifecycle|customer asset/.test(lower)) output.push("asset lifecycle management")
    if (/compliance|inspection|documentation/.test(lower)) output.push("equipment compliance inspections")
    if (/work order|dispatch/.test(lower)) output.push("work order management")
    if (/service contract|recurring|maintenance contract/.test(lower)) output.push("service agreement management")
    if (/technician|field service|field personnel/.test(lower)) output.push("field service operations")
    if (/calibration/.test(lower)) output.push("equipment calibration services")
    if (output.length === 0 && lower.length >= 3) {
      output.push(lower.replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim())
    }
  }
  return uniqueStrings(output)
}

export function resolveAvailableOperationalVerticalClusters(
  projection: BusinessProfileLeadDiscoveryProjection,
): DatamoonOperationalVerticalClusterDefinition[] {
  const verticalIds = new Set(projection.supportedServiceVerticals.map((vertical) => vertical.id))
  const matched = DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS.filter((cluster) =>
    cluster.verticalIds.some((id) => verticalIds.has(id)),
  )
  if (matched.length > 0) {
    return [...matched].sort((left, right) => left.id.localeCompare(right.id))
  }
  return [
    {
      id: "general_field_service",
      label: "General Field Service",
      verticalIds: projection.supportedServiceVerticals.map((vertical) => vertical.id),
      broadeningAnchors: uniqueStrings(projection.topics.slice(0, 5)).concat([
        "field service operations",
        "preventive maintenance contracts",
      ]),
    },
  ]
}

export function resolveOperationalClusterRotationIndex(input: {
  audienceOrdinal: number
  clusterCount: number
}): number {
  if (input.clusterCount <= 0) return 0
  const ordinal = Number.isFinite(input.audienceOrdinal) ? Math.max(0, Math.floor(input.audienceOrdinal)) : 0
  return ordinal % input.clusterCount
}

function buildOperationalConceptPhrases(projection: BusinessProfileLeadDiscoveryProjection): string[] {
  return uniqueStrings([
    ...projection.operationalCapabilities.map((capability) => translateOperationalCapabilityToTopicPhrase(capability)),
    ...translateQualificationCriteriaToTopicPhrases(projection.qualificationCriteria),
    ...projection.keywords,
  ])
}

function pickWeightedTopicPhrases(input: {
  primaryPhrases: readonly string[]
  adjacentPhrases: readonly string[]
  operationalConcepts: readonly string[]
  existingKeys: Set<string>
}): string[] {
  const selected: string[] = []
  const addFromPool = (pool: readonly string[], limit: number) => {
    for (const phrase of pool) {
      if (selected.length >= DATAMOON_MAX_TOPIC_IDS) return
      if (limit <= 0) return
      const key = normalizeKey(phrase)
      if (key.length < 3 || input.existingKeys.has(key)) continue
      input.existingKeys.add(key)
      selected.push(phrase.trim())
      limit -= 1
    }
  }

  addFromPool(input.primaryPhrases, 3)
  addFromPool(input.adjacentPhrases, 1)
  addFromPool(input.operationalConcepts, 1)

  if (selected.length < DATAMOON_MAX_TOPIC_IDS) {
    addFromPool(input.primaryPhrases.slice(3), DATAMOON_MAX_TOPIC_IDS - selected.length)
  }
  if (selected.length < DATAMOON_MAX_TOPIC_IDS) {
    addFromPool(input.adjacentPhrases.slice(1), DATAMOON_MAX_TOPIC_IDS - selected.length)
  }
  if (selected.length < DATAMOON_MAX_TOPIC_IDS) {
    addFromPool(input.operationalConcepts, DATAMOON_MAX_TOPIC_IDS - selected.length)
  }

  return selected.slice(0, DATAMOON_MAX_TOPIC_IDS)
}

function pickIndustryAliasesForCluster(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  cluster: DatamoonOperationalVerticalClusterDefinition
  excludedKeys: Set<string>
}): string[] {
  const aliases = verticalIndustryAliasesForCluster(input.projection, input.cluster)
  const selected: string[] = []
  for (const alias of aliases) {
    if (selected.length >= 2) break
    const key = normalizeKey(alias)
    if (key.length < 3 || input.excludedKeys.has(key)) continue
    selected.push(alias.trim())
  }
  return selected
}

export function translateDatamoonOperationalModelTargeting(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  organizationId: string
  audienceOrdinal?: number
}): DatamoonOperationalTargetingTranslation {
  const availableClusters = resolveAvailableOperationalVerticalClusters(input.projection)
  const rotationIndex = resolveOperationalClusterRotationIndex({
    audienceOrdinal: input.audienceOrdinal ?? 0,
    clusterCount: availableClusters.length,
  })
  const primaryCluster = availableClusters[rotationIndex]!
  const adjacentCluster = availableClusters[(rotationIndex + 1) % availableClusters.length]!

  const primaryPhrases = verticalTopicPhrasesForCluster(input.projection, primaryCluster)
  const adjacentPhrases = verticalTopicPhrasesForCluster(input.projection, adjacentCluster)
  const operationalConcepts = buildOperationalConceptPhrases(input.projection)
  const qualificationTopics = translateQualificationCriteriaToTopicPhrases(input.projection.qualificationCriteria)

  const existingKeys = new Set<string>()
  const topicPhrases = pickWeightedTopicPhrases({
    primaryPhrases,
    adjacentPhrases,
    operationalConcepts,
    existingKeys,
  })
  for (const phrase of topicPhrases) existingKeys.add(normalizeKey(phrase))

  const industryAliasesUsed = pickIndustryAliasesForCluster({
    projection: input.projection,
    cluster: primaryCluster,
    excludedKeys: existingKeys,
  })

  const selectedVerticalIds = uniqueStrings([
    ...verticalIdsForCluster(input.projection, primaryCluster),
    ...verticalIdsForCluster(input.projection, adjacentCluster),
  ])

  const resolvedTopicQueries = uniqueStrings([...topicPhrases, ...industryAliasesUsed])

  return {
    operationalCluster: primaryCluster.label,
    selectedVerticalIds,
    topicPhrases,
    operationalConcepts,
    industryAliasesUsed,
    qualificationCriteriaUsed: [...input.projection.qualificationCriteria],
    qualificationTopics,
    resolvedTopicQueries,
    clusterBroadeningAnchors: [...primaryCluster.broadeningAnchors],
    rotationIndex,
  }
}

export function buildDatamoonOperationalTargetingStrategyMetadata(
  translation: DatamoonOperationalTargetingTranslation,
): DatamoonOperationalTargetingStrategyMetadata {
  return {
    version: DATAMOON_OPERATIONAL_TARGETING_STRATEGY_VERSION,
    operationalCluster: translation.operationalCluster,
    selectedVerticalCluster: translation.operationalCluster,
    selectedVerticalIds: translation.selectedVerticalIds,
    topicPhrases: translation.topicPhrases,
    industryAliases: translation.industryAliasesUsed,
    operationalConcepts: translation.operationalConcepts,
    qualificationTopics: translation.qualificationTopics,
    rotationIndex: translation.rotationIndex,
    resolvedTopicQueries: translation.resolvedTopicQueries,
  }
}

export function mergeDatamoonOperationalTopicSearchQueries(input: {
  topicPhrases: readonly string[]
  supplementalTopicSearchQueries?: readonly string[]
}): string[] {
  const base = uniqueStrings(input.topicPhrases).slice(0, DATAMOON_MAX_TOPIC_IDS)
  const supplemental = uniqueStrings(input.supplementalTopicSearchQueries ?? []).slice(0, 2)
  return uniqueStrings([...base, ...supplemental])
}

export function enrichDatamoonOperationalTargetingStrategyMetadata(input: {
  metadata: DatamoonOperationalTargetingStrategyMetadata
  resolvedTopicQueries?: readonly string[]
  resolvedTopicIds?: readonly string[]
}): DatamoonOperationalTargetingStrategyMetadata {
  return {
    ...input.metadata,
    resolvedTopicQueries: input.resolvedTopicQueries
      ? uniqueStrings(input.resolvedTopicQueries)
      : input.metadata.resolvedTopicQueries,
    resolvedTopicIds: input.resolvedTopicIds
      ? uniqueStrings(input.resolvedTopicIds.map(String))
      : input.metadata.resolvedTopicIds,
  }
}
