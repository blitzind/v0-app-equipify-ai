/**
 * GE-IRE-8A — Native Revenue Decision Adapter.
 * Promotes GE-IRE 7A–7D artifacts to authoritative decision sources while preserving legacy UI contracts.
 * Read-only. No execution, enrollment, or persistence.
 */

import {
  buildNextBestAction,
  type NextBestActionEngineDependencies,
} from "@/lib/growth/contact-verification/next-best-action-engine"
import type { NextBestAction, NextBestActionType } from "@/lib/growth/contact-verification/next-best-action-types"
import {
  buildProspectQualification,
  type ProspectQualificationEngineDependencies,
} from "@/lib/growth/contact-verification/prospect-qualification-engine"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import {
  buildSequenceRecommendation,
  type SequenceRecommendationEngineDependencies,
} from "@/lib/growth/contact-verification/sequence-recommendation-engine"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"
import {
  GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER,
  isNativeRevenueDecisionEngineEnabled,
} from "@/lib/growth/contact-verification/native-revenue-decision-feature"
import { mapProspectSearchIntelligenceToQualificationContext } from "@/lib/growth/contact-verification/prospect-qualification-view"
import { formatNextBestActionDelayLabel } from "@/lib/growth/contact-verification/next-best-action-view"
import type { GrowthAiOsOperatorRevenueRecommendation } from "@/lib/growth/aios/operator-experience/growth-ai-os-operator-experience-types"
import type {
  MeetingPrepAccountPlaybookContext,
  MeetingPrepObjective,
} from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import { MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER } from "@/lib/growth/meeting-intelligence/meeting-prep-types"
import {
  GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER,
  type ProspectSearchOperatorRecommendation,
  type ProspectSearchOperatorRecommendationsSnapshot,
} from "@/lib/growth/prospect-search/prospect-search-operator-recommendations"
import {
  GROWTH_SEQUENCE_READINESS_QA_MARKER,
  resolveAccountSequenceReadiness,
  type ProspectSearchSequenceReadiness,
  type ProspectSearchSequenceReadinessState,
  type ProspectSearchSequenceSuitabilityType,
} from "@/lib/growth/prospect-search/prospect-search-sequence-readiness"
import type { GrowthProspectSearchContactIntelligence } from "@/lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import {
  buildCommunicationStrategy,
  type CommunicationStrategyEngineInput,
} from "@/lib/growth/contact-verification/communication-strategy-engine"
import { isCommunicationStrategyEnabled } from "@/lib/growth/contact-verification/communication-strategy-feature"
import type { CommunicationStrategy } from "@/lib/growth/contact-verification/communication-strategy-types"
import type { CommunicationStrategyTouchHistory } from "@/lib/growth/contact-verification/communication-strategy-types"
import {
  adaptCommunicationStrategyToDisplaySummary,
  buildCommunicationStrategyOperatorHeadline,
} from "@/lib/growth/contact-verification/communication-strategy-view"
import { buildRevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-planner"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import type { EmailLearningObservation } from "@/lib/growth/contact-verification/email-learning"

export { GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER }

export type NativeRevenueDecisionStack = {
  acquisition: AcquisitionCandidate
  qualification: ProspectQualification
  sequence: SequenceRecommendation
  nextBestAction: NextBestAction
}

export type NativeRevenueDecisionBuildInput = {
  companyId: string
  organizationId?: string | null
  companyName?: string | null
  website?: string | null
  industry?: string | null
  companyMatchConfidence?: number | null
  isSuppressed?: boolean
  suppressionReason?: string | null
  intelligence: GrowthProspectSearchContactIntelligence
  generatedAt?: string
  touchHistory?: CommunicationStrategyTouchHistory
  historicalLearning?: EmailLearningObservation[]
}

export type NativeRevenueDecisionComparisonMetrics = {
  qa_marker: typeof GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER
  company_id: string
  legacyQualification: string
  nativeQualification: string
  legacySequence: string
  nativeSequence: string
  legacyReadiness: string
  nativeReadiness: string
  decisionAgreement: boolean
  decisionDifference: string[]
}

export type NativeRevenueDecisionDisplaySummary = {
  qa_marker: typeof GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER
  action: string
  action_label: string
  priority: string
  confidence: number
  execution_readiness: string
  recommended_channel: string
  recommended_delay_label: string
  reasons: string[]
  blockers: string[]
  warnings: string[]
  qualification: string
  overall_score: number
  sequence_name: string | null
  source: "native"
}

export type NativeRevenueDecisionAuthoritativeBundle = {
  qa_marker: typeof GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER
  company_id: string
  generated_at: string
  stack: NativeRevenueDecisionStack
  revenue_execution_plan: RevenueExecutionPlan | null
  communication_strategy: CommunicationStrategy | null
  communication_strategy_display: ReturnType<typeof adaptCommunicationStrategyToDisplaySummary> | null
  sequence_readiness: ProspectSearchSequenceReadiness
  operator_recommendations: ProspectSearchOperatorRecommendationsSnapshot
  display_summary: NativeRevenueDecisionDisplaySummary
  meeting_prep_objective: MeetingPrepObjective | null
  relationship_recommendation: string | null
  command_center_recommendation: GrowthAiOsOperatorRevenueRecommendation | null
}

export type NativeRevenueDecisionEngineDependencies = ProspectQualificationEngineDependencies &
  SequenceRecommendationEngineDependencies &
  NextBestActionEngineDependencies

function formatActionLabel(action: NextBestActionType): string {
  return action.replace(/_/g, " ")
}

function mapEnrollmentToReadinessState(
  enrollment: SequenceRecommendation["enrollmentReadiness"],
  nba: NextBestAction,
): ProspectSearchSequenceReadinessState {
  if (nba.action === "disqualify" || enrollment === "do_not_enroll") return "blocked"
  if (enrollment === "ready") return "ready"
  if (enrollment === "ready_with_review") return "ready_with_review"
  if (enrollment === "needs_verification" || nba.action === "verify_contact") {
    return "verification_required"
  }
  if (enrollment === "needs_research" || nba.action === "research_company") {
    return "research_required"
  }
  if (enrollment === "blocked" || nba.executionReadiness === "blocked") return "blocked"
  if (nba.action === "identify_decision_maker") return "insufficient_coverage"
  return "research_required"
}

function mapNativeToSequenceSuitability(
  stack: NativeRevenueDecisionStack,
): ProspectSearchSequenceSuitabilityType {
  const { nextBestAction: nba, sequence } = stack
  if (nba.action === "disqualify" || sequence.enrollmentReadiness === "do_not_enroll") {
    return "do_not_sequence"
  }
  if (nba.action === "monitor_buying_signals") return "relationship_nurture"
  if (nba.action === "research_company" || nba.action === "identify_decision_maker") {
    return "research_first"
  }
  if (nba.action === "manual_review") return "manual_review"
  if (nba.action === "verify_contact") return "manual_review"
  if (nba.recommendedChannel === "phone") return "call_first"
  if (nba.recommendedChannel === "email") return "email_first"
  return "email_first"
}

function mapNativeActionToOperatorType(
  action: NextBestActionType,
  channel: string,
): ProspectSearchOperatorRecommendation["recommendation_type"] {
  switch (action) {
    case "enroll_sequence":
      return channel === "phone" ? "call_first" : "email_first"
    case "verify_contact":
      return "verification_required"
    case "research_company":
      return "research_before_outreach"
    case "identify_decision_maker":
      return "research_operations_manager"
    case "monitor_buying_signals":
      return "relationship_nurture"
    case "manual_review":
      return "sequence_review"
    case "disqualify":
      return "avoid_outreach"
    default:
      return "sequence_review"
  }
}

function mapNativePriorityToUrgency(
  priority: NextBestAction["priority"],
): ProspectSearchOperatorRecommendation["urgency"] {
  if (priority === "critical") return "critical"
  if (priority === "high") return "high"
  if (priority === "medium") return "moderate"
  return "low"
}

function summarizeLegacyQualification(
  legacySequence: ProspectSearchSequenceReadiness,
): string {
  return `${legacySequence.readiness_state}:${legacySequence.sequence_suitability}`
}

function summarizeNativeQualification(stack: NativeRevenueDecisionStack): string {
  return `${stack.qualification.qualification}:${stack.qualification.nextAction}`
}

function summarizeLegacySequence(legacySequence: ProspectSearchSequenceReadiness): string {
  return legacySequence.suggested_sequence_type
}

function summarizeNativeSequence(stack: NativeRevenueDecisionStack): string {
  return stack.sequence.recommendedSequence.name
}

function summarizeLegacyReadiness(legacySequence: ProspectSearchSequenceReadiness): string {
  return `${legacySequence.readiness_state}@${legacySequence.readiness_score}`
}

function summarizeNativeReadiness(stack: NativeRevenueDecisionStack): string {
  return `${stack.nextBestAction.action}:${stack.nextBestAction.executionReadiness}@${stack.nextBestAction.confidence}`
}

export function adaptNativeToSequenceReadiness(
  stack: NativeRevenueDecisionStack,
  context?: {
    recommendedFirstContactId?: string | null
    recommendedFirstContactName?: string | null
  },
): ProspectSearchSequenceReadiness {
  const { qualification, sequence, nextBestAction: nba } = stack
  const readiness_state = mapEnrollmentToReadinessState(sequence.enrollmentReadiness, nba)
  const sequence_suitability = mapNativeToSequenceSuitability(stack)
  const primary = qualification.acquisitionCandidate.primaryContact

  return {
    qa_marker: GROWTH_SEQUENCE_READINESS_QA_MARKER,
    readiness_state,
    sequence_suitability,
    readiness_reasons: [...nba.reasons, ...sequence.reasons].slice(0, 6),
    blockers: [...nba.blockers, ...sequence.blockers].slice(0, 6),
    missing_requirements: nba.dependencies.slice(0, 6),
    safest_recommended_channel: nba.recommendedChannel,
    recommended_first_contact_id:
      context?.recommendedFirstContactId ?? primary.personId ?? null,
    recommended_first_contact_name:
      context?.recommendedFirstContactName ?? primary.fullName ?? null,
    suggested_sequence_type: sequence.recommendedSequence.name,
    readiness_score: Math.round(
      (sequence.confidence * 0.45 + qualification.overallScore * 0.35 + nba.confidence * 0.2),
    ),
  }
}

export function adaptNativeToOperatorRecommendations(
  stack: NativeRevenueDecisionStack,
  communicationStrategy?: CommunicationStrategy | null,
): ProspectSearchOperatorRecommendationsSnapshot {
  const { nextBestAction: nba, sequence, qualification } = stack
  const recommendation_type = mapNativeActionToOperatorType(nba.action, nba.recommendedChannel)
  const urgency = mapNativePriorityToUrgency(nba.priority)
  const title = communicationStrategy
    ? buildCommunicationStrategyOperatorHeadline(communicationStrategy)
    : formatActionLabel(nba.action)
  const delayLabel = formatNextBestActionDelayLabel(nba.recommendedDelayHours)
  const channelLabel = communicationStrategy
    ? communicationStrategy.primaryChannel.replace(/_/g, " ")
    : nba.recommendedChannel.replace(/_/g, " ")

  const top: ProspectSearchOperatorRecommendation = {
    id: `native:${nba.action}`,
    recommendation_type,
    title,
    confidence: communicationStrategy?.confidence ?? nba.confidence,
    urgency,
    evidence: (communicationStrategy?.reasoning ?? nba.reasons).slice(0, 4),
    reasoning: qualification.recommendations.slice(0, 3),
    recommended_operator_action: communicationStrategy
      ? buildCommunicationStrategyOperatorHeadline(communicationStrategy)
      : `${title} via ${channelLabel}`,
    recommended_timing: delayLabel,
    risk_notes: nba.warnings.slice(0, 3),
    contributing_signals: sequence.reasons.slice(0, 3),
    uncertainty_notes: nba.dependencies.slice(0, 2),
    blocker_explanations: nba.blockers.slice(0, 3),
    priority_score: Math.round(
      (communicationStrategy?.confidence ?? nba.confidence) +
        (urgency === "critical" ? 40 : urgency === "high" ? 25 : 10),
    ),
  }

  return {
    qa_marker: GROWTH_OPERATOR_RECOMMENDATIONS_QA_MARKER,
    recommendations: [top],
    top_recommendation: top,
    summary: top.recommended_operator_action,
    evidence_backed: true,
  }
}

export function adaptNativeToDisplaySummary(
  stack: NativeRevenueDecisionStack,
): NativeRevenueDecisionDisplaySummary {
  const { nextBestAction: nba, qualification, sequence } = stack
  return {
    qa_marker: GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER,
    action: nba.action,
    action_label: formatActionLabel(nba.action),
    priority: nba.priority,
    confidence: nba.confidence,
    execution_readiness: nba.executionReadiness,
    recommended_channel: nba.recommendedChannel,
    recommended_delay_label: formatNextBestActionDelayLabel(nba.recommendedDelayHours),
    reasons: nba.reasons.slice(0, 5),
    blockers: nba.blockers.slice(0, 5),
    warnings: nba.warnings.slice(0, 5),
    qualification: qualification.qualification,
    overall_score: qualification.overallScore,
    sequence_name: sequence.recommendedSequence.name,
    source: "native",
  }
}

export function adaptNativeToMeetingPrepObjective(
  stack: NativeRevenueDecisionStack,
): MeetingPrepObjective | null {
  const { nextBestAction: nba, qualification, acquisition } = stack
  const contactName = acquisition.primaryContact.fullName

  switch (nba.action) {
    case "enroll_sequence":
      return {
        objective: `Prepare for ${nba.recommendedChannel} outreach`,
        reasons: nba.reasons.slice(0, 2),
        evidence: [
          qualification.qualification,
          nba.recommendedSequence?.name ?? "Sequence recommended",
        ].filter(Boolean) as string[],
        priority: 92,
      }
    case "verify_contact":
      return {
        objective: "Confirm contact verification before meeting",
        reasons: ["Native qualification requires verified contact"],
        evidence: nba.dependencies.slice(0, 2),
        priority: 88,
      }
    case "identify_decision_maker":
      return {
        objective: "Identify economic buyer in meeting",
        reasons: ["Buying committee incomplete"],
        evidence: [`Committee coverage ${qualification.buyingCommitteeCoverage}%`],
        priority: 90,
      }
    case "research_company":
      return {
        objective: "Validate company fit and operational pain",
        reasons: nba.reasons.slice(0, 2),
        evidence: qualification.risks.slice(0, 2),
        priority: 85,
      }
    case "monitor_buying_signals":
      return {
        objective: "Nurture relationship — monitor buying signals",
        reasons: nba.reasons.slice(0, 2),
        evidence: [`Primary contact: ${contactName}`],
        priority: 70,
      }
    case "manual_review":
      return {
        objective: "Operator review required before next step",
        reasons: nba.blockers.length ? nba.blockers : nba.warnings,
        evidence: nba.dependencies.slice(0, 2),
        priority: 80,
      }
    case "disqualify":
      return {
        objective: "Confirm disqualification policy before meeting",
        reasons: nba.blockers.length ? nba.blockers : ["Account disqualified by native engine"],
        evidence: [qualification.qualification],
        priority: 95,
      }
    default:
      return null
  }
}

export function adaptNativeToMeetingPrepPlaybookContext(
  stack: NativeRevenueDecisionStack,
): Partial<MeetingPrepAccountPlaybookContext> {
  const objective = adaptNativeToMeetingPrepObjective(stack)
  const coverage = stack.qualification.buyingCommitteeCoverage
  let coverageStatus: MeetingPrepAccountPlaybookContext["coverageStatus"] = "Weak"
  if (coverage >= 70) coverageStatus = "Strong"
  else if (coverage >= 40) coverageStatus = "Partial"

  return {
    qa_marker: MEETING_PREP_ACCOUNT_PLAYBOOK_QA_MARKER,
    available: true,
    committeeCoverageScore: coverage,
    coverageStatus,
    committeeStrategy: stack.qualification.recommendations[0] ?? stack.nextBestAction.action,
    confidenceScore: stack.nextBestAction.confidence,
    reasoning: stack.nextBestAction.reasons[0] ?? null,
    accountLevelObjective: objective,
    committeeCoverageRisks: stack.nextBestAction.warnings.slice(0, 2).map((warning, index) => ({
      id: `native_warning_${index}`,
      label: warning,
      priority: "Medium" as const,
      reason: warning,
      source: "native_revenue_decision",
    })),
  }
}

export function adaptNativeToRelationshipRecommendation(
  stack: NativeRevenueDecisionStack,
  communicationStrategy?: CommunicationStrategy | null,
): string {
  if (communicationStrategy) {
    return buildCommunicationStrategyOperatorHeadline(communicationStrategy)
  }
  const nba = stack.nextBestAction
  const delay = formatNextBestActionDelayLabel(nba.recommendedDelayHours)
  return `${formatActionLabel(nba.action)} (${nba.priority} priority) — ${delay}`
}

export function adaptNativeToCommandCenterRecommendation(
  stack: NativeRevenueDecisionStack,
  options: {
    reviewHref?: string | null
    communicationStrategy?: CommunicationStrategy | null
  } = {},
): GrowthAiOsOperatorRevenueRecommendation {
  const nba = stack.nextBestAction
  const headline = options.communicationStrategy
    ? buildCommunicationStrategyOperatorHeadline(options.communicationStrategy)
    : formatActionLabel(nba.action)
  const reasons = options.communicationStrategy
    ? options.communicationStrategy.reasoning.slice(0, 3)
    : nba.reasons.slice(0, 3)

  return {
    id: `native-nba-${stack.qualification.companyId}`,
    headline,
    reasons,
    estimatedValue: stack.sequence.recommendedSequence.name,
    reviewHref: options.reviewHref ?? null,
    dismissible: true,
    workflowRequestId: null,
  }
}

export function buildNativeRevenueDecisionComparisonMetrics(input: {
  companyId: string
  legacySequence: ProspectSearchSequenceReadiness
  stack: NativeRevenueDecisionStack
}): NativeRevenueDecisionComparisonMetrics {
  const legacyQualification = summarizeLegacyQualification(input.legacySequence)
  const nativeQualification = summarizeNativeQualification(input.stack)
  const legacySequence = summarizeLegacySequence(input.legacySequence)
  const nativeSequence = summarizeNativeSequence(input.stack)
  const legacyReadiness = summarizeLegacyReadiness(input.legacySequence)
  const nativeReadiness = summarizeNativeReadiness(input.stack)

  const decisionDifference: string[] = []
  if (legacyQualification !== nativeQualification) {
    decisionDifference.push(`qualification:${legacyQualification}→${nativeQualification}`)
  }
  if (legacySequence !== nativeSequence) {
    decisionDifference.push(`sequence:${legacySequence}→${nativeSequence}`)
  }
  if (legacyReadiness !== nativeReadiness) {
    decisionDifference.push(`readiness:${legacyReadiness}→${nativeReadiness}`)
  }

  return {
    qa_marker: GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER,
    company_id: input.companyId,
    legacyQualification,
    nativeQualification,
    legacySequence,
    nativeSequence,
    legacyReadiness,
    nativeReadiness,
    decisionAgreement: decisionDifference.length === 0,
    decisionDifference,
  }
}

export function logNativeRevenueDecisionComparisonMetrics(
  metrics: NativeRevenueDecisionComparisonMetrics,
): void {
  console.info(JSON.stringify({ shadow: "native_revenue_decision_comparison", ...metrics }))
}

export async function buildNativeRevenueDecisionStack(
  input: NativeRevenueDecisionBuildInput,
  dependencies: NativeRevenueDecisionEngineDependencies = {},
): Promise<NativeRevenueDecisionStack | null> {
  if (!input.intelligence.has_contacts || input.intelligence.contacts.length === 0) {
    return null
  }

  const mapped = mapProspectSearchIntelligenceToQualificationContext({
    companyId: input.companyId,
    companyName: input.companyName,
    website: input.website,
    industry: input.industry,
    companyMatchConfidence: input.companyMatchConfidence,
    isSuppressed: input.isSuppressed,
    suppressionReason: input.suppressionReason,
    intelligence: input.intelligence,
  })
  if (!mapped) return null

  const buildQualification = dependencies.buildProspectQualification ?? buildProspectQualification
  const buildSequence = dependencies.buildSequenceRecommendation ?? buildSequenceRecommendation
  const buildNba = dependencies.buildNextBestAction ?? buildNextBestAction
  const historicalLearning = input.historicalLearning ?? []

  const qualification = await buildQualification(
    {
      companyId: input.companyId,
      acquisitionInput: {
        ...mapped.acquisitionInput,
        historicalLearning,
      },
      prospectIntelligence: mapped.prospectIntelligence,
      generatedAt: input.generatedAt,
      historicalLearning,
    },
    { skipDns: true, ...dependencies },
  )

  const sequence = await buildSequence(
    { companyId: input.companyId, qualification, historicalLearning },
    { skipDns: true, ...dependencies },
  )

  const nextBestAction = await buildNba(
    {
      companyId: input.companyId,
      qualification,
      sequenceRecommendation: sequence,
      historicalLearning,
    },
    { skipDns: true, ...dependencies },
  )

  return {
    acquisition: qualification.acquisitionCandidate,
    qualification,
    sequence,
    nextBestAction,
  }
}

export function buildNativeRevenueDecisionAuthoritativeBundle(input: {
  stack: NativeRevenueDecisionStack
  legacySequence?: ProspectSearchSequenceReadiness
  recommendedFirstContactId?: string | null
  recommendedFirstContactName?: string | null
  reviewHref?: string | null
  revenueExecutionPlan?: RevenueExecutionPlan | null
  communicationStrategy?: CommunicationStrategy | null
}): NativeRevenueDecisionAuthoritativeBundle {
  const sequence_readiness = adaptNativeToSequenceReadiness(input.stack, {
    recommendedFirstContactId: input.recommendedFirstContactId,
    recommendedFirstContactName: input.recommendedFirstContactName,
  })

  if (input.legacySequence) {
    const metrics = buildNativeRevenueDecisionComparisonMetrics({
      companyId: input.stack.qualification.companyId,
      legacySequence: input.legacySequence,
      stack: input.stack,
    })
    logNativeRevenueDecisionComparisonMetrics(metrics)
  }

  const communication_strategy = input.communicationStrategy ?? null
  const communication_strategy_display = communication_strategy
    ? adaptCommunicationStrategyToDisplaySummary(communication_strategy)
    : null

  return {
    qa_marker: GROWTH_NATIVE_DECISION_ENGINE_QA_MARKER,
    company_id: input.stack.qualification.companyId,
    generated_at: input.stack.nextBestAction.generatedAt,
    stack: input.stack,
    revenue_execution_plan: input.revenueExecutionPlan ?? null,
    communication_strategy,
    communication_strategy_display,
    sequence_readiness,
    operator_recommendations: adaptNativeToOperatorRecommendations(
      input.stack,
      communication_strategy,
    ),
    display_summary: adaptNativeToDisplaySummary(input.stack),
    meeting_prep_objective: adaptNativeToMeetingPrepObjective(input.stack),
    relationship_recommendation: adaptNativeToRelationshipRecommendation(
      input.stack,
      input.communicationStrategy,
    ),
    command_center_recommendation: adaptNativeToCommandCenterRecommendation(input.stack, {
      reviewHref: input.reviewHref,
      communicationStrategy: communication_strategy,
    }),
  }
}

async function buildCommunicationStrategyForStack(input: {
  stack: NativeRevenueDecisionStack
  buildInput: NativeRevenueDecisionBuildInput
  revenueExecutionPlan: RevenueExecutionPlan
}): Promise<CommunicationStrategy | null> {
  if (!isCommunicationStrategyEnabled()) return null

  const organizationId = input.buildInput.organizationId?.trim() || "equipify"
  const strategyInput: CommunicationStrategyEngineInput = {
    organizationId,
    companyId: input.stack.qualification.companyId,
    generatedAt: input.stack.nextBestAction.generatedAt,
    qualification: input.stack.qualification,
    sequenceRecommendation: input.stack.sequence,
    nextBestAction: input.stack.nextBestAction,
    revenueExecutionPlan: input.revenueExecutionPlan,
    touchHistory: input.buildInput.touchHistory,
    subjectId: input.buildInput.companyId,
    subjectType: "company",
  }

  return buildCommunicationStrategy(strategyInput)
}

export async function resolveNativeRevenueDecisionAuthoritativeBundle(input: {
  buildInput: NativeRevenueDecisionBuildInput
  legacySequenceInput?: Parameters<typeof resolveAccountSequenceReadiness>[0]
  dependencies?: NativeRevenueDecisionEngineDependencies
}): Promise<NativeRevenueDecisionAuthoritativeBundle | null> {
  if (!isNativeRevenueDecisionEngineEnabled()) return null

  const stack = await buildNativeRevenueDecisionStack(input.buildInput, input.dependencies ?? {})
  if (!stack) return null

  const legacySequence = input.legacySequenceInput
    ? resolveAccountSequenceReadiness(input.legacySequenceInput)
    : undefined

  const revenueExecutionPlan = await buildRevenueExecutionPlan(
    {
      companyId: input.buildInput.companyId,
      generatedAt: input.buildInput.generatedAt ?? stack.nextBestAction.generatedAt,
      qualification: stack.qualification,
      sequenceRecommendation: stack.sequence,
      nextBestAction: stack.nextBestAction,
    },
    { skipDns: true, ...input.dependencies },
  )

  const communicationStrategy = await buildCommunicationStrategyForStack({
    stack,
    buildInput: input.buildInput,
    revenueExecutionPlan,
  })

  const primary = stack.acquisition.primaryContact
  return buildNativeRevenueDecisionAuthoritativeBundle({
    stack,
    legacySequence,
    recommendedFirstContactId: primary.personId ?? null,
    recommendedFirstContactName: primary.fullName ?? null,
    revenueExecutionPlan,
    communicationStrategy,
  })
}

export function resolveAuthoritativeCommunicationStrategy(input: {
  nativeBundle?: NativeRevenueDecisionAuthoritativeBundle | null
}): CommunicationStrategy | null {
  if (isCommunicationStrategyEnabled() && input.nativeBundle?.communication_strategy) {
    return input.nativeBundle.communication_strategy
  }
  return null
}

export function applyNativeRevenueDecisionToContactIntelligence(
  intelligence: GrowthProspectSearchContactIntelligence,
  bundle: NativeRevenueDecisionAuthoritativeBundle,
): GrowthProspectSearchContactIntelligence {
  const top = bundle.operator_recommendations.top_recommendation
  return {
    ...intelligence,
    sequence_readiness: bundle.sequence_readiness,
    operator_assist: intelligence.operator_assist
      ? {
          ...intelligence.operator_assist,
          operator_recommendations: bundle.operator_recommendations,
        }
      : intelligence.operator_assist,
    outreach_recommendation:
      top?.recommended_operator_action ??
      intelligence.outreach_recommendation ??
      bundle.display_summary.action_label,
    native_revenue_decision: bundle.display_summary,
    native_communication_strategy: bundle.communication_strategy_display,
    native_meeting_prep_objective: bundle.meeting_prep_objective,
    native_relationship_recommendation: bundle.relationship_recommendation,
  }
}

export function resolveAuthoritativeSequenceReadiness(input: {
  legacyInput: Parameters<typeof resolveAccountSequenceReadiness>[0]
  nativeBundle?: NativeRevenueDecisionAuthoritativeBundle | null
}): ProspectSearchSequenceReadiness {
  if (isNativeRevenueDecisionEngineEnabled() && input.nativeBundle) {
    return input.nativeBundle.sequence_readiness
  }
  return resolveAccountSequenceReadiness(input.legacyInput)
}

export function resolveAuthoritativeOperatorRecommendations(input: {
  nativeBundle?: NativeRevenueDecisionAuthoritativeBundle | null
  legacyBuilder: () => ProspectSearchOperatorRecommendationsSnapshot
}): ProspectSearchOperatorRecommendationsSnapshot {
  if (isNativeRevenueDecisionEngineEnabled() && input.nativeBundle) {
    return input.nativeBundle.operator_recommendations
  }
  return input.legacyBuilder()
}
