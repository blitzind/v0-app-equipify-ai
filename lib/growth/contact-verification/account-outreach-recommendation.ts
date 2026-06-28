/**
 * GE-IRE-6E — Best Contact Recommendation Engine (account-level outreach orchestrator).
 * Combines IRE + CRE + BCI + engagement prediction. Read-only. No execution.
 */

import { roundScore } from "@/lib/growth/contact-verification/confidence-signals-core"
import {
  analyzeBuyingCommittee,
  classifyBuyingCommitteeRoles,
  type BuyingCommitteeIntelligenceResult,
  type BuyingCommitteeRole,
  type BuyingCommitteeTargetUseCase,
} from "@/lib/growth/contact-verification/buying-committee-intelligence"
import {
  recommendContacts,
  type ContactRecommendation,
  type ContactRecommendationCandidateInput,
  type ContactRecommendationDependencies,
} from "@/lib/growth/contact-verification/contact-recommendation-engine"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"
import type { IdentityCompanyPatternEvidence } from "@/lib/growth/contact-verification/identity-resolution-engine"
import { isRoleEmailLocalPart } from "@/lib/growth/import/email-classifiers"
import { parseEmailLocalPart } from "@/lib/growth/import/normalize"

export const GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER =
  "account-outreach-recommendation-v1" as const

export type OutreachChannel = "email" | "phone" | "linkedin" | "unknown"

export type AccountOutreachPreferences = {
  maxPrimaryContacts?: number
  maxBackupContacts?: number
  preferredChannels?: OutreachChannel[]
  avoidRoleAccounts?: boolean
  requireDeliverableEmail?: boolean
}

export type AccountOutreachRecommendationInput = {
  companyName?: string
  domain?: string
  industry?: string
  targetUseCase?: BuyingCommitteeTargetUseCase
  contacts: ContactRecommendationCandidateInput[]
  historicalLearning?: EmailLearningObservation[]
  relationshipSignals?: unknown
  companyPatternEvidence?: IdentityCompanyPatternEvidence | null
  buyingCommitteeSignals?: unknown
  preferences?: AccountOutreachPreferences
}

export type AccountOutreachPrimaryRecommendation = {
  contact: ContactRecommendation
  committee_role?: BuyingCommitteeRole
  recommended_email?: string
  recommended_channel: OutreachChannel
  score: number
  confidence: number
  reasons: string[]
  evidence: string[]
  warnings: string[]
}

export type AccountOutreachBackupRecommendation = {
  contact: ContactRecommendation
  committee_role?: BuyingCommitteeRole
  recommended_channel: OutreachChannel
  score: number
  reasons: string[]
}

export type AccountOutreachStagedPlanStep = {
  step: number
  action: "contact_primary" | "contact_backup" | "expand_committee" | "research_missing_role" | "hold"
  contact_name?: string
  committee_role?: BuyingCommitteeRole
  channel: OutreachChannel
  rationale: string
}

export type AccountOutreachReadiness = {
  ready: boolean
  score: number
  tier: "ready" | "needs_review" | "insufficient"
  blockers: string[]
}

export type AccountOutreachRecommendationResult = {
  qa_marker: typeof GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER
  companyName?: string
  domain?: string
  primary_recommendation?: AccountOutreachPrimaryRecommendation
  backup_recommendations: AccountOutreachBackupRecommendation[]
  committee: BuyingCommitteeIntelligenceResult
  staged_plan: AccountOutreachStagedPlanStep[]
  readiness: AccountOutreachReadiness
  summary: {
    total_contacts: number
    recommended_contacts: number
    committee_coverage_score: number
    primary_contact?: string
    recommended_strategy: string
  }
  warnings: string[]
}

export type AccountOutreachRecommendationDependencies = ContactRecommendationDependencies & {
  recommendContacts?: typeof recommendContacts
  analyzeBuyingCommittee?: typeof analyzeBuyingCommittee
}

const PRIMARY_SCORE_READY_THRESHOLD = 0.65
const DELIVERABILITY_MIN_THRESHOLD = 0.45

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return roundScore(Math.max(0, Math.min(1, value)))
}

function contactIdentityKey(input: {
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  displayName?: string
}): string {
  const first = (input.firstName ?? "").trim().toLowerCase()
  const last = (input.lastName ?? "").trim().toLowerCase()
  if (first && last) return `${first}|${last}`
  const full = (input.fullName ?? input.displayName ?? "").trim().toLowerCase()
  if (full) return full
  const email = (input.email ?? "").trim().toLowerCase()
  if (email) return email
  return ""
}

