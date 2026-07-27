/** AVA-DISCOVERY-SEARCH-DIVERSITY-AND-EXHAUSTION-1A — Search slice selection + exhaustion (client-safe). */

import {
  DATAMOON_OPERATIONAL_VERTICAL_CLUSTERS,
  resolveAvailableOperationalVerticalClusters,
  type DatamoonOperationalVerticalClusterDefinition,
} from "@/lib/growth/lead-sources/datamoon/datamoon-operational-model-targeting-1a"
import type { BusinessProfileLeadDiscoveryProjection } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import {
  buildDiscoverySearchSliceKey,
  DATAMOON_DISCOVERY_US_GEO_BUCKETS,
  DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
  DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS,
  DISCOVERY_SLICE_LOW_NOVELTY_RATE_THRESHOLD,
  DISCOVERY_SLICE_MAX_TOPIC_VARIANTS,
  DISCOVERY_SLICE_MIN_SELECTED_FOR_EXHAUSTION,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
  type DatamoonDiscoverySearchSliceOutcome,
  type DatamoonDiscoverySearchSliceOutcomeKind,
  type DatamoonDiscoverySearchSliceSelection,
  type DatamoonDiscoverySearchSliceState,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import type { DatamoonAutonomousDiscoveryStopReason } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"

export {
  DATAMOON_DISCOVERY_US_GEO_BUCKETS,
  DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION,
  DISCOVERY_SLICE_LOW_NOVELTY_RATE_THRESHOLD,
  DISCOVERY_SLICE_MAX_TOPIC_VARIANTS,
  DISCOVERY_SLICE_MIN_SELECTED_FOR_EXHAUSTION,
  GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"

function isSliceExhausted(
  slice: DatamoonDiscoverySearchSliceOutcome | undefined,
  nowMs: number,
): boolean {
  if (!slice?.exhaustedUntil) return false
  return Date.parse(slice.exhaustedUntil) > nowMs
}

function computeNoveltyRate(pushed: number, selected: number): number | null {
  if (selected <= 0) return null
  return pushed / selected
}

/** Stop reasons that reflect provider/system failure — must not affect slice novelty. */
export const DATAMOON_SLICE_OUTCOME_UNTRUSTWORTHY_STOP_REASONS = [
  "datamoon_not_configured",
  "datamoon_disabled",
  "datamoon_dry_run_only",
  "datamoon_budget_exhausted",
  "datamoon_request_active",
  "datamoon_job_failed",
  "datamoon_provider_error",
  "business_profile_missing",
  "fixture_fallback_forbidden",
] as const satisfies readonly DatamoonAutonomousDiscoveryStopReason[]

function isLowNoveltyRun(input: { selected: number; pushed: number }): boolean {
  if (input.selected === 0 && input.pushed === 0) {
    return true
  }
  if (input.selected < DISCOVERY_SLICE_MIN_SELECTED_FOR_EXHAUSTION) return false
  const rate = computeNoveltyRate(input.pushed, input.selected)
  return rate !== null && rate < DISCOVERY_SLICE_LOW_NOVELTY_RATE_THRESHOLD
}

export function resolveDatamoonDiscoverySearchSliceOutcomeKind(input: {
  selectedCount: number
  pushedCount: number
  existingCount: number
  rawCompanyCount?: number
  normalizedCompanyCount?: number
}): DatamoonDiscoverySearchSliceOutcomeKind {
  if (input.pushedCount > 0) return "novel_intake"
  if (input.selectedCount === 0) {
    if ((input.rawCompanyCount ?? 0) === 0) return "zero_provider_results"
    if ((input.normalizedCompanyCount ?? 0) === 0) return "zero_after_normalization"
    return "qualification_rejection"
  }
  if (input.existingCount > 0 && input.pushedCount === 0) return "duplicate_exhaustion"
  return "qualification_rejection"
}

export function isTrustworthyCompletedDatamoonSearchForSliceOutcome(input: {
  datamoonJobActive: boolean
  datamoonStopReason: string | null
  datamoonRunId: string | null
  intakeTerminalized?: boolean
}): boolean {
  if (input.datamoonJobActive) return false
  if (!input.datamoonRunId && input.intakeTerminalized !== true) return false
  if (
    input.datamoonStopReason &&
    (DATAMOON_SLICE_OUTCOME_UNTRUSTWORTHY_STOP_REASONS as readonly string[]).includes(
      input.datamoonStopReason,
    )
  ) {
    return false
  }
  return true
}

export function recordDatamoonDiscoverySearchSliceOutcome(input: {
  state: DatamoonDiscoverySearchSliceState
  selection: Pick<
    DatamoonDiscoverySearchSliceSelection,
    "sliceKey" | "clusterId" | "geoBucketId" | "topicVariantIndex"
  >
  generatedAt: string
  selectedCount: number
  pushedCount: number
  existingCount: number
  rawCompanyCount?: number
  normalizedCompanyCount?: number
}): DatamoonDiscoverySearchSliceState {
  const lowNovelty = isLowNoveltyRun({
    selected: input.selectedCount,
    pushed: input.pushedCount,
  })
  const noveltyRate = computeNoveltyRate(input.pushedCount, input.selectedCount)
  const outcomeKind = resolveDatamoonDiscoverySearchSliceOutcomeKind({
    selectedCount: input.selectedCount,
    pushedCount: input.pushedCount,
    existingCount: input.existingCount,
    rawCompanyCount: input.rawCompanyCount,
    normalizedCompanyCount: input.normalizedCompanyCount,
  })
  const prior = input.state.slices[input.selection.sliceKey]
  const consecutiveLowNoveltyRuns = lowNovelty
    ? (prior?.consecutiveLowNoveltyRuns ?? 0) + 1
    : 0

  let exhaustedUntil: string | null = null
  if (outcomeKind === "zero_provider_results") {
    exhaustedUntil = new Date(
      Date.parse(input.generatedAt) + DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS,
    ).toISOString()
  } else if (
    lowNovelty &&
    consecutiveLowNoveltyRuns >= DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION &&
    input.selection.topicVariantIndex >= DISCOVERY_SLICE_MAX_TOPIC_VARIANTS - 1
  ) {
    exhaustedUntil = new Date(
      Date.parse(input.generatedAt) + DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS,
    ).toISOString()
  } else if (prior?.exhaustedUntil && isSliceExhausted(prior, Date.parse(input.generatedAt))) {
    exhaustedUntil = prior.exhaustedUntil
  }

  const nextSlice: DatamoonDiscoverySearchSliceOutcome = {
    sliceKey: input.selection.sliceKey,
    clusterId: input.selection.clusterId,
    geoBucketId: input.selection.geoBucketId,
    topicVariantIndex: input.selection.topicVariantIndex,
    lastQueriedAt: input.generatedAt,
    lastSelectedCount: input.selectedCount,
    lastPushedCount: input.pushedCount,
    lastExistingCount: input.existingCount,
    lastNoveltyRate: noveltyRate,
    lastOutcomeKind: outcomeKind,
    consecutiveLowNoveltyRuns,
    exhaustedUntil,
  }

  return {
    ...input.state,
    currentSliceKey: input.selection.sliceKey,
    lastSliceSelectionAt: input.generatedAt,
    slices: {
      ...input.state.slices,
      [input.selection.sliceKey]: nextSlice,
    },
  }
}

function listCandidateSlices(input: {
  clusters: DatamoonOperationalVerticalClusterDefinition[]
  geoBuckets: typeof DATAMOON_DISCOVERY_US_GEO_BUCKETS
}): Array<{ sliceKey: string; clusterId: string; geoBucketId: string }> {
  const output: Array<{ sliceKey: string; clusterId: string; geoBucketId: string }> = []
  for (const cluster of input.clusters) {
    for (const geo of input.geoBuckets) {
      output.push({
        sliceKey: buildDiscoverySearchSliceKey(cluster.id, geo.id),
        clusterId: cluster.id,
        geoBucketId: geo.id,
      })
    }
  }
  return output
}

function clusterById(
  clusters: DatamoonOperationalVerticalClusterDefinition[],
  clusterId: string,
): DatamoonOperationalVerticalClusterDefinition | null {
  return clusters.find((row) => row.id === clusterId) ?? null
}

export function selectNextDatamoonDiscoverySearchSlice(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  state: DatamoonDiscoverySearchSliceState
  generatedAt: string
}): DatamoonDiscoverySearchSliceSelection {
  const nowMs = Date.parse(input.generatedAt)
  const clusters = resolveAvailableOperationalVerticalClusters(input.projection)
  const candidates = listCandidateSlices({ clusters, geoBuckets: DATAMOON_DISCOVERY_US_GEO_BUCKETS })

  const currentKey = input.state.currentSliceKey
  const current = currentKey ? input.state.slices[currentKey] : undefined

  if (currentKey && current && !isSliceExhausted(current, nowMs)) {
    const parsed = currentKey.split(":")
    const clusterId = parsed[0] ?? current.clusterId
    const geoBucketId = parsed[1] ?? current.geoBucketId
    const geo = DATAMOON_DISCOVERY_US_GEO_BUCKETS.find((row) => row.id === geoBucketId)
    const cluster = clusterById(clusters, clusterId)
    const clusterRotationIndex = Math.max(0, clusters.findIndex((row) => row.id === clusterId))

    if (
      current.lastOutcomeKind !== "zero_provider_results" &&
      current.consecutiveLowNoveltyRuns > 0 &&
      current.topicVariantIndex < DISCOVERY_SLICE_MAX_TOPIC_VARIANTS - 1
    ) {
      const topicVariantIndex = current.topicVariantIndex + 1
      return {
        qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
        sliceKey: currentKey,
        clusterId,
        clusterRotationIndex,
        geoBucketId,
        geoBucketLabel: geo?.label ?? geoBucketId,
        stateCodes: geo ? [...geo.stateCodes] : [],
        topicVariantIndex,
        selectionReason: "Advance topic variant after low novelty on current slice.",
        resumedSlice: true,
        advancedTopicVariant: true,
        rotatedFromSliceKey: null,
      }
    }

    if (
      current.lastOutcomeKind !== "zero_provider_results" &&
      current.consecutiveLowNoveltyRuns === 0
    ) {
      return {
        qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
        sliceKey: currentKey,
        clusterId,
        clusterRotationIndex,
        geoBucketId,
        geoBucketLabel: geo?.label ?? geoBucketId,
        stateCodes: geo ? [...geo.stateCodes] : [],
        topicVariantIndex: current.topicVariantIndex,
        selectionReason: "Continue current slice with healthy novelty.",
        resumedSlice: true,
        advancedTopicVariant: false,
        rotatedFromSliceKey: null,
      }
    }
  }

  const available = candidates
    .filter((candidate) => !isSliceExhausted(input.state.slices[candidate.sliceKey], nowMs))
    .sort((left, right) => {
      const leftAt = input.state.slices[left.sliceKey]?.lastQueriedAt
      const rightAt = input.state.slices[right.sliceKey]?.lastQueriedAt
      if (!leftAt && !rightAt) return left.sliceKey.localeCompare(right.sliceKey)
      if (!leftAt) return -1
      if (!rightAt) return 1
      return Date.parse(leftAt) - Date.parse(rightAt)
    })

  const picked = available[0] ?? candidates[0]!
  const geo = DATAMOON_DISCOVERY_US_GEO_BUCKETS.find((row) => row.id === picked.geoBucketId)
  const clusterRotationIndex = Math.max(0, clusters.findIndex((row) => row.id === picked.clusterId))

  return {
    qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
    sliceKey: picked.sliceKey,
    clusterId: picked.clusterId,
    clusterRotationIndex,
    geoBucketId: picked.geoBucketId,
    geoBucketLabel: geo?.label ?? picked.geoBucketId,
    stateCodes: geo ? [...geo.stateCodes] : [],
    topicVariantIndex: 0,
    selectionReason:
      available.length > 0
        ? "Rotate to least-recently-searched non-exhausted slice."
        : "All slices cooling down — reuse oldest slice.",
    resumedSlice: false,
    advancedTopicVariant: false,
    rotatedFromSliceKey: currentKey,
  }
}

export function resolveDatamoonDiscoveryClusterRotationIndex(input: {
  projection: BusinessProfileLeadDiscoveryProjection
  clusterRotationIndex: number
}): number {
  const clusters = resolveAvailableOperationalVerticalClusters(input.projection)
  if (clusters.length === 0) return 0
  return ((input.clusterRotationIndex % clusters.length) + clusters.length) % clusters.length
}

export function listOperationalClusterIdsForProjection(
  projection: BusinessProfileLeadDiscoveryProjection,
): string[] {
  return resolveAvailableOperationalVerticalClusters(projection).map((row) => row.id)
}

export function summarizeDiscoverySearchSliceState(state: DatamoonDiscoverySearchSliceState): {
  exhaustedSliceKeys: string[]
  activeSliceKey: string | null
  sliceCount: number
} {
  const nowMs = Date.now()
  const exhaustedSliceKeys = Object.values(state.slices)
    .filter((row) => isSliceExhausted(row, nowMs))
    .map((row) => row.sliceKey)
  return {
    exhaustedSliceKeys,
    activeSliceKey: state.currentSliceKey,
    sliceCount: Object.keys(state.slices).length,
  }
}
