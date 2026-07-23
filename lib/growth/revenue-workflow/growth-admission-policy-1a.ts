/**
 * GE-AIOS-ADMISSION-POLICY-1A — Research Sufficiency → Admission alignment (client-safe).
 * Presentation/policy adapter only: consumes assessGrowthResearchSufficiency() outputs.
 * Does not duplicate sufficiency predicates or create a second admission engine.
 */

import type { GrowthLeadResearchQualificationOutput } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import { qualifyGrowthLeadResearch } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"
import type { GrowthCompanyEvidenceBundle } from "@/lib/growth/research/company-evidence/company-evidence-types"
import type { GrowthLeadResearchResult, GrowthResearchRunPublicView } from "@/lib/growth/research-types"
import {
  assessGrowthResearchSufficiency,
  buildResearchSufficiencyInputFromAssessment,
  type GrowthResearchSufficiencyDecision,
  type GrowthResearchSufficiencyDecisionKind,
} from "@/lib/growth/research/growth-research-sufficiency-1a"
import type { GrowthLead } from "@/lib/growth/types"
import type {
  GrowthLeadAdmissionEvaluation,
  GrowthLeadAdmissionState,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { isAutonomousTerminalRejectReason } from "@/lib/growth/aios/authority/growth-canonical-escalation-authority-1c"

export const GROWTH_ADMISSION_POLICY_1A_QA_MARKER = "ge-aios-admission-policy-1a-v1" as const

const HARD_DISQUALIFIER_PREFIXES = [
  "negative_keyword:",
  "profile_disqualifier:",
  "known_icp_mismatch:",
] as const

const RECOVERABLE_PROVIDER_MISMATCH_REASONS = new Set([
  "prospect_search_industry_gate_failed",
  "operational_keyword_validation_failed",
  "industry_not_in_approved_profile",
  "pending_operational_keyword_validation",
])

const HARD_IDENTITY_REASONS = new Set([
  "consumer_domain_as_company_website",
  "consumer_email_without_business_domain",
  "company_name_is_consumer_domain",
  "invalid_company_identity",
  "missing_credible_company_identity",
])

export type GrowthAdmissionPolicyApplyInput = {
  base: GrowthLeadAdmissionEvaluation
  sufficiency: GrowthResearchSufficiencyDecision
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))]
}

function hasHardDisqualifierReason(reasons: readonly string[]): boolean {
  return reasons.some(
    (reason) =>
      HARD_DISQUALIFIER_PREFIXES.some((prefix) => reason.startsWith(prefix)) ||
      HARD_IDENTITY_REASONS.has(reason),
  )
}

function hasRecoverableProviderMismatchOnly(reasons: readonly string[]): boolean {
  const blocking = reasons.filter(
    (reason) =>
      RECOVERABLE_PROVIDER_MISMATCH_REASONS.has(reason) ||
      reason.startsWith("negative_keyword:") ||
      reason.startsWith("profile_disqualifier:") ||
      reason.startsWith("known_icp_mismatch:"),
  )
  if (blocking.length === 0) return false
  return !hasHardDisqualifierReason(reasons)
}

function mapSufficiencyDisqualifiersToAdmissionReasons(
  sufficiency: Extract<GrowthResearchSufficiencyDecision, { decision: "terminal_reject" }>,
): string[] {
  return sufficiency.disqualifiers.map((code) => {
    switch (code) {
      case "fit_below_terminal_threshold":
        return "insufficient_first_party_evidence"
      case "confidence_below_terminal_threshold":
        return "insufficient_first_party_evidence"
      case "material_evidence_gaps_exceeded":
        return "company_identity_unverified"
      case "operational_fit_not_established":
        return "unsupported_service_model"
      default:
        return code
    }
  })
}

