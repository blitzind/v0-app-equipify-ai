/** Campaigns operator home metrics — multichannel dashboard API only (UX-AUDIT-6). Client-safe. */

import type {
  GrowthMultichannelDashboard,
  GrowthSequenceChannelTask,
} from "@/lib/growth/multichannel/multichannel-types"

export const GROWTH_CAMPAIGNS_HUB_METRICS_QA_MARKER = "growth-campaigns-hub-metrics-v1" as const

export type GrowthCampaignsHubMetricsSnapshot = {
  prospectsEnteredToday: number
  prospectsNeedFollowUp: number
  meetingsBooked: number
  campaignsNeedAttention: number
  overdueFollowUps: number
  repliesAwaitingReview: number
  runningNormally: number
  needsAttention: number
  stalledCampaigns: number
  emailsSent: number
  openRate: number
  replyRate: number
  pipelineCreated: number
  channelTasksDue: number
  taskQueue: GrowthSequenceChannelTask[]
  recentEvents: GrowthMultichannelDashboard["recentEvents"]
  routingRules: GrowthMultichannelDashboard["routingRules"]
  channelPerformance: GrowthMultichannelDashboard["channelPerformance"]
}

function isToday(iso: string): boolean {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return false
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function isOverdue(task: GrowthSequenceChannelTask): boolean {
  if (!task.scheduledFor) return false
  if (!["pending", "approved", "in_progress"].includes(task.status)) return false
  const scheduled = new Date(task.scheduledFor).getTime()
  return !Number.isNaN(scheduled) && scheduled < Date.now()
}

function deriveFromDashboard(dashboard: GrowthMultichannelDashboard): GrowthCampaignsHubMetricsSnapshot {
  const taskQueue = dashboard.taskQueue ?? []
  const recentEvents = dashboard.recentEvents ?? []
  const channelPerformance = dashboard.channelPerformance ?? []

  const overdueFollowUps = taskQueue.filter(isOverdue).length
  const repliesAwaitingReview = taskQueue.filter((task) => task.status === "pending").length
  const stalledCampaigns = taskQueue.filter((task) => ["blocked", "failed"].includes(task.status)).length
  const needsAttention = overdueFollowUps + repliesAwaitingReview + dashboard.blockedFutureChannels
  const runningNormally = Math.max(
    0,
    taskQueue.filter((task) => ["approved", "in_progress", "completed"].includes(task.status)).length -
      needsAttention,
  )

  const prospectsEnteredToday = recentEvents.filter(
    (event) => isToday(event.createdAt) && /enroll|entered|prospect/i.test(event.title + event.eventType),
  ).length

  const emailsSent = channelPerformance
    .filter((entry) => entry.channel === "email")
    .reduce((sum, entry) => sum + entry.metricValue, 0)

  const openSnapshots = channelPerformance.filter((entry) => entry.metricType.includes("open"))
  const replySnapshots = channelPerformance.filter((entry) => entry.metricType.includes("reply"))
  const openRate =
    openSnapshots.length > 0
      ? Math.round(openSnapshots.reduce((sum, entry) => sum + entry.metricValue, 0) / openSnapshots.length)
      : 0
  const replyRate =
    replySnapshots.length > 0
      ? Math.round(replySnapshots.reduce((sum, entry) => sum + entry.metricValue, 0) / replySnapshots.length)
      : 0

  const pipelineCreated = channelPerformance.reduce((sum, entry) => sum + entry.metricValue, 0)

  return {
    prospectsEnteredToday: prospectsEnteredToday || taskQueue.filter((task) => isToday(task.createdAt)).length,
    prospectsNeedFollowUp: dashboard.channelTasksDue,
    meetingsBooked: dashboard.bookingFollowups,
    campaignsNeedAttention: needsAttention + stalledCampaigns,
    overdueFollowUps,
    repliesAwaitingReview,
    runningNormally,
    needsAttention,
    stalledCampaigns,
    emailsSent: emailsSent || dashboard.emailSteps,
    openRate,
    replyRate,
    pipelineCreated,
    channelTasksDue: dashboard.channelTasksDue,
    taskQueue,
    recentEvents,
    routingRules: dashboard.routingRules ?? [],
    channelPerformance,
  }
}

const EMPTY_SNAPSHOT: GrowthCampaignsHubMetricsSnapshot = {
  prospectsEnteredToday: 0,
  prospectsNeedFollowUp: 0,
  meetingsBooked: 0,
  campaignsNeedAttention: 0,
  overdueFollowUps: 0,
  repliesAwaitingReview: 0,
  runningNormally: 0,
  needsAttention: 0,
  stalledCampaigns: 0,
  emailsSent: 0,
  openRate: 0,
  replyRate: 0,
  pipelineCreated: 0,
  channelTasksDue: 0,
  taskQueue: [],
  recentEvents: [],
  routingRules: [],
  channelPerformance: [],
}

export async function fetchGrowthCampaignsHubMetrics(
  signal?: AbortSignal,
): Promise<GrowthCampaignsHubMetricsSnapshot> {
  const response = await fetch("/api/platform/growth/multichannel/dashboard", { cache: "no-store", signal })
  const payload = (await response.json().catch(() => ({}))) as {
    ok?: boolean
    dashboard?: GrowthMultichannelDashboard
  }
  if (!response.ok || payload.ok === false || !payload.dashboard) {
    return EMPTY_SNAPSHOT
  }
  return deriveFromDashboard(payload.dashboard)
}

export {
  resolveGrowthCampaignsContinueWorkingHref,
  buildGrowthCampaignsBriefingLines,
  formatGrowthCampaignsBriefingHeadline,
  extractGrowthCampaignsOperatorFirstName,
} from "@/lib/growth/hubs/growth-campaigns-hub-briefing-utils"
