/**
 * GE-IRE-7D — Native Next Best Action Engine.
 * Consumes ProspectQualification (7B) + SequenceRecommendation (7C) + learning + engagement.
 * Read-only. Never executes actions — decides only.
 */

import {
  predictContactEngagement,
  type ContactEngagementPrediction,
} from "@/lib/growth/contact-verification/contact-engagement-prediction"
import {
  aggregateEmailLearningByDomain,
  type EmailLearningObservation,
} from "@/lib/growth/contact-verification/email-learning"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import {
  buildSequenceRecommendation,
  type SequenceRecommendationEngineDependencies,
  type SequenceRecommendationEngineInput,
} from "@/lib/growth/contact-verification/sequence-recommendation-engine"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type {
  NextBestAction,
  NextBestActionChannel,
  NextBestActionExecutionReadiness,
  NextBestActionPriority,
  NextBestActionType,
} from "@/lib/growth/contact-verification/next-best-action-types"
import {
  GROWTH_NEXT_BEST_ACTION_QA_MARKER,
  NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING,
} from "@/lib/growth/contact-verification/next-best-action-types"

export { GROWTH_NEXT_BEST_ACTION_QA_MARKER, NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING }

export type NextBestActionEngineInput = SequenceRecommendationEngineInput & {
  sequenceRecommendation?: SequenceRecommendation
}

export type NextBestActionEngineDependencies = SequenceRecommendationEngineDependencies & {
  buildSequenceRecommendation?: typeof buildSequenceRecommendation
  predictContactEngagement?: typeof predictContactEngagement
  aggregateEmailLearningByDomain?: typeof aggregateEmailLearningByDomain
}

const LOW_ENGAGEMENT_THRESHOLD = 40
const LOW_COMMITTEE_THRESHOLD = 40

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

function mapChannel(channel: string): NextBestActionChannel {
  if (channel === "email" || channel === "linkedin" || channel === "phone" || channel === "mixed") {
    return channel
  }
  return "email"
}

/**
 * Action selection (NBA v1) — exactly one action, precedence order:
 *
 * 1. disqualify — qualification disqualified or sequence do_not_enroll
 * 2. verify_contact — sequence/qualification verify path
 * 3. identify_decision_maker — find_decision_maker next action or no primary contact
 * 4. research_company — research_more or needs_research enrollment readiness
 * 5. enroll_sequence — qualified + ready + enroll_sequence when execution ready
 * 6. monitor_buying_signals — nurture/wait path
 * 7. manual_review — blocked/manual_review default
 */
