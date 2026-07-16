/**
 * GE-AIOS-21C — Canonical ICP lead admission evaluator (client-safe).
 * Reuses approved Company Profile + identity normalization — no duplicate ICP engine.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  domainToCompanyNameHint,
  extractDomainFromEmail,
  isConsumerEmailDomain,
  normalizeCompanyName,
  normalizeDomain,
} from "@/lib/growth/company-identification/company-identification-normalize"
import type { NormalizedLeadIntake } from "@/lib/growth/revenue-workflow/unified-lead-intake-types"
import {
  GROWTH_LEAD_ADMISSION_21C_QA_MARKER,
  type GrowthLeadAdmissionEvaluation,
  type GrowthLeadAdmissionState,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-types"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"

export type GrowthLeadAdmissionContext = {
  approvedProfile: BusinessProfileDraftContent | null
  activeMissionTitle?: string | null
}

export type GrowthLeadAdmissionEvaluateOptions = {
  /** Post-research operational keyword validation (external discovery only). */
  operationalKeywordValidation?: {
    pass: boolean
    reason?: string | null
    matchedKeywords?: string[]
    missingKeywords?: string[]
  } | null
  /** Prospect Search industry gate result carried from external discovery normalization. */
  prospectSearchIndustryGatePassed?: boolean | null
}

export type GrowthLeadAdmissionIntakeInput = Pick<
  NormalizedLeadIntake,
  | "companyName"
  | "website"
  | "domain"
  | "industry"
  | "email"
  | "contactName"
  | "identityUncertain"
  | "source"
  | "metadata"
>

const KNOWN_ICP_MISMATCH_HINTS = [
  "best buy",
  "comcast",
  "roofing",
  "seafood",
  "promotional marketing",
  "retail chain",
  "grocery",
  "restaurant",
  "pizza",
  "salon",
  "daycare",
  "church",
  "school district",
] as const

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))]
}

function websiteFromDomain(domain: string | null): string | null {
  if (!domain) return null
  return `https://${domain}`
}

export function resolveCredibleBusinessDomain(input: {
  domain?: string | null
  website?: string | null
  businessEmail?: string | null
  contactEmail?: string | null
}): string | null {
  const explicitDomain = normalizeDomain(input.domain) ?? normalizeDomain(input.website)
  if (explicitDomain && !isConsumerEmailDomain(explicitDomain)) {
    return explicitDomain
  }

  const businessEmailDomain = extractDomainFromEmail(input.businessEmail)
  if (businessEmailDomain && !isConsumerEmailDomain(businessEmailDomain)) {
    return businessEmailDomain
  }

  const contactEmailDomain = extractDomainFromEmail(input.contactEmail)
  if (contactEmailDomain && !isConsumerEmailDomain(contactEmailDomain)) {
    return contactEmailDomain
  }

  return null
}

function companyNameLooksLikeConsumerDomain(companyName: string): boolean {
  const normalized = normalizeDomain(companyName)
  return Boolean(normalized && isConsumerEmailDomain(normalized))
}

function hasExplicitCompanyName(companyName: string | null | undefined): boolean {
  const normalized = normalizeCompanyName(companyName ?? "")
  if (!normalized) return false
  if (normalized === "Unknown Company") return false
  if (normalized.endsWith("(company unknown)")) return false
  if (companyNameLooksLikeConsumerDomain(normalized)) return false
  return true
}

function resolveSanitizedCompanyName(input: {
  companyName: string
  credibleDomain: string | null
  contactName: string | null
  explicitCompanyName: string | null
}): string {
  const explicit = normalizeCompanyName(input.explicitCompanyName ?? input.companyName)
  if (explicit && !companyNameLooksLikeConsumerDomain(explicit)) {
    return explicit
  }

  if (input.credibleDomain) {
    return domainToCompanyNameHint(input.credibleDomain)
  }

  if (input.contactName?.trim()) {
    return `${input.contactName.trim()} (company unknown)`
  }

  return "Unknown Company"
}

