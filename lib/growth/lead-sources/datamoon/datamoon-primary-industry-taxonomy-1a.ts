/** GE-AIOS-DATAMOON-PRIMARY-INDUSTRY-TAXONOMY-MAPPING-1A — Proven DataMoon primary_industry taxonomy (adapter-only). */

import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS,
  type DatamoonOperationalVerticalClusterDefinition,
  resolveAvailableOperationalVerticalClusters,
} from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import type { DatamoonOperationalTargetingTranslation } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"

export const GROWTH_DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_1A_QA_MARKER =
  "ge-aios-datamoon-primary-industry-taxonomy-mapping-1a-v1" as const

export const DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION = "datamoon-primary-industry-taxonomy-2026-07-16" as const

export const DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY =
  "no_proven_datamoon_taxonomy_mapping_for_selected_cluster" as const

/**
 * Proven live DataMoon `primary_industry` taxonomy values only.
 * Production probe 5979/5980 + controlled validation 2026-07-16.
 */
export const DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES = [
  "Machinery Manufacturing",
  "Industrial Machinery Manufacturing",
] as const

export type DatamoonProvenPrimaryIndustryTaxonomyValue =
  (typeof DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES)[number]

export type DatamoonPrimaryIndustryTaxonomyMappingEvidence = {
  omtClusterId: string
  ssvVerticalId: string | null
  datamoonTaxonomyValue: DatamoonProvenPrimaryIndustryTaxonomyValue
  evidenceSource: string
}

/** Production-proven OMT cluster → DataMoon primary_industry taxonomy (exact `in` values). */
export const DATAMOON_OMT_CLUSTER_PRIMARY_INDUSTRY_TAXONOMY: Readonly<
  Record<string, readonly DatamoonProvenPrimaryIndustryTaxonomyValue[]>
> = {
  industrial_material: ["Machinery Manufacturing", "Industrial Machinery Manufacturing"],
} as const

export const DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_MAPPING_EVIDENCE: readonly DatamoonPrimaryIndustryTaxonomyMappingEvidence[] =
  [
    {
      omtClusterId: "industrial_material",
      ssvVerticalId: "industrial_equipment",
      datamoonTaxonomyValue: "Machinery Manufacturing",
      evidenceSource: "Production probe audience 5979 exact-in filter; poll returned Machinery Manufacturing",
    },
    {
      omtClusterId: "industrial_material",
      ssvVerticalId: "industrial_equipment",
      datamoonTaxonomyValue: "Industrial Machinery Manufacturing",
      evidenceSource: "Production probe audience 5979 exact-in filter; poll returned Industrial Machinery Manufacturing",
    },
    {
      omtClusterId: "industrial_material",
      ssvVerticalId: "material_handling",
      datamoonTaxonomyValue: "Machinery Manufacturing",
      evidenceSource: "Production probe 5979/5980; industrial rotation cluster 5974 context",
    },
    {
      omtClusterId: "industrial_material",
      ssvVerticalId: "material_handling",
      datamoonTaxonomyValue: "Industrial Machinery Manufacturing",
      evidenceSource: "Production probe 5979; controlled taxonomy validation 2026-07-16",
    },
  ] as const

const MAX_PRIMARY_INDUSTRY_TAXONOMY_VALUES = 5 as const

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function uniqueTaxonomyValues(values: readonly string[]): DatamoonProvenPrimaryIndustryTaxonomyValue[] {
  const allowed = new Set<string>(DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES)
  const seen = new Set<string>()
  const output: DatamoonProvenPrimaryIndustryTaxonomyValue[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || !allowed.has(trimmed)) continue
    const key = normalizeKey(trimmed)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed as DatamoonProvenPrimaryIndustryTaxonomyValue)
    if (output.length >= MAX_PRIMARY_INDUSTRY_TAXONOMY_VALUES) break
  }
  return output
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

function resolvePrimaryOperationalCluster(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): DatamoonOperationalVerticalClusterDefinition {
  const availableClusters = resolveAvailableOperationalVerticalClusters(input.projection)
  const rotationIndex =
    input.operationalTargeting.rotationIndex %
    Math.max(availableClusters.length, 1)
  return (
    availableClusters[rotationIndex] ??
    availableClusters[0] ?? {
      id: "general_field_service",
      label: input.operationalTargeting.operationalCluster,
      verticalIds: [],
      broadeningAnchors: [],
    }
  )
}

export function isDatamoonProvenPrimaryIndustryTaxonomyValue(
  value: string,
): value is DatamoonProvenPrimaryIndustryTaxonomyValue {
  return (DATAMOON_PROVEN_PRIMARY_INDUSTRY_TAXONOMY_VALUES as readonly string[]).includes(value)
}

export function resolveDatamoonPrimaryIndustryTaxonomyForOperationalCluster(
  clusterId: string,
): DatamoonProvenPrimaryIndustryTaxonomyValue[] {
  const mapped = DATAMOON_OMT_CLUSTER_PRIMARY_INDUSTRY_TAXONOMY[clusterId]
  if (!mapped || mapped.length === 0) return []
  return uniqueTaxonomyValues(mapped)
}

export type DatamoonPrimaryIndustryTaxonomyResolution = {
  values: DatamoonProvenPrimaryIndustryTaxonomyValue[]
  applied: boolean
  omissionReason: string | null
  taxonomyVersion: typeof DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION
  sourceCluster: string
  sourceClusterId: string
  sourceVerticalIds: string[]
}

export function resolveDatamoonPrimaryIndustryTaxonomyFromCanonicalProjection(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): DatamoonPrimaryIndustryTaxonomyResolution {
  const primaryCluster = resolvePrimaryOperationalCluster(input)
  const sourceVerticalIds = verticalIdsForCluster(input.projection, primaryCluster)
  const values = resolveDatamoonPrimaryIndustryTaxonomyForOperationalCluster(primaryCluster.id)

  return {
    values,
    applied: values.length > 0,
    omissionReason:
      values.length > 0 ? null : DATAMOON_PRIMARY_INDUSTRY_FILTER_OMISSION_REASON_NO_PROVEN_TAXONOMY,
    taxonomyVersion: DATAMOON_PRIMARY_INDUSTRY_TAXONOMY_VERSION,
    sourceCluster: primaryCluster.label,
    sourceClusterId: primaryCluster.id,
    sourceVerticalIds,
  }
}

/** Certification helper — adjacent-cluster vertical IDs must not drive primary-industry taxonomy. */
export function listAdjacentClusterVerticalIds(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): string[] {
  const availableClusters = resolveAvailableOperationalVerticalClusters(input.projection)
  if (availableClusters.length === 0) return []
  const rotationIndex =
    input.operationalTargeting.rotationIndex %
    Math.max(availableClusters.length, 1)
  const primaryCluster = availableClusters[rotationIndex]!
  const adjacentCluster = availableClusters[(rotationIndex + 1) % availableClusters.length]!
  const primaryIds = new Set(verticalIdsForCluster(input.projection, primaryCluster))
  return verticalIdsForCluster(input.projection, adjacentCluster).filter((id) => !primaryIds.has(id))
}

export function listAllDatamoonOperationalClusterIds(): string[] {
  return DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS.map((cluster) => cluster.id)
}
