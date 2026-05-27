import type {
  GrowthOpportunityRecommendationType,
} from "@/lib/growth/opportunity-intelligence/opportunity-types"
import type { DetectedOpportunitySignal } from "@/lib/growth/opportunity-intelligence/signal-detector"
import { hasMinimumEvidence, toEvidenceSnippets } from "@/lib/growth/opportunity-intelligence/signal-detector"

export type GeneratedOpportunityRecommendation = {
  recommendationType: GrowthOpportunityRecommendationType
  title: string
  description: string
  evidence: ReturnType<typeof toEvidenceSnippets>
}

export function generateOpportunityRecommendations(input: {
  signals: DetectedOpportunitySignal[]
  hasActiveSequence?: boolean
  hasOwner?: boolean
}): GeneratedOpportunityRecommendation[] {
  if (!hasMinimumEvidence(input.signals)) return []

  const recommendations: GeneratedOpportunityRecommendation[] = []
  const evidence = toEvidenceSnippets(input.signals)
  const types = new Set(input.signals.map((signal) => signal.signalType))

  const strongBuying =
    types.has("meeting_interest") ||
    types.has("proposal_request") ||
    types.has("budget_signal") ||
    types.has("pricing_interest")

  if (strongBuying) {
    recommendations.push({
      recommendationType: "create_opportunity",
      title: "Create opportunity",
      description: "Evidence suggests active buying interest — human should create or link a pipeline opportunity.",
      evidence,
    })
    recommendations.push({
      recommendationType: "advance_stage",
      title: "Advance stage",
      description: "Multiple buying signals detected — review whether the deal stage should advance.",
      evidence,
    })
  }

  if (types.has("committee_detected") || types.has("decision_maker_detected")) {
    recommendations.push({
      recommendationType: "committee_expansion",
      title: "Expand buying committee",
      description: "Stakeholder or referral language detected — map additional contacts before advancing.",
      evidence,
    })
  }

  if (types.has("meeting_interest") && input.hasActiveSequence) {
    recommendations.push({
      recommendationType: "pause_sequence",
      title: "Pause sequence",
      description: "Meeting interest detected while sequence is active — human should pause outbound steps.",
      evidence,
    })
  }

  if (types.has("competitive_signal")) {
    recommendations.push({
      recommendationType: "human_review_needed",
      title: "Human review needed",
      description: "Competitive pressure detected — operator review recommended before next touch.",
      evidence,
    })
  }

  if (!input.hasOwner) {
    recommendations.push({
      recommendationType: "assign_owner",
      title: "Assign owner",
      description: "High-intent activity without clear owner — assign a rep for follow-up.",
      evidence,
    })
  }

  if (types.has("timeline_interest") || types.has("urgency_signal")) {
    recommendations.push({
      recommendationType: "follow_up_needed",
      title: "Follow-up needed",
      description: "Timeline or urgency language detected — schedule human follow-up.",
      evidence,
    })
  }

  if (input.signals.some((signal) => signal.source === "reply_draft_outcome")) {
    recommendations.push({
      recommendationType: "human_review_needed",
      title: "Review reply outcome",
      description: "Recent reply draft send may have changed deal context — review before next action.",
      evidence,
    })
  }

  const unique = new Map<GrowthOpportunityRecommendationType, GeneratedOpportunityRecommendation>()
  for (const recommendation of recommendations) {
    unique.set(recommendation.recommendationType, recommendation)
  }
  return [...unique.values()]
}
