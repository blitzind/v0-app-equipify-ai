/**
 * GE-IRE-7C — Native Sequence Recommendation Engine.
 * Consumes ProspectQualification (7B) → AcquisitionCandidate (7A) → Account Outreach Strategy
 * → Engagement Prediction → Learning Engine → deterministic sequence recommendation.
 * Read-only. No enrollment, sends, or mutations.
 */

import {
  recommendAccountOutreach,
  type AccountOutreachRecommendationResult,
} from "@/lib/growth/contact-verification/account-outreach-recommendation"
import type { AcquisitionPreferredChannel } from "@/lib/growth/contact-verification/contact-acquisition-types"
import {
  predictContactEngagement,
  type ContactEngagementPrediction,
} from "@/lib/growth/contact-verification/contact-engagement-prediction"
import {
  aggregateEmailLearningByDomain,
  type EmailLearningObservation,
} from "@/lib/growth/contact-verification/email-learning"
import {
  buildProspectQualification,
  type ProspectQualificationEngineDependencies,
  type ProspectQualificationEngineInput,
} from "@/lib/growth/contact-verification/prospect-qualification-engine"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type {
  SequenceCadence,
  SequenceEnrollmentReadiness,
  SequencePersonalizationInputs,
  SequencePreferredChannel,
  SequenceRecommendation,
  SequenceRecommendationNextAction,
  SequenceRecommendationType,
} from "@/lib/growth/contact-verification/sequence-recommendation-types"
import {
  GROWTH_SEQUENCE_RECOMMENDATION_QA_MARKER,
  SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING,
} from "@/lib/growth/contact-verification/sequence-recommendation-types"

export { GROWTH_SEQUENCE_RECOMMENDATION_QA_MARKER, SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING }

export type SequenceRecommendationEngineInput = {
  companyId: string
  generatedAt?: string
  qualification?: ProspectQualification
  qualificationInput?: ProspectQualificationEngineInput
  historicalLearning?: EmailLearningObservation[]
}

export type SequenceRecommendationEngineDependencies = ProspectQualificationEngineDependencies & {
  buildProspectQualification?: typeof buildProspectQualification
  recommendAccountOutreach?: typeof recommendAccountOutreach
  predictContactEngagement?: typeof predictContactEngagement
  aggregateEmailLearningByDomain?: typeof aggregateEmailLearningByDomain
}

const HIGH_ENGAGEMENT_THRESHOLD = 70
const MEDIUM_ENGAGEMENT_THRESHOLD = 45

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

function mapAcquisitionChannel(channel: AcquisitionPreferredChannel): SequencePreferredChannel {
  if (channel === "email" || channel === "linkedin" || channel === "phone" || channel === "mixed") {
    return channel
  }
  return "email"
}

/**
 * Enrollment readiness (SRE v1) — primary gate from ProspectQualification.nextAction:
 *
 * enroll_sequence      → ready (only if qualification=qualified AND acquisition outreach=ready)
 * verify_contact       → needs_verification
 * research_more        → needs_research
 * find_decision_maker  → needs_research
 * manual_review        → blocked
 * wait                 → not_recommended
 * disqualify           → not_recommended
 */
export function resolveSequenceEnrollmentReadiness(input: {
  qualification: ProspectQualification
}): SequenceEnrollmentReadiness {
  const { qualification, nextAction } = {
    qualification: input.qualification,
    nextAction: input.qualification.nextAction,
  }
  const acquisitionReady = input.qualification.acquisitionCandidate.outreach.readiness === "ready"

  switch (nextAction) {
    case "enroll_sequence":
      if (qualification.qualification === "qualified" && acquisitionReady) return "ready"
      if (qualification.qualification === "qualified") return "needs_verification"
      return "not_recommended"
    case "verify_contact":
      return "needs_verification"
    case "research_more":
    case "find_decision_maker":
      return "needs_research"
    case "manual_review":
      return "blocked"
    case "wait":
    case "disqualify":
      return "not_recommended"
    default:
      return "blocked"
  }
}

