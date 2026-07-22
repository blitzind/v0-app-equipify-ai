/**
 * GE-IRE-7B — Native Prospect Qualification Engine.
 * Consumes prospect intelligence + AcquisitionCandidate (7A) + engagement prediction + email learning.
 * Deterministic, read-only. No AI, LLM, or provider-specific logic.
 */

import {
  buildAcquisitionCandidate,
  type ContactAcquisitionEngineDependencies,
  type ContactAcquisitionEngineInput,
} from "@/lib/growth/contact-verification/contact-acquisition-engine"
import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"
import {
  predictContactEngagement,
  type ContactEngagementPrediction,
} from "@/lib/growth/contact-verification/contact-engagement-prediction"
import {
  aggregateEmailLearningByDomain,
  type EmailLearningObservation,
} from "@/lib/growth/contact-verification/email-learning"
import type {
  ProspectQualification,
  ProspectQualificationNextAction,
  ProspectQualificationState,
} from "@/lib/growth/contact-verification/prospect-qualification-types"
import {
  GROWTH_PROSPECT_QUALIFICATION_QA_MARKER,
  PROSPECT_QUALIFICATION_SCORE_WEIGHTING,
} from "@/lib/growth/contact-verification/prospect-qualification-types"

export { GROWTH_PROSPECT_QUALIFICATION_QA_MARKER, PROSPECT_QUALIFICATION_SCORE_WEIGHTING }

export type ProspectQualificationProspectIntelligence = {
  companyName?: string
  domain?: string
  industry?: string
  companyMatchConfidence?: number | null
  committeeCompletenessPct?: number | null
  leadEngineScore?: number | null
  buyingStage?: string | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  outreachReadinessScore?: number | null
  personaCompleteness?: number | null
  hasPhoneOnPrimary?: boolean
  contactCount?: number
  verifiedContactCount?: number
}

export type ProspectQualificationEngineInput = {
  companyId: string
  generatedAt?: string
  acquisitionCandidate?: AcquisitionCandidate
  acquisitionInput?: ContactAcquisitionEngineInput
  prospectIntelligence?: ProspectQualificationProspectIntelligence
  historicalLearning?: EmailLearningObservation[]
}

export type ProspectQualificationEngineDependencies = ContactAcquisitionEngineDependencies & {
  buildAcquisitionCandidate?: typeof buildAcquisitionCandidate
  predictContactEngagement?: typeof predictContactEngagement
  aggregateEmailLearningByDomain?: typeof aggregateEmailLearningByDomain
}

const QUALIFIED_OVERALL_THRESHOLD = 65
const QUALIFIED_CONTACT_THRESHOLD = 55
const QUALIFIED_ENGAGEMENT_THRESHOLD = 40
const NURTURE_OVERALL_MIN = 40
const DISQUALIFIED_ICP_THRESHOLD = 0.25
const DISQUALIFIED_ACQUISITION_THRESHOLD = 25
const LOW_COMMITTEE_THRESHOLD = 40
const STRONG_ICP_THRESHOLD = 70
const HIGH_ENGAGEMENT_THRESHOLD = 70
const HEALTHY_COMMITTEE_THRESHOLD = 60

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(Math.max(0, Math.min(100, value)))
}

function splitName(fullName: string): { firstName?: string; lastName?: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") }
}

export function computeProspectQualificationFitScore(
  intelligence: ProspectQualificationProspectIntelligence | undefined,
): number {
  if (typeof intelligence?.leadEngineScore === "number" && Number.isFinite(intelligence.leadEngineScore)) {
    return clampPercent(intelligence.leadEngineScore)
  }
  if (
    typeof intelligence?.companyMatchConfidence === "number" &&
    Number.isFinite(intelligence.companyMatchConfidence)
  ) {
    return clampPercent(intelligence.companyMatchConfidence * 100)
  }
  if (
    typeof intelligence?.outreachReadinessScore === "number" &&
    Number.isFinite(intelligence.outreachReadinessScore)
  ) {
    return clampPercent(intelligence.outreachReadinessScore * 0.6)
  }
  return 50
}