function mapMissingEvidenceToAdmissionReasons(missing: readonly string[]): string[] {
  return missing.map((gap) => {
    switch (gap) {
      case "verified_company_identity":
        return "company_identity_unverified"
      case "eligible_territory":
        return "territory_unresolved"
      case "operational_fit":
        return "insufficient_first_party_evidence"
      case "defensible_outreach_angle":
        return "outreach_angle_missing"
      case "sufficient_company_context":
        return "insufficient_first_party_evidence"
      case "confidence_or_fit_threshold":
        return "insufficient_first_party_evidence"
      default:
        return gap.replaceAll("_", " ")
    }
  })
}

function mapOperatorReviewAmbiguity(ambiguity: readonly string[]): string[] {
  const reasons: string[] = ["operational_fit_requires_operator_review"]
  for (const line of ambiguity) {
    if (/conflict/i.test(line)) {
      reasons.push("first_party_evidence_conflicts_with_provider_classification")
    }
  }
  return uniqueReasons(reasons)
}

function resolveBlockersForState(state: GrowthLeadAdmissionState): string[] {
  switch (state) {
    case "invalid":
      return ["invalid_company_identity"]
    case "rejected":
      return ["icp_mismatch"]
    case "review":
      return ["admission_review_required"]
    default:
      return []
  }
}

function resolveLeadStatus(state: GrowthLeadAdmissionState): GrowthLeadAdmissionEvaluation["leadStatus"] {
  return state === "rejected" || state === "invalid" ? "disqualified" : "new"
}

/** Align an existing 21C admission evaluation with canonical Research Sufficiency semantics. */
export function applyResearchSufficiencyAdmissionPolicy(
  input: GrowthAdmissionPolicyApplyInput,
): GrowthLeadAdmissionEvaluation {
  const { base, sufficiency } = input
  let state = base.state
  let reasons = [...base.reasons]

  if (state === "invalid") {
    return base
  }

  if (hasHardDisqualifierReason(reasons)) {
    if (sufficiency.decision === "terminal_reject") {
      state = "rejected"
      reasons.push(...mapSufficiencyDisqualifiersToAdmissionReasons(sufficiency))
    }
    const autonomousReject =
      sufficiency.decision === "terminal_reject" ||
      (reasons.length > 0 && reasons.every(isAutonomousTerminalRejectReason))
    return {
      ...base,
      state,
      reasons: uniqueReasons(reasons),
      leadStatus: resolveLeadStatus(state),
      requiresHumanReview: !autonomousReject,
      blockers: autonomousReject ? [] : resolveBlockersForState(state),
    }
  }

  switch (sufficiency.decision) {
    case "terminal_reject": {
      state = "rejected"
      reasons = uniqueReasons([
        ...reasons.filter((reason) => reason !== "profile_aligned"),
        ...mapSufficiencyDisqualifiersToAdmissionReasons(sufficiency),
      ])
      break
    }
    case "operator_review_required": {
      state = "review"
      reasons = uniqueReasons([
        ...reasons.filter(
          (reason) =>
            reason !== "profile_aligned" &&
            !RECOVERABLE_PROVIDER_MISMATCH_REASONS.has(reason) &&
            reason !== "operational_keyword_validation_failed",
        ),
        ...mapOperatorReviewAmbiguity(sufficiency.ambiguity),
      ])
      break
    }
    case "targeted_research_required": {
      state = "review"
      reasons = uniqueReasons([
        ...reasons.filter(
          (reason) =>
            reason !== "profile_aligned" &&
            (!RECOVERABLE_PROVIDER_MISMATCH_REASONS.has(reason) ||
              hasRecoverableProviderMismatchOnly(base.reasons)),
        ),
        ...mapMissingEvidenceToAdmissionReasons(sufficiency.missingMaterialEvidence),
        "admission_evidence_incomplete",
      ])
      break
    }
    case "sufficient_for_supervised_outreach": {
      const softRejected =
        state === "rejected" && hasRecoverableProviderMismatchOnly(reasons)
      const softReviewOnly =
        state === "review" &&
        reasons.every(
          (reason) =>
            RECOVERABLE_PROVIDER_MISMATCH_REASONS.has(reason) ||
            reason === "identity_uncertain" ||
            reason === "industry_not_in_approved_profile" ||
            reason === "missing_credible_business_domain" ||
            reason === "missing_approved_profile" ||
            reason === "profile_aligned",
        )

      if (softRejected || softReviewOnly || state === "accepted") {
        state = "accepted"
        reasons = uniqueReasons([
          ...reasons.filter(
            (reason) =>
              !RECOVERABLE_PROVIDER_MISMATCH_REASONS.has(reason) &&
              reason !== "operational_keyword_validation_failed" &&
              reason !== "prospect_search_industry_gate_failed" &&
              reason !== "pending_operational_keyword_validation",
          ),
          "profile_aligned",
          ...(sufficiency.optionalEvidenceMissing.includes("named_decision_maker")
            ? ["decision_maker_optional_for_admission"]
            : []),
          ...(sufficiency.optionalEvidenceMissing.includes("verified_contact")
            ? ["contact_verification_optional_for_admission"]
            : []),
        ])
      }
      break
    }
  }

  const autonomousTerminalReject =
    sufficiency.decision === "terminal_reject" ||
    (state === "rejected" && reasons.length > 0 && reasons.every(isAutonomousTerminalRejectReason))

  const requiresHumanReview =
    !autonomousTerminalReject &&
    (state === "review" || (state === "invalid" && !autonomousTerminalReject) || base.requiresHumanReview)

  return {
    ...base,
    state,
    reasons: uniqueReasons(reasons),
    allowLeadCreation: base.allowLeadCreation,
    allowAutoResearch:
      state === "accepted" ||
      (state === "review" && Boolean(base.sanitized.domain || base.sanitized.website)),
    leadStatus: resolveLeadStatus(state),
    requiresHumanReview,
    blockers: resolveBlockersForState(state),
  }
}

