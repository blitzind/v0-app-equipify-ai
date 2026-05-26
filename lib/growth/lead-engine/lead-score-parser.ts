import {
  GROWTH_LEAD_ENGINE_LEAD_SCORE_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS,
  type GrowthLeadEngineLeadGrade,
  type GrowthLeadEngineLeadNextAction,
  type GrowthLeadEngineLeadPriorityLevel,
  type GrowthLeadEngineLeadScoreBreakdown,
  type GrowthLeadEngineLeadScoreComponentContribution,
  type GrowthLeadEngineLeadScoreOutput,
  type GrowthLeadEngineLeadScoreRiskPenalty,
  type GrowthLeadEngineLeadScoreSourceAttribution,
} from "@/lib/growth/lead-engine/lead-score-types"
import type { GrowthLeadEngineAccountBriefOutput } from "@/lib/growth/lead-engine/account-brief-types"
import type { GrowthLeadEngineOutreachPersonalizationOutput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"

const COMPONENT_KEYS = Object.keys(
  GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS,
) as (keyof typeof GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS)[]

export type GrowthLeadEngineLeadScoreUpstreamContext = {
  verificationDisposition?: string | null
  verificationConfidence?: number | null
  verificationRiskScore?: number | null
  verificationReasonCodes?: string[]
  accountBriefHumanReview?: boolean
  accountBriefConfidence?: number | null
  accountBriefCompleteness?: number | null
  personalizationHumanReview?: boolean
  personalizationConfidence?: number | null
  personalizationCompleteness?: number | null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
}

function asComponentScore(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function asConfidence(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  const normalized = value > 1 ? value / 100 : value
  return Math.max(0, Math.min(1, Number(normalized.toFixed(3))))
}

function asSourceAttribution(value: unknown): GrowthLeadEngineLeadScoreSourceAttribution[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      const row = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {}
      const source = asString(row.source)
      const section = asString(row.section)
      const signal = asString(row.signal)
      const evidence = asString(row.evidence)
      const confidence = asConfidence(row.confidence)
      if (!source || !section || !signal || !evidence) return null
      if (confidence <= 0) return null
      return { source, section, signal, evidence, confidence }
    })
    .filter((row): row is GrowthLeadEngineLeadScoreSourceAttribution => row !== null)
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1].trim() : trimmed
  return JSON.parse(body) as unknown
}

export function gradeFromLeadScore(score: number): GrowthLeadEngineLeadGrade {
  if (score >= 85) return "A"
  if (score >= 70) return "B"
  if (score >= 50) return "C"
  if (score >= 25) return "D"
  return "F"
}

