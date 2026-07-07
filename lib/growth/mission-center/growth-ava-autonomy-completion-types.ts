/** GE-AVA-AUTONOMY-COMPLETION-RUN-1 — Async post-import completion state (client-safe). */

export const GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER =
  "ge-ava-autonomy-completion-run-1-v1" as const

export const GROWTH_AVA_AUTONOMY_COMPLETION_FEATURE_FLAG =
  "GROWTH_AVA_AUTONOMY_COMPLETION_ENABLED" as const

export const GROWTH_AVA_AUTONOMY_COMPLETION_METADATA_KEY = "ava_autonomy_completion" as const

export type GrowthAvaAutonomyCompletionLeadStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "failed"

export type GrowthAvaAutonomyCompletionLeadMetadata = {
  qa_marker: typeof GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER
  acquisitionMissionId: string
  status: GrowthAvaAutonomyCompletionLeadStatus
  registeredAt: string
  startedAt?: string | null
  completedAt?: string | null
  skipReason?: string | null
}

export type GrowthAvaAutonomyCompletionLeadSummary = {
  leadId: string
  status: GrowthAvaAutonomyCompletionLeadStatus
  workflowStatus: string | null
  opportunityIntelligenceReady: boolean
  communicationStrategyReady: boolean
  buyingCommitteeSignal: string | null
  outreachPackagePrepared: boolean
  outreachSkipReason?: string | null
  completedAt: string | null
}

export type GrowthAvaAutonomyCompletionHumanApprovalSnapshot = {
  totalPending: number
  relatedPending: number
  approvalsHref: "/growth/os/approvals"
  topItems: Array<{
    id: string
    title: string
    channel: string
    href: string | null
    leadId: string | null
  }>
}

export type GrowthMissionRuntimeAvaAutonomyCompletionState = {
  qa_marker: typeof GROWTH_AVA_AUTONOMY_COMPLETION_RUN_1_QA_MARKER
  pendingLeadIds: string[]
  completedLeadIds: string[]
  completions: Record<string, GrowthAvaAutonomyCompletionLeadSummary>
  humanApprovalCenter: GrowthAvaAutonomyCompletionHumanApprovalSnapshot | null
  lastCompletionAt: string | null
  stoppedAt: "human_approval"
}
