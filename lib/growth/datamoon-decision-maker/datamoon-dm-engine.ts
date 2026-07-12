/** SV1-4 — Decision-maker requirement + ranking + authorization (client-safe). */

import { scoreDecisionMakerTitle } from "@/lib/growth/contact-discovery/decision-maker-score"
import type { AiOsInvestmentState } from "@/lib/growth/resource-allocation/resource-allocation-types"
import {
  AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES,
  AI_OS_DATAMOON_DM_QA_MARKER,
  AI_OS_DATAMOON_DM_RETRY,
  type AiOsDatamoonDmAuthorization,
  type AiOsDatamoonDmCandidate,
  type AiOsDatamoonDmContactReadiness,
  type AiOsDatamoonDmDecision,
  type AiOsDatamoonDmDenyReason,
  type AiOsDatamoonDmExplainability,
  type AiOsDatamoonDmOutcome,
  type AiOsDatamoonDmRequirement,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-types"

export type ExistingDecisionMakerSnapshot = {
  fullName: string
  title?: string | null
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
  status?: string | null
  isPrimary?: boolean
  confidence?: number | null
}

export type DatamoonDmRequirementInput = {
  admissionState?: string | null
  leadStatus?: string | null
  researchComplete?: boolean
  companyIdentityConfident?: boolean
  existingDecisionMakers?: ExistingDecisionMakerSnapshot[]
  hasPrimaryDecisionMaker?: boolean
  hasContactName?: boolean
  contactEmail?: string | null
  decisionMakerStatus?: string | null
  searchAttemptCount?: number
  lastEquivalentNoResultAt?: string | null
  now?: string
  titleFamilies?: string[]
  investmentState?: AiOsInvestmentState | null
  earnedEnrichmentSpend?: boolean
}

function emailLooksUsable(email: string | null | undefined): boolean {
  if (!email?.trim()) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

function phoneLooksUsable(phone: string | null | undefined): boolean {
  if (!phone?.trim()) return false
  const digits = phone.replace(/\D/g, "")
  return digits.length >= 10
}

export function evaluateDecisionMakerContactReadiness(input: {
  email?: string | null
  phone?: string | null
  linkedinUrl?: string | null
}): AiOsDatamoonDmContactReadiness {
  const hasVerifiedEmail = emailLooksUsable(input.email)
  const hasVerifiedPhone = phoneLooksUsable(input.phone)
  const hasProfileUrl = Boolean(input.linkedinUrl?.trim())
  if (hasVerifiedEmail) {
    return {
      hasVerifiedEmail,
      hasVerifiedPhone,
      hasProfileUrl,
      usableChannel: "email",
      unblocksEmailDrafting: true,
      unblocksCallPackage: hasVerifiedPhone,
      reason: "Verified email available for drafting channel.",
    }
  }
  if (hasVerifiedPhone) {
    return {
      hasVerifiedEmail,
      hasVerifiedPhone,
      hasProfileUrl,
      usableChannel: "phone",
      unblocksEmailDrafting: false,
      unblocksCallPackage: true,
      reason: "Phone only — call-oriented package may proceed; email drafting remains blocked.",
    }
  }
  if (hasProfileUrl) {
    return {
      hasVerifiedEmail,
      hasVerifiedPhone,
      hasProfileUrl,
      usableChannel: "profile",
      unblocksEmailDrafting: false,
      unblocksCallPackage: false,
      reason: "Profile URL only — insufficient for email drafting.",
    }
  }
  return {
    hasVerifiedEmail: false,
    hasVerifiedPhone: false,
    hasProfileUrl: false,
    usableChannel: "none",
    unblocksEmailDrafting: false,
    unblocksCallPackage: false,
    reason: "No verified usable channel.",
  }
}

export function isExistingDecisionMakerSufficient(dm: ExistingDecisionMakerSnapshot): boolean {
  if (dm.status === "rejected") return false
  const readiness = evaluateDecisionMakerContactReadiness(dm)
  const titleScore = scoreDecisionMakerTitle({ title: dm.title }).decision_maker_score
  const confirmed =
    dm.status === "confirmed" || dm.isPrimary === true || (dm.confidence ?? 0) >= 0.7
  return readiness.unblocksEmailDrafting && titleScore >= 70 && confirmed
}

export function isExistingDecisionMakerIncompleteWorthEnriching(dm: ExistingDecisionMakerSnapshot): boolean {
  if (dm.status === "rejected") return false
  const readiness = evaluateDecisionMakerContactReadiness(dm)
  const titleScore = scoreDecisionMakerTitle({ title: dm.title }).decision_maker_score
  if (titleScore >= 70 && !readiness.unblocksEmailDrafting) return true
  if (dm.fullName.trim() && !dm.email && !dm.phone) return true
  return false
}

export function projectDecisionMakerRequirement(
  input: DatamoonDmRequirementInput,
): AiOsDatamoonDmRequirement {
  const titleFamilies = [...(input.titleFamilies ?? AI_OS_DATAMOON_DM_DEFAULT_TITLE_FAMILIES)]
  const existing = input.existingDecisionMakers ?? []
  const sufficient = existing.some(isExistingDecisionMakerSufficient)
  const incompleteWorth = existing.some(isExistingDecisionMakerIncompleteWorthEnriching)
  const searchAlreadyAttempted = (input.searchAttemptCount ?? 0) > 0
  const attempts = input.searchAttemptCount ?? 0
  const retryJustified =
    attempts > 0 &&
    attempts < AI_OS_DATAMOON_DM_RETRY.maxAttemptsPerLead &&
    !sufficient

  const disqualified =
    input.leadStatus === "disqualified" ||
    input.leadStatus === "archived" ||
    input.admissionState === "rejected" ||
    input.admissionState === "invalid"

  const personRequired =
    !disqualified &&
    !sufficient &&
    (input.researchComplete !== false) &&
    input.companyIdentityConfident !== false

  const anotherPersonNeeded = personRequired && !sufficient
  const earned =
    input.earnedEnrichmentSpend === true ||
    input.investmentState === "increase_investment"

  let reason = "Decision maker required before drafting."
  if (disqualified) reason = "Lead disqualified — person enrichment not required."
  else if (sufficient) reason = "Existing verified decision maker is sufficient — skip DataMoon."
  else if (incompleteWorth) reason = "Existing person incomplete — enrichment may fill contact gaps."
  else if (!personRequired) reason = "Person not required under current admission/research posture."

  return {
    personRequired,
    titleFamilies,
    existingPersonSufficient: sufficient,
    existingPersonIncompleteWorthEnriching: incompleteWorth && !sufficient,
    anotherPersonNeeded,
    searchAlreadyAttempted,
    retryJustified,
    earnedEnrichmentSpend: earned,
    reason,
  }
}

export function authorizeDatamoonPersonEnrichment(input: {
  requirement: AiOsDatamoonDmRequirement
  investmentState?: AiOsInvestmentState | null
  resourceAllocationSpendAuthorized?: boolean | null
  portfolioSelected: boolean
  providerEnabled: boolean
  providerConfigured: boolean
  budgetAvailable: boolean
  killSwitchActive?: boolean
  leadStatus?: string | null
  researchComplete?: boolean
  companyIdentityConfident?: boolean
  recentEquivalentNoResult?: boolean
  searchAttemptCount?: number
}): AiOsDatamoonDmAuthorization {
  const investmentState = input.investmentState ?? "unknown"
  const base = {
    investmentState: investmentState as AiOsInvestmentState | "unknown",
    portfolioSelected: input.portfolioSelected,
    providerEnabled: input.providerEnabled,
    providerConfigured: input.providerConfigured,
    budgetAvailable: input.budgetAvailable,
    resourceAllocationSpendAuthorized: input.resourceAllocationSpendAuthorized ?? null,
    estimatedResourceClass: "datamoon_person_enrichment" as const,
  }

  const deny = (denyReason: AiOsDatamoonDmDenyReason, reason: string): AiOsDatamoonDmAuthorization => ({
    authorized: false,
    denyReason,
    reason,
    ...base,
  })

  if (input.killSwitchActive) {
    return deny("kill_switch", "Kill switch active — DataMoon person enrichment denied.")
  }
  if (input.leadStatus === "disqualified" || input.leadStatus === "archived") {
    return deny("disqualified_lead", "Lead disqualified — no DataMoon spend.")
  }
  if (investmentState === "stop_investment") {
    return deny("stop_investment", "Stop Investment — DataMoon person enrichment blocked.")
  }
  if (investmentState === "reduce_investment") {
    return deny("reduce_investment", "Reduce Investment — DataMoon person enrichment blocked.")
  }
  if (!input.requirement.personRequired || input.requirement.existingPersonSufficient) {
    return deny(
      input.requirement.existingPersonSufficient ? "sufficient_dm_exists" : "person_not_required",
      input.requirement.reason,
    )
  }
  if (!input.portfolioSelected) {
    return deny("not_portfolio_selected", "Lead not portfolio-selected for person enrichment capacity.")
  }
  if (!input.providerEnabled) {
    return deny("provider_disabled", "DataMoon provider disabled — fail closed.")
  }
  if (!input.providerConfigured) {
    return deny("provider_not_configured", "DataMoon provider not configured — fail closed.")
  }
  if (!input.budgetAvailable) {
    return deny("budget_exhausted", "Provider/runtime budget exhausted — fail closed.")
  }
  if (input.researchComplete === false) {
    return deny("research_incomplete", "Company research incomplete — do not enrich persons yet.")
  }
  if (input.companyIdentityConfident === false) {
    return deny("company_identity_uncertain", "Company identity too uncertain for person spend.")
  }
  if (input.recentEquivalentNoResult) {
    return deny(
      "recent_equivalent_no_result",
      "Recent equivalent search returned no suitable candidate — credit-safe stop.",
    )
  }
  if ((input.searchAttemptCount ?? 0) >= AI_OS_DATAMOON_DM_RETRY.maxAttemptsPerLead) {
    return deny("retry_limit_reached", "Maximum DataMoon person attempts reached for this lead.")
  }
  if (!input.requirement.earnedEnrichmentSpend && investmentState !== "increase_investment") {
    return deny("stop_investment", "Account has not earned additional enrichment spend.")
  }

  return {
    authorized: true,
    denyReason: null,
    reason: "Authorized: investment + portfolio + provider + budget + DM requirement all pass.",
    ...base,
  }
}

export function rankDatamoonDecisionMakerCandidates(
  candidates: Array<{
    fullName: string
    title?: string | null
    email?: string | null
    phone?: string | null
    linkedinUrl?: string | null
    companyName?: string | null
    companyDomain?: string | null
    providerRecordId?: string | null
    companyMatchConfidence?: number
  }>,
  input?: { expectedCompanyDomain?: string | null; expectedCompanyName?: string | null },
): AiOsDatamoonDmCandidate[] {
  const expectedDomain = input?.expectedCompanyDomain?.trim().toLowerCase() ?? null
  const expectedName = input?.expectedCompanyName?.trim().toLowerCase() ?? null

  const ranked = candidates
    .filter((c) => c.fullName?.trim())
    .map((c) => {
      const titleScore = scoreDecisionMakerTitle({ title: c.title }).decision_maker_score
      const readiness = evaluateDecisionMakerContactReadiness(c)
      let companyMatch = typeof c.companyMatchConfidence === "number" ? c.companyMatchConfidence : 0.5
      const domain = c.companyDomain?.trim().toLowerCase() ?? null
      const companyName = c.companyName?.trim().toLowerCase() ?? null
      if (expectedDomain && domain && domain === expectedDomain) companyMatch = Math.max(companyMatch, 0.95)
      if (expectedName && companyName && companyName === expectedName) companyMatch = Math.max(companyMatch, 0.85)
      if (expectedDomain && domain && domain !== expectedDomain) companyMatch = Math.min(companyMatch, 0.35)

      const seniorityBoost = titleScore >= 90 ? 15 : titleScore >= 75 ? 10 : 0
      const contactBoost = readiness.unblocksEmailDrafting ? 20 : readiness.unblocksCallPackage ? 8 : 0
      const compositeScore = Math.max(
        0,
        Math.min(100, titleScore * 0.55 + companyMatch * 100 * 0.25 + contactBoost + seniorityBoost * 0.2),
      )

      let outcomeClass: AiOsDatamoonDmOutcome = "no_suitable_person"
      if (companyMatch < 0.45) outcomeClass = "company_match_uncertain"
      else if (titleScore >= 75 && readiness.unblocksEmailDrafting) outcomeClass = "verified_decision_maker"
      else if (titleScore >= 70) outcomeClass = "probable_decision_maker"
      else if (titleScore >= 40) outcomeClass = "supporting_stakeholder"
      else if (!readiness.unblocksEmailDrafting && !readiness.unblocksCallPackage) {
        outcomeClass = "insufficient_contact_data"
      }

      return {
        fullName: c.fullName.trim(),
        title: c.title?.trim() || null,
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        linkedinUrl: c.linkedinUrl?.trim() || null,
        companyName: c.companyName?.trim() || null,
        companyDomain: domain,
        providerRecordId: c.providerRecordId ?? null,
        titleScore,
        seniorityBoost,
        hasVerifiedEmail: readiness.hasVerifiedEmail,
        hasCallablePhone: readiness.hasVerifiedPhone,
        companyMatchConfidence: companyMatch,
        compositeScore,
        outcomeClass,
        evidence: [
          `Title score ${titleScore}`,
          `Company match ${companyMatch.toFixed(2)}`,
          readiness.reason,
        ],
      } satisfies AiOsDatamoonDmCandidate
    })
    .sort((a, b) => {
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore
      return a.fullName.localeCompare(b.fullName)
    })

  return ranked
}

export function selectBestDatamoonDecisionMaker(
  ranked: AiOsDatamoonDmCandidate[],
): AiOsDatamoonDmCandidate | null {
  const best = ranked[0]
  if (!best) return null
  if (best.outcomeClass === "company_match_uncertain") return null
  if (best.outcomeClass === "no_suitable_person") return null
  if (best.compositeScore < 45) return null
  return best
}

export function buildDatamoonPersonSearchIdempotencyKey(input: {
  organizationId: string
  leadId: string
  companyDomain?: string | null
  companyName?: string | null
  titleFamilies: string[]
}): string {
  const titles = [...input.titleFamilies].map((t) => t.toLowerCase()).sort().join("|")
  const company = (input.companyDomain || input.companyName || "unknown").toLowerCase().trim()
  return `dm-datamoon:${input.organizationId}:${input.leadId}:${company}:${titles}`
}

export function buildDatamoonAudienceFiltersForDecisionMaker(input: {
  companyName?: string | null
  titleFamilies: string[]
}): Array<{ field: string; operator: string; value: string | string[] }> {
  const filters: Array<{ field: string; operator: string; value: string | string[] }> = []
  if (input.companyName?.trim()) {
    filters.push({ field: "company_name", operator: "=", value: input.companyName.trim() })
  }
  if (input.titleFamilies.length > 0) {
    filters.push({
      field: "job_title",
      operator: "in",
      value: input.titleFamilies.slice(0, 8),
    })
  }
  return filters
}

export function mergeContactPreferringVerified(input: {
  existing: { email?: string | null; phone?: string | null; title?: string | null; linkedinUrl?: string | null }
  incoming: { email?: string | null; phone?: string | null; title?: string | null; linkedinUrl?: string | null }
}): { email: string | null; phone: string | null; title: string | null; linkedinUrl: string | null; overwritten: string[] } {
  const overwritten: string[] = []
  const email =
    emailLooksUsable(input.existing.email) && !emailLooksUsable(input.incoming.email)
      ? input.existing.email!.trim()
      : emailLooksUsable(input.existing.email)
        ? input.existing.email!.trim()
        : input.incoming.email?.trim() || null
  if (emailLooksUsable(input.existing.email) && emailLooksUsable(input.incoming.email) && input.existing.email !== input.incoming.email) {
    // keep existing verified — do not overwrite
  } else if (!emailLooksUsable(input.existing.email) && emailLooksUsable(input.incoming.email)) {
    overwritten.push("email_filled_from_provider")
  }

  const phone = phoneLooksUsable(input.existing.phone)
    ? input.existing.phone!.trim()
    : input.incoming.phone?.trim() || null
  if (!phoneLooksUsable(input.existing.phone) && phoneLooksUsable(input.incoming.phone)) {
    overwritten.push("phone_filled_from_provider")
  }

  const title = input.existing.title?.trim() || input.incoming.title?.trim() || null
  const linkedinUrl = input.existing.linkedinUrl?.trim() || input.incoming.linkedinUrl?.trim() || null

  return { email, phone, title, linkedinUrl, overwritten }
}

export function decideDatamoonDecisionMakerEnrichment(input: {
  organizationId: string
  leadId: string
  requirement: AiOsDatamoonDmRequirement
  authorization: AiOsDatamoonDmAuthorization
  rankedCandidates?: AiOsDatamoonDmCandidate[]
  providerCalled?: boolean
  duplicateRequestPrevented?: boolean
  idempotencyKey?: string | null
  now: string
}): AiOsDatamoonDmDecision {
  const ranked = input.rankedCandidates ?? []
  const selected = input.authorization.authorized ? selectBestDatamoonDecisionMaker(ranked) : null
  const contactReadiness = selected
    ? evaluateDecisionMakerContactReadiness(selected)
    : null

  let outcome: AiOsDatamoonDmOutcome = "denied_authorization"
  let resume: AiOsDatamoonDmDecision["resumeDraftFactoryTo"] = "waiting_for_dm"

  if (input.authorization.denyReason === "sufficient_dm_exists") {
    outcome = "skipped_existing_sufficient"
    resume = "personalization"
  } else if (!input.authorization.authorized) {
    outcome =
      input.authorization.denyReason === "budget_exhausted" ||
      input.authorization.denyReason === "provider_disabled"
        ? "provider_exhausted"
        : input.authorization.denyReason === "recent_equivalent_no_result" ||
            input.authorization.denyReason === "retry_limit_reached"
          ? "retry_later"
          : "denied_authorization"
    resume =
      input.authorization.denyReason === "stop_investment" ||
      input.authorization.denyReason === "disqualified_lead"
        ? "paused"
        : "waiting_for_dm"
  } else if (selected && contactReadiness?.unblocksEmailDrafting) {
    outcome = selected.outcomeClass === "verified_decision_maker" ? "verified_decision_maker" : "probable_decision_maker"
    resume = "personalization"
  } else if (selected && contactReadiness?.unblocksCallPackage) {
    outcome = "probable_decision_maker"
    resume = "personalization"
  } else if (selected) {
    outcome = "insufficient_contact_data"
    resume = "waiting_for_dm"
  } else if (input.providerCalled && ranked.length === 0) {
    outcome = "no_suitable_person"
    resume = "waiting_for_dm"
  } else if (input.providerCalled) {
    outcome = ranked[0]?.outcomeClass ?? "no_suitable_person"
    resume = "waiting_for_dm"
  } else {
    outcome = "retry_later"
    resume = "waiting_for_dm"
  }

  const whySelected =
    selected && ranked[1]
      ? `${selected.fullName} scored ${selected.compositeScore.toFixed(1)} vs ${ranked[1].fullName} at ${ranked[1].compositeScore.toFixed(1)} (${selected.evidence.join("; ")}).`
      : selected
        ? `${selected.fullName} was the only qualifying candidate (score ${selected.compositeScore.toFixed(1)}).`
        : null

  const explainability: AiOsDatamoonDmExplainability = {
    whyDecisionMakerNeeded: input.requirement.reason,
    whyDatamoonSelected: "DataMoon is the active enrichment provider — no Apollo path.",
    whyAccountEarnedSpend: input.authorization.reason,
    searchCriteria: input.requirement.titleFamilies.map((t) => `title:${t}`),
    candidateCount: ranked.length,
    whySelectedOutranked: whySelected,
    contactVerificationStatus: contactReadiness?.reason ?? "n/a",
    estimatedCostClass: "datamoon_person_enrichment",
    pipelineDisposition: `Resume Draft Factory → ${resume}`,
    providerProvenance: selected?.providerRecordId
      ? [`datamoon:record:${selected.providerRecordId}`]
      : input.providerCalled
        ? ["datamoon:audience_search"]
        : ["datamoon:not_called"],
  }

  return {
    qaMarker: AI_OS_DATAMOON_DM_QA_MARKER,
    leadId: input.leadId,
    organizationId: input.organizationId,
    outcome,
    authorized: input.authorization.authorized,
    denyReason: input.authorization.denyReason,
    requirement: input.requirement,
    authorization: input.authorization,
    selectedCandidate: selected,
    rankedCandidates: ranked.slice(0, 10),
    contactReadiness,
    providerCalled: Boolean(input.providerCalled),
    duplicateRequestPrevented: Boolean(input.duplicateRequestPrevented),
    idempotencyKey: input.idempotencyKey ?? null,
    resumeDraftFactoryTo: resume,
    explainability,
    decidedAt: input.now,
  }
}