export function computeRiskPenalties(
  context: GrowthLeadEngineLeadScoreUpstreamContext,
  attributionCount: number,
): GrowthLeadEngineLeadScoreRiskPenalty[] {
  const penalties: GrowthLeadEngineLeadScoreRiskPenalty[] = []

  const disposition = (context.verificationDisposition ?? "").toLowerCase()
  if (disposition === "reject") {
    penalties.push({
      code: "VERIFICATION_REJECT",
      penalty: 40,
      evidence: "Verification triage disposition is reject.",
    })
  } else if (disposition === "risky") {
    penalties.push({
      code: "VERIFICATION_RISKY",
      penalty: 15,
      evidence: "Verification triage disposition is risky.",
    })
  }

  const verificationRisk = context.verificationRiskScore ?? 0
  if (verificationRisk >= 70) {
    penalties.push({
      code: "HIGH_VERIFICATION_RISK",
      penalty: 20,
      evidence: `Verification risk_score ${verificationRisk} >= 70.`,
    })
  } else if (verificationRisk >= 50) {
    penalties.push({
      code: "ELEVATED_VERIFICATION_RISK",
      penalty: 10,
      evidence: `Verification risk_score ${verificationRisk} >= 50.`,
    })
  }

  const reasonCodes = context.verificationReasonCodes ?? []
  if (reasonCodes.includes("DUPLICATE_POSSIBLE")) {
    penalties.push({
      code: "DUPLICATE_POSSIBLE",
      penalty: 15,
      evidence: "Verification reason code DUPLICATE_POSSIBLE present.",
    })
  }
  if (reasonCodes.includes("HIGH_RISK_CONTACT")) {
    penalties.push({
      code: "HIGH_RISK_CONTACT",
      penalty: 12,
      evidence: "Verification reason code HIGH_RISK_CONTACT present.",
    })
  }

  if (attributionCount === 0) {
    penalties.push({
      code: "MISSING_ATTRIBUTION",
      penalty: 25,
      evidence: "Lead score source_attribution missing or empty.",
    })
  }

  const verificationConfidence = context.verificationConfidence ?? 1
  if (verificationConfidence < 0.5) {
    penalties.push({
      code: "LOW_VERIFICATION_CONFIDENCE",
      penalty: 15,
      evidence: `verification_confidence ${verificationConfidence} < 0.5.`,
    })
  }

  const briefConfidence = context.accountBriefConfidence
  if (briefConfidence != null && briefConfidence < 0.6) {
    penalties.push({
      code: "LOW_ACCOUNT_BRIEF_CONFIDENCE",
      penalty: 10,
      evidence: `Account brief research_confidence ${briefConfidence} < 0.6.`,
    })
  }

  const personalizationConfidence = context.personalizationConfidence
  if (personalizationConfidence != null && personalizationConfidence < 0.6) {
    penalties.push({
      code: "LOW_PERSONALIZATION_CONFIDENCE",
      penalty: 10,
      evidence: `Personalization confidence ${personalizationConfidence} < 0.6.`,
    })
  }

  if (context.accountBriefHumanReview) {
    penalties.push({
      code: "ACCOUNT_BRIEF_HUMAN_REVIEW",
      penalty: 8,
      evidence: "Account brief flagged human_review_required.",
    })
  }
  if (context.personalizationHumanReview) {
    penalties.push({
      code: "PERSONALIZATION_HUMAN_REVIEW",
      penalty: 8,
      evidence: "Outreach personalization flagged human_review_required.",
    })
  }

  const briefCompleteness = context.accountBriefCompleteness
  if (briefCompleteness != null && briefCompleteness < 50) {
    penalties.push({
      code: "LOW_BRIEF_COMPLETENESS",
      penalty: 10,
      evidence: `Account brief completeness ${briefCompleteness} < 50.`,
    })
  }

  const personalizationCompleteness = context.personalizationCompleteness
  if (personalizationCompleteness != null && personalizationCompleteness < 50) {
    penalties.push({
      code: "LOW_PERSONALIZATION_COMPLETENESS",
      penalty: 10,
      evidence: `Personalization completeness ${personalizationCompleteness} < 50.`,
    })
  }

  return penalties
}

export function computeDeterministicLeadScore(
  components: Record<keyof typeof GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS, number>,
  penalties: GrowthLeadEngineLeadScoreRiskPenalty[],
): GrowthLeadEngineLeadScoreBreakdown {
  const contributions: GrowthLeadEngineLeadScoreComponentContribution[] = COMPONENT_KEYS.map(
    (component) => {
      const weight = GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS[component]
      const score = components[component]
      const contribution = Number(((score * weight) / 100).toFixed(2))
      return { component, score, weight, contribution }
    },
  )

  const raw_weighted_score = Math.round(
    contributions.reduce((sum, row) => sum + row.contribution, 0),
  )
  const total_risk_penalty = penalties.reduce((sum, row) => sum + row.penalty, 0)
  const computed_lead_score = Math.max(0, Math.min(100, raw_weighted_score - total_risk_penalty))

  return {
    components: contributions,
    raw_weighted_score,
    risk_penalties: penalties,
    total_risk_penalty,
    computed_lead_score,
  }
}

function resolvePriorityLevel(
  leadScore: number,
  disqualified: boolean,
): GrowthLeadEngineLeadPriorityLevel {
  if (disqualified || leadScore < 25) return "disqualified"
  if (leadScore >= 85) return "high"
  if (leadScore >= 50) return "medium"
  return "low"
}

function resolveNextAction(
  leadScore: number,
  priority: GrowthLeadEngineLeadPriorityLevel,
  context: GrowthLeadEngineLeadScoreUpstreamContext,
  humanReviewRequired: boolean,
): GrowthLeadEngineLeadNextAction {
  if (priority === "disqualified" || (context.verificationDisposition ?? "") === "reject") {
    return "disqualify"
  }
  if ((context.verificationDisposition ?? "") === "risky" || leadScore < 50) {
    if (leadScore < 40) return "verify_contact"
  }
  if (leadScore < 50) {
    return leadScore < 35 ? "deprioritize" : "enrich_more"
  }
  if (humanReviewRequired || context.accountBriefHumanReview || context.personalizationHumanReview) {
    return "approve_for_human_review"
  }
  if (leadScore >= 70 && humanReviewRequired) {
    return "approve_for_human_review"
  }
  if (leadScore >= 85) {
    return "approve_for_human_review"
  }
  if (leadScore >= 50) {
    return "enrich_more"
  }
  return "deprioritize"
}

