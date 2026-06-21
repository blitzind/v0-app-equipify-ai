/** GS-AI-PLAYBOOK-4B — Deterministic message plan builder (client-safe). */

import { nextBestActionLabel } from "@/lib/growth/buyer-journey/growth-next-best-action"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { GrowthMessagePlan, GrowthReasoningObservation } from "@/lib/growth/reasoning/growth-reasoning-types"
import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"

function pickInsight(
  insights: GrowthReasoningObservation[],
  categories: GrowthReasoningObservation["category"][],
): string | null {
  const match = insights.find((entry) => categories.includes(entry.category))
  return match?.statement ?? null
}

function shorten(text: string, max = 120): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1).trim()}…`
}

export function buildGrowthMessagePlan(input: {
  topInsights: GrowthReasoningObservation[]
  industryContext?: GrowthIndustryContext | null
}): GrowthMessagePlan {
  const { topInsights, industryContext } = input
  const journey = industryContext?.buyerJourneyContext
  const persona = industryContext?.personaMessagingContext
  const account = industryContext?.accountIntelligenceContext
  const outcome = industryContext?.outcomeGuidanceContext
  const sequence = industryContext?.sequenceIntelligenceContext?.diagnostics.guidance

  const verified = pickInsight(topInsights, ["verified_company", "account"])
  const industry = pickInsight(topInsights, ["industry"])
  const personaInsight = pickInsight(topInsights, ["persona"])
  const journeyInsight = pickInsight(topInsights, ["buyer_journey"])
  const engagement = pickInsight(topInsights, ["engagement"])
  const memory = pickInsight(topInsights, ["memory"])

  const openingStrategy = verified
    ? `Lead with operational understanding of ${shorten(verified, 80).replace(/\.$/, "")}.`
    : industry
      ? `Open with industry-specific context: ${shorten(industry, 80).replace(/\.$/, "")}.`
      : "Open with a concise, relevant observation about their operation."

  const credibilityParts: string[] = []
  if (persona?.framework.persona.title) {
    credibilityParts.push(`Speak to ${persona.framework.persona.title} priorities`)
  }
  if (account?.model.operationalSignals[0]) {
    credibilityParts.push(`Reference ${shorten(account.model.operationalSignals[0], 60).replace(/\.$/, "")}`)
  } else if (personaInsight) {
    credibilityParts.push(shorten(personaInsight, 70).replace(/\.$/, ""))
  }
  const credibilityStrategy =
    credibilityParts.length > 0
      ? credibilityParts.join("; ") + "."
      : "Establish credibility through workflow-specific language, not generic claims."

  const valueParts: string[] = []
  if (sequence?.nextNarrative) {
    valueParts.push(narrativeThemeLabel(sequence.nextNarrative))
  }
  for (const mapping of industryContext?.capabilityMappings.slice(0, 2) ?? []) {
    valueParts.push(shorten(mapping.painSignal, 70))
  }
  if (valueParts.length === 0 && industry) {
    valueParts.push(shorten(industry, 70))
  }
  const valueStrategy =
    valueParts.length > 0
      ? `Connect value to: ${valueParts.join("; ")}.`
      : "Tie value to operational efficiency and risk reduction."

  const proofParts: string[] = []
  if (sequence) {
    proofParts.push(proofStageLabel(sequence.nextProof))
  }
  if (persona?.diagnostics.preferredProof) {
    proofParts.push(persona.diagnostics.preferredProof.split(";")[0]?.trim() ?? "")
  }
  for (const proof of outcome?.guidance.preferredProofTypes.slice(0, 1) ?? []) {
    proofParts.push(proof.replace(/_/g, " "))
  }
  const proofStrategy =
    proofParts.filter(Boolean).length > 0
      ? `Use proof: ${proofParts.filter(Boolean).join("; ")}.`
      : "Use one concrete workflow example rather than broad claims."

  const primaryAction = journey?.nextBestActions.primaryAction
  const ctaStrategy = sequence
    ? `CTA: ${ctaStageLabel(sequence.nextCta)}.`
    : primaryAction
      ? `CTA: ${nextBestActionLabel(primaryAction)}.`
      : outcome?.guidance.preferredCtaTypes[0]
        ? `CTA: ${outcome.guidance.preferredCtaTypes[0].replace(/_/g, " ")}.`
        : "CTA: Offer a low-friction workflow review."

  const avoidTopics: string[] = []
  if (journey?.buyingStage.stage === "unaware" || journey?.buyingStage.stage === "problem_aware") {
    avoidTopics.push("Pricing discussion")
    avoidTopics.push("Hard product pitch")
  }
  if (memory?.toLowerCase().includes("objection")) {
    avoidTopics.push("Repeating prior objections")
  }
  if (engagement && !engagement.toLowerCase().includes("replied")) {
    avoidTopics.push("Assuming prior conversation depth")
  }
  if (sequence) {
    avoidTopics.push(...sequence.avoidPatterns.slice(0, 4))
  }
  if (avoidTopics.length === 0) {
    avoidTopics.push("Generic vendor language")
  }

  const narrativeOrder: string[] = ["opening"]
  if (credibilityParts.length) narrativeOrder.push("credibility")
  narrativeOrder.push("value")
  if (proofParts.filter(Boolean).length) narrativeOrder.push("proof")
  narrativeOrder.push("cta")
  if (journeyInsight) narrativeOrder.unshift("stage_acknowledgment")

  return {
    openingStrategy,
    credibilityStrategy,
    valueStrategy,
    proofStrategy,
    ctaStrategy,
    avoidTopics,
    narrativeOrder,
  }
}