export function resolveNextBestActionType(input: {
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): NextBestActionType {
  const qual = input.qualification
  const seq = input.sequence
  const acquisition = qual.acquisitionCandidate

  if (
    qual.qualification === "disqualified" ||
    qual.nextAction === "disqualify" ||
    seq.nextAction === "do_not_enroll"
  ) {
    return "disqualify"
  }

  if (
    seq.nextAction === "verify_contact" ||
    qual.nextAction === "verify_contact" ||
    seq.enrollmentReadiness === "needs_verification"
  ) {
    return "verify_contact"
  }

  if (
    qual.nextAction === "find_decision_maker" ||
    acquisition.primaryContact.fullName === "No primary contact" ||
    acquisition.blockers.some((b) => b.toLowerCase().includes("decision maker"))
  ) {
    return "identify_decision_maker"
  }

  if (
    seq.nextAction === "research_more" ||
    qual.nextAction === "research_more" ||
    seq.enrollmentReadiness === "needs_research" ||
    qual.qualification === "research"
  ) {
    return "research_company"
  }

  if (
    seq.nextAction === "enroll_sequence" &&
    qual.qualification === "qualified" &&
    seq.enrollmentReadiness === "ready" &&
    acquisition.outreach.readiness === "ready"
  ) {
    return "enroll_sequence"
  }

  if (
    qual.qualification === "nurture" ||
    qual.nextAction === "wait" ||
    seq.nextAction === "wait"
  ) {
    return "monitor_buying_signals"
  }

  if (
    seq.nextAction === "manual_review" ||
    qual.nextAction === "manual_review" ||
    seq.enrollmentReadiness === "blocked" ||
    qual.qualification === "blocked"
  ) {
    return "manual_review"
  }

  return "manual_review"
}

/**
 * Priority rules (NBA v1):
 *
 * critical — disqualify; verify_contact when outreach blocked by verification
 * high     — enroll_sequence when ready; executive verified contact path
 * medium   — research_company, identify_decision_maker, manual_review
 * low      — monitor_buying_signals
 */
export function resolveNextBestActionPriority(input: {
  action: NextBestActionType
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): NextBestActionPriority {
  const acquisition = input.qualification.acquisitionCandidate

  if (input.action === "disqualify") return "critical"

  if (
    input.action === "verify_contact" &&
    (!acquisition.verification.emailVerified ||
      acquisition.verification.deliverability === "unknown")
  ) {
    return "critical"
  }

  if (input.action === "enroll_sequence" && input.sequence.enrollmentReadiness === "ready") {
    const isExecutive =
      acquisition.primaryContact.title &&
      /\b(chief|vp|vice president|director|president|head)\b/i.test(acquisition.primaryContact.title)
    if (acquisition.verification.emailVerified && isExecutive) return "high"
    return "high"
  }

  if (
    input.action === "identify_decision_maker" ||
    input.action === "research_company" ||
    input.action === "manual_review"
  ) {
    return "medium"
  }

  if (input.action === "monitor_buying_signals") return "low"

  if (input.action === "verify_contact") return "high"

  return "medium"
}

/**
 * Execution readiness (NBA v1):
 *
 * ready   — enroll_sequence with ready enrollment + outreach ready
 * blocked — manual_review, disqualify, blocked qualification/sequence states
 * waiting — verify, research, identify, monitor paths
 */
export function resolveNextBestActionExecutionReadiness(input: {
  action: NextBestActionType
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): NextBestActionExecutionReadiness {
  if (input.action === "disqualify") return "blocked"

  if (
    input.action === "enroll_sequence" &&
    input.sequence.enrollmentReadiness === "ready" &&
    input.qualification.acquisitionCandidate.outreach.readiness === "ready" &&
    input.sequence.blockers.length === 0
  ) {
    return "ready"
  }

  if (
    input.action === "manual_review" ||
    input.sequence.enrollmentReadiness === "blocked" ||
    input.qualification.qualification === "blocked"
  ) {
    return "blocked"
  }

  if (
    input.action === "verify_contact" ||
    input.action === "research_company" ||
    input.action === "identify_decision_maker" ||
    input.action === "monitor_buying_signals"
  ) {
    return "waiting"
  }

  if (input.action === "enroll_sequence") return "waiting"

  return "blocked"
}

/**
 * Delay recommendation (NBA v1) — hours, no scheduling execution:
 *
 * 0      — enroll_sequence ready (immediately)
 * 24     — verify_contact
 * 72     — identify_decision_maker / research_company
 * 168    — manual_review (7 days)
 * 720    — monitor_buying_signals (30 days)
 * undefined — disqualify (never)
 */
export function resolveNextBestActionDelayHours(input: {
  action: NextBestActionType
  executionReadiness: NextBestActionExecutionReadiness
}): number | undefined {
  if (input.action === "disqualify") return undefined

  if (input.action === "enroll_sequence" && input.executionReadiness === "ready") return 0

  if (input.action === "verify_contact") return 24

  if (input.action === "identify_decision_maker" || input.action === "research_company") return 72

  if (input.action === "manual_review") return 168

  if (input.action === "monitor_buying_signals") return 720

  if (input.action === "enroll_sequence") return 24

  return 72
}

export function computeNextBestActionConfidence(input: {
  qualification: ProspectQualification
  sequence: SequenceRecommendation
  engagementScore: number
  learningSignalBoost: number
}): number {
  const weights = NEXT_BEST_ACTION_CONFIDENCE_WEIGHTING.components
  return clampPercent(
    input.qualification.confidence * weights.qualification_confidence +
      input.sequence.confidence * weights.sequence_confidence +
      input.qualification.acquisitionCandidate.overallConfidence * weights.acquisition_confidence +
      input.engagementScore * weights.engagement +
      input.learningSignalBoost * weights.learning_signal,
  )
}

export function buildNextBestActionReasons(input: {
  action: NextBestActionType
  qualification: ProspectQualification
  sequence: SequenceRecommendation
  engagementPrediction: ContactEngagementPrediction
}): string[] {
  const reasons: string[] = []

  reasons.push(`Qualification: ${input.qualification.qualification}`)
  reasons.push(`Sequence type: ${input.sequence.recommendedSequence.type.replace(/_/g, " ")}`)
  reasons.push(`Selected action: ${input.action.replace(/_/g, " ")}`)

  if (input.qualification.nextAction === "enroll_sequence") {
    reasons.push("Qualification permits sequence enrollment")
  }

  for (const reason of input.sequence.reasons.slice(0, 3)) {
    if (!reasons.includes(reason)) reasons.push(reason)
  }

  for (const strength of input.qualification.strengths.slice(0, 2)) {
    if (!reasons.includes(strength)) reasons.push(strength)
  }

  if (input.engagementPrediction.engagement_tier === "high") {
    reasons.push("High engagement prediction supports recommended action")
  }

  return [...new Set(reasons)].slice(0, 10)
}

export function buildNextBestActionBlockers(input: {
  action: NextBestActionType
  qualification: ProspectQualification
  sequence: SequenceRecommendation
  executionReadiness: NextBestActionExecutionReadiness
}): string[] {
  const blockers: string[] = []

  if (input.action === "enroll_sequence" && input.executionReadiness !== "ready") {
    blockers.push("Sequence enrollment not yet ready")
  }

  for (const blocker of input.sequence.blockers.slice(0, 4)) {
    if (!blockers.includes(blocker)) blockers.push(blocker)
  }

  for (const blocker of input.qualification.blockers.slice(0, 3)) {
    if (!blockers.includes(blocker)) blockers.push(blocker)
  }

  if (input.action === "disqualify") {
    blockers.push("Account disqualified from automated outreach")
  }

  return [...new Set(blockers)].slice(0, 8)
}

export function buildNextBestActionDependencies(input: {
  action: NextBestActionType
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): string[] {
  const dependencies: string[] = []
  const acquisition = input.qualification.acquisitionCandidate

  if (
    input.action === "enroll_sequence" ||
    input.action === "verify_contact"
  ) {
    if (!acquisition.verification.emailVerified) {
      dependencies.push("Verified email required")
    }
  }

  if (
    input.action === "enroll_sequence" ||
    input.action === "identify_decision_maker"
  ) {
    if (
      acquisition.primaryContact.fullName === "No primary contact" ||
      acquisition.blockers.some((b) => b.toLowerCase().includes("decision maker"))
    ) {
      dependencies.push("Decision maker required")
    }
  }

  if (input.qualification.buyingCommitteeCoverage < LOW_COMMITTEE_THRESHOLD) {
    dependencies.push("Buying committee incomplete")
  }

  if (input.qualification.qualification === "research") {
    dependencies.push("Qualification pending")
  }

  if (
    input.action === "enroll_sequence" &&
    input.sequence.enrollmentReadiness !== "ready"
  ) {
    dependencies.push("Sequence selection pending")
  }

  if (input.sequence.enrollmentReadiness === "needs_verification") {
    dependencies.push("Verification required before enrollment")
  }

  return [...new Set(dependencies)].slice(0, 8)
}

export function buildNextBestActionWarnings(input: {
  qualification: ProspectQualification
  sequence: SequenceRecommendation
  engagementPrediction: ContactEngagementPrediction
  isSuppressed?: boolean
  contactCount?: number
}): string[] {
  const warnings: string[] = []
  const acquisition = input.qualification.acquisitionCandidate

  if (
    input.engagementPrediction.engagement_tier === "low" ||
    input.qualification.engagementScore < LOW_ENGAGEMENT_THRESHOLD
  ) {
    warnings.push("Low engagement prediction")
  }

  if (
    acquisition.verification.deliverability === "risky" ||
    acquisition.verification.deliverability === "unknown"
  ) {
    warnings.push("Weak verification")
  }

  if (
    acquisition.backupContacts.length === 0 &&
    (input.contactCount ?? 0) <= 1
  ) {
    warnings.push("Single contact available")
  }

  if (input.qualification.buyingCommitteeCoverage < LOW_COMMITTEE_THRESHOLD) {
    warnings.push("Limited committee coverage")
  }

  if (input.isSuppressed) {
    warnings.push("Recent suppression flag on account")
  }

  for (const risk of input.sequence.risks.slice(0, 2)) {
    if (!warnings.includes(risk)) warnings.push(risk)
  }

  for (const warning of input.engagementPrediction.warnings.slice(0, 2)) {
    if (!warnings.includes(warning)) warnings.push(warning)
  }

  return [...new Set(warnings)].slice(0, 8)
}

export async function buildNextBestAction(
  input: NextBestActionEngineInput,
  dependencies: NextBestActionEngineDependencies = {},
): Promise<NextBestAction> {
  const buildSequence = dependencies.buildSequenceRecommendation ?? buildSequenceRecommendation
  const predictEngagement = dependencies.predictContactEngagement ?? predictContactEngagement
  const aggregateLearning = dependencies.aggregateEmailLearningByDomain ?? aggregateEmailLearningByDomain

  let qualification = input.qualification
  if (!qualification) {
    if (!input.qualificationInput) {
      throw new Error("qualification_or_input_required")
    }
    const { buildProspectQualification } = await import(
      "@/lib/growth/contact-verification/prospect-qualification-engine"
    )
    const buildQualification = dependencies.buildProspectQualification ?? buildProspectQualification
    qualification = await buildQualification(
      {
        ...input.qualificationInput,
        companyId: input.companyId,
        historicalLearning: input.historicalLearning ?? input.qualificationInput.historicalLearning,
        generatedAt: input.generatedAt ?? input.qualificationInput.generatedAt,
      },
      dependencies,
    )
  }

  const sequence =
    input.sequenceRecommendation ??
    (await buildSequence(
      {
        companyId: input.companyId,
        generatedAt: input.generatedAt ?? qualification.generatedAt,
        qualification,
        historicalLearning: input.historicalLearning,
      },
      dependencies,
    ))

  const acquisition = qualification.acquisitionCandidate
  const domain =
    input.qualificationInput?.prospectIntelligence?.domain ??
    input.qualificationInput?.acquisitionInput?.domain

  const learningStats = aggregateLearning(input.historicalLearning ?? [])
  const domainLearning = domain
    ? learningStats.find((row) => row.domain === domain.replace(/^www\./, "").toLowerCase())
    : undefined
  const learningSignalBoost = clampPercent(
    domainLearning?.reply_rate != null
      ? domainLearning.reply_rate * 100
      : domainLearning?.messages_sent
        ? 40
        : 20,
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

  const action = resolveNextBestActionType({ qualification, sequence })
  const priority = resolveNextBestActionPriority({ action, qualification, sequence })
  const executionReadiness = resolveNextBestActionExecutionReadiness({
    action,
    qualification,
    sequence,
  })
  const recommendedDelayHours = resolveNextBestActionDelayHours({ action, executionReadiness })

  const confidence = computeNextBestActionConfidence({
    qualification,
    sequence,
    engagementScore: qualification.engagementScore,
    learningSignalBoost,
  })

  const isSuppressed = input.qualificationInput?.prospectIntelligence?.isSuppressed

  return {
    version: 1,
    companyId: input.companyId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    action,
    priority,
    confidence,
    executionReadiness,
    recommendedSequence:
      action === "enroll_sequence" || action === "monitor_buying_signals"
        ? {
            id: sequence.recommendedSequence.sequenceId,
            name: sequence.recommendedSequence.name,
          }
        : undefined,
    recommendedChannel: mapChannel(sequence.preferredChannel),
    recommendedDelayHours,
    reasons: buildNextBestActionReasons({
      action,
      qualification,
      sequence,
      engagementPrediction,
    }),
    blockers: buildNextBestActionBlockers({
      action,
      qualification,
      sequence,
      executionReadiness,
    }),
    dependencies: buildNextBestActionDependencies({ action, qualification, sequence }),
    warnings: buildNextBestActionWarnings({
      qualification,
      sequence,
      engagementPrediction,
      isSuppressed,
      contactCount: input.qualificationInput?.prospectIntelligence?.contactCount,
    }),
  }
}