export function computeProspectQualificationContactScore(
  acquisition: AcquisitionCandidate,
): number {
  const primaryConfidence = acquisition.primaryContact.confidence
  const acquisitionConfidence = acquisition.overallConfidence
  return clampPercent(primaryConfidence * 0.55 + acquisitionConfidence * 0.45)
}

export function computeProspectQualificationCommitteeCoverage(input: {
  acquisition: AcquisitionCandidate
  intelligence?: ProspectQualificationProspectIntelligence
}): number {
  if (
    typeof input.intelligence?.committeeCompletenessPct === "number" &&
    Number.isFinite(input.intelligence.committeeCompletenessPct)
  ) {
    return clampPercent(
      input.intelligence.committeeCompletenessPct * 0.6 + input.acquisition.committee.confidence * 0.4,
    )
  }
  if (typeof input.intelligence?.personaCompleteness === "number") {
    return clampPercent(
      input.intelligence.personaCompleteness * 0.5 + input.acquisition.committee.confidence * 0.5,
    )
  }
  return clampPercent(input.acquisition.committee.confidence)
}

export function computeProspectQualificationEngagementScore(
  prediction: ContactEngagementPrediction,
): number {
  return clampPercent(prediction.engagement_score * 100)
}

export function computeProspectQualificationOverallScore(input: {
  fitScore: number
  contactScore: number
  engagementScore: number
  buyingCommitteeCoverage: number
  acquisitionConfidence: number
}): number {
  const weights = PROSPECT_QUALIFICATION_SCORE_WEIGHTING.components
  return clampPercent(
    input.fitScore * weights.fit +
      input.contactScore * weights.contact +
      input.engagementScore * weights.engagement +
      input.buyingCommitteeCoverage * weights.buying_committee_coverage +
      input.acquisitionConfidence * weights.acquisition_confidence,
  )
}

export function computeProspectQualificationConfidence(input: {
  acquisition: AcquisitionCandidate
  engagementPrediction: ContactEngagementPrediction
  learningDomainObservations: number
}): number {
  let confidence = input.acquisition.overallConfidence * 0.45 + input.engagementPrediction.confidence * 0.35
  if (input.learningDomainObservations > 0) {
    confidence += Math.min(20, input.learningDomainObservations * 2)
  } else {
    confidence *= 0.92
  }
  if (input.acquisition.verification.emailVerified) confidence += 5
  return clampPercent(confidence)
}

/**
 * Deterministic qualification state rules (PQE v1):
 *
 * disqualified — account suppressed; OR ICP fit below 25% with acquisition confidence below 25%.
 * blocked      — acquisition outreach blocked; OR no outreach path; OR hard acquisition blockers.
 * research     — acquisition readiness research; OR verification pending; OR committee coverage below 40%.
 * nurture      — partial fit (overall 40–64); OR medium engagement with incomplete committee; not ready for sequence.
 * qualified    — outreach ready; overall ≥ 65; contact ≥ 55; engagement ≥ 40; verified/risky-acceptable contact path.
 */
