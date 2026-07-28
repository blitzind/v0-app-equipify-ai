/** AVA-DISCOVERY-BROAD-SEARCH-SIGNAL-RECOVERY-1A — Slice-guided broad DataMoon discovery signals (client-safe). */

import type { DatamoonOperationalTargetingTranslation } from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import {
  DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS,
} from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import type { DatamoonDiscoverySearchSliceSelection } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"

export const GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER =
  "ava-discovery-broad-search-signal-recovery-1a-v1" as const

/** Broad discovery uses one primary concept (+ at most one resolved topic_id backup). */
export const AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS = 2 as const

export const AUTONOMOUS_BROAD_DISCOVERY_GEO_POLICY = "us_wide" as const

/** Fallback concepts when slice/cluster metadata is unavailable. */
export const AUTONOMOUS_CORE_SERVICE_DISCOVERY_CONCEPTS = [
  "equipment service",
  "equipment maintenance",
  "field service operations",
  "preventive maintenance contracts",
  "equipment repair",
  "equipment installation service",
  "equipment inspection services",
  "equipment calibration services",
  "service agreement management",
  "commercial equipment repair",
] as const

export type AutonomousBroadDiscoveryConcept = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER
  primaryConcept: string
  conceptSource: "slice_cluster_anchor" | "operational_targeting" | "core_fallback"
  sliceKey: string | null
  clusterId: string | null
  geoBucketId: string | null
  topicVariantIndex: number
  geoPolicy: typeof AUTONOMOUS_BROAD_DISCOVERY_GEO_POLICY
}

export type AutonomousBroadDiscoveryObservability = {
  qaMarker: typeof GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER
  autonomousBroadProviderDiscovery: true
  autonomousBroadSearchSignal: true
  qualificationFiltersDeferred: true
  providerDiscoveryConcept: string
  providerDiscoveryConceptSource: AutonomousBroadDiscoveryConcept["conceptSource"]
  discoverySearchSliceKey: string | null
  discoveryClusterId: string | null
  discoveryGeoBucketId: string | null
  topicVariantIndex: number
  geoPolicy: typeof AUTONOMOUS_BROAD_DISCOVERY_GEO_POLICY
}

function normalizeConcept(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function conceptPoolForSlice(input: {
  searchSlice?: DatamoonDiscoverySearchSliceSelection | null
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): { pool: string[]; source: AutonomousBroadDiscoveryConcept["conceptSource"] } {
  const cluster =
    input.searchSlice?.clusterId != null
      ? DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS.find((row) => row.id === input.searchSlice?.clusterId) ??
        null
      : null

  if (cluster?.broadeningAnchors.length) {
    return {
      pool: cluster.broadeningAnchors.map(normalizeConcept).filter((row) => row.length >= 3),
      source: "slice_cluster_anchor",
    }
  }

  if (input.operationalTargeting.clusterBroadeningAnchors.length > 0) {
    return {
      pool: input.operationalTargeting.clusterBroadeningAnchors
        .map(normalizeConcept)
        .filter((row) => row.length >= 3),
      source: "operational_targeting",
    }
  }

  return {
    pool: [...AUTONOMOUS_CORE_SERVICE_DISCOVERY_CONCEPTS],
    source: "core_fallback",
  }
}

/** One broad provider discovery concept per slice variant — not an ICP qualification gate. */
export function resolveAutonomousBroadDiscoveryConceptFromSlice(input: {
  searchSlice?: DatamoonDiscoverySearchSliceSelection | null
  operationalTargeting: DatamoonOperationalTargetingTranslation
}): AutonomousBroadDiscoveryConcept {
  const { pool, source } = conceptPoolForSlice(input)
  const topicVariantIndex = Math.max(0, Math.floor(input.searchSlice?.topicVariantIndex ?? 0))
  const primaryConcept =
    pool[topicVariantIndex % Math.max(pool.length, 1)] ??
    pool[0] ??
    AUTONOMOUS_CORE_SERVICE_DISCOVERY_CONCEPTS[0]

  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER,
    primaryConcept: normalizeConcept(primaryConcept),
    conceptSource: source,
    sliceKey: input.searchSlice?.sliceKey ?? null,
    clusterId: input.searchSlice?.clusterId ?? null,
    geoBucketId: input.searchSlice?.geoBucketId ?? null,
    topicVariantIndex,
    geoPolicy: AUTONOMOUS_BROAD_DISCOVERY_GEO_POLICY,
  }
}

export function buildAutonomousBroadDiscoveryObservability(
  concept: AutonomousBroadDiscoveryConcept,
): AutonomousBroadDiscoveryObservability {
  return {
    qaMarker: GROWTH_DATAMOON_AUTONOMOUS_BROAD_SEARCH_SIGNAL_1A_QA_MARKER,
    autonomousBroadProviderDiscovery: true,
    autonomousBroadSearchSignal: true,
    qualificationFiltersDeferred: true,
    providerDiscoveryConcept: concept.primaryConcept,
    providerDiscoveryConceptSource: concept.conceptSource,
    discoverySearchSliceKey: concept.sliceKey,
    discoveryClusterId: concept.clusterId,
    discoveryGeoBucketId: concept.geoBucketId,
    topicVariantIndex: concept.topicVariantIndex,
    geoPolicy: concept.geoPolicy,
  }
}

export function limitAutonomousBroadDiscoveryTopicIds(topicIds: readonly string[]): string[] {
  return [...new Set(topicIds.map((row) => row.trim()).filter(Boolean))].slice(
    0,
    AUTONOMOUS_BROAD_DISCOVERY_MAX_TOPIC_IDS,
  )
}
