/**
 * GE-AIOS-RESEARCH-SUFFICIENCY-1A — Canonical research sufficiency contract.
 * Single decision surface for package readiness vs send readiness.
 * Threshold constants remain owned by OUTREACH-1A.
 */

import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthLeadResearchResult } from "@/lib/growth/research-types"
import type { GrowthLead } from "@/lib/growth/types"
import {
  GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE,
  GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE,
  GROWTH_RESEARCH_EXIT_MAX_MISSING_EVIDENCE,
  hasEnoughWebsiteEvidence,
  hasLikelyDecisionMaker,
  isObviousDisqualifier,
} from "@/lib/growth/outreach/growth-autonomous-revenue-loop-1a"

export const GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER =
  "ge-aios-research-sufficiency-1a-v1" as const

export const GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES = 2 as const

export type GrowthEvidenceTier = 1 | 2 | 3 | 4

export type GrowthResearchSufficiencyDecisionKind =
  | "sufficient_for_supervised_outreach"
  | "targeted_research_required"
  | "operator_review_required"
  | "terminal_reject"

export type GrowthResearchSufficiencyRequiredEvidence =
  | "verified_company_identity"
  | "eligible_territory"
  | "operational_fit"
  | "defensible_outreach_angle"
  | "sufficient_company_context"
  | "no_terminal_disqualifier"

export type GrowthResearchSufficiencyOptionalEvidence =
  | "named_decision_maker"
  | "verified_contact"
  | "buying_committee"
  | "fleet_size"
  | "revenue_estimate"
  | "software_stack"
  | "deep_competitive_intelligence"

export type GrowthResearchSufficiencyDecision =
  | {
      qaMarker: typeof GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER
      decision: "sufficient_for_supervised_outreach"
      confidence: number
      fitScore: number
      requiredEvidenceSatisfied: GrowthResearchSufficiencyRequiredEvidence[]
      optionalEvidenceMissing: GrowthResearchSufficiencyOptionalEvidence[]
      outreachClaimsAllowed: string[]
      packageReady: true
      sendReady: boolean
      shouldStopResearch: true
    }
  | {
      qaMarker: typeof GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER
      decision: "targeted_research_required"
      confidence: number
      fitScore: number
      missingMaterialEvidence: string[]
      boundedNextActions: string[]
      maxAdditionalInvestment: number
      packageReady: false
      sendReady: false
      shouldStopResearch: false
    }
  | {
      qaMarker: typeof GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER
      decision: "operator_review_required"
      confidence: number
      fitScore: number
      ambiguity: string[]
      packageReady: false
      sendReady: false
      shouldStopResearch: true
    }
  | {
      qaMarker: typeof GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER
      decision: "terminal_reject"
      confidence: number
      fitScore: number
      disqualifiers: string[]
      packageReady: false
      sendReady: false
      shouldStopResearch: true
    }

export type GrowthResearchSufficiencyInput = {
  fitScore: number
  confidence: number
  missingEvidenceCount: number
  result?: Pick<
    GrowthLeadResearchResult,
    | "companySummary"
    | "websiteSummary"
    | "sourceUrls"
    | "decisionMakerCandidates"
    | "outreachAngles"
    | "equipmentServiceIndicators"
    | "equipifyPainPoints"
  > | null
  lead?: Pick<
    GrowthLead,
    | "decisionMakerStatus"
    | "primaryDecisionMakerId"
    | "contactName"
    | "contactEmail"
    | "country"
    | "metadata"
  > | null
  qualification?: Pick<GrowthLeadResearchQualificationOutput, "missingEvidence"> | null
  researchTimeBudgetExhausted?: boolean
  /** Tier-4 provider industry label that conflicts with first-party operational evidence. */
  providerIndustryLabel?: string | null
  targetedResearchPassesUsed?: number
}

function emptyResult(): Pick<
  GrowthLeadResearchResult,
  | "companySummary"
  | "websiteSummary"
  | "sourceUrls"
  | "decisionMakerCandidates"
  | "outreachAngles"
  | "equipmentServiceIndicators"
  | "equipifyPainPoints"
