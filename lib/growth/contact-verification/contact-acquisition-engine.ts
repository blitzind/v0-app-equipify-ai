/**
 * GE-IRE-7A — Native Contact Acquisition Engine.
 * Orchestrates IRE → Native Verification → CRE → BCI → Account Outreach Strategy.
 * Deterministic, read-only. No AI, LLM, randomness, or provider-specific logic.
 */

import {
  recommendAccountOutreach,
  type AccountOutreachPreferences,
  type AccountOutreachRecommendationDependencies,
  type AccountOutreachRecommendationInput,
  type AccountOutreachRecommendationResult,
  type OutreachChannel,
} from "@/lib/growth/contact-verification/account-outreach-recommendation"
import {
  analyzeBuyingCommittee,
  type BuyingCommitteeIntelligenceDependencies,
  type BuyingCommitteeIntelligenceResult,
  type BuyingCommitteeRole,
  type BuyingCommitteeTargetUseCase,
} from "@/lib/growth/contact-verification/buying-committee-intelligence"
import {
  recommendContacts,
  resolveCompanyPatternEvidence,
  buildContactRecommendationHistoricalLearning,
  type ContactRecommendationCandidateInput,
  type ContactRecommendationDependencies,
  type ContactRecommendationResult,
} from "@/lib/growth/contact-verification/contact-recommendation-engine"
import type {
  AcquisitionBackupContact,
  AcquisitionCandidate,
  AcquisitionCommitteeRole,
  AcquisitionDeliverability,
  AcquisitionOutreachReadiness,
  AcquisitionPreferredChannel,
} from "@/lib/growth/contact-verification/contact-acquisition-types"
import {
  CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING,
  GROWTH_CONTACT_ACQUISITION_QA_MARKER,
} from "@/lib/growth/contact-verification/contact-acquisition-types"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import {
  resolveEmailIdentity,
  type IdentityCompanyPatternEvidence,
  type IdentityResolutionDependencies,
  type IdentityResolutionResult,
} from "@/lib/growth/contact-verification/identity-resolution-engine"
import {
  verifyEmailNatively,
  type NativeEmailVerificationDependencies,
  type NativeEmailVerificationResult,
} from "@/lib/growth/contact-verification/native-email-verification"
import { resolveNativeVerificationSkipDns } from "@/lib/growth/contact-verification/native-verification-feature"
import { normalizeEmail, parseEmailDomain } from "@/lib/growth/import/normalize"

export { GROWTH_CONTACT_ACQUISITION_QA_MARKER, CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING }

export type ContactAcquisitionCandidateInput = ContactRecommendationCandidateInput & {
  personId?: string
}

export type ContactAcquisitionEngineInput = {
  companyId: string
  companyName?: string
  domain?: string
  industry?: string
  targetUseCase?: BuyingCommitteeTargetUseCase
  contacts: ContactAcquisitionCandidateInput[]
  historicalLearning?: EmailLearningObservation[]
  companyPatternEvidence?: IdentityCompanyPatternEvidence | null
  relationshipSignals?: unknown
  preferences?: AccountOutreachPreferences
  /** Optional fixed timestamp for deterministic certification output. */
  generatedAt?: string
}

export type ContactAcquisitionEngineDependencies = ContactRecommendationDependencies &
  BuyingCommitteeIntelligenceDependencies &
  AccountOutreachRecommendationDependencies &
  IdentityResolutionDependencies & {
    nativeVerificationDependencies?: NativeEmailVerificationDependencies
  }

const BLOCKER_LABELS: Record<string, string> = {
  no_primary_contact: "No decision maker identified",
  no_outreach_channel: "No outreach channel available",
  deliverable_email_required: "Missing verified email",
  primary_score_below_threshold: "Primary contact confidence below threshold",
  committee_coverage_insufficient: "Buying committee coverage insufficient",
  committee_coverage_below_use_case_minimum: "Committee coverage below use case minimum",
  no_contacts_pass_preferences: "No contacts meet outreach preferences",
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value)))
}

function normalizeDomain(domain: string | null | undefined): string | null {
  const trimmed = domain?.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase().replace(/^www\./, "")
}

function splitDisplayName(name: string | null | undefined): {
  firstName?: string
  lastName?: string
  fullName?: string
} {
  const trimmed = name?.trim()
  if (!trimmed) return {}
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return { fullName: trimmed }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    fullName: trimmed,
  }
}

