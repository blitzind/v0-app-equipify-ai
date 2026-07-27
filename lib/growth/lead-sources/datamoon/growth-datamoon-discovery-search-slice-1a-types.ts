/** AVA-DISCOVERY-SEARCH-DIVERSITY-AND-EXHAUSTION-1A — Discovery search slice types (client-safe). */

export const GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER =
  "ava-discovery-search-diversity-and-exhaustion-1a-v1" as const

/** Minimum selected companies before exhaustion signals are meaningful. */
export const DISCOVERY_SLICE_MIN_SELECTED_FOR_EXHAUSTION = 5 as const

/** Novelty rate below this counts as low-novelty for the slice. */
export const DISCOVERY_SLICE_LOW_NOVELTY_RATE_THRESHOLD = 0.1 as const

/** Consecutive low-novelty runs before a slice is temporarily exhausted. */
export const DISCOVERY_SLICE_CONSECUTIVE_LOW_NOVELTY_FOR_EXHAUSTION = 2 as const

/** Topic phrase rotations within one cluster+geo slice (DataMoon has no page API). */
export const DISCOVERY_SLICE_MAX_TOPIC_VARIANTS = 3 as const

/** Cooldown before revisiting an exhausted slice (ms). */
export const DISCOVERY_SLICE_EXHAUSTION_COOLDOWN_MS = 24 * 60 * 60 * 1000 as const

export type DatamoonDiscoveryGeoBucket = {
  id: string
  label: string
  stateCodes: readonly string[]
}

/** USA geographic buckets for provider `personal_state` filtering. */
export const DATAMOON_DISCOVERY_US_GEO_BUCKETS: readonly DatamoonDiscoveryGeoBucket[] = [
  {
    id: "us_northeast",
    label: "US Northeast",
    stateCodes: ["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA"],
  },
  {
    id: "us_southeast",
    label: "US Southeast",
    stateCodes: ["DE", "MD", "DC", "VA", "WV", "NC", "SC", "GA", "FL", "KY", "TN", "AL", "MS", "LA", "AR"],
  },
  {
    id: "us_midwest",
    label: "US Midwest",
    stateCodes: ["OH", "IN", "IL", "MI", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"],
  },
  {
    id: "us_southwest",
    label: "US Southwest",
    stateCodes: ["TX", "OK", "NM", "AZ"],
  },
  {
    id: "us_west",
    label: "US West",
    stateCodes: ["CO", "WY", "MT", "ID", "UT", "NV", "CA", "OR", "WA", "AK", "HI"],
  },
] as const

/** Completed search result category for slice rotation diagnostics. */
export type DatamoonDiscoverySearchSliceOutcomeKind =
  | "zero_provider_results"
  | "zero_after_normalization"
  | "duplicate_exhaustion"
  | "qualification_rejection"
  | "novel_intake"

export type DatamoonDiscoverySearchSliceOutcome = {
  sliceKey: string
  clusterId: string
  geoBucketId: string
  topicVariantIndex: number
  lastQueriedAt: string | null
  lastSelectedCount: number
  lastPushedCount: number
  lastExistingCount: number
  lastNoveltyRate: number | null
  lastOutcomeKind: DatamoonDiscoverySearchSliceOutcomeKind | null
  consecutiveLowNoveltyRuns: number
  exhaustedUntil: string | null
}

export type DatamoonDiscoverySearchSliceState = {
  qaMarker: typeof GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER
  currentSliceKey: string | null
  slices: Record<string, DatamoonDiscoverySearchSliceOutcome>
  lastSliceSelectionAt: string | null
}

export type DatamoonDiscoverySearchSliceSelection = {
  qaMarker: typeof GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER
  sliceKey: string
  clusterId: string
  clusterRotationIndex: number
  geoBucketId: string
  geoBucketLabel: string
  stateCodes: string[]
  topicVariantIndex: number
  selectionReason: string
  resumedSlice: boolean
  advancedTopicVariant: boolean
  rotatedFromSliceKey: string | null
}

export function buildDiscoverySearchSliceKey(clusterId: string, geoBucketId: string): string {
  return `${clusterId}:${geoBucketId}`
}

export function parseDiscoverySearchSliceKey(sliceKey: string): {
  clusterId: string
  geoBucketId: string
} | null {
  const idx = sliceKey.indexOf(":")
  if (idx <= 0) return null
  return {
    clusterId: sliceKey.slice(0, idx),
    geoBucketId: sliceKey.slice(idx + 1),
  }
}

export function emptyDatamoonDiscoverySearchSliceState(): DatamoonDiscoverySearchSliceState {
  return {
    qaMarker: GROWTH_DATAMOON_DISCOVERY_SEARCH_SLICE_1A_QA_MARKER,
    currentSliceKey: null,
    slices: {},
    lastSliceSelectionAt: null,
  }
}
