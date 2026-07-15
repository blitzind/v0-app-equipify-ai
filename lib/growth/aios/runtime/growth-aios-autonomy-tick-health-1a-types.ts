export const GROWTH_AIOS_LIVE_AUTONOMY_TICK_PROOF_1B_QA_MARKER =
  "ge-aios-live-autonomy-tick-proof-1b-v1" as const

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
