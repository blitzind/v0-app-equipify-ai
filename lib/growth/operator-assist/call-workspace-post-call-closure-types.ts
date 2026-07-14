/** GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B — Post-call closure types (client-safe). */

import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { AdaptiveStrategyChangeDetection } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { CanonicalChannels1AChannel } from "@/lib/growth/aios/growth/growth-channels-1a-types"
import type { CallIntelligenceOutcome, CallIntelligenceScorecardPublicView } from "@/lib/growth/call-intelligence/call-intelligence-types"
import type { CallWorkspaceAiosLiveReasoningSnapshot } from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import type { NativeCallWrapupInput } from "@/lib/growth/native-dialer/native-dialer-wrapup-engine"
import type { GrowthCanonicalNextBestDecision } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"

export const GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER =
  "ge-aios-call-workspace-intelligence-2b-v1" as const

export const GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM =
  "ge-aios-call-workspace-intelligence-2b" as const

export type GrowthOutreachChannel = CanonicalChannels1AChannel

export type CallOutcomeSummary = {
  outcome: CallIntelligenceOutcome | "connected" | "no_answer" | "voicemail" | "meeting_booked"
  disposition: string | null
  overallScore: number | null
  riskLevel: string | null
  confidence: string
  operatorNotes: string | null
}

export const CALL_WORKSPACE_POST_CALL_NEXT_ACTIONS = [
  "send_promised_information",
  "send_recap",
  "schedule_next_meeting",
  "request_stakeholder_introduction",
  "prepare_demo",
  "prepare_workflow_review",
  "wait_until_agreed_date",
  "research_unresolved_question",
  "prepare_pricing_discussion",
  "prepare_proposal",
  "multi_thread",
  "pause",
  "disqualify",
  "no_action",
] as const

export type CallWorkspacePostCallNextActionKind = (typeof CALL_WORKSPACE_POST_CALL_NEXT_ACTIONS)[number]

export type NextBestAction = {
  kind: CallWorkspacePostCallNextActionKind
  label: string
  rationale: string
  confidence: number
  advancesRelationshipGoal: boolean
}

export type CallWorkspaceCommitteeSuggestion = {
  role: string
  personLabel: string | null
  signal: string
  confidence: "low" | "medium" | "high"
  reviewRequired: boolean
  canonicalPathQueued: boolean
}

export type CallWorkspaceMemoryReviewItem = {
  conclusion: string
  humanMemoryKind: string
  confidence: "low" | "medium" | "high"
  reason: string
}

export type GrowthCallWorkspacePostCallClosure = {
  qaMarker: typeof GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER
  callOutcome: CallOutcomeSummary
  meetingSummary: string
  businessConclusions: string[]
  personalConclusions: string[]
  objections: string[]
  commitments: string[]
  buyingSignals: string[]
  committeeSignals: string[]
  relationshipChange: AdaptiveProspectEvent[]
  recommendedNextAction: NextBestAction
  followUpRequired: boolean
  followUpChannel: GrowthOutreachChannel | null
  followUpReason: string | null
  operatorReviewRequired: boolean
  strategyChange: AdaptiveStrategyChangeDetection | null
  committeeSuggestions: CallWorkspaceCommitteeSuggestion[]
  memoryReviewItems: CallWorkspaceMemoryReviewItem[]
  followUpPackageId: string | null
  followUpPackageStatus: "not_required" | "pending_approval" | "blocked" | "reused_existing"
  meetingIntelligenceUpdated: boolean
  closureFingerprint: string
  /** GE-AIOS-DECISION-ENGINE-1A — authoritative next-best decision projection */
  canonicalDecision?: GrowthCanonicalNextBestDecision | null
}

export type CallWorkspacePostCallClosureInput = {
  organizationId: string
  leadId: string
  companyName: string | null
  sessionId: string
  realtimeSessionId?: string | null
  completionVersion?: number
  generatedAt: string
  liveReasoning: CallWorkspaceAiosLiveReasoningSnapshot | null
  scorecard: CallIntelligenceScorecardPublicView | null
  operatorWrapup?: NativeCallWrapupInput | null
  operatorDisposition?: string | null
  operatorNotes?: string | null
  priorApprovedPackageId?: string | null
}

export type CallWorkspacePostCallClosureSideEffects = {
  memoryWrites: number
  memoryDeduped: number
  memoryReviewPrepared: number
  adaptiveEventsEmitted: number
  committeeSuggestionsQueued: number
  strategyRefreshScheduled: boolean
  idempotentReplay: boolean
}

export type CallWorkspacePostCallClosureResult = {
  closure: GrowthCallWorkspacePostCallClosure
  sideEffects: CallWorkspacePostCallClosureSideEffects
}
