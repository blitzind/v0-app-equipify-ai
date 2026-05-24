/** Client-safe Growth Engine outreach queue types. */

export const GROWTH_OUTREACH_QUEUE_CHANNELS = ["email", "manual_call", "manual_follow_up"] as const
export type GrowthOutreachQueueChannel = (typeof GROWTH_OUTREACH_QUEUE_CHANNELS)[number]

export const GROWTH_OUTREACH_QUEUE_STATUSES = [
  "draft",
  "pending_approval",
  "approved",
  "scheduled",
  "executed",
  "failed",
  "cancelled",
] as const
export type GrowthOutreachQueueStatus = (typeof GROWTH_OUTREACH_QUEUE_STATUSES)[number]

export const GROWTH_OUTREACH_QUEUE_PRIORITIES = ["low", "normal", "high", "critical"] as const
export type GrowthOutreachQueuePriority = (typeof GROWTH_OUTREACH_QUEUE_PRIORITIES)[number]

export const GROWTH_OUTREACH_QUEUE_EVENT_TYPES = [
  "queued",
  "approved",
  "scheduled",
  "regenerated",
  "execution_started",
  "executed",
  "failed",
  "cancelled",
] as const
export type GrowthOutreachQueueEventType = (typeof GROWTH_OUTREACH_QUEUE_EVENT_TYPES)[number]

export type GrowthOutreachQueuePayloadSnapshot = {
  subject?: string | null
  body?: string | null
  toEmail?: string | null
  generationType?: string | null
  promptVersion?: string | null
  promptVariant?: string | null
  inputHash?: string | null
  sequenceStep?: number | null
  variantKey?: string | null
  campaignName?: string | null
  personalizationStrategyVersion?: string | null
  personalizationConfidence?: number | null
}

export type GrowthOutreachQueueItem = {
  id: string
  leadId: string
  generationId: string | null
  campaignId: string | null
  channel: GrowthOutreachQueueChannel
  status: GrowthOutreachQueueStatus
  priority: GrowthOutreachQueuePriority
  executionConfidence: number
  scheduledFor: string | null
  approvedAt: string | null
  approvedBy: string | null
  approvalNote: string | null
  executedAt: string | null
  failedAt: string | null
  failureReason: string | null
  providerConnectionId: string | null
  outboundMessageId: string | null
  payloadSnapshot: GrowthOutreachQueuePayloadSnapshot
  generationVersion: number
  parentQueueId: string | null
  sequencePatternId: string | null
  sequenceEnrollmentStepId: string | null
  createdBy: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthOutreachQueueEvent = {
  id: string
  queueId: string
  eventType: GrowthOutreachQueueEventType
  actorUserId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthOutreachQueueItemWithLead = GrowthOutreachQueueItem & {
  companyName: string
  executiveOwner: string | null
  callPriorityTier: string | null
  executivePriorityTier: string | null
  sourceVendor: string | null
}

export const GROWTH_OUTREACH_QUEUE_CHANNEL_LABELS: Record<GrowthOutreachQueueChannel, string> = {
  email: "Email",
  manual_call: "Manual call",
  manual_follow_up: "Manual follow-up",
}

export const GROWTH_OUTREACH_QUEUE_PRIORITY_LABELS: Record<GrowthOutreachQueuePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
}