/**
 * Sequence type selection (SRE v1):
 *
 * cold_outbound   — qualified + ready + engagement ≥ 70 + verified email + economic buyer/champion
 * warm_followup   — qualified + ready + engagement ≥ 45
 * nurture         — nurture qualification OR wait next action
 * revalidation    — needs_verification OR verify_contact next action OR risky deliverability
 * manual_review   — blocked/disqualified/research with manual_review path
 */
export function selectSequenceType(input: {
  qualification: ProspectQualification
  engagementScore: number
  enrollmentReadiness: SequenceEnrollmentReadiness
}): { type: SequenceRecommendationType; name: string; matchScore: number } {
  const acquisition = input.qualification.acquisitionCandidate
  const state = input.qualification.qualification
  const nextAction = input.qualification.nextAction

  if (
    input.enrollmentReadiness === "needs_verification" ||
    nextAction === "verify_contact" ||
    acquisition.verification.deliverability === "risky"
  ) {
    return {
      type: "revalidation",
      name: "Email Revalidation Sequence",
      matchScore: 72,
    }
  }

  if (
    state === "nurture" ||
    nextAction === "wait" ||
    input.enrollmentReadiness === "not_recommended"
  ) {
    return {
      type: "nurture",
      name: "Long-Cycle Nurture Sequence",
      matchScore: 65,
    }
  }

  if (
    state === "blocked" ||
    state === "disqualified" ||
    state === "research" ||
    nextAction === "manual_review" ||
    input.enrollmentReadiness === "blocked"
  ) {
    return {
      type: "manual_review",
      name: "Manual Review Hold",
      matchScore: 55,
    }
  }

  const isDecisionMaker =
    acquisition.committee.role === "economic_buyer" || acquisition.committee.role === "champion"
  const verifiedPath =
    acquisition.verification.emailVerified || acquisition.verification.deliverability === "verified"

  if (
    state === "qualified" &&
    input.enrollmentReadiness === "ready" &&
    input.engagementScore >= HIGH_ENGAGEMENT_THRESHOLD &&
    verifiedPath &&
    isDecisionMaker
  ) {
    return {
      type: "cold_outbound",
      name: "Executive Cold Outbound Sequence",
      matchScore: 90,
    }
  }

  if (state === "qualified" && input.enrollmentReadiness === "ready") {
    return {
      type: "warm_followup",
      name: "Warm Multi-Touch Follow-Up Sequence",
      matchScore: 78,
    }
  }

  if (input.enrollmentReadiness === "needs_research") {
    return {
      type: "manual_review",
      name: "Committee Research Sequence Prep",
      matchScore: 60,
    }
  }

  return {
    type: "manual_review",
    name: "Manual Review Hold",
    matchScore: 50,
  }
}

/**
 * Cadence rules (SRE v1):
 *
 * high   — qualified + engagement ≥ 70 → 5 touches / 14 days
 * medium — qualified + engagement ≥ 45 → 4 touches / 21 days
 * low    — nurture/research/verification → 3 touches / 45 days
 */
export function buildSequenceCadence(input: {
  sequenceType: SequenceRecommendationType
  engagementScore: number
  enrollmentReadiness: SequenceEnrollmentReadiness
}): SequenceCadence {
  if (
    input.sequenceType === "cold_outbound" ||
    (input.enrollmentReadiness === "ready" && input.engagementScore >= HIGH_ENGAGEMENT_THRESHOLD)
  ) {
    return { intensity: "high", suggestedTouchCount: 5, suggestedDurationDays: 14 }
  }

  if (
    input.sequenceType === "warm_followup" ||
    (input.enrollmentReadiness === "ready" && input.engagementScore >= MEDIUM_ENGAGEMENT_THRESHOLD)
  ) {
    return { intensity: "medium", suggestedTouchCount: 4, suggestedDurationDays: 21 }
  }

  if (input.sequenceType === "revalidation") {
    return { intensity: "low", suggestedTouchCount: 2, suggestedDurationDays: 10 }
  }

  return { intensity: "low", suggestedTouchCount: 3, suggestedDurationDays: 45 }
}

/**
 * Next action precedence (SRE v1):
 * 1. disqualify / disqualified → do_not_enroll
 * 2. verify_contact / needs_verification → verify_contact
 * 3. research_more / find_decision_maker → research_more
 * 4. qualified + ready + enroll_sequence → enroll_sequence
 * 5. wait / nurture → wait
 * 6. manual_review / blocked → manual_review
 * 7. default → manual_review
 */