function validateScoreBreakdown(
  breakdown: GrowthLeadEngineLeadScoreBreakdown,
  components: Record<keyof typeof GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS, number>,
): boolean {
  if (breakdown.components.length !== COMPONENT_KEYS.length) return false
  for (const row of breakdown.components) {
    if (row.score !== components[row.component]) return false
    if (row.weight !== GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS[row.component]) return false
  }
  const expected = Math.max(
    0,
    Math.min(100, breakdown.raw_weighted_score - breakdown.total_risk_penalty),
  )
  return breakdown.computed_lead_score === expected
}

function buildDisqualificationReasons(
  leadScore: number,
  context: GrowthLeadEngineLeadScoreUpstreamContext,
): string[] {
  const reasons: string[] = []
  if ((context.verificationDisposition ?? "") === "reject") {
    reasons.push("Verification triage rejected the contact/company match.")
  }
  if (leadScore < 25) {
    reasons.push(`Lead score ${leadScore} below disqualification threshold (25).`)
  }
  if ((context.verificationReasonCodes ?? []).includes("COMPANY_MISMATCH")) {
    reasons.push("Company mismatch detected during verification.")
  }
  return [...new Set(reasons)]
}

function enforceLeadScore(
  output: GrowthLeadEngineLeadScoreOutput,
  context: GrowthLeadEngineLeadScoreUpstreamContext,
): GrowthLeadEngineLeadScoreOutput {
  let intent_score = output.intent_score
  if (intent_score > 70 && output.source_attribution.length < 2) {
    intent_score = Math.min(intent_score, 55)
  }

  const components = {
    fit_score: output.fit_score,
    intent_score,
    contactability_score: output.contactability_score,
    verification_score: output.verification_score,
    account_quality_score: output.account_quality_score,
    personalization_score: output.personalization_score,
  }

  const penalties = computeRiskPenalties(context, output.source_attribution.length)
  const score_breakdown = computeDeterministicLeadScore(components, penalties)
  const lead_score = score_breakdown.computed_lead_score
  const lead_grade = gradeFromLeadScore(lead_score)

  const disqualification_reasons = buildDisqualificationReasons(lead_score, context)
  const disqualified =
    (context.verificationDisposition ?? "") === "reject" || lead_score < 25

  let human_review_required = output.human_review_required
  if (context.accountBriefHumanReview || context.personalizationHumanReview) {
    human_review_required = true
  }
  if ((context.verificationDisposition ?? "") === "reject" || (context.verificationDisposition ?? "") === "risky") {
    human_review_required = true
  }
  if (lead_score < 70 || score_breakdown.total_risk_penalty >= 25) {
    human_review_required = true
  }
  if (intent_score !== output.intent_score) {
    human_review_required = true
  }

  const priority_level = resolvePriorityLevel(lead_score, disqualified)
  const recommended_next_action = resolveNextAction(
    lead_score,
    priority_level,
    context,
    human_review_required,
  )

  const upstreamRisk = context.verificationRiskScore ?? 0
  const risk_score = Math.max(
    0,
    Math.min(100, Math.round(Math.max(output.risk_score, upstreamRisk, score_breakdown.total_risk_penalty))),
  )

  return {
    ...output,
    ...components,
    lead_score,
    lead_grade,
    risk_score,
    priority_level,
    recommended_next_action,
    disqualification_reasons,
    score_breakdown,
    human_review_required,
  }
}

