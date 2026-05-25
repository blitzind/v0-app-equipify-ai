import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"

export function computeTalkListenBalanceScore(input: CallIntelligenceScoreInputs): number {
  if (input.talkRatioInGoalRange) return 85
  if (input.repTalkPercent > 70) return 30
  if (input.repTalkPercent > 60) return 45
  return 65
}