> {
  return {
    companySummary: "",
    websiteSummary: null,
    sourceUrls: [],
    decisionMakerCandidates: [],
    outreachAngles: [],
    equipmentServiceIndicators: [],
    equipifyPainPoints: [],
  }
}

/** Tier 1 — first-party website and service-page evidence (highest authority). */
export function hasFirstPartyOperationalEvidence(
  result: Pick<
    GrowthLeadResearchResult,
    "websiteSummary" | "sourceUrls" | "outreachAngles" | "equipmentServiceIndicators" | "equipifyPainPoints"
  >,
): boolean {
  if (result.equipmentServiceIndicators.length > 0) return true
  if (result.outreachAngles.length > 0) return true
  if (result.equipifyPainPoints.length > 0) return true
  const website = `${result.websiteSummary ?? ""}`.toLowerCase()
  if (
    /maintenance|service|repair|install|calibrat|dispatch|field|technician|equipment|hvac|fleet/.test(website)
  ) {
    return true
  }
  return result.sourceUrls.some((url) => /\/(services|service|solutions|maintenance|about)/i.test(url))
}

/** Tier 4 provider classification must not override strong Tier 1 operational evidence. */
export function providerClassificationConflictsWithFirstPartyEvidence(input: {
  providerIndustryLabel?: string | null
  result: Pick<
    GrowthLeadResearchResult,
    "websiteSummary" | "sourceUrls" | "outreachAngles" | "equipmentServiceIndicators" | "equipifyPainPoints"
  >
}): boolean {
  const label = input.providerIndustryLabel?.trim().toLowerCase()
  if (!label) return false
  if (!hasFirstPartyOperationalEvidence(input.result)) return false
  return /construction|manufacturing|retail|food|restaurant|real estate|finance|insurance/.test(label)
}

function resolveVerifiedCompanyIdentity(
  result: ReturnType<typeof emptyResult>,
): GrowthResearchSufficiencyRequiredEvidence | null {
  const hasIdentity =
    Boolean(result.companySummary.trim()) &&
    (Boolean(result.websiteSummary?.trim()) || result.sourceUrls.length > 0)
  return hasIdentity ? "verified_company_identity" : null
}

function resolveEligibleTerritory(
  lead: GrowthResearchSufficiencyInput["lead"],
): GrowthResearchSufficiencyRequiredEvidence | null {
  const country = lead?.country?.trim().toUpperCase()
  if (!country) {
    // Admission/intake already validated territory for canonical pipeline leads.
    return "eligible_territory"
  }
  if (country === "US" || country === "USA" || country === "UNITED STATES") return "eligible_territory"
  return null
}

function resolveOperationalFit(input: {
  result: ReturnType<typeof emptyResult>
  fitScore: number
  providerIndustryLabel?: string | null
}): GrowthResearchSufficiencyRequiredEvidence | null {
  if (input.fitScore < GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE) {
    if (hasFirstPartyOperationalEvidence(input.result) && input.fitScore >= 45) {
      return "operational_fit"
    }
    return null
  }
  if (providerClassificationConflictsWithFirstPartyEvidence({
    providerIndustryLabel: input.providerIndustryLabel,
    result: input.result,
  })) {
    return "operational_fit"
  }
  return input.fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE ? "operational_fit" : null
}

function resolveDefensibleOutreachAngle(
  result: ReturnType<typeof emptyResult>,
): GrowthResearchSufficiencyRequiredEvidence | null {
  if (result.outreachAngles.length > 0) return "defensible_outreach_angle"
  if (result.equipifyPainPoints.length > 0) return "defensible_outreach_angle"
  if (result.equipmentServiceIndicators.length > 0) return "defensible_outreach_angle"
  return null
}

function resolveSufficientCompanyContext(
  result: ReturnType<typeof emptyResult>,
): GrowthResearchSufficiencyRequiredEvidence | null {
  return hasEnoughWebsiteEvidence(result) ? "sufficient_company_context" : null
}

