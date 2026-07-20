/**
 * GE-AIOS-NEXT-1C — Strategic Evaluation layer (presentation + reasoning only).
 * Sits between Mission Interpreter and existing mission/objective execution.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { projectApprovedBusinessProfileToSupportedServiceVerticals } from "@/lib/growth/business-profile/business-profile-supported-service-verticals-projection"
import type { ResolvedSupportedServiceVertical } from "@/lib/growth/business-profile/supported-service-verticals"
import type { OrganizationalKnowledgeItem } from "@/lib/growth/memory/knowledge/organization-knowledge-types"
import type { AvaOrganizationalPreference } from "@/lib/growth/memory/types"
import { interpretGrowthHomeAvaMissionIntent } from "@/lib/growth/ava-home/recommendations/growth-home-ava-mission-interpreter-next-1b"
import type { GrowthHomeAvaMissionIntentInterpretation } from "@/lib/growth/ava-home/recommendations/growth-home-ava-recommendation-next-1b-types"
import {
  buildStrategicMarketKey,
  type GrowthHomeAvaStrategicOverrideRecord,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-override-memory-next-1c"
import {
  GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER,
  type GrowthHomeAvaStrategicAlignment,
  type GrowthHomeAvaStrategicAlternative,
  type GrowthHomeAvaStrategicEvaluation,
  type GrowthHomeAvaStrategicIntentEvaluation,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-strategic-evaluation-next-1c-types"

const STRATEGIC_INTENT_KINDS = new Set([
  "shift_market_focus",
  "find_leads",
  "increase_meetings",
  "similar_accounts",
])

export type GrowthHomeAvaStrategicEvaluationContext = {
  approvedProfile?: BusinessProfileDraftContent | null
  organizationalKnowledge?: OrganizationalKnowledgeItem[]
  organizationPreferences?: AvaOrganizationalPreference[]
  sellerTargetCustomer?: string | null
  sellerPoorFitCustomer?: string | null
  sellerWhenNotToRecommend?: string[]
  overrideRecords?: GrowthHomeAvaStrategicOverrideRecord[]
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(trimmed)
  }
  return output
}

function extractMarketDescriptor(
  instruction: string,
  interpretation: GrowthHomeAvaMissionIntentInterpretation,
): { industryLabel: string | null; geographyLabel: string | null } {
  const objective = interpretation.objectiveShiftLabel ?? interpretation.understoodIntent
  const towardMatch = objective.match(/toward\s+(.+?)(?:\.|$)/i)
  const raw = towardMatch?.[1]?.trim() ?? objective
  const parts = raw.split(/\s+in\s+/i)
  if (parts.length >= 2) {
    return {
      industryLabel: parts[0]?.trim() || null,
      geographyLabel: parts.slice(1).join(" in ").trim() || null,
    }
  }
  return { industryLabel: raw.trim() || null, geographyLabel: null }
}

function classifyMarketTarget(instruction: string): "service_vertical" | "end_customer_institution" | "unknown" {
  const lower = instruction.toLowerCase()
  const institutionPattern =
    /\b(hospitals?|health systems?|universit(y|ies)|colleges?|government agencies?|school districts?|state agencies?)\b/i
  const servicePattern =
    /\b(service companies?|service providers?|contractors?|maintenance companies?|field service|technicians?|find \d+|discover \d+|companies that maintain|equipment service)\b/i

  if (servicePattern.test(lower)) return "service_vertical"
  if (
    institutionPattern.test(lower) &&
    !/\b(service|maintenance|contractor|provider|equipment service|biomed|calibration|hvac)\b/i.test(lower)
  ) {
    return "end_customer_institution"
  }
  if (/\b(stop selling|move away from|deprioritize|ignore)\b/i.test(lower)) return "service_vertical"
  return "unknown"
}

function profileProjection(context: GrowthHomeAvaStrategicEvaluationContext) {
  if (!context.approvedProfile) return null
  return projectApprovedBusinessProfileToSupportedServiceVerticals(context.approvedProfile)
}

function profileVerticals(context: GrowthHomeAvaStrategicEvaluationContext): ResolvedSupportedServiceVertical[] {
  return profileProjection(context)?.supportedServiceVerticals ?? []
}

function matchesDisqualifier(instruction: string, disqualifiers: string[]): string[] {
  const lower = instruction.toLowerCase()
  return disqualifiers.filter((entry) => {
    const token = entry.trim().toLowerCase()
    return token.length > 2 && lower.includes(token)
  })
}

function matchesNegativeKeyword(instruction: string, negativeKeywords: string[]): string[] {
  const lower = instruction.toLowerCase()
  return negativeKeywords.filter((entry) => {
    const token = entry.trim().toLowerCase()
    return token.length > 2 && lower.includes(token)
  })
}

function knowledgeEvidence(
  instruction: string,
  items: OrganizationalKnowledgeItem[] | undefined,
): { supportive: string[]; concerns: string[]; sources: string[] } {
  const lower = instruction.toLowerCase()
  const supportive: string[] = []
  const concerns: string[] = []
  const sources: string[] = []

  for (const item of items ?? []) {
    if (!item.active || item.superseded_by) continue
    const finding = item.finding.trim()
    if (!finding) continue
    const findingLower = finding.toLowerCase()
    const overlaps = lower.split(/\s+/).some((token) => token.length > 4 && findingLower.includes(token))
    if (!overlaps) continue
    sources.push(`organizational_knowledge:${item.category}`)
    if (item.confidence >= 0.65) supportive.push(finding)
    else concerns.push(finding)
  }

  return { supportive: uniqueStrings(supportive), concerns: uniqueStrings(concerns), sources: uniqueStrings(sources) }
}

function verticalMatchesRequestedMarket(
  verticals: ResolvedSupportedServiceVertical[],
  industryLabel: string | null,
): ResolvedSupportedServiceVertical[] {
  if (!industryLabel) return []
  const normalized = industryLabel.toLowerCase()
  const tokens = normalized.split(/\s+/).filter((token) => token.length >= 3)
  return verticals.filter((vertical) => {
    const candidates = [vertical.label, ...vertical.profileLabels, ...vertical.industryAliases]
    return candidates.some((label) => {
      const labelLower = label.toLowerCase()
      if (labelLower.includes(normalized) || normalized.includes(labelLower)) return true
      return tokens.some((token) => labelLower.includes(token))
    })
  })
}

function buildAlternativesFromProfile(
  verticals: ResolvedSupportedServiceVertical[],
  excludeLabels: string[] = [],
): GrowthHomeAvaStrategicAlternative[] {
  const excluded = new Set(excludeLabels.map((value) => value.toLowerCase()))
  return verticals
    .filter((vertical) => !excluded.has(vertical.label.toLowerCase()))
    .slice(0, 3)
    .map((vertical) => ({
      label: vertical.label,
      rationale:
        vertical.profileLabels[0] ??
        `Stronger fit with our current service-operator ICP and approved Business Profile.`,
    }))
}

function institutionConcerns(context: GrowthHomeAvaStrategicEvaluationContext): string[] {
  const concerns: string[] = []
  if (context.sellerPoorFitCustomer) {
    concerns.push(
      `Our approved seller guidance flags poor-fit targets such as: ${context.sellerPoorFitCustomer.slice(0, 180)}.`,
    )
  }
  for (const line of context.sellerWhenNotToRecommend ?? []) {
    concerns.push(line)
  }
  const criteria = context.approvedProfile?.salesAndMarketing.qualificationCriteria ?? []
  const customerOwned = criteria.find((line) => /customer-owned|installed base|field service|technicians?/i.test(line))
  if (customerOwned) {
    concerns.push(
      "Our strongest success pattern is with companies that maintain customer-owned equipment — not large institutions buying software for internal departments.",
    )
  } else {
    concerns.push(
      "Large institutions often have longer procurement cycles and different buying centers than the service operators we win fastest with.",
    )
  }
  return uniqueStrings(concerns).slice(0, 4)
}

function buildEvaluation(input: {
  instruction: string
  interpretation: GrowthHomeAvaMissionIntentInterpretation
  context: GrowthHomeAvaStrategicEvaluationContext
}): GrowthHomeAvaStrategicEvaluation {
  const { instruction, interpretation, context } = input
  const market = extractMarketDescriptor(instruction, interpretation)
  const marketKey = buildStrategicMarketKey(market)
  const overrideRecord = context.overrideRecords?.find((row) => row.marketKey === marketKey) ?? null
  const verticals = profileVerticals(context)
  const projection = profileProjection(context)
  const targetClass = classifyMarketTarget(instruction)
  const matchedVerticals = verticalMatchesRequestedMarket(verticals, market.industryLabel)
  const disqualifierHits = matchesDisqualifier(
    instruction,
    context.approvedProfile?.idealCustomers.disqualifiers ?? [],
  )
  const negativeKeywordHits = matchesNegativeKeyword(
    instruction,
    context.approvedProfile?.problemsAndTriggers.negativeKeywords ?? [],
  )
  const knowledge = knowledgeEvidence(instruction, context.organizationalKnowledge)
  const preferenceHits =
    context.organizationPreferences?.filter((pref) => {
      const statement = pref.statement.toLowerCase()
      return market.industryLabel ? statement.includes(market.industryLabel.toLowerCase()) : false
    }) ?? []

  const supportiveReasons = uniqueStrings([
    context.sellerTargetCustomer ? `Our target customer profile emphasizes: ${context.sellerTargetCustomer.slice(0, 160)}.` : null,
    matchedVerticals.length > 0
      ? `${matchedVerticals.map((vertical) => vertical.label).join(", ")} already appears in your approved Business Profile.`
      : null,
    projection?.assumptions[0] ?? null,
    ...preferenceHits.map((pref) => pref.statement),
    ...knowledge.supportive,
  ])

  const concernReasons = uniqueStrings([
    ...disqualifierHits.map((entry) => `Your Business Profile disqualifier mentions: ${entry}.`),
    ...negativeKeywordHits.map((entry) => `Your negative keyword list includes: ${entry}.`),
    ...(targetClass === "end_customer_institution" ? institutionConcerns(context) : []),
    matchedVerticals.length === 0 && verticals.length > 0
      ? `I don't see ${market.industryLabel ?? "that market"} in your approved supported service verticals today.`
      : null,
    ...knowledge.concerns,
  ])

  let alignment: GrowthHomeAvaStrategicAlignment = "partial_fit"
  if (
    matchedVerticals.length > 0 &&
    targetClass !== "end_customer_institution" &&
    disqualifierHits.length === 0 &&
    negativeKeywordHits.length === 0
  ) {
    alignment = "strong_fit"
  } else if (
    targetClass === "end_customer_institution" ||
    disqualifierHits.length > 0 ||
    negativeKeywordHits.length > 0 ||
    (verticals.length > 0 && matchedVerticals.length === 0 && targetClass !== "unknown")
  ) {
    alignment = "poor_fit"
  } else if (matchedVerticals.length > 0 || verticals.length === 0) {
    alignment = "partial_fit"
  }

  const alternativeOptions = buildAlternativesFromProfile(
    verticals,
    market.industryLabel ? [market.industryLabel] : [],
  )
  const recommendedAlternative =
    alignment === "strong_fit"
      ? null
      : alternativeOptions[0] ??
        (verticals[0]
          ? {
              label: verticals[0].label,
              rationale: "This is one of your strongest approved service verticals today.",
            }
          : null)

  if (recommendedAlternative && alignment !== "strong_fit") {
    supportiveReasons.push(
      `I think ${recommendedAlternative.label.toLowerCase()} is a stronger first target because ${recommendedAlternative.rationale.toLowerCase()}`,
    )
  }

  const evidenceSources = uniqueStrings([
    context.approvedProfile ? "approved_business_profile" : null,
    projection ? "supported_service_verticals_projection" : null,
    context.sellerTargetCustomer ? "canonical_seller_knowledge" : null,
    ...knowledge.sources,
    overrideRecord ? "operator_override_history" : null,
  ])

  const confidenceLabel =
    verticals.length > 0 && context.approvedProfile
      ? alignment === "strong_fit"
        ? "High confidence — aligned with approved profile"
        : alignment === "partial_fit"
          ? "Moderate confidence — adjacent opportunity"
          : "High confidence — strategic concern"
      : "Limited profile evidence — review carefully"

  const proceedRecommendation =
    alignment === "strong_fit" ? "support" : alignment === "partial_fit" ? "refine" : "challenge"

  const perspectiveLine =
    alignment === "strong_fit"
      ? "I agree — this aligns with what we already know about your business."
      : alignment === "partial_fit"
        ? "I see why this is attractive, but I think we can sharpen the target before we commit effort."
        : "I understand why you're thinking about this market, but I don't think it's our strongest move today."

  const overrideAcknowledgment =
    overrideRecord && overrideRecord.overrideCount > 0
      ? `I'll treat this as an experimental market and monitor results so we can compare it against our current ICP.${
          overrideRecord.overrideCount > 1
            ? " You've asked to explore this direction before — I'll watch the pattern without changing strategy automatically."
            : ""
        }`
      : "I'll treat this as an experimental market and monitor the results so we can compare it against our current ICP."

  return {
    qaMarker: GROWTH_AIOS_NEXT_1C_STRATEGIC_ADVISOR_QA_MARKER,
    alignment,
    openingLine: "I understand your thinking.",
    perspectiveLine,
    supportiveReasons,
    concernReasons,
    recommendedAlternative,
    alternativeOptions,
    confidenceLabel,
    evidenceSources,
    proceedRecommendation,
    allowsOverride: true,
    overrideAcknowledgment,
    interpretedIntent: interpretation,
  }
}

export function evaluateGrowthHomeAvaStrategicIntent(input: {
  instruction: string
  companyCandidates?: Array<{ leadId: string; companyName: string }>
  activeMissionLabel?: string | null
  estimatedMinutes?: number | null
  context?: GrowthHomeAvaStrategicEvaluationContext
}): GrowthHomeAvaStrategicIntentEvaluation | null {
  const interpretation = interpretGrowthHomeAvaMissionIntent(input)
  if (!interpretation) return null

  if (!STRATEGIC_INTENT_KINDS.has(interpretation.intentKind)) {
    return { interpretation, evaluation: null }
  }

  return {
    interpretation,
    evaluation: buildEvaluation({
      instruction: input.instruction,
      interpretation,
      context: input.context ?? {},
    }),
  }
}

export function buildGrowthHomeAvaStrategicOverrideIntent(input: {
  evaluation: GrowthHomeAvaStrategicEvaluation
}): GrowthHomeAvaMissionIntentInterpretation {
  const intent = input.evaluation.interpretedIntent
  const market = extractMarketDescriptor("", intent)
  return {
    ...intent,
    restatement: "Understood.",
    objectiveShiftLabel:
      intent.objectiveShiftLabel ??
      `I'll shift today's objective toward ${market.industryLabel ?? "your requested market"}${
        market.geographyLabel ? ` in ${market.geographyLabel}` : ""
      }.`,
    planSummary: `${intent.planSummary} ${input.evaluation.overrideAcknowledgment ?? ""}`.trim(),
  }
}
