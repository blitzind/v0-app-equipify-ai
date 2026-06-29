/**
 * GE-AIOS-SDR-2A — Daily revenue work queue display adapters (client-safe).
 */

import type {
  DailyRevenueWorkQueue,
  WorkQueueItem,
} from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"
import { GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER } from "@/lib/growth/daily-work-queue/daily-revenue-work-queue-types"

export type DailyRevenueWorkQueueDisplaySummary = {
  qa_marker: typeof GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER
  generated_at: string
  total_accounts: number
  actionable_count: number
  waiting_count: number
  blocked_count: number
  estimated_workload_minutes: number
  suggested_daily_capacity: number
  channel_summary: string
  bucket_counts: {
    critical: number
    high: number
    medium: number
    waiting: number
    blocked: number
  }
  top_items: Array<{
    lead_id: string
    company_id: string
    company_name: string | null
    priority: string
    action_label: string
    channel_label: string
    confidence: number
    reasoning: string
    estimated_minutes: number
    requires_human_approval: boolean
  }>
}

const ACTION_LABELS: Record<WorkQueueItem["action"], string> = {
  send_email: "Send email",
  place_call: "Place call",
  launch_voice_drop: "Launch voice drop",
  send_sms: "Send SMS",
  create_linkedin_task: "LinkedIn task",
  send_video: "Send video",
  schedule_meeting: "Schedule meeting",
  wait: "Wait",
  stop: "Stop",
  request_human_review: "Human review",
}

const CHANNEL_LABELS: Record<WorkQueueItem["recommendedChannel"], string> = {
  email: "Email",
  phone: "Phone",
  sms: "SMS",
  voice_drop: "Voice drop",
  linkedin: "LinkedIn",
  video: "Video",
  wait: "Wait",
  stop: "Stop",
  human: "Human",
}

function flattenActionable(queue: DailyRevenueWorkQueue): WorkQueueItem[] {
  return [...queue.critical, ...queue.high, ...queue.medium, ...queue.low]
}

export function adaptDailyRevenueWorkQueueToDisplaySummary(
  queue: DailyRevenueWorkQueue,
  options?: { leadCompanyNames?: Record<string, string> },
): DailyRevenueWorkQueueDisplaySummary {
  const actionable = flattenActionable(queue)
  const leadCompanyNames = options?.leadCompanyNames ?? {}
  const channelParts = Object.entries(queue.channelAllocation)
    .filter(([, count]) => count > 0)
    .map(([channel, count]) => `${count} ${CHANNEL_LABELS[channel as WorkQueueItem["recommendedChannel"]] ?? channel}`)

  return {
    qa_marker: GROWTH_DAILY_REVENUE_WORK_QUEUE_QA_MARKER,
    generated_at: queue.generatedAt,
    total_accounts: queue.totalAccounts,
    actionable_count: actionable.length,
    waiting_count: queue.waiting.length,
    blocked_count: queue.blocked.length,
    estimated_workload_minutes: queue.estimatedWorkloadMinutes,
    suggested_daily_capacity: queue.suggestedDailyCapacity,
    channel_summary: channelParts.length > 0 ? channelParts.join(" · ") : "No items scheduled",
    bucket_counts: {
      critical: queue.critical.length,
      high: queue.high.length,
      medium: queue.medium.length,
      waiting: queue.waiting.length,
      blocked: queue.blocked.length,
    },
    top_items: actionable.slice(0, 8).map((item) => ({
      lead_id: item.leadId,
      company_id: item.companyId,
      company_name: leadCompanyNames[item.leadId] ?? null,
      priority: item.priority,
      action_label: ACTION_LABELS[item.action] ?? item.action,
      channel_label: CHANNEL_LABELS[item.recommendedChannel] ?? item.recommendedChannel,
      confidence: item.confidence,
      reasoning: item.reasoning[0] ?? "",
      estimated_minutes: item.estimatedMinutes,
      requires_human_approval: item.requiresHumanApproval,
    })),
  }
}

export function buildDailyRevenueWorkQueueHeadline(queue: DailyRevenueWorkQueue): string {
  const actionable =
    queue.critical.length + queue.high.length + queue.medium.length + queue.low.length
  if (actionable === 0) return "No actionable work queued for today"
  const top = queue.critical[0] ?? queue.high[0] ?? queue.medium[0] ?? queue.low[0]
  if (!top) return `${actionable} items queued for today`
  return `${actionable} items today · Next: ${ACTION_LABELS[top.action]} (${CHANNEL_LABELS[top.recommendedChannel]})`
}