export function buildLeadScoreUpstreamContext(upstream?: {
  verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
  accountBrief?: GrowthLeadEngineAccountBriefOutput | string
  outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
}): GrowthLeadEngineLeadScoreUpstreamContext {
  const context: GrowthLeadEngineLeadScoreUpstreamContext = {}

  if (upstream?.verificationTriage && typeof upstream.verificationTriage === "object") {
    const triage = upstream.verificationTriage
    context.verificationDisposition = triage.disposition
    context.verificationConfidence = triage.verification_confidence
    context.verificationRiskScore = triage.risk_score
    context.verificationReasonCodes = triage.verification_reason_codes
  }

  if (upstream?.accountBrief && typeof upstream.accountBrief === "object") {
    const brief = upstream.accountBrief
    context.accountBriefHumanReview = brief.human_review_required
    context.accountBriefConfidence = brief.research_confidence
    context.accountBriefCompleteness = brief.brief_completeness
  }

  if (upstream?.outreachPersonalization && typeof upstream.outreachPersonalization === "object") {
    const personalization = upstream.outreachPersonalization
    context.personalizationHumanReview = personalization.human_review_required
    context.personalizationConfidence = personalization.personalization_confidence
    context.personalizationCompleteness = personalization.personalization_completeness
  }

  return context
}

export function parseGrowthLeadEngineLeadScoreOutput(
  raw: string,
  options?: { upstream?: GrowthLeadEngineLeadScoreUpstreamContext },
): { ok: true; output: GrowthLeadEngineLeadScoreOutput } | { ok: false; message: string } {
  try {
    const parsed = extractJsonObject(raw)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, message: "Lead score response is not a JSON object." }
    }
    const record = parsed as Record<string, unknown>
    const context = options?.upstream ?? {}

    const source_attribution = asSourceAttribution(record.source_attribution)
    if (source_attribution.length === 0) {
      return {
        ok: false,
        message: "Lead score response must include source_attribution with evidence.",
      }
    }

    const components = {
      fit_score: asComponentScore(record.fit_score),
      intent_score: asComponentScore(record.intent_score),
      contactability_score: asComponentScore(record.contactability_score),
      verification_score: asComponentScore(record.verification_score),
      account_quality_score: asComponentScore(record.account_quality_score),
      personalization_score: asComponentScore(record.personalization_score),
    }

    const penalties = computeRiskPenalties(context, source_attribution.length)
    const score_breakdown = computeDeterministicLeadScore(components, penalties)

    const output: GrowthLeadEngineLeadScoreOutput = {
      lead_score: score_breakdown.computed_lead_score,
      lead_grade: gradeFromLeadScore(score_breakdown.computed_lead_score),
      ...components,
      risk_score: asComponentScore(record.risk_score),
      priority_level: "medium",
      recommended_next_action: "enrich_more",
      disqualification_reasons: asStringArray(record.disqualification_reasons),
      score_breakdown,
      score_explanation: asString(record.score_explanation),
      human_review_required: record.human_review_required === true,
      source_attribution,
    }

    if (!validateScoreBreakdown(score_breakdown, components)) {
      return { ok: false, message: "Lead score breakdown failed validation." }
    }

    if (!output.score_explanation) {
      return { ok: false, message: "Lead score response missing score_explanation." }
    }

    const enforced = enforceLeadScore(output, context)

    if (enforced.lead_score > 85 && enforced.source_attribution.length < 2) {
      return {
        ok: false,
        message: "Lead score above 85 requires at least two source_attribution entries.",
      }
    }

    if (!validateScoreBreakdown(enforced.score_breakdown, {
      fit_score: enforced.fit_score,
      intent_score: enforced.intent_score,
      contactability_score: enforced.contactability_score,
      verification_score: enforced.verification_score,
      account_quality_score: enforced.account_quality_score,
      personalization_score: enforced.personalization_score,
    })) {
      return { ok: false, message: "Enforced lead score breakdown failed validation." }
    }

    return { ok: true, output: enforced }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not parse lead score JSON.",
    }
  }
}

export function parseGrowthLeadEngineLeadScoreFromUpstream(
  raw: string,
  upstream?: {
    verificationTriage?: GrowthLeadEngineVerificationTriageOutput | string
    accountBrief?: GrowthLeadEngineAccountBriefOutput | string
    outreachPersonalization?: GrowthLeadEngineOutreachPersonalizationOutput | string
  },
): ReturnType<typeof parseGrowthLeadEngineLeadScoreOutput> {
  return parseGrowthLeadEngineLeadScoreOutput(raw, {
    upstream: buildLeadScoreUpstreamContext(upstream),
  })
}

export function assertGrowthLeadEngineLeadScoreOutputKeys(): readonly string[] {
  return GROWTH_LEAD_ENGINE_LEAD_SCORE_OUTPUT_JSON_KEYS
}