function resolveOptionalEvidenceMissing(input: {
  lead: GrowthResearchSufficiencyInput["lead"]
  result: ReturnType<typeof emptyResult>
}): GrowthResearchSufficiencyOptionalEvidence[] {
  const missing: GrowthResearchSufficiencyOptionalEvidence[] = []
  if (!hasLikelyDecisionMaker({ lead: input.lead, result: input.result })) {
    missing.push("named_decision_maker")
  }
  const contactVerified =
    input.lead?.decisionMakerStatus === "verified_contactable" ||
    input.lead?.decisionMakerStatus === "confirmed" ||
    Boolean(input.lead?.contactEmail?.includes("@"))
  if (!contactVerified) missing.push("verified_contact")
  if ((input.result.decisionMakerCandidates.length ?? 0) <= 1) missing.push("buying_committee")
  return missing
}

function resolveOutreachClaimsAllowed(input: {
  result: ReturnType<typeof emptyResult>
  optionalMissing: GrowthResearchSufficiencyOptionalEvidence[]
}): string[] {
  const claims: string[] = []
  for (const angle of input.result.outreachAngles.slice(0, 2)) {
    if (angle.trim()) claims.push(angle.trim())
  }
  for (const indicator of input.result.equipmentServiceIndicators.slice(0, 2)) {
    if (indicator.trim()) claims.push(`Operational focus: ${indicator.trim()}`)
  }
  if (input.optionalMissing.includes("named_decision_maker")) {
    claims.push("Contact target to be confirmed during operator review")
  }
  if (input.optionalMissing.includes("verified_contact")) {
    claims.push("Outreach transport blocked until contact verification completes")
  }
  return claims
}

function resolveSendReady(input: {
  lead: GrowthResearchSufficiencyInput["lead"]
  result: ReturnType<typeof emptyResult>
}): boolean {
  const contactVerified =
    input.lead?.decisionMakerStatus === "verified_contactable" ||
    input.lead?.decisionMakerStatus === "confirmed" ||
    Boolean(input.lead?.contactEmail?.includes("@") && hasLikelyDecisionMaker({ lead: input.lead, result: input.result }))
  return contactVerified && hasLikelyDecisionMaker({ lead: input.lead, result: input.result })
}

