/**
 * GE-AIOS-SDR-2A — Ava Daily Revenue Work Queue artifact (client-safe).
 * Operational runtime — consumes IRE stack + Communication Strategy only.
 */

import type {
  CommunicationStrategy,
  CommunicationStrategyRecommendedAction,
  CommunicationStrategyTouchHistory,
} from "@/lib/growth/contact-verification/communication-strategy-types"
import type { NextBestAction } from "@/lib/growth/contact-verification/next-best-action-types"
import type { ProspectQualification } from "@/lib/growth/contact-verification/prospect-qualification-types"
import type { RevenueExecutionPlan } from "@/lib/growth/contact-verification/revenue-execution-plan-types"
import type { SequenceRecommendation } from "@/lib/growth/contact-verification/sequence-recommendation-types"

export const GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER = "daily-revenue-work-queue-v1" as const

export const GROWTH_DAILY_WORK_QUEUE_LEARNING_EVENT = "daily_work_queue.item_completed" as const

export type DailyRevenueWorkQueueVersion = 1

export type WorkQueuePriority = "critical" | "high" | "medium" | "low"

export type WorkQueueDisposition = WorkQueuePriority | "waiting" | "blocked" | "completed"

export type WorkQueueItem = {
  leadId: string
  companyId: string
  priority: WorkQueueDisposition
  action: CommunicationStrategyRecommendedAction
  communicationStrategy: Pick<
    CommunicationStrategy,
    "primaryChannel" | "recommendedAction" | "confidence" | "requiresHumanApproval"
  >
  recommendedChannel: CommunicationStrategy["primaryChannel"]
  estimatedMinutes: number
  confidence: number
  requiresHumanApproval: boolean
  dueAt: string | null
  reasoning: string[]
  sortScore: number
  taskKey: string
}

export type DailyRevenueWorkQueueChannelLimits = {
  email?: number
  phone?: number
  voice_drop?: number
  sms?: number
  linkedin?: number
  video?: number
  meeting?: number
}

export type DailyRevenueWorkQueueCapacityLimits = {
  dailyCapacityMinutes?: number
  suggestedDailyItemCount?: number
  channelLimits?: DailyRevenueWorkQueueChannelLimits
  mailboxDailyLimit?: number
  warmupDailyLimit?: number
  campaignDailyLimit?: number
}

export type DailyRevenueWorkQueueWorkingHours = {
  startHour?: number
  endHour?: number
  timezone?: string
}

export type DailyRevenueWorkQueueCampaignState = {
  active?: boolean
  enrollmentBlocked?: boolean
  campaignId?: string | null
}

export type DailyRevenueWorkQueueInboxState = {
  unreadReplies?: number
  needsAction?: boolean
  threadId?: string | null
}

export type DailyRevenueWorkQueueReplyIntelligence = {
  positiveReply?: boolean
  negativeReply?: boolean
  intent?: string | null
  priority?: string | null
}

export type DailyRevenueWorkQueueMeetingState = {
  meetingToday?: boolean
  meetingScheduledAt?: string | null
  followUpDue?: boolean
}

export type DailyRevenueWorkQueueExistingTask = {
  taskKey: string
  status?: "pending" | "completed" | "cancelled"
}

export type DailyRevenueWorkQueueCandidate = {
  leadId: string
  companyId: string
  qualification: ProspectQualification
  sequenceRecommendation: SequenceRecommendation
  nextBestAction: NextBestAction
  revenueExecutionPlan: RevenueExecutionPlan
  communicationStrategy: CommunicationStrategy
  campaignState?: DailyRevenueWorkQueueCampaignState
  inboxState?: DailyRevenueWorkQueueInboxState
  replyIntelligence?: DailyRevenueWorkQueueReplyIntelligence
  meetingState?: DailyRevenueWorkQueueMeetingState
  touchHistory?: CommunicationStrategyTouchHistory
  existingTasks?: DailyRevenueWorkQueueExistingTask[]
  suppressed?: boolean
  completedToday?: boolean
  assignedOwnerId?: string | null
}

export type DailyRevenueWorkQueue = {
  version: DailyRevenueWorkQueueVersion
  qa_marker: typeof GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER
  generatedAt: string
  totalAccounts: number
  estimatedWorkloadMinutes: number
  suggestedDailyCapacity: number
  channelAllocation: Record<string, number>
  critical: WorkQueueItem[]
  high: WorkQueueItem[]
  medium: WorkQueueItem[]
  low: WorkQueueItem[]
  waiting: WorkQueueItem[]
  blocked: WorkQueueItem[]
  completed: WorkQueueItem[]
}

export const DEFAULT_DAILY_REVENUE_WORK_QUEUE_CHANNEL_LIMITS: DailyRevenueWorkQueueChannelLimits = {
  email: 18,
  phone: 7,
  voice_drop: 3,
  sms: 5,
  linkedin: 10,
  meeting: 2,
}

export const DEFAULT_DAILY_REVENUE_WORK_QUEUE_CAPACITY: DailyRevenueWorkQueueCapacityLimits = {
  dailyCapacityMinutes: 480,
  suggestedDailyItemCount: 35,
  channelLimits: DEFAULT_DAILY_REVENUE_WORK_QUEUE_CHANNEL_LIMITS,
  mailboxDailyLimit: 18,
  warmupDailyLimit: 12,
  campaignDailyLimit: 50,
}