export function buildResearchSufficiencyDecisionForAdmission(input: {
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
  qualification?: Pick<
    GrowthLeadResearchQualificationOutput,
    "fitScore" | "confidence" | "missingEvidence" | "recommendedNextAction" | "recommendedWorkOrderType" | "reason"
  > | null
  lead?: Pick<
    GrowthLead,
    | "decisionMakerStatus"
    | "primaryDecisionMakerId"
    | "contactName"
    | "contactEmail"
    | "country"
    | "metadata"
    | "score"
    | "companyName"
    | "website"
  > | null
  researchTimeBudgetExhausted?: boolean
  targetedResearchPassesUsed?: number
  providerIndustryLabel?: string | null
}): GrowthResearchSufficiencyDecision {
  if (input.result && input.qualification) {
    return assessGrowthResearchSufficiency(
      buildResearchSufficiencyInputFromAssessment({
        result: input.result as GrowthLeadResearchResult,
        qualification: input.qualification as GrowthLeadResearchQualificationOutput,
        lead: input.lead ?? null,
        researchTimeBudgetExhausted: input.researchTimeBudgetExhausted,
        targetedResearchPassesUsed: input.targetedResearchPassesUsed,
        providerIndustryLabel: input.providerIndustryLabel,
      }),
    )
  }

  if (input.lead) {
    return assessGrowthResearchSufficiency(
      buildResearchSufficiencyInputFromAssessment({
        result: {
          companySummary: input.lead.companyName?.trim() || "",
          websiteSummary: null,
          sourceUrls: input.lead.website?.trim() ? [input.lead.website.trim()] : [],
          decisionMakerCandidates: [],
          outreachAngles: [],
          equipmentServiceIndicators: [],
          equipifyPainPoints: [],
        } as GrowthLeadResearchResult,
        qualification: {
          fitScore: typeof input.lead.score === "number" ? input.lead.score : 0,
          confidence: typeof input.lead.score === "number" ? input.lead.score / 100 : 0,
          missingEvidence: [],
          recommendedNextAction: "Continue research",
          recommendedWorkOrderType: null,
          reason: "legacy_lead_projection",
        },
        lead: input.lead,
        providerIndustryLabel: input.providerIndustryLabel,
      }),
    )
  }

  return assessGrowthResearchSufficiency({
    fitScore: 0,
    confidence: 0,
    missingEvidenceCount: 4,
  })
}

