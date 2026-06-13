import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAidenDailyBriefing, type AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import {
  aidenGreetingForHour,
  buildAidenPriorityRecommendations,
  buildAidenRecommendedActionSummary,
  formatAidenOperatorName,
  type AidenBriefingSignals,
} from "@/lib/growth/aiden/aiden-priority-engine"
import { listApolloPilotCohorts, loadApolloPilotCohortAnalytics } from "@/lib/growth/apollo/apollo-pilot-route"
import { buildReplyIntelligenceSummary, buildInboxDashboard } from "@/lib/growth/inbox/inbox-dashboard"
import { listInboxThreads } from "@/lib/growth/inbox/thread-repository"
import { fetchMailboxHealthDashboard } from "@/lib/growth/mailboxes/mailbox-repository"
import { listGrowthMeetingsForDashboardScan } from "@/lib/growth/meeting-intelligence/meeting-repository"
import { fetchGrowthReplyInboxDashboard } from "@/lib/growth/reply-intelligence/reply-inbox-dashboard-repository"
import { listSequenceExecutionJobs } from "@/lib/growth/sequences/execution/sequence-job-repository"

function startOfWeekIso(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfWeekIso(): string {
  const start = new Date(startOfWeekIso())
  start.setDate(start.getDate() + 7)
  return start.toISOString()
}

function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function endOfTodayIso(): string {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.toISOString()
}

async function countOpportunityDraftsPending(admin: SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("opportunity_drafts")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
  if (error) return 0
  return count ?? 0
}

async function loadPilotRevenueSnapshot(admin: SupabaseClient): Promise<AidenBriefingSignals["revenue"]> {
  const fallback: AidenBriefingSignals["revenue"] = {
    emails_sent: 0,
    replies: 0,
    meetings: 0,
    opportunities: 0,
    revenue: 0,
  }

  try {
    const cohorts = await listApolloPilotCohorts(admin)
    const active = cohorts.find((c) => c.status === "active") ?? cohorts[0]
    if (!active) return fallback
    const analytics = await loadApolloPilotCohortAnalytics(admin, active.id)
    if (!analytics?.dashboard) return fallback
    return {
      emails_sent: analytics.dashboard.emails_sent ?? 0,
      replies: analytics.dashboard.replies_received ?? 0,
      meetings: analytics.dashboard.meetings_booked ?? 0,
      opportunities: analytics.dashboard.opportunities_created ?? 0,
      revenue: analytics.dashboard.revenue_attributed ?? 0,
    }
  } catch {
    return fallback
  }
}

export async function fetchAidenDailyBriefing(
  admin: SupabaseClient,
  input: { operatorEmail?: string | null; actorUserId?: string | null },
): Promise<AidenDailyBriefing> {
  const now = Date.now()
  const weekStart = startOfWeekIso()
  const weekEnd = endOfWeekIso()

  const [
    mailboxHealth,
    replyDashboard,
    executionJobs,
    inboxThreads,
    meetingsScan,
    opportunityDraftsPending,
    revenue,
  ] = await Promise.all([
    fetchMailboxHealthDashboard(admin).catch(() => ({
      connected_count: 0,
      warning_count: 0,
      expired_count: 0,
      failed_validation_count: 0,
      average_connection_health: 0,
      qa_marker: "fallback",
    })),
    fetchGrowthReplyInboxDashboard(admin).catch(() => null),
    listSequenceExecutionJobs(admin, { limit: 200 }).catch(() => []),
    listInboxThreads(admin).catch(() => []),
    listGrowthMeetingsForDashboardScan(admin, { actorUserId: input.actorUserId ?? null }).catch(() => []),
    countOpportunityDraftsPending(admin),
    loadPilotRevenueSnapshot(admin),
  ])

  const todayStart = startOfTodayIso()
  const todayEnd = endOfTodayIso()
  const meetingsToday = meetingsScan.filter(
    (m) => m.status === "scheduled" && m.startAt && m.startAt >= todayStart && m.startAt <= todayEnd,
  ).length

  const inboxIntel = buildReplyIntelligenceSummary(inboxThreads)
  const inboxDash = buildInboxDashboard(inboxThreads)

  const openNeedsReview = inboxThreads.filter((t) =>
    ["open", "needs_review"].includes(t.thread_status),
  ).length

  const objections =
    inboxThreads.filter((t) =>
      ["competitor", "not_interested"].includes(t.classification),
    ).length + (replyDashboard?.competitorMentionCount ?? 0)

  const jobs = executionJobs
  const pendingDrafts = jobs.filter((job) => job.status === "draft").length
  const pendingJobs = jobs.filter((job) => job.status === "pending_approval").length
  const blockedJobs = jobs.filter((job) => job.status === "blocked").length
  const runningJobs = jobs.filter((job) => job.status === "running").length

  const meetingsThisWeek = meetingsScan.filter(
    (m) => m.startAt && m.startAt >= weekStart && m.startAt < weekEnd && m.status === "scheduled",
  ).length

  const signals: AidenBriefingSignals = {
    mailbox: {
      healthy_mailboxes: mailboxHealth.connected_count ?? 0,
      expired_mailboxes: mailboxHealth.expired_count ?? 0,
      warnings: (mailboxHealth.warning_count ?? 0) + (mailboxHealth.failed_validation_count ?? 0),
    },
    inbox: {
      new_replies:
        replyDashboard?.unansweredCount ??
        replyDashboard?.ownerWaitingCount ??
        openNeedsReview,
      replies_needing_attention: Math.max(
        replyDashboard?.unansweredCount ?? 0,
        replyDashboard?.ownerWaitingCount ?? 0,
        inboxDash.needs_review_count + inboxDash.open_count,
      ),
      positive_interest: inboxIntel.positive_interest,
      meeting_requests:
        inboxIntel.meeting_intent + (replyDashboard?.meetingRequestCount ?? 0),
      objections,
      unsubscribes: inboxIntel.unsubscribe,
    },
    approval_queue: {
      pending_drafts: pendingDrafts,
      pending_jobs: pendingJobs,
      blocked_jobs: blockedJobs,
      running_jobs: runningJobs,
    },
    meetings: {
      meetings_today: meetingsToday,
      meetings_this_week: meetingsThisWeek,
      opportunities_pending: opportunityDraftsPending,
    },
    revenue,
  }

  const priorities = buildAidenPriorityRecommendations(signals)
  const recommendedAction = buildAidenRecommendedActionSummary(priorities)
  const operatorName = formatAidenOperatorName(input.operatorEmail)
  const greeting = aidenGreetingForHour(new Date(now).getHours())

  return buildAidenDailyBriefing({
    operatorName,
    greeting,
    signals,
    priorities,
    recommendedAction,
  })
}
