import type { GrowthRelationshipSignalKind } from "@/lib/growth/relationship-types"

/** Deterministic meaningful-touch weight registry — future-safe stubs at 0. */
export const RELATIONSHIP_SIGNAL_BASE_POINTS: Record<GrowthRelationshipSignalKind, number> = {
  manual_touch: 3,
  connected_call: 15,
  positive_reply: 25,
  decision_maker_confirmed: 12,
  follow_up_completed: 8,
  human_note_activity: 5,
  decision_maker_engagement: 10,
  multiple_touchpoints: 6,
  call_duration: 0,
  meeting_scheduled: 0,
  unsubscribe: -40,
  not_interested: -35,
  long_silence: -10,
  multiple_failed_attempts: -15,
  bounce: -20,
  suppression: -50,
}

export const MEANINGFUL_TOUCH_KINDS = new Set<GrowthRelationshipSignalKind>([
  "manual_touch",
  "connected_call",
  "positive_reply",
  "decision_maker_confirmed",
  "follow_up_completed",
  "human_note_activity",
  "decision_maker_engagement",
  "multiple_touchpoints",
  "call_duration",
  "meeting_scheduled",
])

export const HIGH_VALUE_RELATIONSHIP_KINDS = new Set<GrowthRelationshipSignalKind>([
  "connected_call",
  "positive_reply",
  "decision_maker_confirmed",
  "decision_maker_engagement",
])

export const RECOVERY_TOUCH_KINDS = new Set<GrowthRelationshipSignalKind>([
  "manual_touch",
  "connected_call",
  "positive_reply",
  "follow_up_completed",
  "decision_maker_engagement",
])

export function relationshipSignalPoints(kind: GrowthRelationshipSignalKind): number {
  return RELATIONSHIP_SIGNAL_BASE_POINTS[kind]
}

export function isMeaningfulRelationshipTouch(kind: GrowthRelationshipSignalKind): boolean {
  return MEANINGFUL_TOUCH_KINDS.has(kind)
}
