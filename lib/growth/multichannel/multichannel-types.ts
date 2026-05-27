/** Client-safe Growth Engine multi-channel sequence types (Phase 2P). */

export const GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER = "growth-multichannel-sequences-v1" as const

export const GROWTH_MULTICHANNEL_SEQUENCES_PRIVACY_NOTE =
  "Multi-channel sequence tasks require human approval for non-email channels. No autonomous SMS, LinkedIn actions, calls, or voicemail drops."

export const GROWTH_SEQUENCE_CHANNEL_TYPES = [
  "email",
  "manual_call",
  "manual_followup",
  "linkedin_manual",
  "sms_future",
  "booking_followup",
  "voicemail_future",
] as const
export type GrowthSequenceChannelType = (typeof GROWTH_SEQUENCE_CHANNEL_TYPES)[number]

export const GROWTH_SEQUENCE_CHANNEL_TASK_STATUSES = [
  "pending",
  "approved",
  "in_progress",
  "completed",
  "skipped",
  "blocked",
  "failed",
] as const
export type GrowthSequenceChannelTaskStatus = (typeof GROWTH_SEQUENCE_CHANNEL_TASK_STATUSES)[number]

export const GROWTH_FUTURE_PLACEHOLDER_CHANNELS = ["sms_future", "voicemail_future"] as const
export type GrowthFuturePlaceholderChannel = (typeof GROWTH_FUTURE_PLACEHOLDER_CHANNELS)[number]

export type GrowthSequenceChannelTask = {
  id: string
  leadId: string
  leadLabel: string
  sequenceEnrollmentId: string
  sequenceStepId: string | null
  channel: GrowthSequenceChannelType
  status: GrowthSequenceChannelTaskStatus
  title: string
  description: string
  evidenceSnippet: string
  requiresHumanApproval: true
  approvedBy: string | null
  completedBy: string | null
  skippedBy: string | null
  bookingRecommendationId: string | null
  sequenceExecutionJobId: string | null
  callWorkspaceHref: string | null
  bookingIntelligenceHref: string | null
  scheduledFor: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export type GrowthSequenceChannelTaskEvent = {
  id: string
  taskId: string
  leadId: string | null
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  createdAt: string
}

export type GrowthChannelPerformanceSnapshot = {
  id: string
  leadId: string
  leadLabel: string
  taskId: string | null
  channel: GrowthSequenceChannelType
  metricType: string
  metricValue: number
  attributionWeight: number
  recordedAt: string
}

export type GrowthChannelRoutingRule = {
  id: string
  channel: GrowthSequenceChannelType
  label: string
  priority: number
  isActive: boolean
  requiresApproval: boolean
  isFuturePlaceholder: boolean
  matchCriteria: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthMultichannelPlanResult = {
  scanned: number
  created: number
  skippedExisting: number
  skippedEmailDelegated: number
  blockedFuture: number
  bookingFollowups: number
  failed: number
}

export type GrowthMultichannelDashboard = {
  qa_marker: typeof GROWTH_MULTICHANNEL_SEQUENCES_QA_MARKER
  channelTasksDue: number
  emailSteps: number
  callTasks: number
  linkedinManualTasks: number
  bookingFollowups: number
  blockedFutureChannels: number
  taskQueue: GrowthSequenceChannelTask[]
  channelPerformance: GrowthChannelPerformanceSnapshot[]
  routingRules: GrowthChannelRoutingRule[]
  recentEvents: GrowthSequenceChannelTaskEvent[]
}

export function maskMultichannelLeadLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Account ${leadId.slice(0, 8)}…`
}

export function channelTypeLabel(channel: GrowthSequenceChannelType): string {
  return channel.replace(/_/g, " ")
}

export function taskStatusLabel(status: GrowthSequenceChannelTaskStatus): string {
  return status.replace(/_/g, " ")
}

export function sanitizeChannelEvidenceSnippet(text: string, maxLength = 280): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}

export function isFuturePlaceholderChannel(channel: GrowthSequenceChannelType): boolean {
  return (GROWTH_FUTURE_PLACEHOLDER_CHANNELS as readonly string[]).includes(channel)
}

const CHANNEL_ATTRIBUTION_WEIGHT: Record<GrowthSequenceChannelType, number> = {
  email: 1,
  manual_call: 1.5,
  manual_followup: 1,
  linkedin_manual: 0.75,
  sms_future: 0,
  booking_followup: 2,
  voicemail_future: 0,
}

export function channelAttributionWeight(channel: GrowthSequenceChannelType): number {
  return CHANNEL_ATTRIBUTION_WEIGHT[channel] ?? 1
}
