/**
 * GE-AIOS-SAFETY-1 — Autonomous execution guardrail decision schema (client-safe).
 * Evaluates safety only — never executes outbound work.
 */

import type { AcquisitionCandidate } from "@/lib/growth/contact-verification/contact-acquisition-types"
import type {
  CommunicationStrategy,
  CommunicationStrategyRecommendedAction,
} from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"
import type {
  DailyRevenueWorkQueueCampaignState,
  DailyRevenueWorkQueueChannelLimits,
  DailyRevenueWorkQueueExistingTask,
  WorkQueueItem,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER =
  "autonomous-execution-guardrail-v1" as const

export type AutonomousExecutionRiskLevel = "low" | "medium" | "high" | "critical"

export type AutonomousExecutionGuardrailDecision = {
  qa_marker: typeof GROWTH_AUTONOMOUS_EXECUTION_GUARDRAIL_QA_MARKER
  enabled: boolean
  allowed: boolean
  requiresApproval: boolean
  blocked: boolean
  riskLevel: AutonomousExecutionRiskLevel
  reasons: string[]
  blockers: string[]
  limitsApplied: string[]
  auditMetadata: Record<string, unknown>
}

export type AutonomousExecutionMailboxState = {
  warmed?: boolean
  dailyCap?: number
  dailyUsed?: number
  warmupCap?: number
  warmupUsed?: number
  domainCap?: number
  domainUsed?: number
  bounceRatePercent?: number
  bounceRateThreshold?: number
  spamComplaintDetected?: boolean
  healthScore?: number
  healthThreshold?: number
}

export type AutonomousExecutionCampaignState = DailyRevenueWorkQueueCampaignState & {
  sequenceDisabled?: boolean
  alreadyEnrolled?: boolean
  duplicateTouchScheduled?: boolean
  missingTemplate?: boolean
  humanApprovedSequence?: boolean
  dailyCap?: number
  dailyUsed?: number
}

export type AutonomousExecutionVolumeState = {
  orgDailyCap?: number
  orgDailyUsed?: number
  perLeadTouchCap?: number
  perLeadTouchUsed?: number
  perCompanyTouchCap?: number
  perCompanyTouchUsed?: number
  perSequenceCap?: number
  perSequenceUsed?: number
}

export type AutonomousExecutionChannelUsage = {
  limits?: DailyRevenueWorkQueueChannelLimits
  used?: Partial<Record<keyof DailyRevenueWorkQueueChannelLimits, number>>
}

export type AutonomousExecutionProviderReadiness = {
  emailReady?: boolean
  smsEnabled?: boolean
  voiceDropEnabled?: boolean
  voiceDropRecordingApproved?: boolean
  templatePresent?: boolean
  unsubscribeFooterAvailable?: boolean
  videoAssetApproved?: boolean
  videoAutonomousSendEnabled?: boolean
}

export type AutonomousExecutionApprovalState = {
  humanApprovalPending?: boolean
  humanApprovalGranted?: boolean
}

export const AUTONOMOUS_EXECUTION_CONFIDENCE_THRESHOLDS: Record<
  CommunicationStrategyRecommendedAction,
  number
> = {
  send_email: 70,
  send_sms: 80,
  launch_voice_drop: 80,
  place_call: 60,
  create_linkedin_task: 60,
  schedule_meeting: 85,
  send_video: 80,
  wait: 0,
  stop: 0,
  request_human_review: 0,
}

export type AutonomousExecutionGuardrailInput = {
  guardrailsEnabled?: boolean
  killSwitchActive?: boolean
  leadId: string
  companyId?: string | null
  action: CommunicationStrategyRecommendedAction
  channel: CommunicationStrategy["primaryChannel"]
  confidence?: number
  workQueueItem?: Pick<
    WorkQueueItem,
    "taskKey" | "priority" | "requiresHumanApproval" | "confidence" | "recommendedChannel" | "action"
  > | null
  communicationStrategy?: Pick<
    CommunicationStrategy,
    "confidence" | "requiresHumanApproval" | "recommendedAction" | "primaryChannel"
  > | null
  revenueExecutionPlan?: Pick<
    RevenueExecutionPlan,
    "confidence" | "executionState" | "approvalsRequired" | "blockers"
  > | null
  nextBestAction?: Pick<NextBestAction, "confidence" | "executionReadiness" | "blockers"> | null
  qualification?: Pick<
    ProspectQualification,
    "qualification" | "confidence" | "blockers" | "overallScore"
  > | null
  sequenceRecommendation?: Pick<
    SequenceRecommendation,
    "enrollmentReadiness" | "confidence" | "blockers"
  > | null
  acquisitionCandidate?: AcquisitionCandidate | null
  leadStatus?: GrowthLeadStatus | null
  contactEmail?: string | null
  contactPhone?: string | null
  suppressed?: boolean
  unsubscribed?: boolean
  hardBounced?: boolean
  isCustomer?: boolean
  isCompetitor?: boolean
  consentFlagPresent?: boolean
  legalBasisPresent?: boolean
  mailbox?: AutonomousExecutionMailboxState
  campaign?: AutonomousExecutionCampaignState
  channelCaps?: AutonomousExecutionChannelUsage
  volume?: AutonomousExecutionVolumeState
  providerReadiness?: AutonomousExecutionProviderReadiness
  approvalState?: AutonomousExecutionApprovalState
  existingTasks?: DailyRevenueWorkQueueExistingTask[]
  correlationId?: string
  evaluatedAt?: string
}
