/** SR-3 Phase 7 — operator branch/wait visibility types (client-safe). */

import type { SequenceBranchDecisionOutcome } from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type { GrowthSequenceChannelEventKind } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"

export const GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER =
  "growth-sequence-branch-visibility-sr3-phase7-v1" as const

export const SR3_CONDITIONAL_E2E_QA_MARKER = "growth-sequence-conditional-e2e-sr3-phase7-v1" as const

export const SR3_CERTIFIED_PATTERN_A_KEY = "sr3-certified-email-open-branch" as const
export const SR3_CERTIFIED_PATTERN_B_KEY = "sr3-certified-share-cta-branch" as const

export type SequenceEnrollmentBranchWaitView = {
  id: string
  enrollmentStepId: string
  patternStepId: string | null
  status: string
  waitKind: string
  waitedForEvent: string | null
  waitedForSource: string | null
  timeoutAt: string | null
  startedAt: string | null
  resolvedAt: string | null
  resolutionReason: string | null
  isActive: boolean
}

export type SequenceEnrollmentBranchDecisionView = {
  id: string
  enrollmentStepId: string | null
  patternStepId: string | null
  decision: SequenceBranchDecisionOutcome
  source: string
  event: string
  outcomeDetail: string | null
  evaluatedAt: string
  edgeId: string | null
  conditionId: string | null
}

export type SequenceEnrollmentBranchTimelineEntry = {
  id: string
  occurredAt: string
  eventKind: GrowthSequenceChannelEventKind | string
  title: string
  summary: string | null
  enrollmentStepId: string | null
  evidenceRefs: string[]
}

export type SequenceEnrollmentBranchSkippedStepView = {
  enrollmentStepId: string
  stepOrder: number
  channel: string
  skipReason: string | null
}

export type SequenceEnrollmentBranchVisibilityView = {
  qaMarker: typeof GROWTH_SEQUENCE_BRANCH_VISIBILITY_QA_MARKER
  readOnly: true
  activeWaits: SequenceEnrollmentBranchWaitView[]
  branchDecisions: SequenceEnrollmentBranchDecisionView[]
  timeline: SequenceEnrollmentBranchTimelineEntry[]
  skippedSteps: SequenceEnrollmentBranchSkippedStepView[]
  evidenceRefs: string[]
  blockedAdvancementCount: number
  hasConditionalGraph: boolean
}