function parseContactName(candidate: ContactAcquisitionCandidateInput): {
  firstName: string
  lastName: string
  displayName: string
} {
  let firstName = candidate.firstName?.trim() ?? ""
  let lastName = candidate.lastName?.trim() ?? ""

  if ((!firstName || !lastName) && candidate.fullName?.trim()) {
    const parts = splitDisplayName(candidate.fullName)
    firstName = firstName || parts.firstName || ""
    lastName = lastName || parts.lastName || ""
  }

  const displayName =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    candidate.fullName?.trim() ||
    candidate.email?.trim() ||
    "Unknown contact"

  return { firstName, lastName, displayName }
}

export function mapBuyingCommitteeRoleToAcquisitionRole(
  role?: BuyingCommitteeRole,
): AcquisitionCommitteeRole {
  switch (role) {
    case "economic_buyer":
    case "executive_sponsor":
    case "operational_buyer":
    case "finance_procurement":
      return "economic_buyer"
    case "champion":
    case "influencer":
      return "champion"
    case "technical_evaluator":
      return "technical"
    case "end_user":
      return "user"
    default:
      return "unknown"
  }
}

export function mapNativeVerificationToDeliverability(
  result: NativeEmailVerificationResult | null | undefined,
): AcquisitionDeliverability {
  if (!result) return "unknown"
  if (result.status === "valid") return "verified"
  if (result.status === "risky") return "risky"
  if (result.status === "invalid") return "risky"
  return "unknown"
}

export function mapOutreachReadinessTier(
  tier: AccountOutreachRecommendationResult["readiness"]["tier"],
): AcquisitionOutreachReadiness {
  if (tier === "ready") return "ready"
  if (tier === "needs_review") return "research"
  return "blocked"
}

export function mapOutreachChannelToPreferredChannel(input: {
  primaryChannel: OutreachChannel
  contacts: ContactAcquisitionCandidateInput[]
  primaryEmail?: string | null
}): AcquisitionPreferredChannel {
  const channels = new Set<OutreachChannel>()
  if (input.primaryChannel !== "unknown") channels.add(input.primaryChannel)

  for (const contact of input.contacts) {
    if (contact.email?.trim()) channels.add("email")
    if (contact.phone?.trim()) channels.add("phone")
    if (contact.linkedinUrl?.trim()) channels.add("linkedin")
  }

  const viable = [...channels].filter((channel) => channel !== "unknown")
  if (viable.length >= 2) return "mixed"
  if (input.primaryChannel === "linkedin") return "linkedin"
  if (input.primaryChannel === "phone") return "phone"
  if (input.primaryChannel === "email" || input.primaryEmail) return "email"
  if (viable[0] === "linkedin") return "linkedin"
  if (viable[0] === "phone") return "phone"
  return "email"
}

export function buildRecommendedSequenceLabel(
  outreach: AccountOutreachRecommendationResult,
): string | undefined {
  if (outreach.staged_plan.length === 0) return undefined

  const labels = outreach.staged_plan.map((step) => {
    const action = step.action.replace(/_/g, " ")
    const role = step.committee_role?.replace(/_/g, " ")
    const channel = step.channel !== "unknown" ? ` via ${step.channel}` : ""
    if (step.contact_name) {
      return `${action}: ${step.contact_name}${role ? ` (${role})` : ""}${channel}`
    }
    if (role) return `${action}: ${role}${channel}`
    return `${action}${channel}`
  })

  return labels.join(" → ")
}

export function humanizeAcquisitionBlockers(blockers: string[]): string[] {
  const labels: string[] = []
  for (const blocker of blockers) {
    labels.push(BLOCKER_LABELS[blocker] ?? blocker.replace(/_/g, " "))
  }
  return [...new Set(labels)]
}

export function buildAcquisitionBlockers(input: {
  outreach: AccountOutreachRecommendationResult
  verification: NativeEmailVerificationResult | null
  primaryEmail?: string | null
  hasContacts: boolean
  companyKnown: boolean
}): string[] {
  const blockers = humanizeAcquisitionBlockers(input.outreach.readiness.blockers)

  if (!input.hasContacts) {
    blockers.push("No decision maker identified")
  }

  if (!input.companyKnown) {
    blockers.push("Unknown company")
  }

  const email = input.primaryEmail?.trim()
  if (!email) {
    blockers.push("Missing verified email")
  } else if (input.verification?.status === "invalid") {
    blockers.push("Missing verified email")
  } else if (input.verification?.status === "unknown") {
    blockers.push("Verification pending")
  }

  if (input.outreach.primary_recommendation?.recommended_channel === "unknown") {
    if (!blockers.includes("No outreach channel available")) {
      blockers.push("No outreach channel available")
    }
  }

  if (input.outreach.readiness.tier === "needs_review" && blockers.length === 0) {
    blockers.push("Research incomplete")
  }

  return [...new Set(blockers)]
}