function findMatchingCandidate(
  recommendation: ContactRecommendation,
  contacts: ContactRecommendationCandidateInput[],
): ContactRecommendationCandidateInput {
  const key = contactIdentityKey({
    firstName: recommendation.contact.first_name,
    lastName: recommendation.contact.last_name,
    fullName: recommendation.contact.display_name,
    email: recommendation.contact.email,
  })
  const matched = contacts.find((candidate) => contactIdentityKey(candidate) === key)
  if (matched) return matched
  return {
    firstName: recommendation.contact.first_name,
    lastName: recommendation.contact.last_name,
    fullName: recommendation.contact.display_name,
    email: recommendation.contact.email,
    jobTitle: recommendation.contact.job_title,
    department: recommendation.contact.department,
    seniority: recommendation.contact.seniority,
  }
}

function isRoleAccountContact(recommendation: ContactRecommendation): boolean {
  const email = recommendation.recommended_email ?? recommendation.contact.email
  if (!email) return false
  return isRoleEmailLocalPart(parseEmailLocalPart(email))
}

export function selectOutreachChannel(input: {
  candidate: ContactRecommendationCandidateInput
  recommendation: ContactRecommendation
  preferredChannels?: OutreachChannel[]
  requireDeliverableEmail?: boolean
}): { channel: OutreachChannel; reasons: string[] } {
  const reasons: string[] = []
  const hasEmail = Boolean(input.recommendation.recommended_email ?? input.candidate.email)
  const hasPhone = Boolean(input.candidate.phone?.trim())
  const hasLinkedin = Boolean(input.candidate.linkedinUrl?.trim())
  const deliverability = input.recommendation.scores.deliverability

  const available: OutreachChannel[] = []
  if (hasEmail && deliverability >= DELIVERABILITY_MIN_THRESHOLD) available.push("email")
  if (hasPhone) available.push("phone")
  if (hasLinkedin) available.push("linkedin")

  if (input.preferredChannels?.length) {
    for (const preferred of input.preferredChannels) {
      if (preferred === "unknown") continue
      if (available.includes(preferred)) {
        reasons.push(`Preferred channel available: ${preferred}`)
        return { channel: preferred, reasons }
      }
    }
  }

  if (available.includes("email")) {
    reasons.push("Deliverable email available — email preferred")
    return { channel: "email", reasons }
  }

  if (hasPhone && (!hasEmail || deliverability < DELIVERABILITY_MIN_THRESHOLD)) {
    reasons.push("Phone available; email weak or missing")
    return { channel: "phone", reasons }
  }

  if (hasLinkedin && !hasEmail && !hasPhone) {
    reasons.push("LinkedIn available without direct email/phone")
    return { channel: "linkedin", reasons }
  }

  if (input.requireDeliverableEmail) {
    reasons.push("No deliverable email available")
  }

  return { channel: "unknown", reasons: ["No reliable outreach channel identified"] }
}

function resolveCommitteeRole(
  recommendation: ContactRecommendation,
  contacts: ContactRecommendationCandidateInput[],
): BuyingCommitteeRole | undefined {
  const candidate = findMatchingCandidate(recommendation, contacts)
  return classifyBuyingCommitteeRoles({ contact: candidate, recommendation }).primary_role
}

function passesContactPreferences(
  recommendation: ContactRecommendation,
  preferences: AccountOutreachPreferences,
): boolean {
  if (preferences.avoidRoleAccounts && isRoleAccountContact(recommendation)) return false
  if (preferences.requireDeliverableEmail) {
    const email = recommendation.recommended_email ?? recommendation.contact.email
    if (!email || recommendation.scores.deliverability < DELIVERABILITY_MIN_THRESHOLD) return false
  }
  return true
}