function resolveProviderIndustryLabelFromLead(
  lead: Pick<GrowthLead, "metadata" | "industry"> | null | undefined,
): string | null {
  if (lead?.industry?.trim()) return lead.industry.trim()
  const metadata = lead?.metadata
  if (!metadata || typeof metadata !== "object") return null
  const raw = metadata as Record<string, unknown>
  const datamoon =
    raw.datamoon && typeof raw.datamoon === "object" ? (raw.datamoon as Record<string, unknown>) : {}
  for (const key of ["provider_industry", "datamoon_industry", "industry_label", "prospect_search_industry"]) {
    const value = raw[key] ?? datamoon[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function buildResearchResultFromPostResearchAdmissionInput(input: {
  lead: Pick<GrowthLead, "companyName" | "website" | "industry">
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "recommendedNextAction"
    | "industryGuess"
    | "detectedTechnologies"
    | "signals"
    | "equipifyFitScore"
    | "researchConfidence"
  > | null
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  websiteCrawlText?: string | null
}): GrowthLeadResearchResult {
  const profile = input.evidenceBundle?.profile
  const painSignals = Array.isArray(input.researchRun?.signals?.pain_signals)
    ? input.researchRun.signals.pain_signals.filter((value): value is string => typeof value === "string")
    : []
  const websiteSummary =
    input.websiteCrawlText?.trim() ||
    input.researchRun?.researchSummary?.trim() ||
    profile?.companyDescription?.value?.trim() ||
    null

  return {
    companySummary:
      input.researchRun?.researchSummary?.trim() ||
      profile?.companyDescription?.value?.trim() ||
      input.lead.companyName?.trim() ||
      "",
    websiteSummary,
    likelyServiceCategory: input.lead.industry ?? input.researchRun?.industryGuess ?? null,
    serviceAreaClues: [],
    companySizeEstimate: null,
    equipmentServiceIndicators: profile?.primaryServices?.values ?? [],
    equipifyPainPoints: painSignals,
    equipifyFitScore:
      typeof input.researchRun?.equipifyFitScore === "number"
        ? input.researchRun.equipifyFitScore
        : typeof input.lead === "object" && "score" in input.lead && typeof input.lead.score === "number"
          ? input.lead.score
          : 0,
    outreachAngles: input.researchRun?.suggestedPitchAngle?.trim()
      ? [input.researchRun.suggestedPitchAngle.trim()]
      : [],
    recommendedNextAction:
      input.researchRun?.recommendedNextAction?.trim() || "Continue research",
    researchConfidence:
      typeof input.researchRun?.researchConfidence === "number"
        ? input.researchRun.researchConfidence
        : 0.5,
    sourceUrls: input.lead.website?.trim() ? [input.lead.website.trim()] : [],
    caveats: [],
    fitModelVersion: "admission-policy-1a",
    decisionMakerCandidates: [],
    estimatedAnnualRevenue: null,
    estimatedEmployeeCount: null,
    fleetSizeEstimate: null,
    crmDetected: null,
    fieldServiceStackDetected:
      Array.isArray(input.researchRun?.detectedTechnologies) &&
      input.researchRun.detectedTechnologies.length > 0
        ? input.researchRun.detectedTechnologies.join(", ")
        : null,
  }
}

export function buildResearchSufficiencyDecisionForPostResearchAdmission(input: {
  lead: Pick<
    GrowthLead,
    | "companyName"
    | "website"
    | "industry"
    | "metadata"
    | "score"
    | "country"
    | "contactEmail"
    | "contactName"
    | "primaryDecisionMakerId"
    | "decisionMakerStatus"
  >
  researchRun?: Pick<
    GrowthResearchRunPublicView,
    | "researchSummary"
    | "suggestedPitchAngle"
    | "recommendedNextAction"
    | "industryGuess"
    | "detectedTechnologies"
    | "signals"
    | "equipifyFitScore"
    | "researchConfidence"
  > | null
  evidenceBundle?: GrowthCompanyEvidenceBundle | null
  websiteCrawlText?: string | null
  researchTimeBudgetExhausted?: boolean
  targetedResearchPassesUsed?: number
}): GrowthResearchSufficiencyDecision {
  const result = buildResearchResultFromPostResearchAdmissionInput(input)
  const qualification = qualifyGrowthLeadResearch({
    result,
    researchRunStatus: "succeeded",
  }).qualification

  return assessGrowthResearchSufficiency(
    buildResearchSufficiencyInputFromAssessment({
      result,
      qualification,
      lead: input.lead,
      researchTimeBudgetExhausted: input.researchTimeBudgetExhausted,
      targetedResearchPassesUsed: input.targetedResearchPassesUsed,
      providerIndustryLabel: resolveProviderIndustryLabelFromLead(input.lead),
    }),
  )
}

export function buildAdmissionPolicyMetadataFromSufficiency(
  sufficiency: GrowthResearchSufficiencyDecision,
  generatedAt: string = new Date().toISOString(),
): Record<string, unknown> {
  const common = {
    research_sufficiency_decision: sufficiency.decision,
    research_sufficiency_evaluated_at: generatedAt,
    research_sufficiency_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    admission_policy_qa_marker: GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
    package_ready: "packageReady" in sufficiency ? sufficiency.packageReady : false,
    send_ready: "sendReady" in sufficiency ? sufficiency.sendReady : false,
  }

  if (sufficiency.decision === "targeted_research_required") {
    return {
      ...common,
      admission_targeted_research_missing_evidence: sufficiency.missingMaterialEvidence,
      admission_bounded_next_actions: sufficiency.boundedNextActions,
      admission_max_additional_investment: sufficiency.maxAdditionalInvestment,
    }
  }

  if (sufficiency.decision === "operator_review_required") {
    return {
      ...common,
      admission_review_ambiguity: sufficiency.ambiguity,
    }
  }

  if (sufficiency.decision === "terminal_reject") {
    return {
      ...common,
      admission_terminal_disqualifiers: sufficiency.disqualifiers,
    }
  }

  if (sufficiency.decision === "sufficient_for_supervised_outreach") {
    return {
      ...common,
      admission_optional_evidence_missing: sufficiency.optionalEvidenceMissing,
      admission_outreach_claims_allowed: sufficiency.outreachClaimsAllowed,
    }
  }

  return common
}

/** Safe read for legacy records without sufficiency metadata — preserves stored admission state. */
export function resolveLegacyAdmissionPolicyRead(input: {
  admissionState: GrowthLeadAdmissionState | null
  metadata?: Record<string, unknown> | null
}): {
  admissionState: GrowthLeadAdmissionState | null
  sufficiencyDecision: GrowthResearchSufficiencyDecisionKind | null
  hasPolicyMetadata: boolean
} {
  const metadata = input.metadata ?? {}
  const rawDecision = metadata.research_sufficiency_decision
  const sufficiencyDecision =
    rawDecision === "sufficient_for_supervised_outreach" ||
    rawDecision === "targeted_research_required" ||
    rawDecision === "operator_review_required" ||
    rawDecision === "terminal_reject"
      ? rawDecision
      : null

  return {
    admissionState: input.admissionState,
    sufficiencyDecision,
    hasPolicyMetadata: metadata.admission_policy_qa_marker === GROWTH_ADMISSION_POLICY_1A_QA_MARKER,
  }
}
