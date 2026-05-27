import type { GrowthCalendarRoutingRuleType } from "@/lib/growth/booking-intelligence/booking-types"
import type { DetectedBookingIntent } from "@/lib/growth/booking-intelligence/booking-intent-detector"
import { hasMinimumBookingEvidence, toBookingEvidenceSnippets } from "@/lib/growth/booking-intelligence/booking-intent-detector"

export type GeneratedBookingRecommendation = {
  recommendationType: string
  title: string
  description: string
  evidence: ReturnType<typeof toBookingEvidenceSnippets>
  routingRuleType: GrowthCalendarRoutingRuleType | null
  availabilityHint: string | null
}

export function generateBookingRecommendations(input: {
  intents: DetectedBookingIntent[]
  hasActiveSequence?: boolean
  engagementScore?: number
}): GeneratedBookingRecommendation[] {
  if (!hasMinimumBookingEvidence(input.intents)) return []

  const evidence = toBookingEvidenceSnippets(input.intents)
  const recommendations: GeneratedBookingRecommendation[] = []
  const intentTypes = new Set(input.intents.map((intent) => intent.intentType))

  const strongMeeting =
    intentTypes.has("meeting_request") ||
    intentTypes.has("demo_request") ||
    intentTypes.has("decision_maker_call")

  if (strongMeeting) {
    recommendations.push({
      recommendationType: "book_meeting",
      title: "Book meeting",
      description: "Meeting intent detected — human should review routing and send booking options manually.",
      evidence,
      routingRuleType: "owner",
      availabilityHint: "Review rep availability before proposing times.",
    })
  }

  if (intentTypes.has("pricing_call")) {
    recommendations.push({
      recommendationType: "pricing_call",
      title: "Schedule pricing call",
      description: "Pricing interest detected — route to account owner for a pricing conversation.",
      evidence,
      routingRuleType: "owner",
      availabilityHint: "Suggest 30-minute pricing call windows.",
    })
  }

  if (intentTypes.has("technical_call")) {
    recommendations.push({
      recommendationType: "technical_call",
      title: "Schedule technical call",
      description: "Technical questions detected — consider solutions engineer routing.",
      evidence,
      routingRuleType: "manual",
      availabilityHint: "Allow extra prep time for technical validation.",
    })
  }

  if (intentTypes.has("referral_intro")) {
    recommendations.push({
      recommendationType: "referral_intro",
      title: "Book referral intro",
      description: "Referral language detected — coordinate intro meeting with referred stakeholder.",
      evidence,
      routingRuleType: "owner",
      availabilityHint: null,
    })
  }

  if (input.hasActiveSequence && strongMeeting) {
    recommendations.push({
      recommendationType: "sequence_meeting_exit_review",
      title: "Review sequence before booking",
      description: "Meeting intent while sequence is active — human should pause or stop sequence before booking.",
      evidence,
      routingRuleType: null,
      availabilityHint: null,
    })
  }

  if ((input.engagementScore ?? 0) >= 60 && intentTypes.has("follow_up_call")) {
    recommendations.push({
      recommendationType: "high_engagement_follow_up",
      title: "High-engagement follow-up call",
      description: "Strong engagement plus timeline language — prioritize human follow-up scheduling.",
      evidence,
      routingRuleType: "account_priority",
      availabilityHint: "Offer slots within 48 hours if possible.",
    })
  }

  const unique = new Map<string, GeneratedBookingRecommendation>()
  for (const recommendation of recommendations) {
    unique.set(recommendation.recommendationType, recommendation)
  }
  return [...unique.values()]
}