export function computeAccountOutreachReadiness(input: {
  primary?: AccountOutreachPrimaryRecommendation
  committee: BuyingCommitteeIntelligenceResult
  useCase: BuyingCommitteeTargetUseCase
  requireDeliverableEmail?: boolean
}): AccountOutreachReadiness {
  const blockers: string[] = []
  let score = 0

  if (!input.primary) {
    blockers.push("no_primary_contact")
    return { ready: false, score: 0, tier: "insufficient", blockers }
  }

  score += input.primary.score * 0.45
  score += input.committee.coverage.coverage_score * 0.35

  if (input.primary.recommended_channel === "unknown") {
    blockers.push("no_outreach_channel")
  } else {
    score += 0.2
  }

  if (input.requireDeliverableEmail && input.primary.recommended_channel !== "email") {
    blockers.push("deliverable_email_required")
  }

  if (input.primary.score < PRIMARY_SCORE_READY_THRESHOLD) {
    blockers.push("primary_score_below_threshold")
  }

  const coverageTier = input.committee.coverage.coverage_tier
  if (coverageTier === "insufficient") {
    blockers.push("committee_coverage_insufficient")
  }

  const minCoverageForReady =
    input.useCase === "growth_engine" ? "moderate" : "weak"
  const coverageRank = { strong: 3, moderate: 2, weak: 1, insufficient: 0 }
  if (coverageRank[coverageTier] < coverageRank[minCoverageForReady]) {
    blockers.push("committee_coverage_below_use_case_minimum")
  }

  const readinessScore = Math.round(Math.max(0, Math.min(100, score * 100)))

  if (
    blockers.length === 0 ||
    (blockers.length === 1 && blockers[0] === "committee_coverage_below_use_case_minimum")
  ) {
    if (blockers.length === 0 && input.primary.score >= PRIMARY_SCORE_READY_THRESHOLD) {
      return { ready: true, score: readinessScore, tier: "ready", blockers: [] }
    }
    return { ready: false, score: readinessScore, tier: "needs_review", blockers }
  }

  if (blockers.includes("no_primary_contact") || blockers.includes("no_outreach_channel")) {
    return { ready: false, score: readinessScore, tier: "insufficient", blockers }
  }

  return { ready: false, score: readinessScore, tier: "needs_review", blockers }
}

export function buildAccountOutreachStagedPlan(input: {
  primary?: AccountOutreachPrimaryRecommendation
  backups: AccountOutreachBackupRecommendation[]
  committee: BuyingCommitteeIntelligenceResult
  readiness: AccountOutreachReadiness
}): AccountOutreachStagedPlanStep[] {
  const steps: AccountOutreachStagedPlanStep[] = []
  let step = 1

  if (input.readiness.tier === "insufficient" && !input.primary) {
    steps.push({
      step: step++,
      action: "hold",
      channel: "unknown",
      rationale: "Account lacks a viable primary contact — enrich committee before outreach",
    })
    return steps
  }

  if (input.primary) {
    steps.push({
      step: step++,
      action: "contact_primary",
      contact_name: input.primary.contact.contact.display_name,
      committee_role: input.primary.committee_role,
      channel: input.primary.recommended_channel,
      rationale: `Contact primary ${input.primary.committee_role?.replace(/_/g, " ") ?? "stakeholder"} via ${input.primary.recommended_channel}`,
    })
  }

  for (const backup of input.backups) {
    steps.push({
      step: step++,
      action: "contact_backup",
      contact_name: backup.contact.contact.display_name,
      committee_role: backup.committee_role,
      channel: backup.recommended_channel,
      rationale: `Backup outreach to ${backup.committee_role?.replace(/_/g, " ") ?? "alternate stakeholder"} if primary does not respond`,
    })
  }

  for (const missingRole of input.committee.coverage.missing_roles) {
    steps.push({
      step: step++,
      action: "research_missing_role",
      committee_role: missingRole,
      channel: "unknown",
      rationale: `Research missing ${missingRole.replace(/_/g, " ")} before expanding sequence enrollment`,
    })
  }

  if (
    input.committee.coverage.coverage_tier === "weak" ||
    input.committee.coverage.coverage_tier === "insufficient"
  ) {
    steps.push({
      step: step++,
      action: "expand_committee",
      channel: "unknown",
      rationale: "Expand buying committee coverage before broad sequence enrollment",
    })
  }

  if (input.readiness.tier === "needs_review") {
    steps.push({
      step: step++,
      action: "hold",
      channel: "unknown",
      rationale: "Review readiness blockers before automated outreach execution",
    })
  }

  return steps
}