export function resolveSequenceNextAction(input: {
  qualification: ProspectQualification
  enrollmentReadiness: SequenceEnrollmentReadiness
}): SequenceRecommendationNextAction {
  const nextAction = input.qualification.nextAction
  const state = input.qualification.qualification

  if (nextAction === "disqualify" || state === "disqualified") return "do_not_enroll"
  if (nextAction === "verify_contact" || input.enrollmentReadiness === "needs_verification") {
    return "verify_contact"
  }
  if (
    nextAction === "research_more" ||
    nextAction === "find_decision_maker" ||
    input.enrollmentReadiness === "needs_research"
  ) {
    return "research_more"
  }
  if (
    nextAction === "enroll_sequence" &&
    state === "qualified" &&
    input.enrollmentReadiness === "ready" &&
    input.qualification.acquisitionCandidate.outreach.readiness === "ready"
  ) {
    return "enroll_sequence"
  }
  if (nextAction === "wait" || state === "nurture") return "wait"
  if (nextAction === "manual_review" || input.enrollmentReadiness === "blocked") {
    return "manual_review"
  }
  if (input.enrollmentReadiness === "not_recommended") return "do_not_enroll"
  return "manual_review"
}

export function computeSequenceRecommendationConfidence(input: {
  qualification: ProspectQualification
  sequenceMatchScore: number
  engagementScore: number
  learningSignalBoost: number
}): number {
  const weights = SEQUENCE_RECOMMENDATION_CONFIDENCE_WEIGHTING.components
  return clampPercent(
    input.qualification.confidence * weights.qualification_confidence +
      input.sequenceMatchScore * weights.sequence_match +
      input.engagementScore * weights.engagement +
      input.qualification.acquisitionCandidate.overallConfidence * weights.acquisition_confidence +
      input.learningSignalBoost * weights.learning_signal,
  )
}

export function buildSequencePersonalizationInputs(input: {
  qualification: ProspectQualification
  outreach?: AccountOutreachRecommendationResult | null
  engagementPrediction: ContactEngagementPrediction
  sequenceType: SequenceRecommendationType
}): SequencePersonalizationInputs {
  const acquisition = input.qualification.acquisitionCandidate
  const primary = acquisition.primaryContact

  const primaryReason =
    input.qualification.strengths[0] ??
    acquisition.reasons[0] ??
    `Recommend ${input.sequenceType.replace(/_/g, " ")} based on qualification score ${input.qualification.overallScore}%`

  const companyContext = [
    input.qualification.fitScore >= 70 ? "Strong ICP fit" : null,
    input.qualification.buyingCommitteeCoverage >= 60
      ? "Healthy buying committee coverage"
      : "Limited committee coverage",
  ]
    .filter(Boolean)
    .join(" · ")

  const contactContext = [
    primary.fullName,
    primary.title,
    acquisition.committee.role.replace(/_/g, " "),
    acquisition.verification.emailVerified ? "verified email" : acquisition.verification.deliverability,
  ]
    .filter(Boolean)
    .join(" · ")

  const buyingCommitteeContext = [
    `Role: ${acquisition.committee.role.replace(/_/g, " ")}`,
    `Coverage ${input.qualification.buyingCommitteeCoverage}%`,
    input.outreach?.summary.recommended_strategy,
  ]
    .filter(Boolean)
    .join(" · ")

  const riskContext = [
    ...input.qualification.risks.slice(0, 2),
    ...input.engagementPrediction.warnings.slice(0, 1),
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    primaryReason,
    companyContext: companyContext || undefined,
    contactContext: contactContext || undefined,
    buyingCommitteeContext: buyingCommitteeContext || undefined,
    riskContext: riskContext || undefined,
  }
}