function collectProfileMismatchReasons(
  text: string,
  profile: BusinessProfileDraftContent,
): string[] {
  const haystack = text.toLowerCase()
  const reasons: string[] = []

  for (const keyword of profile.problemsAndTriggers.negativeKeywords) {
    const normalized = keyword.trim().toLowerCase()
    if (normalized.length >= 4 && haystack.includes(normalized)) {
      reasons.push(`negative_keyword:${normalized}`)
    }
  }

  for (const disqualifier of profile.idealCustomers.disqualifiers) {
    const normalized = disqualifier.trim().toLowerCase()
    if (normalized.length >= 4 && haystack.includes(normalized)) {
      reasons.push(`profile_disqualifier:${normalized}`)
    }
  }

  for (const hint of KNOWN_ICP_MISMATCH_HINTS) {
    if (haystack.includes(hint)) {
      reasons.push(`known_icp_mismatch:${hint}`)
    }
  }

  return reasons
}

function evaluateIdentity(input: {
  companyName: string
  domain: string | null
  website: string | null
  email: string | null
  businessEmail?: string | null
}): { invalid: boolean; reasons: string[]; credibleDomain: string | null } {
  const reasons: string[] = []
  const rawDomain = normalizeDomain(input.domain) ?? normalizeDomain(input.website)
  const emailDomain = extractDomainFromEmail(input.email)
  const businessEmailDomain = extractDomainFromEmail(input.businessEmail)

  if (rawDomain && isConsumerEmailDomain(rawDomain)) {
    reasons.push("consumer_domain_as_company_website")
  }
  if (emailDomain && isConsumerEmailDomain(emailDomain) && !businessEmailDomain) {
    reasons.push("consumer_email_without_business_domain")
  }
  if (companyNameLooksLikeConsumerDomain(input.companyName)) {
    reasons.push("company_name_is_consumer_domain")
  }

  const credibleDomain = resolveCredibleBusinessDomain({
    domain: input.domain,
    website: input.website,
    businessEmail: input.businessEmail,
    contactEmail: input.email,
  })

  const invalid =
    reasons.includes("company_name_is_consumer_domain") ||
    (reasons.includes("consumer_domain_as_company_website") && !credibleDomain)

  return { invalid, reasons, credibleDomain }
}

function evaluateIcpFit(input: {
  companyName: string
  industry: string | null
  credibleDomain: string | null
  context: GrowthLeadAdmissionContext
}): { state: GrowthLeadAdmissionState; reasons: string[] } {
  const text = [input.companyName, input.industry, input.credibleDomain].filter(Boolean).join(" ")
  const reasons: string[] = []

  if (!input.context.approvedProfile) {
    if (!input.credibleDomain) {
      return { state: "review", reasons: ["missing_approved_profile", "missing_credible_business_domain"] }
    }
    return { state: "review", reasons: ["missing_approved_profile"] }
  }

  const profileReasons = collectProfileMismatchReasons(text, input.context.approvedProfile)
  if (profileReasons.length > 0) {
    return { state: "rejected", reasons: profileReasons }
  }

  if (!input.credibleDomain) {
    return { state: "review", reasons: ["missing_credible_business_domain"] }
  }

  const targetIndustries = input.context.approvedProfile.idealCustomers.targetIndustries
  if (input.industry && targetIndustries.length > 0) {
    const industryLower = input.industry.toLowerCase()
    const matchesTarget = targetIndustries.some((entry) => {
      const target = entry.trim().toLowerCase()
      return target.length >= 3 && (industryLower.includes(target) || target.includes(industryLower))
    })
    if (!matchesTarget) {
      reasons.push("industry_not_in_approved_profile")
    }
  }

  if (reasons.length > 0) {
    return { state: "review", reasons }
  }

  return { state: "accepted", reasons: ["profile_aligned"] }
}

