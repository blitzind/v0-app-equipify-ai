/**
 * GE-IRE-8B — Native Revenue Execution Planner.
 * Consumes AcquisitionCandidate (7A) → ProspectQualification (7B) → SequenceRecommendation (7C) → NextBestAction (7D).
 * Read-only. Never executes — plans only.
 */

import {
  buildNextBestAction,
  type NextBestActionEngineDependencies,
  type NextBestActionEngineInput,
} from "@/lib/growth/contact-verification/next-best-action-engine"
import type { NextBestAction, NextBestActionType } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import {
  GROWTH_REVENUE_EXECUTION_PLAN_QA_MARKER,
  REVENUE_EXECUTION_PLAN_DURATION_MINUTES,
  type ExecutionStep,
  type RevenueExecutionMode,
  type RevenueExecutionPlan,
  type RevenueExecutionState,
  type RevenueRecommendedWorkflow,
} from "@/lib/growth/contact-verification/revenue-execution-plan-types"

export { GROWTH_REVENUE_EXECUTION_PLAN_QA_MARKER, REVENUE_EXECUTION_PLAN_DURATION_MINUTES }

export type RevenueExecutionPlanEngineInput = NextBestActionEngineInput & {
  nextBestAction?: NextBestAction
  qualification?: ProspectQualification
  sequenceRecommendation?: SequenceRecommendation
}

export type RevenueExecutionPlanEngineDependencies = NextBestActionEngineDependencies & {
  buildNextBestAction?: typeof buildNextBestAction
}

/**
 * Workflow mapping (REP v1) — NextBestAction → recommendedWorkflow.
 *
 * enroll_sequence        → sequence_enrollment
 * verify_contact         → verification
 * research_company       → research
 * identify_decision_maker → research
 * manual_review          → manual_review
 * monitor_buying_signals → monitor
 * disqualify             → manual_review
 */
export function resolveRecommendedWorkflow(
  action: NextBestActionType,
): RevenueRecommendedWorkflow {
  switch (action) {
    case "enroll_sequence":
      return "sequence_enrollment"
    case "verify_contact":
      return "verification"
    case "research_company":
    case "identify_decision_maker":
      return "research"
    case "monitor_buying_signals":
      return "monitor"
    case "disqualify":
    case "manual_review":
    default:
      return "manual_review"
  }
}

/**
 * Execution state (REP v1) — mirrors NextBestAction executionReadiness.
 */
export function resolveExecutionState(
  nextBestAction: NextBestAction,
): RevenueExecutionState {
  return nextBestAction.executionReadiness
}

/**
 * Execution mode (REP v1) — deterministic precedence:
 *
 * 1. human_review — disqualify, manual_review, blocked qualification/sequence, blocked readiness
 * 2. approval_required — verify path, missing verification before enrollment, high-risk enrollment
 * 3. ready_for_execution — enroll_sequence + ready + verified contact + no blockers
 */