export function buildSequenceRecommendationReasons(input: {
  qualification: ProspectQualification
  sequenceType: SequenceRecommendationType
  enrollmentReadiness: SequenceEnrollmentReadiness
  outreach?: AccountOutreachRecommendationResult | null
  engagementPrediction: ContactEngagementPrediction
  learningReplyRate: number | null
}): string[] {
  const reasons: string[] = []

  reasons.push(`Qualification state: ${input.qualification.qualification}`)
  reasons.push(`Enrollment readiness: ${input.enrollmentReadiness.replace(/_/g, " ")}`)
  reasons.push(`Selected sequence type: ${input.sequenceType.replace(/_/g, " ")}`)

  if (input.qualification.nextAction === "enroll_sequence") {
    reasons.push("Qualification next action permits sequence enrollment")
  }

  if (input.qualification.acquisitionCandidate.outreach.recommendedSequence) {
    reasons.push(
      `Acquisition outreach plan: ${input.qualification.acquisitionCandidate.outreach.recommendedSequence}`,
    )
  }

  if (input.outreach?.readiness.tier === "ready") {
    reasons.push("Account outreach strategy readiness confirmed")
  }

  for (const reason of input.engagementPrediction.reasons.slice(0, 2)) {
    reasons.push(reason)
  }

  if (input.learningReplyRate != null) {
    reasons.push(`Domain historical reply rate: ${Math.round(input.learningReplyRate * 100)}%`)
  }

  for (const strength of input.qualification.strengths.slice(0, 2)) {
    if (!reasons.includes(strength)) reasons.push(strength)
  }

  return [...new Set(reasons)].slice(0, 10)
}

export function buildSequenceRecommendationRisks(input: {
  qualification: ProspectQualification
  engagementPrediction: ContactEngagementPrediction
}): string[] {
  const risks = [...input.qualification.risks]

  if (input.engagementPrediction.engagement_tier === "low") {
    risks.push("Low engagement probability may reduce sequence response")
  }

  if (input.qualification.acquisitionCandidate.verification.deliverability === "risky") {
    risks.push("Risky email deliverability may affect sequence delivery")
  }

  if (input.qualification.buyingCommitteeCoverage < 40) {
    risks.push("Limited buying committee coverage increases sequence risk")
  }

  return [...new Set(risks)].slice(0, 8)
}

export function buildSequenceRecommendationBlockers(input: {
  qualification: ProspectQualification
  enrollmentReadiness: SequenceEnrollmentReadiness
  nextAction: SequenceRecommendationNextAction
}): string[] {
  const blockers: string[] = []

  if (input.nextAction === "do_not_enroll") {
    blockers.push("Sequence enrollment not recommended for this account")
  }

  if (input.enrollmentReadiness === "blocked") {
    blockers.push("Enrollment blocked pending manual review")
  }

  if (input.enrollmentReadiness === "needs_verification") {
    blockers.push("Verify contact before sequence enrollment")
  }

  if (input.enrollmentReadiness === "needs_research") {
    blockers.push("Research additional stakeholders before enrollment")
  }

  if (
    input.qualification.qualification !== "qualified" ||
    input.qualification.acquisitionCandidate.outreach.readiness !== "ready"
  ) {
    if (input.nextAction === "enroll_sequence") {
      blockers.push("Enrollment requires qualified status and ready outreach readiness")
    }
  }

  for (const blocker of input.qualification.blockers.slice(0, 4)) {
    if (!blockers.includes(blocker)) blockers.push(blocker)
  }

  return [...new Set(blockers)].slice(0, 8)
}

function deriveSequenceNameFromOutreach(
  outreach: AccountOutreachRecommendationResult | null | undefined,
  fallback: string,
): string | undefined {
  if (!outreach?.summary.recommended_strategy) return undefined
  const strategy = outreach.summary.recommended_strategy.trim()
  if (strategy.length > 80) return undefined
  return strategy
}

