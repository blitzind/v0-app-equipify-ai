/** Stage policy gate — blocks checklist questions outside appropriate conversation stage. */

import type { GrowthLiveGuidanceEventType } from "@/lib/growth/live-guidance/live-guidance-types"
import type { GrowthRealtimeDiscoveryArea } from "@/lib/growth/realtime/realtime-call-types"
import type { ConversationStage } from "@/lib/growth/live-coaching/types"

export type CoachingTopic =
  | "decision_maker"
  | "budget"
  | "timeline"
  | "implementation"
  | "current_solution"

const TOPIC_ALLOWED_STAGES: Record<CoachingTopic, ReadonlySet<ConversationStage>> = {
  decision_maker: new Set(["discovery", "buying_process", "close"]),
  budget: new Set(["pain", "impact", "solution_fit", "buying_process", "close"]),
  timeline: new Set(["impact", "solution_fit", "buying_process", "close"]),
  implementation: new Set(["solution_fit", "buying_process", "close"]),
  current_solution: new Set(["discovery", "pain", "solution_fit"]),
}

export function isCoachingTopicAllowed(stage: ConversationStage, topic: CoachingTopic): boolean {
  return TOPIC_ALLOWED_STAGES[topic].has(stage)
}

export function isDiscoveryAreaAllowed(stage: ConversationStage, area: GrowthRealtimeDiscoveryArea): boolean {
  switch (area) {
    case "decision_maker_confirmed":
      return isCoachingTopicAllowed(stage, "decision_maker")
    case "budget_asked":
      return isCoachingTopicAllowed(stage, "budget")
    case "timeline_asked":
      return isCoachingTopicAllowed(stage, "timeline")
    case "implementation_asked":
      return isCoachingTopicAllowed(stage, "implementation")
    case "current_solution_identified":
      return isCoachingTopicAllowed(stage, "current_solution")
    default:
      return true
  }
}

export function isGuidanceEventAllowedForStage(
  stage: ConversationStage,
  eventType: GrowthLiveGuidanceEventType,
  dedupeKey?: string,
): boolean {
  if (eventType !== "discovery_gap_guidance") return true
  if (dedupeKey?.includes(":dm")) return isCoachingTopicAllowed(stage, "decision_maker")
  if (dedupeKey?.includes(":timeline")) return isCoachingTopicAllowed(stage, "timeline")
  return true
}

const BANNED_PHRASE_PATTERNS: Array<{ topic: CoachingTopic; pattern: RegExp }> = [
  { topic: "decision_maker", pattern: /\b(decision maker|who else|who besides|sign.?off|weigh in|involved in this decision)\b/i },
  { topic: "budget", pattern: /\b(budget|price range|how much can you spend|investment)\b/i },
  { topic: "timeline", pattern: /\b(timeline|by when|go live|implementation timing)\b/i },
]

export function phraseViolatesStagePolicy(stage: ConversationStage, phrase: string): boolean {
  for (const { topic, pattern } of BANNED_PHRASE_PATTERNS) {
    if (pattern.test(phrase) && !isCoachingTopicAllowed(stage, topic)) return true
  }
  return false
}
