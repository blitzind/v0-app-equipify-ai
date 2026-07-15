import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER =
  "ge-aios-live-autonomy-tick-proof-1b-v1" as const

export type AutonomyTickHealthStage =
  | "initializing"
  | "organization_resolution"
  | "portfolio_snapshot"
  | "runtime_context"
  | "work_manager"
  | "asl_dry_run"
  | "lead_resolution"
  | "admission_evaluation"
  | "execution_authority"
  | "complete"

export type GrowthAiosAutonomyTickHealthSnapshot = {
  ok: boolean
  qaMarker: typeof GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER
  organizationResolved: boolean
  portfolioSnapshotBuilt: boolean
  leadCount: number
  candidateCount: number
  selectedWork: boolean
  selectedWorkType: string | null
  workflowAgent: string | null
  decisionResolved: boolean
  authorityDisposition: string | null
  wouldExecute: boolean
  outboundEnabled: boolean
  mutationPerformed: boolean
  stopReason: string | null
  admissionBlocked: boolean
}

export type AutonomyTickHealthBuildDiagnostics = {
  stage: AutonomyTickHealthStage
  organizationResolved: boolean
  portfolioSnapshotBuilt: boolean
  workSelected: boolean
  decisionResolutionStarted: boolean
  authorityEvaluationStarted: boolean
  errorClass: string | null
}

export class AutonomyTickHealthBuildError extends Error {
  readonly stage: AutonomyTickHealthStage
  readonly diagnostics: AutonomyTickHealthBuildDiagnostics

  constructor(input: {
    stage: AutonomyTickHealthStage
    diagnostics: AutonomyTickHealthBuildDiagnostics
    cause: unknown
  }) {
    const causeMessage = input.cause instanceof Error ? input.cause.message : String(input.cause)
    super(`Autonomy tick health failed at ${input.stage}: ${causeMessage}`)
    this.name = "AutonomyTickHealthBuildError"
    this.stage = input.stage
    this.diagnostics = input.diagnostics
  }
}

export type GrowthAiosAutonomyTickProofVerdict =
  | "READY_FOR_FIRST_INTERNAL_AUTONOMY_TICK"
  | "READY_AFTER_PORTFOLIO_ADMISSION"
  | "BLOCKED_BY_ADMISSION_STATE"
  | "BLOCKED_BY_EXECUTION_AUTHORITY"
  | "BLOCKED_BY_EMPTY_PORTFOLIO"
  | "BLOCKED_BY_RUNTIME_CODE_DEFECT"

export function resolveGrowthAiosAutonomyTickProofVerdict(input: {
  tickHealth: GrowthAiosAutonomyTickHealthSnapshot
  runtimeCodeDefect?: boolean
  portfolioAdmissionLeadThreshold?: number
  activeLeadCount?: number | null
}): GrowthAiosAutonomyTickProofVerdict {
  if (input.runtimeCodeDefect) {
    return "BLOCKED_BY_RUNTIME_CODE_DEFECT"
  }
  if (!input.tickHealth.organizationResolved || !input.tickHealth.portfolioSnapshotBuilt) {
    return input.runtimeCodeDefect ? "BLOCKED_BY_RUNTIME_CODE_DEFECT" : "READY_AFTER_PORTFOLIO_ADMISSION"
  }
  if (input.tickHealth.leadCount === 0) {
    return "BLOCKED_BY_EMPTY_PORTFOLIO"
  }
  if (input.tickHealth.admissionBlocked) {
    return "BLOCKED_BY_ADMISSION_STATE"
  }
  if (
    input.tickHealth.selectedWork &&
    input.tickHealth.authorityDisposition != null &&
    input.tickHealth.authorityDisposition !== "allowed"
  ) {
    return "BLOCKED_BY_EXECUTION_AUTHORITY"
  }
  if (input.tickHealth.wouldExecute && !input.tickHealth.outboundEnabled) {
    return "READY_FOR_FIRST_INTERNAL_AUTONOMY_TICK"
  }
  const threshold = input.portfolioAdmissionLeadThreshold ?? 3
  const activeLeads = input.activeLeadCount ?? input.tickHealth.leadCount
  if (activeLeads < threshold || !input.tickHealth.selectedWork) {
    return "READY_AFTER_PORTFOLIO_ADMISSION"
  }
  if (!input.tickHealth.selectedWork) {
    return "BLOCKED_BY_EMPTY_PORTFOLIO"
  }
  return "READY_AFTER_PORTFOLIO_ADMISSION"
}

/** Admission metadata may be absent on Production leads — null is valid, not blocked. */
export function resolveAdmissionBlockedFromLeadMetadata(
  metadata: Record<string, unknown> | null | undefined,
): boolean {
  const admission = resolveLeadAdmissionStateFromMetadata(metadata)
  return admission === "review" || admission === "rejected" || admission === "invalid"
}

export function resolveAutonomyTickStopReason(input: {
  selectedWork: boolean
  decisionResolved: boolean
  authorityDisposition: string | null
  authorityReasonCode?: string | null
  dryRunStopReason: string | null | undefined
}): string | null {
  if (!input.selectedWork) return "no_executable_work"

  if (input.authorityDisposition === "blocked") {
    return input.authorityReasonCode ?? "execution_authority_blocked"
  }
  if (input.authorityDisposition === "deferred") {
    return input.authorityReasonCode ?? "decision_resolution_unavailable"
  }
  if (input.authorityDisposition === "operator_required") {
    return input.authorityReasonCode ?? "operator_required"
  }

  if (!input.decisionResolved) {
    return input.authorityReasonCode ?? "decision_resolution_unavailable"
  }

  if (input.authorityDisposition != null && input.authorityDisposition !== "allowed") {
    return input.authorityReasonCode ?? input.authorityDisposition
  }

  return input.dryRunStopReason ?? null
}
