/** Client-safe Growth Engine multi-channel cadence types (slice 6.24A). */

export const GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER = "multi-channel-cadence-v1" as const

export const GROWTH_CADENCE_EMAIL_CHANNEL = "email" as const

export const GROWTH_CADENCE_TASK_CHANNELS = [
  "manual_call",
  "voicemail",
  "linkedin_view_profile",
  "linkedin_connect",
  "linkedin_message",
  "sms_task",
  "meeting_followup",
  "manual_task",
  "manual_follow_up",
] as const
export type GrowthCadenceTaskChannel = (typeof GROWTH_CADENCE_TASK_CHANNELS)[number]

export const GROWTH_CADENCE_TASK_STATUSES = ["open", "completed", "skipped"] as const
export type GrowthCadenceTaskStatus = (typeof GROWTH_CADENCE_TASK_STATUSES)[number]

export const GROWTH_CADENCE_TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const
export type GrowthCadenceTaskPriority = (typeof GROWTH_CADENCE_TASK_PRIORITIES)[number]

export const GROWTH_CADENCE_TASK_OUTCOMES = [
  "completed",
  "skipped",
  "no_answer",
  "left_voicemail",
  "connected",
  "interested",
  "not_interested",
  "meeting_booked",
  "followup_needed",
  "wrong_contact",
] as const
export type GrowthCadenceTaskOutcome = (typeof GROWTH_CADENCE_TASK_OUTCOMES)[number]

export const GROWTH_CADENCE_INBOX_VIEWS = [
  "due",
  "overdue",
  "by_channel",
  "completed_today",
  "skipped",
  "sequence_progress",
] as const
export type GrowthCadenceInboxView = (typeof GROWTH_CADENCE_INBOX_VIEWS)[number]

export const GROWTH_CADENCE_CHANNEL_LABELS: Record<GrowthCadenceTaskChannel | typeof GROWTH_CADENCE_EMAIL_CHANNEL, string> = {
  email: "Email",
  manual_call: "Manual Call",
  voicemail: "Voicemail",
  linkedin_view_profile: "LinkedIn View Profile",
  linkedin_connect: "LinkedIn Connect",
  linkedin_message: "LinkedIn Message",
  sms_task: "SMS Task",
  meeting_followup: "Meeting Follow-up",
  manual_task: "Manual Task",
  manual_follow_up: "Manual Follow-up",
}

export type GrowthCadenceTask = {
  id: string
  ownerUserId: string | null
  leadId: string
  opportunityId: string | null
  meetingId: string | null
  sequenceEnrollmentId: string | null
  sequenceEnrollmentStepId: string | null
  sequenceExecutionJobId: string | null
  channel: GrowthCadenceTaskChannel
  title: string
  instructions: string
  templateDraft: string | null
  suggestedSmsText: string | null
  dueAt: string | null
  status: GrowthCadenceTaskStatus
  priority: GrowthCadenceTaskPriority
  outcome: GrowthCadenceTaskOutcome | null
  skippedReason: string | null
  completedAt: string | null
  completedBy: string | null
  createdAt: string
  updatedAt: string
  companyName?: string | null
  stepOrder?: number | null
  enrollmentId?: string | null
}

export type GrowthCadenceDashboard = {
  qaMarker: typeof GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER
  dueCount: number
  overdueCount: number
  completedTodayCount: number
  skippedCount: number
  callTasksDueCount: number
  linkedinTasksDueCount: number
  meetingFollowupsDueCount: number
  channelMix: Array<{ channel: GrowthCadenceTaskChannel; count: number }>
}

export type GrowthCadenceCommandSummary = {
  qaMarker: typeof GROWTH_MULTI_CHANNEL_CADENCE_QA_MARKER
  tasksDueTodayCount: number
  overdueCadenceTasksCount: number
  callTasksDueCount: number
  linkedinTasksDueCount: number
  meetingFollowupsDueCount: number
}