export function buildAcquisitionReasons(input: {
  outreach: AccountOutreachRecommendationResult
  verification: NativeEmailVerificationResult | null
  identityResult: IdentityResolutionResult | null
}): string[] {
  const reasons: string[] = []
  const primary = input.outreach.primary_recommendation

  if (primary) {
    for (const reason of primary.reasons) {
      if (isDeterministicReason(reason)) reasons.push(reason)
    }
    for (const evidence of primary.evidence) {
      if (isDeterministicReason(evidence)) reasons.push(evidence)
    }
  }

  for (const reason of input.outreach.committee.recommendation.reasons) {
    if (isDeterministicReason(reason)) reasons.push(reason)
  }

  if (input.verification?.status === "valid") {
    reasons.push("Highest verification confidence")
  }

  if (input.identityResult?.recommended) {
    reasons.push(
      `${input.identityResult.recommended.pattern.display_name} identity pattern matches company evidence`,
    )
  }

  const role = primary?.committee_role
  if (role === "economic_buyer" || role === "executive_sponsor" || role === "operational_buyer") {
    reasons.push("Economic buyer")
  } else if (role === "champion") {
    reasons.push("Champion identified for outreach")
  }

  if (primary && primary.score >= 0.75) {
    reasons.push("Highest committee score")
  }

  return [...new Set(reasons)].slice(0, 12)
}

function isDeterministicReason(value: string): boolean {
  const lower = value.toLowerCase()
  if (lower.includes("placeholder")) return false
  if (lower.includes("provider")) return false
  if (lower.includes("llm")) return false
  if (lower.includes("random")) return false
  return value.trim().length > 0
}

export function computeAcquisitionOverallConfidence(input: {
  identityScore: number
  verificationScore: number
  committeeScore: number
  recommendationScore: number
  outreachReadinessScore: number
}): number {
  const weights = CONTACT_ACQUISITION_CONFIDENCE_WEIGHTING.components
  const weighted =
    clampPercent(input.identityScore) * weights.identity +
    clampPercent(input.verificationScore) * weights.verification +
    clampPercent(input.committeeScore) * weights.committee +
    clampPercent(input.recommendationScore) * weights.recommendation +
    clampPercent(input.outreachReadinessScore) * weights.outreach_readiness

  return clampPercent(weighted)
}

function resolvePrimaryPersonId(
  outreach: AccountOutreachRecommendationResult,
  contacts: ContactAcquisitionCandidateInput[],
): string | undefined {
  const primaryName = outreach.primary_recommendation?.contact.contact.display_name?.trim().toLowerCase()
  const primaryEmail = (
    outreach.primary_recommendation?.recommended_email ??
    outreach.primary_recommendation?.contact.contact.email
  )
    ?.trim()
    .toLowerCase()

  for (const contact of contacts) {
    const parsed = parseContactName(contact)
    const email = contact.email?.trim().toLowerCase()
    if (primaryEmail && email === primaryEmail && contact.personId) return contact.personId
    if (primaryName && parsed.displayName.toLowerCase() === primaryName && contact.personId) {
      return contact.personId
    }
  }

  return undefined
}

function collectUniqueEmails(contacts: ContactAcquisitionCandidateInput[]): string[] {
  const emails = new Set<string>()
  for (const contact of contacts) {
    const normalized = normalizeEmail(contact.email)
    if (normalized) emails.add(normalized)
  }
  return [...emails]
}

function resolvePrimaryEmail(
  outreach: AccountOutreachRecommendationResult,
): string | undefined {
  return (
    outreach.primary_recommendation?.recommended_email ??
    outreach.primary_recommendation?.contact.contact.email ??
    undefined
  )
}

export function rankAcquisitionBackupContacts(input: {
  outreach: AccountOutreachRecommendationResult
  contacts: ContactAcquisitionCandidateInput[]
}): AcquisitionBackupContact[] {
  const ranked = [...input.outreach.backup_recommendations].sort(
    (left, right) => right.score - left.score,
  )

  return ranked.map((backup) => {
    const email =
      backup.contact.recommended_email ?? backup.contact.contact.email ?? undefined
    const deterministicReason =
      backup.reasons.find(isDeterministicReason) ??
      backup.reasons[0] ??
      "Ranked backup outreach target"

    return {
      name: backup.contact.contact.display_name,
      title: backup.contact.contact.job_title,
      role: mapBuyingCommitteeRoleToAcquisitionRole(backup.committee_role),
      email,
      confidence: backup.contact.confidence,
      reasonSelected: deterministicReason,
    }
  })
}