export function resolveProspectQualificationState(input: {
  overallScore: number
  contactScore: number
  engagementScore: number
  buyingCommitteeCoverage: number
  acquisition: AcquisitionCandidate
  intelligence?: ProspectQualificationProspectIntelligence
}): ProspectQualificationState {
  const intel = input.intelligence

  if (intel?.isSuppressed) return "disqualified"

  const icp =
    typeof intel?.companyMatchConfidence === "number" ? intel.companyMatchConfidence : null
  if (
    icp != null &&
    icp < DISQUALIFIED_ICP_THRESHOLD &&
    input.acquisition.overallConfidence < DISQUALIFIED_ACQUISITION_THRESHOLD
  ) {
    return "disqualified"
  }

  if (input.acquisition.outreach.readiness === "blocked") return "blocked"

  const hardBlockers = input.acquisition.blockers.some((blocker) =>
    [
      "No outreach channel available",
      "Unknown company",
      "No decision maker identified",
    ].includes(blocker),
  )
  if (hardBlockers && input.acquisition.primaryContact.confidence < 30) return "blocked"

  if (input.acquisition.outreach.readiness === "research") return "research"

  const verificationWeak =
    !input.acquisition.verification.emailVerified &&
    input.acquisition.verification.deliverability !== "verified"
  const verificationPending = input.acquisition.blockers.includes("Verification pending")
  if (verificationPending || (verificationWeak && input.contactScore < 50)) return "research"

  if (input.buyingCommitteeCoverage < LOW_COMMITTEE_THRESHOLD && input.contactScore < 50) {
    return "research"
  }

  const outreachReady = input.acquisition.outreach.readiness === "ready"
  const scoresQualified =
    input.overallScore >= QUALIFIED_OVERALL_THRESHOLD &&
    input.contactScore >= QUALIFIED_CONTACT_THRESHOLD &&
    input.engagementScore >= QUALIFIED_ENGAGEMENT_THRESHOLD

  if (
    outreachReady &&
    scoresQualified &&
    (input.acquisition.verification.emailVerified ||
      input.acquisition.verification.deliverability === "verified" ||
      input.acquisition.verification.deliverability === "risky")
  ) {
    return "qualified"
  }

  if (input.overallScore >= NURTURE_OVERALL_MIN) return "nurture"

  if (input.acquisition.blockers.length > 0) return "blocked"

  return "research"
}

/**
 * Next action precedence (PQE v1 — highest priority first):
 * 1. disqualified / suppressed → disqualify
 * 2. no decision maker → find_decision_maker
 * 3. missing verified email / verification pending → verify_contact
 * 4. blocked → manual_review
 * 5. research → research_more
 * 6. nurture → wait
 * 7. qualified + outreach ready → enroll_sequence
 * 8. default → manual_review
 */
export function resolveProspectQualificationNextAction(input: {
  qualification: ProspectQualificationState
  acquisition: AcquisitionCandidate
  intelligence?: ProspectQualificationProspectIntelligence
}): ProspectQualificationNextAction {
  if (input.intelligence?.isSuppressed || input.qualification === "disqualified") {
    return "disqualify"
  }

  const blockers = input.acquisition.blockers
  if (
    blockers.some((b) => b.includes("No decision maker identified")) ||
    input.acquisition.primaryContact.fullName === "No primary contact"
  ) {
    return "find_decision_maker"
  }

  if (
    blockers.some(
      (b) =>
        b.includes("verified email") ||
        b.includes("Verification pending") ||
        b.includes("deliverability"),
    ) ||
    (!input.acquisition.verification.emailVerified &&
      input.acquisition.verification.deliverability === "unknown")
  ) {
    return "verify_contact"
  }

  if (input.qualification === "blocked") return "manual_review"
  if (input.qualification === "research") return "research_more"
  if (input.qualification === "nurture") return "wait"
  if (
    input.qualification === "qualified" &&
    input.acquisition.outreach.readiness === "ready"
  ) {
    return "enroll_sequence"
  }

  return "manual_review"
}

export function buildProspectQualificationStrengths(input: {
  fitScore: number
  engagementScore: number
  buyingCommitteeCoverage: number
  acquisition: AcquisitionCandidate
  engagementPrediction: ContactEngagementPrediction
}): string[] {
  const strengths: string[] = []

  if (
    input.acquisition.verification.emailVerified &&
    input.acquisition.primaryContact.title &&
    /\b(chief|vp|vice president|director|president|head)\b/i.test(
      input.acquisition.primaryContact.title,
    )
  ) {
    strengths.push("Verified executive contact")
  } else if (input.acquisition.verification.emailVerified) {
    strengths.push("Verified primary contact email")
  }

  if (input.fitScore >= STRONG_ICP_THRESHOLD) strengths.push("Strong ICP match")

  if (
    input.acquisition.committee.role === "economic_buyer" ||
    input.acquisition.committee.role === "champion"
  ) {
    strengths.push("Economic buyer identified")
  }

  if (
    input.engagementPrediction.engagement_tier === "high" ||
    input.engagementScore >= HIGH_ENGAGEMENT_THRESHOLD
  ) {
    strengths.push("High engagement prediction")
  }

  const verifiedBackups = input.acquisition.backupContacts.filter((contact) => contact.email).length
  if (verifiedBackups >= 1 && input.acquisition.verification.emailVerified) {
    strengths.push("Multiple verified contacts")
  }

  if (input.buyingCommitteeCoverage >= HEALTHY_COMMITTEE_THRESHOLD) {
    strengths.push("Healthy committee coverage")
  }

  for (const reason of input.acquisition.reasons.slice(0, 3)) {
    if (!strengths.includes(reason) && reason.length < 80) strengths.push(reason)
  }

  return [...new Set(strengths)].slice(0, 8)
}