function resolveProviderIndustryFromLead(lead: GrowthResearchSufficiencyInput["lead"]): string | null {
  const metadata = lead?.metadata
  if (!metadata || typeof metadata !== "object") return null
  const raw = metadata as Record<string, unknown>
  const candidates = [
    raw.provider_industry,
    raw.datamoon_industry,
    raw.industry_label,
    raw.prospect_search_industry,
  ]
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

/** Canonical research sufficiency decision — package readiness separate from send readiness. */
export function assessGrowthResearchSufficiency(
  input: GrowthResearchSufficiencyInput,
): GrowthResearchSufficiencyDecision {
  const result = input.result ?? emptyResult()
  const lead = input.lead ?? null
  const fitScore = input.fitScore
  const confidence = input.confidence
  const missingEvidenceCount = input.missingEvidenceCount
  const providerIndustryLabel = input.providerIndustryLabel ?? resolveProviderIndustryFromLead(lead)

  if (isObviousDisqualifier({ fitScore, confidence, missingEvidenceCount })) {
    const disqualifiers: string[] = []
    if (fitScore < 40) disqualifiers.push("fit_below_terminal_threshold")
    if (confidence < 0.35) disqualifiers.push("confidence_below_terminal_threshold")
    if (missingEvidenceCount >= 4) disqualifiers.push("material_evidence_gaps_exceeded")
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "terminal_reject",
      confidence,
      fitScore,
      disqualifiers,
      packageReady: false,
      sendReady: false,
      shouldStopResearch: true,
    }
  }

  if (
    providerClassificationConflictsWithFirstPartyEvidence({ providerIndustryLabel, result }) &&
    fitScore >= 45 &&
    confidence >= 0.4
  ) {
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "operator_review_required",
      confidence,
      fitScore,
      ambiguity: [
        `Provider industry "${providerIndustryLabel}" conflicts with first-party operational evidence on the company website.`,
      ],
      packageReady: false,
      sendReady: false,
      shouldStopResearch: true,
    }
  }

  const requiredChecks: Array<{
    key: GrowthResearchSufficiencyRequiredEvidence
    satisfied: GrowthResearchSufficiencyRequiredEvidence | null
  }> = [
    { key: "verified_company_identity", satisfied: resolveVerifiedCompanyIdentity(result) },
    { key: "eligible_territory", satisfied: resolveEligibleTerritory(lead) },
    {
      key: "operational_fit",
      satisfied: resolveOperationalFit({ result, fitScore, providerIndustryLabel }),
    },
    { key: "defensible_outreach_angle", satisfied: resolveDefensibleOutreachAngle(result) },
    { key: "sufficient_company_context", satisfied: resolveSufficientCompanyContext(result) },
    { key: "no_terminal_disqualifier", satisfied: "no_terminal_disqualifier" },
  ]

  const requiredEvidenceSatisfied = requiredChecks
    .map((row) => row.satisfied)
    .filter((row): row is GrowthResearchSufficiencyRequiredEvidence => row !== null)

  const missingMaterial = requiredChecks
    .filter((row) => row.satisfied === null)
    .map((row) => row.key)

  const optionalEvidenceMissing = resolveOptionalEvidenceMissing({ lead, result })
  const sendReady = resolveSendReady({ lead, result })

  const scoresSupportPackage =
    confidence >= GROWTH_EARLY_OUTREACH_MIN_CONFIDENCE &&
    fitScore >= GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE &&
    missingEvidenceCount <= GROWTH_RESEARCH_EXIT_MAX_MISSING_EVIDENCE

  if (
    missingMaterial.length === 0 &&
    scoresSupportPackage &&
    (hasEnoughWebsiteEvidence(result) || hasFirstPartyOperationalEvidence(result))
  ) {
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "sufficient_for_supervised_outreach",
      confidence,
      fitScore,
      requiredEvidenceSatisfied,
      optionalEvidenceMissing,
      outreachClaimsAllowed: resolveOutreachClaimsAllowed({ result, optionalMissing: optionalEvidenceMissing }),
      packageReady: true,
      sendReady,
      shouldStopResearch: true,
    }
  }

  if (input.researchTimeBudgetExhausted === true && scoresSupportPackage && missingMaterial.length <= 1) {
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "sufficient_for_supervised_outreach",
      confidence,
      fitScore,
      requiredEvidenceSatisfied,
      optionalEvidenceMissing,
      outreachClaimsAllowed: resolveOutreachClaimsAllowed({ result, optionalMissing: optionalEvidenceMissing }),
      packageReady: true,
      sendReady,
      shouldStopResearch: true,
    }
  }

  const passesUsed = input.targetedResearchPassesUsed ?? 0
  if (missingMaterial.length > 0 && passesUsed < GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES) {
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "targeted_research_required",
      confidence,
      fitScore,
      missingMaterialEvidence: missingMaterial,
      boundedNextActions: missingMaterial.map((gap) => `Resolve ${gap.replaceAll("_", " ")}`),
      maxAdditionalInvestment: Math.max(0, GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES - passesUsed),
      packageReady: false,
      sendReady: false,
      shouldStopResearch: false,
    }
  }

  if (missingMaterial.length > 0 || !scoresSupportPackage) {
    if (fitScore < GROWTH_EARLY_OUTREACH_MIN_FIT_SCORE && !hasFirstPartyOperationalEvidence(result)) {
      return {
        qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
        decision: "terminal_reject",
        confidence,
        fitScore,
        disqualifiers: ["operational_fit_not_established"],
        packageReady: false,
        sendReady: false,
        shouldStopResearch: true,
      }
    }
    return {
      qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
      decision: "targeted_research_required",
      confidence,
      fitScore,
      missingMaterialEvidence: missingMaterial.length > 0 ? missingMaterial : ["confidence_or_fit_threshold"],
      boundedNextActions: ["Complete one bounded material research action"],
      maxAdditionalInvestment: 0,
      packageReady: false,
      sendReady: false,
      shouldStopResearch: passesUsed >= GROWTH_RESEARCH_SUFFICIENCY_MAX_TARGETED_PASSES,
    }
  }

  return {
    qaMarker: GROWTH_RESEARCH_SUFFICIENCY_1A_QA_MARKER,
    decision: "operator_review_required",
    confidence,
    fitScore,
    ambiguity: ["Research completed but package readiness remains ambiguous."],
    packageReady: false,
    sendReady: false,
    shouldStopResearch: true,
  }
}