async function runIdentityResolutionPass(input: {
  engineInput: ContactAcquisitionEngineInput
  domain: string | null
  companyPatternEvidence: IdentityCompanyPatternEvidence | null
  dependencies: ContactAcquisitionEngineDependencies
}): Promise<Map<string, IdentityResolutionResult>> {
  const resolveIdentity = input.dependencies.resolveEmailIdentity ?? resolveEmailIdentity
  const results = new Map<string, IdentityResolutionResult>()

  const ireHistoricalLearning =
    input.domain && input.engineInput.historicalLearning?.length
      ? buildContactRecommendationHistoricalLearning({
          domain: input.domain,
          observations: input.engineInput.historicalLearning,
        })
      : null

  for (const candidate of input.engineInput.contacts) {
    const parsed = parseContactName(candidate)
    if (!input.domain || !parsed.firstName || !parsed.lastName) continue

    const key = `${parsed.firstName.toLowerCase()}|${parsed.lastName.toLowerCase()}`
    if (results.has(key)) continue

    const result = await resolveIdentity(
      {
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        domain: input.domain,
        companyName: input.engineInput.companyName,
        industry: input.engineInput.industry,
        jobTitle: candidate.jobTitle,
        department: candidate.department,
        knownEmails: candidate.email ? [candidate.email] : [],
        historicalPatterns: input.companyPatternEvidence,
        historicalLearning: ireHistoricalLearning,
      },
      input.dependencies,
    )
    results.set(key, result)
  }

  return results
}

async function runNativeVerificationPass(input: {
  emails: string[]
  dependencies: ContactAcquisitionEngineDependencies
}): Promise<Map<string, NativeEmailVerificationResult>> {
  const verify = input.dependencies.verifyEmailNatively ?? verifyEmailNatively
  const results = new Map<string, NativeEmailVerificationResult>()

  for (const email of input.emails) {
    const normalized = normalizeEmail(email)
    if (!normalized || results.has(normalized)) continue

    const result = await verify(
      {
        email: normalized,
        skipDns: resolveNativeVerificationSkipDns({ skipDns: input.dependencies.skipDns }),
      },
      input.dependencies.nativeVerificationDependencies,
    )
    results.set(normalized, result)
  }

  return results
}

function identityResultForPrimary(
  outreach: AccountOutreachRecommendationResult,
  contacts: ContactAcquisitionCandidateInput[],
  identityByContactKey: Map<string, IdentityResolutionResult>,
): IdentityResolutionResult | null {
  const primary = outreach.primary_recommendation
  if (!primary) return null

  const matched = contacts.find((contact) => {
    const parsed = parseContactName(contact)
    return parsed.displayName === primary.contact.contact.display_name
  })
  if (!matched) return null

  const parsed = parseContactName(matched)
  const key = `${parsed.firstName.toLowerCase()}|${parsed.lastName.toLowerCase()}`
  return identityByContactKey.get(key) ?? null
}