export function buildProspectQualificationRisks(input: {
  fitScore: number
  engagementScore: number
  buyingCommitteeCoverage: number
  acquisition: AcquisitionCandidate
  engagementPrediction: ContactEngagementPrediction
  intelligence?: ProspectQualificationProspectIntelligence
}): string[] {
  const risks: string[] = []

  if (input.buyingCommitteeCoverage < LOW_COMMITTEE_THRESHOLD) {
    risks.push("Limited committee coverage")
  }

  if (input.intelligence?.hasPhoneOnPrimary === false) {
    risks.push("No phone on primary contact")
  }

  if (
    input.engagementPrediction.engagement_tier === "low" ||
    input.engagementScore < 35
  ) {
    risks.push("Low engagement probability")
  }

  if (
    input.acquisition.verification.deliverability === "risky" ||
    input.acquisition.verification.deliverability === "unknown"
  ) {
    risks.push("Weak verification")
  }

  if (!input.intelligence?.industry?.trim()) {
    risks.push("Industry uncertainty")
  }

  for (const warning of input.engagementPrediction.warnings.slice(0, 2)) {
    if (!risks.includes(warning)) risks.push(warning)
  }

  return [...new Set(risks)].slice(0, 8)
}

export function buildProspectQualificationBlockers(input: {
  acquisition: AcquisitionCandidate
  intelligence?: ProspectQualificationProspectIntelligence
}): string[] {
  const blockers = [...input.acquisition.blockers]

  if (input.intelligence?.isSuppressed) {
    blockers.push(input.intelligence.suppressionReason ?? "Account suppressed")
  }

  if (
    !input.acquisition.verification.emailVerified &&
    input.acquisition.verification.deliverability !== "verified"
  ) {
    if (!blockers.some((b) => b.includes("verified"))) {
      blockers.push("No verified contact")
    }
  }

  if (input.acquisition.outreach.readiness === "research") {
    if (!blockers.includes("Research incomplete")) blockers.push("Research incomplete")
  }

  if (input.acquisition.outreach.readiness === "blocked") {
    if (!blockers.some((b) => b.includes("outreach"))) blockers.push("No outreach path")
  }

  return [...new Set(blockers)].slice(0, 10)
}

export function buildProspectQualificationRecommendations(input: {
  qualification: ProspectQualificationState
  nextAction: ProspectQualificationNextAction
  acquisition: AcquisitionCandidate
  buyingCommitteeCoverage: number
}): string[] {
  const recommendations: string[] = []

  switch (input.nextAction) {
    case "enroll_sequence":
      recommendations.push("Enroll in outbound sequence")
      break
    case "research_more":
      recommendations.push("Research additional stakeholders")
      if (input.buyingCommitteeCoverage < LOW_COMMITTEE_THRESHOLD) {
        recommendations.push("Expand buying committee coverage")
      }
      break
    case "verify_contact":
      recommendations.push("Verify alternate email")
      break
    case "find_decision_maker":
      recommendations.push("Identify decision maker before outreach")
      break
    case "wait":
      recommendations.push("Monitor buying signals")
      break
    case "disqualify":
      recommendations.push("Disqualify account")
      break
    default:
      recommendations.push("Manual review")
  }

  if (input.qualification === "nurture") {
    recommendations.push("Monitor buying signals")
  }

  if (input.acquisition.outreach.recommendedSequence) {
    recommendations.push(`Follow sequence: ${input.acquisition.outreach.recommendedSequence}`)
  }

  return [...new Set(recommendations)].slice(0, 6)
}

