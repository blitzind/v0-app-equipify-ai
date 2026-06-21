/** GS-AI-PLAYBOOK-4B — Narrative brief builder (client-safe). */

import { buyingStageLabel } from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"
import { nextBestActionLabel } from "@/lib/growth/buyer-journey/growth-next-best-action"
import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type {
  GrowthMessagePlan,
  GrowthNarrativeBrief,
  GrowthReasoningObservation,
} from "@/lib/growth/reasoning/growth-reasoning-types"

function uniqueStrings(values: string[], limit: number): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const normalized = value.trim()
    if (!normalized || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    result.push(normalized)
    if (result.length >= limit) break
  }
  return result
}

export function buildGrowthNarrativeBrief(input: {
  topInsights: GrowthReasoningObservation[]
  messagePlan: GrowthMessagePlan
  industryContext?: GrowthIndustryContext | null
  companyName?: string | null
  contactName?: string | null
}): GrowthNarrativeBrief {
  const { topInsights, messagePlan, industryContext, companyName, contactName } = input
  const journey = industryContext?.buyerJourneyContext
  const persona = industryContext?.personaMessagingContext
  const account = industryContext?.accountIntelligenceContext

  const audience =
    contactName && companyName
      ? `${contactName} at ${companyName}`
      : companyName ?? contactName ?? "Target prospect"

  const stage = journey
    ? buyingStageLabel(journey.buyingStage.stage)
    : "Unknown stage"

  const personaLabel = persona?.framework.persona.title ?? "General buyer"

  const companySummary =
    account?.model.companySummary[0] ??
    topInsights.find((entry) => entry.category === "verified_company")?.statement ??
    (companyName ? `${companyName} is the target account.` : "Target company context is limited.")

  const primaryProblems = uniqueStrings(
    [
      ...(industryContext?.capabilityMappings.map((entry) => entry.painSignal) ?? []),
      ...topInsights
        .filter((entry) => entry.category === "industry" || entry.category === "account")
        .map((entry) => entry.statement),
    ],
    4,
  )

  const valueThemes = uniqueStrings(
    [
      messagePlan.valueStrategy.replace(/^Connect value to:\s*/i, "").replace(/\.$/, ""),
      ...(industryContext?.narrativeContext?.narrativeGoals ?? []),
      ...(industryContext?.narrativeContext?.activeThemes.map((theme) => theme.replace(/_/g, " ")) ?? []),
    ],
    4,
  )

  const proofThemes = uniqueStrings(
    [
      messagePlan.proofStrategy.replace(/^Use proof:\s*/i, "").replace(/\.$/, ""),
      persona?.diagnostics.preferredProof ?? "",
      ...(industryContext?.outcomeGuidanceContext?.guidance.preferredProofTypes.map((p) =>
        p.replace(/_/g, " "),
      ) ?? []),
    ],
    3,
  )

  const nextBestAction = journey
    ? nextBestActionLabel(journey.nextBestActions.primaryAction)
    : messagePlan.ctaStrategy.replace(/^CTA:\s*/i, "").replace(/\.$/, "")

  const tone =
    journey?.buyingStage.stage === "unaware" || journey?.buyingStage.stage === "problem_aware"
      ? "Consultative and curious"
      : journey?.buyingStage.stage === "evaluating" || journey?.buyingStage.stage === "proposal"
        ? "Direct and evidence-led"
        : industryContext?.narrativeContext?.recommendedTone ?? persona?.diagnostics.preferredLanguage ?? "Professional and helpful"

  const objective =
    journey?.conversationState.state === "engaged"
      ? "Advance the active conversation with a clear next step."
      : journey?.buyingStage.stage === "problem_aware"
        ? "Start discovery conversation."
        : journey?.buyingStage.stage === "evaluating"
          ? "Support evaluation with relevant proof and a concrete CTA."
          : "Open a relevant conversation without over-selling."

  return {
    audience,
    stage,
    persona: personaLabel,
    companySummary,
    primaryProblems,
    valueThemes,
    proofThemes,
    nextBestAction,
    tone,
    objective,
  }
}
