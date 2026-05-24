import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"

export function emptyRealtimeLiveSnapshot(now = new Date()): GrowthRealtimeLiveSnapshot {
  return {
    objections: [],
    buyingSignals: [],
    talkRatio: {
      repTalkPercent: 0,
      prospectTalkPercent: 0,
      repWordCount: 0,
      prospectWordCount: 0,
      inGoalRange: true,
      flags: [],
    },
    discovery: {
      covered: [],
      missing: [
        "timeline_asked",
        "budget_asked",
        "implementation_asked",
        "decision_maker_confirmed",
        "current_solution_identified",
      ],
    },
    riskFlags: [],
    competitorGuidance: [],
    recommendedNextQuestion: null,
    recommendedResponse: null,
    guidanceTips: [],
    computedAt: now.toISOString(),
  }
}