export function isPackageReadyFromSufficiency(decision: GrowthResearchSufficiencyDecision): boolean {
  return decision.packageReady === true
}

export function isSendReadyFromSufficiency(decision: GrowthResearchSufficiencyDecision): boolean {
  return decision.decision === "sufficient_for_supervised_outreach" && decision.sendReady === true
}

export function shouldStopResearchFromSufficiency(decision: GrowthResearchSufficiencyDecision): boolean {
  return decision.shouldStopResearch
}

export function buildResearchSufficiencyInputFromAssessment(input: {
  result: GrowthLeadResearchResult
  qualification: GrowthLeadResearchQualificationOutput
  lead?: GrowthLead | null
  researchTimeBudgetExhausted?: boolean
  targetedResearchPassesUsed?: number
  providerIndustryLabel?: string | null
}): GrowthResearchSufficiencyInput {
  return {
    fitScore: input.qualification.fitScore,
    confidence: input.qualification.confidence,
    missingEvidenceCount: input.qualification.missingEvidence?.length ?? 0,
    result: input.result,
    lead: input.lead ?? null,
    qualification: input.qualification,
    researchTimeBudgetExhausted: input.researchTimeBudgetExhausted,
    targetedResearchPassesUsed: input.targetedResearchPassesUsed,
    providerIndustryLabel: input.providerIndustryLabel,
  }
}

function readMetadataNumber(metadata: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!metadata) return null
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
  }
  return null
}

/** Lightweight lead-only projection for Draft Factory / SV1-1 when full research result is unavailable. */
export function assessGrowthResearchSufficiencyFromLead(
  lead: Pick<
    GrowthLead,
    | "score"
    | "country"
    | "metadata"
    | "contactEmail"
    | "contactName"
    | "primaryDecisionMakerId"
    | "decisionMakerStatus"
    | "companyName"
    | "website"
  >,
): GrowthResearchSufficiencyDecision {
  const metadata =
    lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
      ? (lead.metadata as Record<string, unknown>)
      : null
  const fitScore =
    readMetadataNumber(metadata, ["equipify_fit_score", "fit_score"]) ??
    (typeof lead.score === "number" ? lead.score : 0)
  const rawConfidence =
    readMetadataNumber(metadata, ["research_confidence", "confidence"]) ??
    (typeof lead.score === "number" ? lead.score / 100 : 0)
  const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence
  const summary =
    typeof metadata?.research_summary === "string"
      ? metadata.research_summary
      : typeof metadata?.company_summary === "string"
        ? metadata.company_summary
        : lead.companyName?.trim() || ""

  return assessGrowthResearchSufficiency({
    fitScore,
    confidence,
    missingEvidenceCount: 0,
    lead,
    result: {
      companySummary: summary,
      websiteSummary: typeof metadata?.website_summary === "string" ? metadata.website_summary : null,
      sourceUrls: lead.website?.trim() ? [lead.website.trim()] : [],
      decisionMakerCandidates: [],
      outreachAngles:
        typeof metadata?.suggested_pitch_angle === "string" && metadata.suggested_pitch_angle.trim()
          ? [metadata.suggested_pitch_angle.trim()]
          : [],
      equipmentServiceIndicators: [],
      equipifyPainPoints: [],
    },
    providerIndustryLabel: resolveProviderIndustryFromLead(lead),
  })
}
