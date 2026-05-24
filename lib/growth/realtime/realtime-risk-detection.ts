import type {
  GrowthRealtimeDetectedBuyingSignal,
  GrowthRealtimeDetectedObjection,
  GrowthRealtimeDiscoveryCoverage,
  GrowthRealtimeRiskFlag,
  GrowthRealtimeTalkRatio,
} from "@/lib/growth/realtime/realtime-call-types"
import type { GrowthLeadRealtimeIntelligenceInput } from "@/lib/growth/realtime/realtime-call-types"

export function detectRealtimeRiskFlags(input: {
  talkRatio: GrowthRealtimeTalkRatio
  discovery: GrowthRealtimeDiscoveryCoverage
  objections: GrowthRealtimeDetectedObjection[]
  buyingSignals: GrowthRealtimeDetectedBuyingSignal[]
  lead: GrowthLeadRealtimeIntelligenceInput
  recentProspectSentimentNegative?: boolean
  hasNextStepLanguage?: boolean
}): GrowthRealtimeRiskFlag[] {
  const flags: GrowthRealtimeRiskFlag[] = []

  if (input.talkRatio.flags.includes("talking_too_much")) flags.push("talking_too_much")
  if (input.talkRatio.flags.includes("not_enough_questions")) flags.push("not_enough_questions")
  if (input.discovery.missing.length >= 3) flags.push("low_discovery")
  if (input.recentProspectSentimentNegative) flags.push("negative_sentiment_shift")
  if (input.objections.length >= 3) flags.push("multiple_objections_stacking")
  if (!input.hasNextStepLanguage && input.talkRatio.repWordCount + input.talkRatio.prospectWordCount >= 40) {
    flags.push("no_next_step_identified")
  }
  if (
    input.lead.conversationMomentum === "stalling" ||
    input.lead.conversationMomentum === "slowing"
  ) {
    flags.push("call_momentum_slowing")
  }
  if (
    input.lead.executivePriorityTier === "executive_now" &&
    (input.lead.revenueTrajectory === "at_risk" || input.objections.length >= 2)
  ) {
    flags.push("executive_account_risk")
  }

  return [...new Set(flags)]
}

export function detectNegativeSentiment(text: string): boolean {
  const lower = text.toLowerCase()
  return /\b(frustrated|angry|disappointed|unhappy|not interested|waste of time|terrible)\b/.test(lower)
}

export function detectNextStepLanguage(text: string): boolean {
  return /\b(next step|follow up|schedule|send (over|you)|call back|meeting|demo)\b/i.test(text)
}
