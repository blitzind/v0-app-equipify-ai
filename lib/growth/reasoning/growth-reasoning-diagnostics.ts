/** GS-AI-PLAYBOOK-4B — Reasoning diagnostics and operator preview (client-safe). */

import type {
  GrowthMessagePlan,
  GrowthNarrativeBrief,
  GrowthReasoningDiagnostics,
  GrowthReasoningObservation,
} from "@/lib/growth/reasoning/growth-reasoning-types"

export function buildGrowthReasoningDiagnostics(input: {
  observations: GrowthReasoningObservation[]
  topInsights: GrowthReasoningObservation[]
  secondaryInsights: GrowthReasoningObservation[]
  ignoredInsights: GrowthReasoningObservation[]
  messagePlan: GrowthMessagePlan
  narrativeBrief: GrowthNarrativeBrief
  sequenceDiagnostics?: import("@/lib/growth/sequence-intelligence/growth-sequence-state-types").GrowthSequenceDiagnostics | null
}): GrowthReasoningDiagnostics {
  const avgConfidence =
    input.observations.length === 0
      ? 0
      : Math.round(
          input.observations.reduce((sum, entry) => sum + entry.confidence, 0) /
            input.observations.length,
        )

  return {
    observations: input.observations,
    topInsights: input.topInsights,
    secondaryInsights: input.secondaryInsights,
    ignoredInsights: input.ignoredInsights,
    messagePlan: input.messagePlan,
    narrativeBrief: input.narrativeBrief,
    confidence: avgConfidence,
    sequenceDiagnostics: input.sequenceDiagnostics ?? null,
  }
}

export function formatGrowthReasoningOperatorPreview(diagnostics: GrowthReasoningDiagnostics): {
  topInsights: string[]
  recommendedApproach: string[]
  objective: string
} {
  const { messagePlan, narrativeBrief } = diagnostics

  const recommendedApproach = [
    messagePlan.openingStrategy,
    messagePlan.credibilityStrategy,
    messagePlan.valueStrategy,
    messagePlan.ctaStrategy,
    messagePlan.avoidTopics.length
      ? `Avoid: ${messagePlan.avoidTopics.join(", ").toLowerCase()}.`
      : "",
  ].filter(Boolean)

  return {
    topInsights: diagnostics.topInsights.map((entry) => entry.statement),
    recommendedApproach,
    objective: narrativeBrief.objective,
  }
}

export function buildGrowthNarrativeBriefPromptBlock(brief: GrowthNarrativeBrief, plan: GrowthMessagePlan): string {
  const lines = [
    "NARRATIVE BRIEF (highest-priority planning layer — use to shape message, do not replace other context):",
    `Audience: ${brief.audience}`,
    `Stage: ${brief.stage}`,
    `Persona: ${brief.persona}`,
    `Company: ${brief.companySummary}`,
  ]

  if (brief.primaryProblems.length) {
    lines.push(`Primary problems: ${brief.primaryProblems.join("; ")}`)
  }
  if (brief.valueThemes.length) {
    lines.push(`Value themes: ${brief.valueThemes.join("; ")}`)
  }
  if (brief.proofThemes.length) {
    lines.push(`Proof themes: ${brief.proofThemes.join("; ")}`)
  }

  lines.push(
    `Next best action: ${brief.nextBestAction}`,
    `Tone: ${brief.tone}`,
    `Objective: ${brief.objective}`,
    `Opening strategy: ${plan.openingStrategy}`,
    `Credibility: ${plan.credibilityStrategy}`,
    `Value: ${plan.valueStrategy}`,
    `Proof: ${plan.proofStrategy}`,
    `CTA: ${plan.ctaStrategy}`,
  )

  if (plan.avoidTopics.length) {
    lines.push(`Avoid: ${plan.avoidTopics.join(", ")}`)
  }
  if (plan.narrativeOrder.length) {
    lines.push(`Narrative order: ${plan.narrativeOrder.join(" → ")}`)
  }

  return lines.join("\n")
}