export async function recommendAccountOutreach(
  input: AccountOutreachRecommendationInput,
  dependencies: AccountOutreachRecommendationDependencies = {},
): Promise<AccountOutreachRecommendationResult> {
  const preferences: AccountOutreachPreferences = {
    maxPrimaryContacts: 1,
    maxBackupContacts: 3,
    avoidRoleAccounts: false,
    requireDeliverableEmail: false,
    ...input.preferences,
  }

  const committeeInput = {
    companyName: input.companyName,
    domain: input.domain,
    industry: input.industry,
    targetUseCase: input.targetUseCase,
    contacts: input.contacts,
    historicalLearning: input.historicalLearning,
    companyPatternEvidence: input.companyPatternEvidence ?? null,
    relationshipSignals: input.relationshipSignals,
  }

  const analyze = dependencies.analyzeBuyingCommittee ?? analyzeBuyingCommittee
  const recommend = dependencies.recommendContacts ?? recommendContacts

  const [committee, contactRankings] = await Promise.all([
    analyze(committeeInput, dependencies),
    recommend(
      {
        ...committeeInput,
        relationshipSignals: input.relationshipSignals,
      },
      dependencies,
    ),
  ])

  const warnings = [...committee.warnings]
  const ranked = contactRankings.recommended.filter((row) =>
    passesContactPreferences(row, preferences),
  )

  if (ranked.length === 0) {
    warnings.push("no_contacts_pass_preferences")
  }

  let primaryContact =
    committee.recommendation.primary_contact &&
    passesContactPreferences(committee.recommendation.primary_contact, preferences)
      ? committee.recommendation.primary_contact
      : ranked[0]

  const primaryRole = primaryContact
    ? committee.recommendation.primary_contact?.contact.display_name ===
      primaryContact.contact.display_name
      ? committee.recommendation.primary_role
      : resolveCommitteeRole(primaryContact, input.contacts)
    : undefined

  let primaryRecommendation: AccountOutreachPrimaryRecommendation | undefined

  if (primaryContact) {
    const candidate = findMatchingCandidate(primaryContact, input.contacts)
    const channel = selectOutreachChannel({
      candidate,
      recommendation: primaryContact,
      preferredChannels: preferences.preferredChannels,
      requireDeliverableEmail: preferences.requireDeliverableEmail,
    })

    primaryRecommendation = {
      contact: primaryContact,
      committee_role: primaryRole,
      recommended_email: primaryContact.recommended_email ?? primaryContact.contact.email,
      recommended_channel: channel.channel,
      score: clampScore(primaryContact.scores.overall),
      confidence: primaryContact.confidence,
      reasons: [
        ...committee.recommendation.reasons,
        ...channel.reasons,
        "Selected as account primary outreach target",
      ],
      evidence: [...primaryContact.evidence],
      warnings: [...primaryContact.warnings, ...committee.recommendation.warnings],
    }
  }

  const backupLimit = preferences.maxBackupContacts ?? 3
  const backupSource = [
    ...(committee.recommendation.backup_contacts ?? []),
    ...ranked,
  ].filter(
    (row, index, array) =>
      passesContactPreferences(row, preferences) &&
      row.contact.display_name !== primaryContact?.contact.display_name &&
      array.findIndex((other) => other.contact.display_name === row.contact.display_name) === index,
  )

  const backup_recommendations: AccountOutreachBackupRecommendation[] = backupSource
    .slice(0, backupLimit)
    .map((recommendation) => {
      const candidate = findMatchingCandidate(recommendation, input.contacts)
      const channel = selectOutreachChannel({
        candidate,
        recommendation,
        preferredChannels: preferences.preferredChannels,
      })
      return {
        contact: recommendation,
        committee_role: resolveCommitteeRole(recommendation, input.contacts),
        recommended_channel: channel.channel,
        score: clampScore(recommendation.scores.overall),
        reasons: [
          "Selected as backup outreach target",
          ...channel.reasons,
          ...(committee.recommendation.reasons.slice(0, 1) ?? []),
        ],
      }
    })

  const readiness = computeAccountOutreachReadiness({
    primary: primaryRecommendation,
    committee,
    useCase: input.targetUseCase ?? "generic",
    requireDeliverableEmail: preferences.requireDeliverableEmail,
  })

  const staged_plan = buildAccountOutreachStagedPlan({
    primary: primaryRecommendation,
    backups: backup_recommendations,
    committee,
    readiness,
  })

  if (readiness.tier !== "ready") {
    warnings.push(`readiness_${readiness.tier}`)
  }
  warnings.push(...readiness.blockers)

  const recommended_contacts =
    (primaryRecommendation ? 1 : 0) + backup_recommendations.length

  return {
    qa_marker: GROWTH_ACCOUNT_OUTREACH_RECOMMENDATION_QA_MARKER,
    companyName: input.companyName,
    domain: input.domain ?? committee.domain,
    primary_recommendation: primaryRecommendation,
    backup_recommendations,
    committee,
    staged_plan,
    readiness,
    summary: {
      total_contacts: input.contacts.length,
      recommended_contacts,
      committee_coverage_score: committee.coverage.coverage_score,
      primary_contact: primaryRecommendation?.contact.contact.display_name,
      recommended_strategy: committee.recommendation.recommended_strategy,
    },
    warnings: [...new Set(warnings)],
  }
}
