import type { CallIntelligenceScoreInputs } from "@/lib/growth/call-intelligence/call-intelligence-types"

export function computeNextStepScore(input: CallIntelligenceScoreInputs): number {
  if (input.nextStepSecured) return 90
  if (input.meetingFollowUpDue) return 35
  if (input.meetingOutcomeMissing) return 25
  if (input.meetingNoShow) return 15
  return 40
}
