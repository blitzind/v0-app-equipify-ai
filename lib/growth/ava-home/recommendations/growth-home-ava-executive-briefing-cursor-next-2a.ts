/** GE-AIOS-NEXT-2A — Executive briefing cursor (client-safe, acknowledgment + snapshot references only). */

import type { AvaNarrativeMetricsSnapshot } from "@/lib/growth/ava-home/narrative/narrative-types"
import {
  GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
  type GrowthHomeAvaExecutiveBriefingCursor,
  type GrowthHomeAvaExecutiveBriefingCursorSnapshot,
  type GrowthHomeAvaExecutiveBriefingHistoryEntry,
  type GrowthHomeAvaExecutiveBriefingInteractionKind,
  type GrowthHomeAvaExecutiveBriefingState,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-briefing-cursor-next-2a-types"

export const GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_STORAGE_KEY =
  "equipify:growth-home-ava-executive-briefing-cursor/v1" as const

export const GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_PASSIVE_SESSION_KEY =
  "equipify:growth-home-ava-executive-briefing-passive-session/v1" as const

const MAX_HISTORY = 30

function emptyCursor(): GrowthHomeAvaExecutiveBriefingCursor {
  return {
    qaMarker: GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER,
    organizationId: null,
    lastMeaningfulInteractionAt: null,
    lastMeaningfulInteractionKind: null,
    lastBriefingAcknowledgedAt: null,
    lastBriefingGeneratedAt: null,
    acknowledgedSnapshot: null,
    briefingHistory: [],
  }
}

function readCursorStore(): GrowthHomeAvaExecutiveBriefingCursor {
  if (typeof window === "undefined") return emptyCursor()
  try {
    const raw = window.localStorage.getItem(GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as GrowthHomeAvaExecutiveBriefingCursor) : null
    if (!parsed || parsed.qaMarker !== GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_QA_MARKER) {
      return emptyCursor()
    }
    return {
      ...emptyCursor(),
      ...parsed,
      briefingHistory: parsed.briefingHistory ?? [],
    }
  } catch {
    return emptyCursor()
  }
}

function writeCursorStore(cursor: GrowthHomeAvaExecutiveBriefingCursor): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_CURSOR_STORAGE_KEY,
      JSON.stringify(cursor),
    )
  } catch {
    // ignore quota / privacy mode
  }
}

export function readGrowthHomeAvaExecutiveBriefingCursor(
  organizationId?: string | null,
): GrowthHomeAvaExecutiveBriefingCursor {
  const cursor = readCursorStore()
  if (organizationId && cursor.organizationId && cursor.organizationId !== organizationId) {
    return emptyCursor()
  }
  return cursor
}

export function buildGrowthHomeAvaExecutiveBriefingCursorSnapshot(input: {
  metricsSnapshot: AvaNarrativeMetricsSnapshot
  leadPoolVisible?: number
  pendingApprovals?: number
  objectiveProgressPercent?: number | null
  lastRecommendationKind?: string | null
}): GrowthHomeAvaExecutiveBriefingCursorSnapshot {
  return {
    ...input.metricsSnapshot,
    leadPoolVisible: input.leadPoolVisible ?? 0,
    pendingApprovals: input.pendingApprovals ?? input.metricsSnapshot.approvalsWaiting,
    objectiveProgressPercent: input.objectiveProgressPercent ?? null,
    lastRecommendationKind: input.lastRecommendationKind ?? null,
  }
}

export function recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction(input: {
  organizationId?: string | null
  kind: GrowthHomeAvaExecutiveBriefingInteractionKind
  at?: string
}): GrowthHomeAvaExecutiveBriefingCursor {
  const cursor = readCursorStore()
  const at = input.at ?? new Date().toISOString()
  const next: GrowthHomeAvaExecutiveBriefingCursor = {
    ...cursor,
    organizationId: input.organizationId ?? cursor.organizationId,
    lastMeaningfulInteractionAt: at,
    lastMeaningfulInteractionKind: input.kind,
  }
  writeCursorStore(next)
  return next
}

export function acknowledgeGrowthHomeAvaExecutiveBriefing(input: {
  organizationId?: string | null
  snapshot: GrowthHomeAvaExecutiveBriefingCursorSnapshot
  state: GrowthHomeAvaExecutiveBriefingState
  headline: string
  at?: string
}): GrowthHomeAvaExecutiveBriefingCursor {
  const cursor = readCursorStore()
  const at = input.at ?? new Date().toISOString()
  const historyEntry: GrowthHomeAvaExecutiveBriefingHistoryEntry = {
    generatedAt: cursor.lastBriefingGeneratedAt ?? at,
    acknowledgedAt: at,
    state: input.state,
    headline: input.headline,
  }
  const next: GrowthHomeAvaExecutiveBriefingCursor = {
    ...cursor,
    organizationId: input.organizationId ?? cursor.organizationId,
    lastBriefingAcknowledgedAt: at,
    lastMeaningfulInteractionAt: at,
    lastMeaningfulInteractionKind: "briefing_reviewed",
    acknowledgedSnapshot: input.snapshot,
    briefingHistory: [historyEntry, ...cursor.briefingHistory].slice(0, MAX_HISTORY),
  }
  writeCursorStore(next)
  return next
}

export function recordGrowthHomeAvaExecutiveBriefingGenerated(input: {
  organizationId?: string | null
  at?: string
}): GrowthHomeAvaExecutiveBriefingCursor {
  const cursor = readCursorStore()
  const at = input.at ?? new Date().toISOString()
  const next: GrowthHomeAvaExecutiveBriefingCursor = {
    ...cursor,
    organizationId: input.organizationId ?? cursor.organizationId,
    lastBriefingGeneratedAt: at,
  }
  writeCursorStore(next)
  return next
}

/** Passive refresh marker — does not move meaningful interaction or acknowledgment cursors. */
export function markGrowthHomeAvaExecutiveBriefingPassiveRefresh(): boolean {
  if (typeof window === "undefined") return false
  try {
    const existing = window.sessionStorage.getItem(GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_PASSIVE_SESSION_KEY)
    if (existing) return true
    window.sessionStorage.setItem(
      GROWTH_AIOS_NEXT_2A_EXECUTIVE_BRIEFING_PASSIVE_SESSION_KEY,
      new Date().toISOString(),
    )
    return false
  } catch {
    return false
  }
}

export function recordGrowthHomeAvaExecutiveBriefingHomeVisit(input: {
  organizationId?: string | null
}): { cursor: GrowthHomeAvaExecutiveBriefingCursor; isPassiveRefresh: boolean } {
  const isPassiveRefresh = markGrowthHomeAvaExecutiveBriefingPassiveRefresh()
  if (isPassiveRefresh) {
    return { cursor: readCursorStore(), isPassiveRefresh: true }
  }
  return {
    cursor: recordGrowthHomeAvaExecutiveBriefingMeaningfulInteraction({
      organizationId: input.organizationId,
      kind: "home_visit",
    }),
    isPassiveRefresh: false,
  }
}

export function hoursSinceIso(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null
  const parsed = Date.parse(iso)
  if (Number.isNaN(parsed)) return null
  return Math.max(0, (now - parsed) / (60 * 60 * 1000))
}