export async function buildProspectQualification(
  input: ProspectQualificationEngineInput,
  dependencies: ProspectQualificationEngineDependencies = {},
): Promise<ProspectQualification> {
  const buildAcquisition = dependencies.buildAcquisitionCandidate ?? buildAcquisitionCandidate
  const predictEngagement = dependencies.predictContactEngagement ?? predictContactEngagement
  const aggregateLearning = dependencies.aggregateEmailLearningByDomain ?? aggregateEmailLearningByDomain

  let acquisition = input.acquisitionCandidate
  if (!acquisition) {
    if (!input.acquisitionInput) {
      throw new Error("acquisition_candidate_or_input_required")
    }
    acquisition = await buildAcquisition(input.acquisitionInput, dependencies)
  }

  const intel = input.prospectIntelligence
  const domain =
    intel?.domain?.trim() ||
    input.acquisitionInput?.domain?.trim() ||
    undefined

  const learningStats = aggregateLearning(input.historicalLearning ?? [])
  const domainLearning = domain
    ? learningStats.find((row) => row.domain === domain.replace(/^www\./, "").toLowerCase())
    : undefined

  const nameParts = splitName(acquisition.primaryContact.fullName)
  const engagementPrediction = predictEngagement({
    companyName: intel?.companyName ?? input.acquisitionInput?.companyName,
    domain,
    industry: intel?.industry ?? input.acquisitionInput?.industry,
    contact: {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fullName: acquisition.primaryContact.fullName,
      email: acquisition.primaryContact.email,
      jobTitle: acquisition.primaryContact.title,
    },
    historicalLearning: input.historicalLearning,
  })

  const fitScore = computeProspectQualificationFitScore(intel)
  const contactScore = computeProspectQualificationContactScore(acquisition)
  const engagementScore = computeProspectQualificationEngagementScore(engagementPrediction)
  const buyingCommitteeCoverage = computeProspectQualificationCommitteeCoverage({
    acquisition,
    intelligence: intel,
  })
  const overallScore = computeProspectQualificationOverallScore({
    fitScore,
    contactScore,
    engagementScore,
    buyingCommitteeCoverage,
    acquisitionConfidence: acquisition.overallConfidence,
  })
  const confidence = computeProspectQualificationConfidence({
    acquisition,
    engagementPrediction,
    learningDomainObservations:
      (domainLearning?.messages_sent ?? 0) + (domainLearning?.deliveries ?? 0),
  })

  const qualification = resolveProspectQualificationState({
    overallScore,
    contactScore,
    engagementScore,
    buyingCommitteeCoverage,
    acquisition,
    intelligence: intel,
  })

  const nextAction = resolveProspectQualificationNextAction({
    qualification,
    acquisition,
    intelligence: intel,
  })

  return {
    version: 1,
    companyId: input.companyId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    qualification,
    overallScore,
    fitScore,
    contactScore,
    engagementScore,
    buyingCommitteeCoverage,
    confidence,
    acquisitionCandidate: acquisition,
    strengths: buildProspectQualificationStrengths({
      fitScore,
      engagementScore,
      buyingCommitteeCoverage,
      acquisition,
      engagementPrediction,
    }),
    risks: buildProspectQualificationRisks({
      fitScore,
      engagementScore,
      buyingCommitteeCoverage,
      acquisition,
      engagementPrediction,
      intelligence: intel,
    }),
    blockers: buildProspectQualificationBlockers({ acquisition, intelligence: intel }),
    recommendations: buildProspectQualificationRecommendations({
      qualification,
      nextAction,
      acquisition,
      buyingCommitteeCoverage,
    }),
    nextAction,
  }
}