export function resolveExecutionMode(input: {
  nextBestAction: NextBestAction
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): RevenueExecutionMode {
  const { nextBestAction: nba, qualification, sequence } = input
  const acquisition = qualification.acquisitionCandidate

  if (
    nba.action === "disqualify" ||
    nba.action === "manual_review" ||
    qualification.qualification === "blocked" ||
    qualification.qualification === "disqualified" ||
    sequence.enrollmentReadiness === "blocked" ||
    sequence.enrollmentReadiness === "do_not_enroll" ||
    nba.executionReadiness === "blocked"
  ) {
    return "human_review"
  }

  if (
    nba.action === "verify_contact" ||
    !acquisition.verification.emailVerified ||
    acquisition.verification.deliverability === "unknown" ||
    acquisition.verification.deliverability === "risky" ||
    sequence.enrollmentReadiness === "needs_verification" ||
    nba.dependencies.some((dep) => dep.toLowerCase().includes("verif"))
  ) {
    return "approval_required"
  }

  if (
    nba.action === "enroll_sequence" &&
    nba.executionReadiness === "ready" &&
    acquisition.verification.emailVerified &&
    sequence.enrollmentReadiness === "ready" &&
    nba.blockers.length === 0
  ) {
    return "ready_for_execution"
  }

  if (
    nba.action === "enroll_sequence" ||
    nba.action === "research_company" ||
    nba.action === "identify_decision_maker"
  ) {
    return "approval_required"
  }

  if (nba.action === "monitor_buying_signals") {
    return "ready_for_execution"
  }

  return "human_review"
}

function step(
  order: number,
  id: string,
  label: string,
  description: string,
  estimatedMinutes: number,
  status: ExecutionStep["status"] = "pending",
): ExecutionStep {
  return { order, id, label, description, estimatedMinutes, status }
}

/**
 * Execution step generation (REP v1) — deterministic step lists per workflow.
 */
export function buildExecutionSteps(input: {
  workflow: RevenueRecommendedWorkflow
  nextBestAction: NextBestAction
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): ExecutionStep[] {
  const { workflow, nextBestAction: nba, qualification, sequence } = input
  const acquisition = qualification.acquisitionCandidate
  const verified = acquisition.verification.emailVerified
  const steps: ExecutionStep[] = []

  if (workflow === "verification") {
    steps.push(
      step(1, "verify_email", "Verify email", "Run native email verification on primary contact", 3),
      step(2, "confirm_deliverability", "Confirm deliverability", "Review deliverability and verification confidence", 2),
      step(3, "review_results", "Review verification results", "Operator confirms verification outcome before outreach", 2),
    )
    return steps
  }

  if (workflow === "research") {
    steps.push(
      step(1, "research_company", "Research company", "Gather company intelligence and fit signals", 8),
      step(
        2,
        "identify_decision_maker",
        "Confirm decision maker",
        "Validate economic buyer and committee coverage",
        5,
      ),
      step(3, "assess_readiness", "Assess outreach readiness", "Review qualification and sequence prerequisites", 2),
    )
    if (nba.action === "identify_decision_maker") {
      steps[1] = step(
        2,
        "identify_decision_maker",
        "Identify decision maker",
        "Locate and validate economic buyer contact",
        7,
        "pending",
      )
    }
    return steps
  }

  if (workflow === "monitor") {
    steps.push(
      step(1, "monitor_signals", "Monitor buying signals", "Track engagement and buying committee activity", 1),
      step(2, "review_engagement", "Review engagement trends", "Assess nurture timing and signal changes", 1),
    )
    return steps
  }

  if (workflow === "manual_review") {
    steps.push(
      step(1, "review_blockers", "Review blockers", "Operator reviews blockers and qualification risks", 8),
      step(2, "resolve_conflicts", "Resolve conflicts", "Address suppression, compliance, or data conflicts", 7),
      step(3, "determine_next_step", "Determine next step", "Decide whether to proceed, nurture, or disqualify", 5),
    )
    return steps
  }

  // sequence_enrollment
  if (!verified) {
    steps.push(
      step(1, "verify_email", "Verify email", "Verify primary contact email before enrollment", 3, "pending"),
    )
  }
  steps.push(
    step(
      steps.length + 1,
      "confirm_decision_maker",
      "Confirm decision maker",
      `Validate ${acquisition.primaryContact.fullName} as primary outreach contact`,
      2,
      acquisition.committee.role === "unknown" ? "pending" : "optional",
    ),
  )
  steps.push(
    step(
      steps.length + 1,
      "review_sequence",
      "Review sequence selection",
      `Confirm sequence: ${sequence.recommendedSequence.name}`,
      2,
    ),
  )
  steps.push(
    step(
      steps.length + 1,
      "obtain_enrollment_approval",
      "Obtain enrollment approval",
      "Human approval required before sequence enrollment",
      2,
    ),
  )
  steps.push(
    step(
      steps.length + 1,
      "enroll_sequence",
      "Enroll sequence",
      `Plan enrollment via ${nba.recommendedChannel} — execution not performed by planner`,
      3,
      nba.executionReadiness === "ready" ? "pending" : "blocked",
    ),
  )
  steps.push(
    step(
      steps.length + 1,
      "schedule_follow_up",
      "Schedule follow-up",
      nba.recommendedDelayHours === 0
        ? "Follow-up immediately after enrollment"
        : `Schedule follow-up in ${nba.recommendedDelayHours ?? 24} hours`,
      1,
    ),
  )
  steps.push(
    step(
      steps.length + 1,
      "monitor_engagement",
      "Monitor engagement",
      "Track opens, replies, and engagement signals post-enrollment",
      2,
    ),
  )

  return steps.map((item, index) => ({ ...item, order: index + 1 }))
}

/**
 * Approval rules (REP v1) — deterministic approvals, no execution.
 */
export function buildApprovalsRequired(input: {
  executionMode: RevenueExecutionMode
  nextBestAction: NextBestAction
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): string[] {
  const approvals: string[] = []
  const { executionMode, nextBestAction: nba, qualification, sequence } = input
  const acquisition = qualification.acquisitionCandidate

  if (executionMode === "human_review") {
    approvals.push("Operator review required before any outreach action")
  }

  if (
    !acquisition.verification.emailVerified ||
    nba.action === "verify_contact" ||
    sequence.enrollmentReadiness === "needs_verification"
  ) {
    approvals.push("Verification required before outreach")
  }

  if (nba.action === "enroll_sequence" || sequence.enrollmentReadiness === "ready") {
    approvals.push("Human approval required before enrollment")
  }

  if (nba.priority === "critical" || qualification.qualification === "blocked") {
    approvals.push("Manager approval for high-risk account")
  }

  if (
    acquisition.verification.deliverability === "risky" ||
    qualification.risks.some((risk) => risk.toLowerCase().includes("risk"))
  ) {
    approvals.push("Compliance review for risky deliverability")
  }

  if (executionMode === "ready_for_execution" && nba.action === "enroll_sequence") {
    // Enrollment still requires explicit approval even when ready
    if (!approvals.includes("Human approval required before enrollment")) {
      approvals.push("Human approval required before enrollment")
    }
  }

  return [...new Set(approvals)].slice(0, 6)
}

/**
 * Duration estimation (REP v1) — sum of step minutes with workflow base floor.
 */
export function estimateDurationMinutes(input: {
  workflow: RevenueRecommendedWorkflow
  executionSteps: ExecutionStep[]
}): number {
  const base = REVENUE_EXECUTION_PLAN_DURATION_MINUTES[input.workflow]
  const stepTotal = input.executionSteps.reduce((sum, item) => sum + item.estimatedMinutes, 0)
  return Math.max(base, stepTotal)
}

export function buildPlanPrerequisites(input: {
  nextBestAction: NextBestAction
  qualification: ProspectQualification
}): string[] {
  const deps = [...input.nextBestAction.dependencies]
  if (
    !input.qualification.acquisitionCandidate.verification.emailVerified &&
    !deps.some((dep) => dep.toLowerCase().includes("verif"))
  ) {
    deps.unshift("Verified email required")
  }
  if (
    input.qualification.buyingCommitteeCoverage < 40 &&
    !deps.some((dep) => dep.toLowerCase().includes("committee"))
  ) {
    deps.push("Buying committee incomplete")
  }
  return [...new Set(deps)].slice(0, 8)
}

export function buildPlanRisks(input: {
  nextBestAction: NextBestAction
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): string[] {
  const risks = [
    ...input.qualification.risks,
    ...input.sequence.risks,
    ...input.nextBestAction.warnings,
  ]
  return [...new Set(risks)].slice(0, 8)
}

export function buildPlanBlockers(input: {
  nextBestAction: NextBestAction
  qualification: ProspectQualification
  sequence: SequenceRecommendation
}): string[] {
  const blockers = [
    ...input.nextBestAction.blockers,
    ...input.qualification.blockers,
    ...input.sequence.blockers,
  ]
  return [...new Set(blockers)].slice(0, 8)
}

export function computePlanConfidence(nextBestAction: NextBestAction): number {
  return nextBestAction.confidence
}

export async function buildRevenueExecutionPlan(
  input: RevenueExecutionPlanEngineInput,
  dependencies: RevenueExecutionPlanEngineDependencies = {},
): Promise<RevenueExecutionPlan> {
  const { buildProspectQualification } = await import(
    "@/lib/growth/contact-verification/prospect-qualification-engine"
  )
  const { buildSequenceRecommendation } = await import(
    "@/lib/growth/contact-verification/sequence-recommendation-engine"
  )

  const buildQualification = dependencies.buildProspectQualification ?? buildProspectQualification
  const buildSequence = dependencies.buildSequenceRecommendation ?? buildSequenceRecommendation
  const buildNba = dependencies.buildNextBestAction ?? buildNextBestAction

  let qualification = input.qualification
  let sequence = input.sequenceRecommendation
  let nextBestAction = input.nextBestAction

  if (!qualification) {
    if (!input.qualificationInput) {
      throw new Error("qualification_or_input_required")
    }
    qualification = await buildQualification(
      {
        ...input.qualificationInput,
        companyId: input.companyId,
        generatedAt: input.generatedAt ?? input.qualificationInput.generatedAt,
        historicalLearning: input.historicalLearning,
      },
      { skipDns: true, ...dependencies },
    )
  }

  if (!sequence) {
    sequence = await buildSequence(
      {
        companyId: input.companyId,
        generatedAt: input.generatedAt ?? qualification.generatedAt,
        qualification,
        historicalLearning: input.historicalLearning,
      },
      { skipDns: true, ...dependencies },
    )
  }

  if (!nextBestAction) {
    nextBestAction = await buildNba(
      {
        companyId: input.companyId,
        generatedAt: input.generatedAt ?? qualification.generatedAt,
        qualification,
        sequenceRecommendation: sequence,
        historicalLearning: input.historicalLearning,
      },
      { skipDns: true, ...dependencies },
    )
  }

  const recommendedWorkflow = resolveRecommendedWorkflow(nextBestAction.action)
  const executionState = resolveExecutionState(nextBestAction)
  const executionMode = resolveExecutionMode({ nextBestAction, qualification, sequence })
  const executionSteps = buildExecutionSteps({
    workflow: recommendedWorkflow,
    nextBestAction,
    qualification,
    sequence,
  })
  const prerequisites = buildPlanPrerequisites({ nextBestAction, qualification })
  const approvalsRequired = buildApprovalsRequired({
    executionMode,
    nextBestAction,
    qualification,
    sequence,
  })
  const estimatedDurationMinutes = estimateDurationMinutes({ workflow: recommendedWorkflow, executionSteps })
  const confidence = computePlanConfidence(nextBestAction)
  const risks = buildPlanRisks({ nextBestAction, qualification, sequence })
  const blockers = buildPlanBlockers({ nextBestAction, qualification, sequence })

  return {
    version: 1,
    companyId: input.companyId,
    generatedAt: input.generatedAt ?? nextBestAction.generatedAt,
    executionState,
    executionMode,
    recommendedWorkflow,
    executionSteps,
    prerequisites,
    approvalsRequired,
    estimatedDurationMinutes,
    confidence,
    risks,
    blockers,
  }
}
