import type {
  GrowthLeadOpportunityReadinessInput,
  GrowthOpportunityAccelerator,
  GrowthOpportunityAcceleratorKey,
} from "@/lib/growth/opportunity-types"

const ACCELERATOR_LABELS: Record<GrowthOpportunityAcceleratorKey, string> = {
  positive_reply: "Positive email reply",
  trusted_relationship: "Trusted relationship",
  connected_call: "Connected call",
  decision_maker_confirmed: "Decision maker confirmed",
  hot_engagement: "Hot engagement",
  high_fit: "High fit score",
  strategic_relationship: "Strategic relationship",
  multiple_meaningful_touches: "Multiple meaningful touches",
  research_confidence: "Strong research confidence",
}

export function deriveOpportunityAccelerators(
  input: GrowthLeadOpportunityReadinessInput,
): GrowthOpportunityAccelerator[] {
  const accelerators: GrowthOpportunityAccelerator[] = []
  const fit = input.fit ?? 0

  if (input.hasPositiveReply) {
    accelerators.push({ key: "positive_reply", label: ACCELERATOR_LABELS.positive_reply })
  }

  if (input.relationshipStrengthTier === "trusted") {
    accelerators.push({ key: "trusted_relationship", label: ACCELERATOR_LABELS.trusted_relationship })
  }

  if (input.connectedCallCount > 0) {
    accelerators.push({ key: "connected_call", label: ACCELERATOR_LABELS.connected_call })
  }

  if (
    input.decisionMakerStatus === "confirmed" ||
    input.decisionMakerStatus === "verified_contactable"
  ) {
    accelerators.push({ key: "decision_maker_confirmed", label: ACCELERATOR_LABELS.decision_maker_confirmed })
  }

  if (input.engagementTier === "hot") {
    accelerators.push({ key: "hot_engagement", label: ACCELERATOR_LABELS.hot_engagement })
  }

  if (fit >= 70) {
    accelerators.push({ key: "high_fit", label: ACCELERATOR_LABELS.high_fit })
  }

  if (input.relationshipStrengthTier === "strategic") {
    accelerators.push({ key: "strategic_relationship", label: ACCELERATOR_LABELS.strategic_relationship })
  }

  if (
    (input.relationshipStrengthScore ?? 0) >= 40 &&
    (input.relationshipStrengthTier === "active" ||
      input.relationshipStrengthTier === "trusted" ||
      input.relationshipStrengthTier === "strategic")
  ) {
    accelerators.push({
      key: "multiple_meaningful_touches",
      label: ACCELERATOR_LABELS.multiple_meaningful_touches,
    })
  }

  if ((input.researchConfidence ?? 0) >= 0.6) {
    accelerators.push({ key: "research_confidence", label: ACCELERATOR_LABELS.research_confidence })
  }

  return accelerators.sort((a, b) => a.key.localeCompare(b.key))
}