export function evaluateGrowthLeadAdmission(
  intake: GrowthLeadAdmissionIntakeInput,
  context: GrowthLeadAdmissionContext,
  options?: GrowthLeadAdmissionEvaluateOptions,
): GrowthLeadAdmissionEvaluation {
  const businessEmail =
    typeof intake.metadata?.business_email === "string" ? intake.metadata.business_email : null

  const identity = evaluateIdentity({
    companyName: intake.companyName,
    domain: intake.domain,
    website: intake.website,
    email: intake.email,
    businessEmail,
  })

  const explicitCompanyName = intake.companyName?.trim() || null
  const sanitizedCompanyName = resolveSanitizedCompanyName({
    companyName: intake.companyName,
    credibleDomain: identity.credibleDomain,
    contactName: intake.contactName,
    explicitCompanyName,
  })

  const sanitizedDomain = identity.credibleDomain
  const sanitizedWebsite = websiteFromDomain(sanitizedDomain)
  const reasons = [...identity.reasons]

  if (intake.identityUncertain) {
    reasons.push("identity_uncertain")
  }

  let state: GrowthLeadAdmissionState
  if (identity.invalid) {
    state = "invalid"
    reasons.push("invalid_company_identity")
  } else if (!hasExplicitCompanyName(intake.companyName) && !identity.credibleDomain) {
    state = "invalid"
    reasons.push("missing_credible_company_identity")
    reasons.push("invalid_company_identity")
  } else {
    const icp = evaluateIcpFit({
      companyName: sanitizedCompanyName,
      industry: intake.industry,
      credibleDomain: identity.credibleDomain,
      context,
    })
    state = icp.state
    reasons.push(...icp.reasons)
  }

  const externalDiscovery = isExternalDiscoveryLeadIntakeSource(intake.source)
  if (externalDiscovery && state !== "invalid") {
    const industryGatePassed = options?.prospectSearchIndustryGatePassed !== false
    if (!industryGatePassed) {
      state = "rejected"
      reasons.push("prospect_search_industry_gate_failed")
    }

    const keywordValidation = options?.operationalKeywordValidation
    if (keywordValidation == null) {
      if (state === "accepted") {
        state = "review"
      }
      reasons.push("pending_operational_keyword_validation")
    } else if (!keywordValidation.pass) {
      state = "rejected"
      reasons.push("operational_keyword_validation_failed")
      if (keywordValidation.reason?.trim()) {
        reasons.push(keywordValidation.reason.trim())
      }
    } else {
      reasons.push("operational_keyword_validation_passed")
      if (
        industryGatePassed &&
        state !== "rejected" &&
        !reasons.some(
          (reason) =>
            reason.startsWith("negative_keyword:") ||
            reason.startsWith("profile_disqualifier:") ||
            reason.startsWith("known_icp_mismatch:"),
        )
      ) {
        const hasBlockingReviewReason = reasons.some(
          (reason) =>
            reason === "missing_credible_business_domain" ||
            reason === "missing_approved_profile" ||
            reason === "identity_uncertain" ||
            reason === "industry_not_in_approved_profile",
        )
        state = hasBlockingReviewReason ? "review" : "accepted"
      }
    }
  }

  const requiresHumanReview =
    state === "review" || state === "invalid" || intake.identityUncertain || state === "rejected"

  const allowLeadCreation = state !== "invalid"
  const allowAutoResearch =
    state === "accepted" ||
    (state === "review" && Boolean(identity.credibleDomain))

  const blockers =
    state === "invalid"
      ? ["invalid_company_identity"]
      : state === "rejected"
        ? ["icp_mismatch"]
        : state === "review"
          ? ["admission_review_required"]
          : []

  return {
    qa_marker: GROWTH_LEAD_ADMISSION_21C_QA_MARKER,
    state,
    reasons: uniqueReasons(reasons),
    allowLeadCreation,
    allowAutoResearch,
    leadStatus: state === "rejected" ? "disqualified" : "new",
    requiresHumanReview,
    blockers,
    sanitized: {
      companyName: sanitizedCompanyName,
      website: sanitizedWebsite,
      domain: sanitizedDomain,
    },
  }
}

export function resolveLeadAdmissionStateFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthLeadAdmissionState | null {
  const raw = metadata?.admission_state
  if (
    raw === "accepted" ||
    raw === "review" ||
    raw === "rejected" ||
    raw === "invalid"
  ) {
    return raw
  }
  return null
}

export function buildLeadAdmissionMetadata(
  evaluation: GrowthLeadAdmissionEvaluation,
  generatedAt: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    admission_state: evaluation.state,
    admission_reasons: evaluation.reasons,
    admission_evaluated_at: generatedAt,
    admission_qa_marker: evaluation.qa_marker,
    requires_human_review: evaluation.requiresHumanReview,
  }
}
