/** Personalization confidence + warning helpers (slice 6.15B). */

import type {
  OutreachContextPacket,
  PersonalizationSignalKey,
  PersonalizationWarning,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"

export function computePersonalizationConfidence(input: {
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  strategy: SelectedMessageStrategy
}): { score: number; label: "low" | "medium" | "high" } {
  let score = 20
  if (input.packet.hasWebsiteResearch) score += 15
  if (input.packet.websiteFindings.length > 0) score += 10
  if (input.packet.researchConfidence != null && input.packet.researchConfidence >= 60) score += 10
  if (input.packet.hasDecisionMaker) score += 10
  if (input.signals.length >= 2) score += 15
  if (input.signals.length >= 4) score += 10
  if (input.packet.researchPainPoints.length > 0) score += 10
  if (input.strategy.blocks.length >= 4) score += 10
  if (input.packet.memoryAvailable && (input.packet.memoryCoverageScore ?? 0) >= 50) score += 10
  if (input.packet.memoryAvailable && input.packet.memoryInteractionSummaries.length > 0) score += 5
  score = Math.min(100, score)

  const label = score >= 75 ? "high" : score >= 50 ? "medium" : "low"
  return { score, label }
}

export function buildPersonalizationWarnings(input: {
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  confidenceScore: number
}): PersonalizationWarning[] {
  const warnings: PersonalizationWarning[] = []

  if (!input.packet.hasWebsiteResearch || input.packet.websiteFindings.length === 0) {
    warnings.push({
      code: "missing_website_signal",
      message: "No verified website findings — personalization relies on lead intelligence only.",
      severity: "warning",
    })
  }

  if (!input.packet.hasDecisionMaker) {
    warnings.push({
      code: "missing_decision_maker",
      message: "No confirmed decision maker — message uses generic greeting.",
      severity: "warning",
    })
  }

  if (input.signals.length < 2) {
    warnings.push({
      code: "weak_personalization",
      message: "Few deterministic signals available — draft may read generic.",
      severity: "warning",
    })
  }

  if (input.confidenceScore < 50) {
    warnings.push({
      code: "low_confidence_context",
      message: "Low confidence context — review draft carefully before approval.",
      severity: input.confidenceScore < 35 ? "critical" : "warning",
    })
  }

  if (input.packet.memoryAvailable && (input.packet.memoryCoverageScore ?? 100) < 25) {
    warnings.push({
      code: "weak_personalization",
      message: "Low relationship memory coverage — verify outreach against prior conversations.",
      severity: "warning",
    })
  }

  if (input.packet.memoryAvailable && input.packet.memoryRiskFlags.length > 0) {
    warnings.push({
      code: "weak_personalization",
      message: `Relationship memory risk flags present: ${input.packet.memoryRiskFlags.slice(0, 2).join("; ")}`,
      severity: "warning",
    })
  }

  if (input.packet.memoryAvoidRepeating.length > 0) {
    warnings.push({
      code: "weak_personalization",
      message: "Avoid repeating previously answered topics in this outreach.",
      severity: "info",
    })
  }

  return warnings
}
