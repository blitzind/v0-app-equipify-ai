import type { GrowthReplyBuyingSignalEvidence } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type { ReplyIntentClassificationV2Result } from "@/lib/growth/reply-intelligence/reply-intent-classifier-v2"
import type {
  GrowthOpportunitySignalEvidence,
  GrowthRevenuePhase6SignalType,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

export type DetectedRevenueOpportunitySignal = {
  signalType: GrowthRevenuePhase6SignalType | string
  confidence: "low" | "medium" | "high" | "verified"
  excerpt: string
  source: string
  attribution: Record<string, unknown>
}

const BUYING_SIGNAL_MAP: Record<string, GrowthRevenuePhase6SignalType> = {
  demo_interest: "demo_request",
  pricing_interest: "pricing_interest",
  replacement_intent: "replacement_intent",
  timeline_mentioned: "timeline_interest",
  decision_maker_clue: "decision_maker_detected",
  internal_referral: "multi_person_engagement",
  case_study_request: "technical_evaluation",
  feature_details_request: "technical_evaluation",
  pain_point_mentioned: "roi_discussion",
  current_vendor_mentioned: "competitive_signal",
}

function confidenceFromScore(score: number): DetectedRevenueOpportunitySignal["confidence"] {
  if (score >= 0.8) return "high"
  if (score >= 0.6) return "medium"
  return "low"
}

function confidenceFromTier(tier: string): DetectedRevenueOpportunitySignal["confidence"] {
  if (tier === "high") return "high"
  if (tier === "medium") return "medium"
  return "low"
}

export function detectOpportunitySignalsFromReplyV2(input: {
  bodyPreview: string | null | undefined
  classification: ReplyIntentClassificationV2Result
  buyingSignals: GrowthReplyBuyingSignalEvidence[]
  source?: string
  threadReplyCount?: number
  responseLatencyMs?: number | null
}): DetectedRevenueOpportunitySignal[] {
  const body = input.bodyPreview?.trim() ?? ""
  const source = input.source ?? "reply_intelligence_v2"
  const detected: DetectedRevenueOpportunitySignal[] = []
  const seen = new Set<string>()

  const push = (signal: DetectedRevenueOpportunitySignal) => {
    if (seen.has(signal.signalType)) return
    if (!signal.excerpt.trim()) return
    seen.add(signal.signalType)
    detected.push(signal)
  }

  for (const buying of input.buyingSignals) {
    const mapped = BUYING_SIGNAL_MAP[buying.signal]
    if (!mapped) continue
    push({
      signalType: mapped,
      confidence: confidenceFromScore(buying.confidence),
      excerpt: buying.excerpt,
      source,
      attribution: { buying_signal: buying.signal },
    })
  }

  if (input.classification.intent === "demo_request" || input.classification.intent === "meeting_request") {
    push({
      signalType: "demo_request",
      confidence: confidenceFromTier(input.classification.confidenceTier),
      excerpt: input.classification.matchedPhrases[0]?.excerpt ?? body.slice(0, 180),
      source,
      attribution: { intent: input.classification.intent },
    })
  }

  if (input.classification.intent === "pricing_question") {
    push({
      signalType: "pricing_interest",
      confidence: confidenceFromTier(input.classification.confidenceTier),
      excerpt: input.classification.matchedPhrases[0]?.excerpt ?? body.slice(0, 180),
      source,
      attribution: { intent: input.classification.intent },
    })
  }

  if (/implementation|rollout|onboarding|deploy/i.test(body)) {
    push({
      signalType: "implementation_discussion",
      confidence: "medium",
      excerpt: body.match(/(?:implementation|rollout|onboarding|deploy)[^.!?]{0,80}/i)?.[0] ?? body.slice(0, 120),
      source,
      attribution: {},
    })
  }

  if (/roi|business case|cost savings|efficiency/i.test(body)) {
    push({
      signalType: "roi_discussion",
      confidence: "medium",
      excerpt: body.match(/(?:roi|business case|cost savings|efficiency)[^.!?]{0,80}/i)?.[0] ?? body.slice(0, 120),
      source,
      attribution: {},
    })
  }

  if ((input.threadReplyCount ?? 1) > 1) {
    push({
      signalType: "engagement_acceleration",
      confidence: "medium",
      excerpt: `${input.threadReplyCount} replies in thread — repeat engagement detected.`,
      source,
      attribution: { thread_reply_count: input.threadReplyCount },
    })
  }

  if (input.responseLatencyMs != null && input.responseLatencyMs <= 4 * 60 * 60 * 1000) {
    push({
      signalType: "follow_up_responsiveness",
      confidence: "high",
      excerpt: `Prospect replied within ${Math.round(input.responseLatencyMs / 60000)} minutes.`,
      source,
      attribution: { response_latency_ms: input.responseLatencyMs },
    })
  }

  if (/\bcc:\b|\bfyi\b|\blooping in\b|\bteam\b|\bcolleague\b/i.test(body)) {
    push({
      signalType: "multi_person_engagement",
      confidence: "medium",
      excerpt: body.match(/(?:cc:|fyi|looping in|team|colleague)[^.!?]{0,80}/i)?.[0] ?? body.slice(0, 120),
      source,
      attribution: {},
    })
  }

  return detected
}

export function toOpportunitySignalEvidence(signals: DetectedRevenueOpportunitySignal[]): GrowthOpportunitySignalEvidence[] {
  return signals.map((signal) => ({
    signalType: signal.signalType,
    confidence: signal.confidence,
    excerpt: signal.excerpt,
    source: signal.source,
    occurredAt: new Date().toISOString(),
  }))
}