export async function buildAcquisitionCandidate(
  input: ContactAcquisitionEngineInput,
  dependencies: ContactAcquisitionEngineDependencies = {},
): Promise<AcquisitionCandidate> {
  const domain =
    normalizeDomain(input.domain) ??
    normalizeDomain(parseEmailDomain(input.contacts.find((row) => row.email)?.email ?? ""))

  const companyPatternEvidence = resolveCompanyPatternEvidence({
    domain,
    explicit: input.companyPatternEvidence ?? null,
    observations: input.historicalLearning,
  })

  const recommendationBase: AccountOutreachRecommendationInput = {
    companyName: input.companyName,
    domain: domain ?? undefined,
    industry: input.industry,
    targetUseCase: input.targetUseCase,
    contacts: input.contacts,
    historicalLearning: input.historicalLearning,
    companyPatternEvidence,
    relationshipSignals: input.relationshipSignals,
    preferences: input.preferences,
  }

  const identityByContactKey = await runIdentityResolutionPass({
    engineInput: input,
    domain,
    companyPatternEvidence,
    dependencies,
  })

  const verificationByEmail = await runNativeVerificationPass({
    emails: collectUniqueEmails(input.contacts),
    dependencies,
  })

  const cachedResolveIdentity: ContactAcquisitionEngineDependencies["resolveEmailIdentity"] = async (
    ireInput,
    ireDeps,
  ) => {
    const key = `${ireInput.firstName.toLowerCase()}|${ireInput.lastName.toLowerCase()}`
    const cached = identityByContactKey.get(key)
    if (cached) return cached
    const resolveIdentity = dependencies.resolveEmailIdentity ?? resolveEmailIdentity
    return resolveIdentity(ireInput, ireDeps)
  }

  const cachedVerifyEmail: ContactAcquisitionEngineDependencies["verifyEmailNatively"] = async (
    verifyInput,
    verifyDeps,
  ) => {
    const normalized = normalizeEmail(verifyInput.email)
    if (normalized) {
      const cached = verificationByEmail.get(normalized)
      if (cached) return cached
    }
    const verify = dependencies.verifyEmailNatively ?? verifyEmailNatively
    return verify(verifyInput, verifyDeps)
  }

  const recommend = dependencies.recommendContacts ?? recommendContacts
  const contactRecommendations: ContactRecommendationResult = await recommend(
    recommendationBase,
    {
      ...dependencies,
      resolveEmailIdentity: cachedResolveIdentity,
      verifyEmailNatively: cachedVerifyEmail,
    },
  )

  const analyze = dependencies.analyzeBuyingCommittee ?? analyzeBuyingCommittee
  const committee: BuyingCommitteeIntelligenceResult = await analyze(recommendationBase, {
    ...dependencies,
    resolveEmailIdentity: cachedResolveIdentity,
    verifyEmailNatively: cachedVerifyEmail,
    recommendContacts: async () => contactRecommendations,
  })

  const recommendOutreach = dependencies.recommendAccountOutreach ?? recommendAccountOutreach
  const outreach: AccountOutreachRecommendationResult = await recommendOutreach(
    recommendationBase,
    {
      ...dependencies,
      resolveEmailIdentity: cachedResolveIdentity,
      verifyEmailNatively: cachedVerifyEmail,
      recommendContacts: async () => contactRecommendations,
      analyzeBuyingCommittee: async () => committee,
    },
  )

  const primaryEmail = resolvePrimaryEmail(outreach)
  const primaryVerification = primaryEmail
    ? verificationByEmail.get(normalizeEmail(primaryEmail) ?? "") ?? null
    : null

  const identityResult = identityResultForPrimary(outreach, input.contacts, identityByContactKey)

  const primaryContact = outreach.primary_recommendation
  const primaryCandidate = primaryContact
    ? {
        personId: resolvePrimaryPersonId(outreach, input.contacts),
        fullName: primaryContact.contact.contact.display_name,
        title: primaryContact.contact.contact.job_title,
        email: primaryEmail,
        confidence: primaryContact.confidence,
      }
    : {
        fullName: "No primary contact",
        confidence: 0,
      }

  const committeeRole = mapBuyingCommitteeRoleToAcquisitionRole(primaryContact?.committee_role)
  const committeeConfidence = clampPercent(outreach.committee.coverage.coverage_score * 100)

  const verificationConfidence = clampPercent(
    (primaryVerification?.confidence.score ?? primaryContact?.contact.scores.deliverability ?? 0) *
      100,
  )

  const identityScore = clampPercent(
    (identityResult?.recommended?.overall_probability ??
      primaryContact?.contact.scores.identity ??
      0) * 100,
  )

  const recommendationScore = primaryContact?.confidence ?? 0
  const outreachReadinessScore = outreach.readiness.score

  const overallConfidence = computeAcquisitionOverallConfidence({
    identityScore,
    verificationScore: verificationConfidence,
    committeeScore: committeeConfidence,
    recommendationScore,
    outreachReadinessScore,
  })

  const preferredChannel = mapOutreachChannelToPreferredChannel({
    primaryChannel: primaryContact?.recommended_channel ?? "unknown",
    contacts: input.contacts,
    primaryEmail,
  })

  return {
    version: 1,
    companyId: input.companyId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    primaryContact: primaryCandidate,
    verification: {
      emailVerified: primaryVerification?.status === "valid",
      deliverability: mapNativeVerificationToDeliverability(primaryVerification),
      confidence: verificationConfidence,
    },
    committee: {
      role: committeeRole,
      confidence: committeeConfidence,
    },
    outreach: {
      readiness: mapOutreachReadinessTier(outreach.readiness.tier),
      preferredChannel,
      recommendedSequence: buildRecommendedSequenceLabel(outreach),
    },
    backupContacts: rankAcquisitionBackupContacts({
      outreach,
      contacts: input.contacts,
    }),
    blockers: buildAcquisitionBlockers({
      outreach,
      verification: primaryVerification,
      primaryEmail,
      hasContacts: input.contacts.length > 0,
      companyKnown: Boolean(input.companyName?.trim() || domain),
    }),
    reasons: buildAcquisitionReasons({
      outreach,
      verification: primaryVerification,
      identityResult,
    }),
    overallConfidence,
  }
}
