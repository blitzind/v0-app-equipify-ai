/** Pure guidance supersession planner — client-safe for tests. */

import { inferGuidanceDedupeKey } from "@/lib/growth/live-guidance/infer-guidance-dedupe-key"
import type {
  GrowthLiveGuidanceCandidate,
  GrowthLiveGuidanceEvent,
  GrowthLiveGuidanceSeverity,
} from "@/lib/growth/live-guidance/live-guidance-types"

const SEVERITY_WEIGHT: Record<GrowthLiveGuidanceSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

export type GuidanceSyncAction =
  | { type: "dismiss"; eventId: string; reason: "no_longer_relevant" | "superseded" }
  | { type: "insert"; candidate: GrowthLiveGuidanceCandidate }

export function guidanceCandidateRankScore(candidate: GrowthLiveGuidanceCandidate): number {
  return SEVERITY_WEIGHT[candidate.severity] * 100 + candidate.confidenceScore
}

export function guidanceEventRankScore(event: Pick<GrowthLiveGuidanceEvent, "severity" | "confidenceScore">): number {
  return SEVERITY_WEIGHT[event.severity] * 100 + event.confidenceScore
}

export function planGuidanceSync(input: {
  activeEvents: GrowthLiveGuidanceEvent[]
  candidates: GrowthLiveGuidanceCandidate[]
  passesThreshold: (candidate: GrowthLiveGuidanceCandidate) => boolean
}): GuidanceSyncAction[] {
  const eligible = input.candidates.filter(input.passesThreshold)
  const eligibleKeys = new Set(eligible.map((candidate) => candidate.dedupeKey))
  const activeWithKeys = input.activeEvents.map((event) => ({
    event,
    dedupeKey: inferGuidanceDedupeKey(event),
  }))
  const activeByKey = new Map(activeWithKeys.map((entry) => [entry.dedupeKey, entry.event]))
  const actions: GuidanceSyncAction[] = []
  const dismissIds = new Set<string>()

  for (const { event, dedupeKey } of activeWithKeys) {
    if (!eligibleKeys.has(dedupeKey)) {
      actions.push({ type: "dismiss", eventId: event.id, reason: "no_longer_relevant" })
      dismissIds.add(event.id)
    }
  }

  for (const candidate of eligible) {
    if (activeByKey.has(candidate.dedupeKey)) continue

    for (const { event, dedupeKey } of activeWithKeys) {
      if (dismissIds.has(event.id)) continue
      if (event.eventType !== candidate.eventType) continue
      if (dedupeKey === candidate.dedupeKey) continue
      if (guidanceCandidateRankScore(candidate) <= guidanceEventRankScore(event)) continue
      actions.push({ type: "dismiss", eventId: event.id, reason: "superseded" })
      dismissIds.add(event.id)
    }

    actions.push({ type: "insert", candidate })
  }

  return actions
}
