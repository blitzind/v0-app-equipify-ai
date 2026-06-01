import { mergeRealtimeBuyingSignals } from "@/lib/growth/realtime/realtime-buying-signals"
import { buildRealtimeCompetitorGuidance } from "@/lib/growth/realtime/realtime-competitor-guidance"
import { computeRealtimeDiscoveryCoverage } from "@/lib/growth/realtime/realtime-discovery"
import { buildRealtimeGuidance } from "@/lib/growth/realtime/realtime-guidance"
import { mergeRealtimeObjections } from "@/lib/growth/realtime/realtime-objections"
import {
  detectNegativeSentiment,
  detectNextStepLanguage,
  detectRealtimeRiskFlags,
} from "@/lib/growth/realtime/realtime-risk-detection"
import { computeRealtimeTalkRatio } from "@/lib/growth/realtime/realtime-talk-ratio"
import type {
  GrowthLeadRealtimeIntelligenceInput,
  GrowthRealtimeLiveSnapshot,
  GrowthRealtimeTranscriptEvent,
} from "@/lib/growth/realtime/realtime-call-types"

export function analyzeRealtimeCallTranscript(input: {
  events: GrowthRealtimeTranscriptEvent[]
  lead: GrowthLeadRealtimeIntelligenceInput
  now?: Date
}): GrowthRealtimeLiveSnapshot {
  const now = input.now ?? new Date()
  const transcriptText = input.events.map((event) => event.content).join("\n")
  const objections = mergeRealtimeObjections(
    input.events.map((event) => ({ content: event.content, sequenceNumber: event.sequenceNumber })),
  )
  const buyingSignals = mergeRealtimeBuyingSignals(
    input.events.map((event) => ({
      content: event.content,
      sequenceNumber: event.sequenceNumber,
      speaker: event.speaker,
    })),
  )
  const talkRatio = computeRealtimeTalkRatio(input.events)
  let discovery = computeRealtimeDiscoveryCoverage(input.events)
  if (buyingSignals.some((signal) => signal.key === "decision_maker_confirmed")) {
    const covered = new Set(discovery.covered)
    covered.add("decision_maker_confirmed")
    discovery = {
      covered: [...covered],
      missing: discovery.missing.filter((area) => area !== "decision_maker_confirmed"),
    }
  }
  const competitorGuidance = buildRealtimeCompetitorGuidance(transcriptText)

  const prospectEvents = input.events.filter((event) => event.speaker === "prospect")
  const recentProspectSentimentNegative = prospectEvents
    .slice(-3)
    .some((event) => detectNegativeSentiment(event.content))
  const hasNextStepLanguage = input.events.some((event) => detectNextStepLanguage(event.content))

  const riskFlags = detectRealtimeRiskFlags({
    talkRatio,
    discovery,
    objections,
    buyingSignals,
    lead: input.lead,
    recentProspectSentimentNegative,
    hasNextStepLanguage,
  })

  const guidance = buildRealtimeGuidance({
    lead: input.lead,
    discovery,
    objections,
    buyingSignals,
    riskFlags,
  })

  return {
    objections,
    buyingSignals,
    talkRatio,
    discovery,
    riskFlags,
    competitorGuidance,
    recommendedNextQuestion: guidance.recommendedNextQuestion,
    recommendedResponse: guidance.recommendedResponse,
    guidanceTips: guidance.tips,
    computedAt: now.toISOString(),
  }
}

export function diffRealtimeSnapshot(
  previous: GrowthRealtimeLiveSnapshot | null,
  next: GrowthRealtimeLiveSnapshot,
): {
  newObjections: string[]
  newBuyingSignals: string[]
  newDiscoveryGaps: string[]
  newRiskFlags: string[]
} {
  const prevObjections = new Set(previous?.objections.map((entry) => entry.key) ?? [])
  const prevBuying = new Set(previous?.buyingSignals.map((entry) => entry.key) ?? [])
  const prevDiscovery = new Set(previous?.discovery.missing ?? [])
  const prevRisk = new Set(previous?.riskFlags ?? [])

  return {
    newObjections: next.objections.filter((entry) => !prevObjections.has(entry.key)).map((entry) => entry.key),
    newBuyingSignals: next.buyingSignals.filter((entry) => !prevBuying.has(entry.key)).map((entry) => entry.key),
    newDiscoveryGaps: next.discovery.missing.filter((area) => !prevDiscovery.has(area)),
    newRiskFlags: next.riskFlags.filter((flag) => !prevRisk.has(flag)),
  }
}
