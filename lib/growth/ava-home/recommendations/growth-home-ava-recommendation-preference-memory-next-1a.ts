/** GE-AIOS-NEXT-1A — Operator recommendation preference memory (client-safe, no new AI). */

import type { GrowthHomeAvaRecommendationKind } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1a-types"

export const GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_STORAGE_KEY =
  "equipify:growth-home-ava-recommendation-preferences/v1" as const

export const GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER =
  "ge-aios-next-1a-ava-recommendation-preference-v1" as const

export type GrowthHomeAvaRecommendationPreferenceRecord = {
  kind: GrowthHomeAvaRecommendationKind
  accepted: number
  skipped: number
  lastAcceptedAt: string | null
  lastSkippedAt: string | null
}

type PreferenceStore = {
  qaMarker: typeof GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER
  organizationId: string | null
  records: GrowthHomeAvaRecommendationPreferenceRecord[]
}

function emptyRecord(kind: GrowthHomeAvaRecommendationKind): GrowthHomeAvaRecommendationPreferenceRecord {
  return {
    kind,
    accepted: 0,
    skipped: 0,
    lastAcceptedAt: null,
    lastSkippedAt: null,
  }
}

function readStore(): PreferenceStore {
  if (typeof window === "undefined") {
    return {
      qaMarker: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER,
      organizationId: null,
      records: [],
    }
  }
  try {
    const raw = window.localStorage.getItem(GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as PreferenceStore) : null
    if (!parsed || parsed.qaMarker !== GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER) {
      return {
        qaMarker: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER,
        organizationId: null,
        records: [],
      }
    }
    return parsed
  } catch {
    return {
      qaMarker: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER,
      organizationId: null,
      records: [],
    }
  }
}

function writeStore(store: PreferenceStore): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / privacy mode
  }
}

export function readGrowthHomeAvaRecommendationPreferences(
  organizationId?: string | null,
): GrowthHomeAvaRecommendationPreferenceRecord[] {
  const store = readStore()
  if (organizationId && store.organizationId && store.organizationId !== organizationId) {
    return []
  }
  return store.records
}

function upsertRecord(
  records: GrowthHomeAvaRecommendationPreferenceRecord[],
  kind: GrowthHomeAvaRecommendationKind,
): GrowthHomeAvaRecommendationPreferenceRecord[] {
  const existing = records.find((row) => row.kind === kind)
  if (existing) return records
  return [...records, emptyRecord(kind)]
}

export function recordGrowthHomeAvaRecommendationAccepted(input: {
  kind: GrowthHomeAvaRecommendationKind
  organizationId?: string | null
}): void {
  const store = readStore()
  const now = new Date().toISOString()
  const records = upsertRecord(store.records, input.kind).map((row) =>
    row.kind === input.kind
      ? {
          ...row,
          accepted: row.accepted + 1,
          lastAcceptedAt: now,
        }
      : row,
  )
  writeStore({
    qaMarker: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER,
    organizationId: input.organizationId ?? store.organizationId,
    records,
  })
}

export function recordGrowthHomeAvaRecommendationSkipped(input: {
  kind: GrowthHomeAvaRecommendationKind
  organizationId?: string | null
}): void {
  const store = readStore()
  const now = new Date().toISOString()
  const records = upsertRecord(store.records, input.kind).map((row) =>
    row.kind === input.kind
      ? {
          ...row,
          skipped: row.skipped + 1,
          lastSkippedAt: now,
        }
      : row,
  )
  writeStore({
    qaMarker: GROWTH_AIOS_NEXT_1A_RECOMMENDATION_PREFERENCE_QA_MARKER,
    organizationId: input.organizationId ?? store.organizationId,
    records,
  })
}

/** Lightweight preference boost — reorders existing ranked items only. */
export function applyGrowthHomeAvaRecommendationPreferenceBoost<T extends { kind: GrowthHomeAvaRecommendationKind; rank: number }>(
  items: T[],
  preferences: GrowthHomeAvaRecommendationPreferenceRecord[],
): T[] {
  if (items.length <= 1 || preferences.length === 0) return items

  const scoreAdjustment = (kind: GrowthHomeAvaRecommendationKind): number => {
    const pref = preferences.find((row) => row.kind === kind)
    if (!pref) return 0
    const net = pref.accepted - pref.skipped
    return Math.max(-12, Math.min(12, net * 2))
  }

  return [...items]
    .map((item, index) => ({
      item,
      effectiveRank: item.rank - scoreAdjustment(item.kind) + index * 0.001,
    }))
    .sort((left, right) => left.effectiveRank - right.effectiveRank)
    .map((row, index) => ({ ...row.item, rank: index + 1 }))
}