export async function buildSequenceRecommendation(
  input: SequenceRecommendationEngineInput,
  dependencies: SequenceRecommendationEngineDependencies = {},
): Promise<SequenceRecommendation> {
  const buildQualification = dependencies.buildProspectQualification ?? buildProspectQualification
  const recommendOutreach = dependencies.recommendAccountOutreach ?? recommendAccountOutreach
  const predictEngagement = dependencies.predictContactEngagement ?? predictContactEngagement
  const aggregateLearning = dependencies.aggregateEmailLearningByDomain ?? aggregateEmailLearningByDomain

  let qualification: ProspectQualification
  if (input.qualification) {
    qualification = input.qualification
  } else if (input.qualificationInput) {
    qualification = await buildQualification(
      {
        ...input.qualificationInput,
        companyId: input.companyId,
        historicalLearning: input.historicalLearning ?? input.qualificationInput.historicalLearning,
        generatedAt: input.generatedAt ?? input.qualificationInput.generatedAt,
      },
      dependencies,
    )
  } else {
    throw new Error("qualification_or_input_required")
  }

  const acquisition = qualification.acquisitionCandidate
  const domain =
    input.qualificationInput?.prospectIntelligence?.domain ??
    input.qualificationInput?.acquisitionInput?.domain

  let outreach: AccountOutreachRecommendationResult | null = null
  if (input.qualificationInput?.acquisitionInput?.contacts.length) {
    outreach = await recommendOutreach(
      {
        companyName: input.qualificationInput.acquisitionInput.companyName,
        domain: input.qualificationInput.acquisitionInput.domain,
        industry: input.qualificationInput.acquisitionInput.industry,
        targetUseCase: input.qualificationInput.acquisitionInput.targetUseCase,
        contacts: input.qualificationInput.acquisitionInput.contacts,
        historicalLearning: input.historicalLearning ?? input.qualificationInput.historicalLearning,
        companyPatternEvidence: input.qualificationInput.acquisitionInput.companyPatternEvidence,
        relationshipSignals: input.qualificationInput.acquisitionInput.relationshipSignals,
        preferences: input.qualificationInput.acquisitionInput.preferences,
      },
      dependencies,
    )
  }

  const learningStats = aggregateLearning(input.historicalLearning ?? [])
  const domainLearning = domain
    ? learningStats.find((row) => row.domain === domain.replace(/^www\./, "").toLowerCase())
    : undefined
  const learningReplyRate = domainLearning?.reply_rate ?? null
  const learningSignalBoost = clampPercent(
    learningReplyRate != null ? learningReplyRate * 100 : domainLearning?.messages_sent ? 40 : 20,
  )

  const nameParts = splitName(acquisition.primaryContact.fullName)
  const engagementPrediction = predictEngagement({
    companyName: input.qualificationInput?.prospectIntelligence?.companyName,
    domain,
    industry: input.qualificationInput?.prospectIntelligence?.industry,
    contact: {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      fullName: acquisition.primaryContact.fullName,
      email: acquisition.primaryContact.email,
      jobTitle: acquisition.primaryContact.title,
    },
    historicalLearning: input.historicalLearning,
  })

  const engagementScore = qualification.engagementScore
  const enrollmentReadiness = resolveSequenceEnrollmentReadiness({ qualification })
  const selected = selectSequenceType({ qualification, engagementScore, enrollmentReadiness })
  const cadence = buildSequenceCadence({
    sequenceType: selected.type,
    engagementScore,
    enrollmentReadiness,
  })
  const nextAction = resolveSequenceNextAction({ qualification, enrollmentReadiness })
  const preferredChannel = mapAcquisitionChannel(acquisition.outreach.preferredChannel)

  const outreachDerivedName = deriveSequenceNameFromOutreach(outreach, selected.name)
  const sequenceName = outreachDerivedName ?? selected.name

  const confidence = computeSequenceRecommendationConfidence({
    qualification,
    sequenceMatchScore: selected.matchScore,
    engagementScore,
    learningSignalBoost,
  })

  return {
    version: 1,
    companyId: input.companyId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    recommendedSequence: {
      name: sequenceName,
      type: selected.type,
      confidence: clampPercent(selected.matchScore * 0.7 + confidence * 0.3),
    },
    enrollmentReadiness,
    preferredChannel,
    cadence,
    personalizationInputs: buildSequencePersonalizationInputs({
      qualification,
      outreach,
      engagementPrediction,
      sequenceType: selected.type,
    }),
    reasons: buildSequenceRecommendationReasons({
      qualification,
      sequenceType: selected.type,
      enrollmentReadiness,
      outreach,
      engagementPrediction,
      learningReplyRate,
    }),
    risks: buildSequenceRecommendationRisks({ qualification, engagementPrediction }),
    blockers: buildSequenceRecommendationBlockers({
      qualification,
      enrollmentReadiness,
      nextAction,
    }),
    nextAction,
    confidence,
  }
}
