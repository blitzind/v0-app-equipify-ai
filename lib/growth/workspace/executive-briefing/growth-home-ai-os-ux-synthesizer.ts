/** GE-AIOS-UX-1A / GE-AIOS-UX-1B — AI OS home operator experience synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import { sortLeadInboxQueue } from "@/lib/growth/lead-inbox/lead-inbox-priority"
import {
  hasCanonicalDailyWorkQueue,
  mapCanonicalQueueDisplayToHomeItems,
  mapCanonicalQueueToWaitingOnYou,
  pickTopCanonicalQueueActionItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-canonical-queue-mapper"
import type {
  GrowthHomeAiOsUxViewModel,
  GrowthHomeAutonomousReadiness,
  GrowthHomeAvaLiveStatus,
  GrowthHomeDailyWorkQueueBuckets,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeExecutiveBrief,
  GrowthHomeExecutiveBriefingHero,
  GrowthHomeMailboxDomainHealth,
  GrowthHomeNeedsReview,
  GrowthHomeThroughputMetric,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GROWTH_HOME_AI_OS_UX_QA_MARKER } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  GROWTH_HOME_KPI_AVA_CONFIDENCE,
  GROWTH_HOME_KPI_COMPLETED_FOR_YOU,
  GROWTH_HOME_KPI_NEEDS_APPROVAL,
  GROWTH_HOME_KPI_PIPELINE_IMPACT,
} from "@/lib/growth/workspace/executive-briefing/growth-home-experience-2b"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? GROWTH_WORKSPACE_BASE_PATH
}

function confidencePresentation(score: number | null): {
  confidencePercent: number | null
  confidenceLabel: string | null
} {
  if (score == null || !Number.isFinite(score) || score <= 0) {
    return { confidencePercent: null, confidenceLabel: null }
  }
  const percent = Math.round(Math.max(0, Math.min(100, score)))
  if (percent >= 85) return { confidencePercent: percent, confidenceLabel: "High Confidence" }
  if (percent >= 70) return { confidencePercent: percent, confidenceLabel: "Medium Confidence" }
  return { confidencePercent: percent, confidenceLabel: "Requires Review" }
}

function overallConfidence(dashboard: GrowthWorkspaceDashboardViewModel): {
  confidencePercent: number | null
  confidenceLabel: string | null
} {
  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const readiness = dashboard.briefing?.approval_queue
    ? Math.max(
        0,
        100 -
          (dashboard.briefing.summary.pending_approvals ?? 0) * 3 -
          (dashboard.briefing.mailbox.warnings ?? 0) * 8 -
          (dashboard.briefing.mailbox.expired_mailboxes ?? 0) * 20,
      )
    : engagementScore
  return confidencePresentation(readiness > 0 ? readiness : engagementScore)
}

function canonicalQueueBuckets(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeDailyWorkQueueBuckets | null {
  if (!hasCanonicalDailyWorkQueue(dashboard)) return null
  return dashboard.dailyRevenueWorkQueueDisplay!.bucket_counts
}

export function buildExecutiveBriefingHero(
  dashboard: GrowthWorkspaceDashboardViewModel,
  executiveBrief: GrowthHomeExecutiveBrief,
): GrowthHomeExecutiveBriefingHero {
  const briefing = dashboard.briefing
  const display = dashboard.dailyRevenueWorkQueueDisplay
  const queueEnabled = hasCanonicalDailyWorkQueue(dashboard)
  const qualifiedProspects =
    metricValue(dashboard, "my-queue", "Call-ready leads") +
    metricValue(dashboard, "my-queue", "Leads needing action")
  const repliesWaiting =
    metricValue(dashboard, "my-queue", "Inbox requiring replies") +
    (briefing?.summary.replies_needing_attention ?? 0)
  const meetingsScheduled = Math.max(
    briefing?.meetings.meetings_this_week ?? 0,
    briefing?.summary.meetings_today ?? 0,
    metricValue(dashboard, "activity", "Meetings today"),
  )
  const opportunitiesCreated = Math.max(
    briefing?.revenue.opportunities ?? 0,
    metricValue(dashboard, "pipeline-snapshot", "Open opportunities"),
  )
  const pipelineInfluence = Math.max(
    metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    metricValue(dashboard, "pipeline-snapshot", "Forecast value"),
  )
  const confidence = overallConfidence(dashboard)
  const approvalBlockedCount =
    (display?.blocked_count ?? 0) +
    (display?.waiting_count ?? 0) +
    (briefing?.summary.pending_approvals ?? 0)

  const revenueToday = [
    queueEnabled && (display?.actionable_count ?? 0) > 0
      ? {
          label: "Critical work items ready",
          value: String(display!.actionable_count),
          ...confidencePresentation(84),
        }
      : qualifiedProspects > 0
        ? {
            label: "Qualified prospects ready",
            value: String(qualifiedProspects),
            ...confidencePresentation(qualifiedProspects > 0 ? 82 : null),
          }
        : null,
    queueEnabled && approvalBlockedCount > 0
      ? {
          label: "Approvals blocking progress",
          value: String(approvalBlockedCount),
          ...confidencePresentation(78),
        }
      : repliesWaiting > 0
        ? {
            label: "Replies waiting",
            value: String(repliesWaiting),
            ...confidencePresentation(78),
          }
        : null,
    meetingsScheduled > 0
      ? {
          label: "Meetings scheduled",
          value: String(meetingsScheduled),
          ...confidencePresentation(88),
        }
      : null,
    opportunitiesCreated > 0
      ? {
          label: "Opportunities created",
          value: String(opportunitiesCreated),
          ...confidencePresentation(80),
        }
      : null,
    pipelineInfluence > 0
      ? {
          label: "Estimated pipeline influenced today",
          value: formatHomeCurrency(pipelineInfluence),
          ...confidence,
        }
      : null,
    confidence.confidencePercent != null
      ? {
          label: "Confidence level",
          value: `${confidence.confidencePercent}%`,
          confidencePercent: confidence.confidencePercent,
          confidenceLabel: confidence.confidenceLabel,
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row != null)

  const topQueueAction =
    queueEnabled && dashboard.dailyRevenueWorkQueue && display
      ? pickTopCanonicalQueueActionItem(dashboard.dailyRevenueWorkQueue, display)
      : null

  const biggestOpportunity =
    executiveBrief.biggestWin?.headline ??
    (topQueueAction
      ? `${topQueueAction.actionLabel} for ${topQueueAction.companyName}`
      : sanitizeHomeNarrative(briefing?.priorities?.[0]?.detail ?? briefing?.section_summaries.revenue ?? "") ||
        null)

  const biggestRisk =
    executiveBrief.biggestRisk?.headline ??
    (queueEnabled && (display?.blocked_count ?? 0) > 0
      ? `${display!.blocked_count} blocked work ${pluralize(display!.blocked_count, "item", "items")} need review`
      : sanitizeHomeNarrative(briefing?.section_summaries.mailbox ?? briefing?.section_summaries.inbox ?? "") ||
        null)

  const expectedOutcomeToday =
    sanitizeHomeNarrative(
      topQueueAction
        ? `Next up: ${topQueueAction.actionLabel} for ${topQueueAction.companyName} via ${topQueueAction.channelLabel}.`
        : dashboard.welcome.todaysFocus ??
            briefing?.summary.recommended_action ??
            executiveBrief.todaysPriority ??
            "",
    ) || null

  const tasksCompleted = Math.max(
    executiveBrief.completedOutcomes.length,
    metricValue(dashboard, "activity", "Emails sent today") +
      metricValue(dashboard, "activity", "Replies today") +
      metricValue(dashboard, "intelligence", "Hot companies"),
  )

  const companiesReviewed = Math.max(
    metricValue(dashboard, "intelligence", "Hot companies"),
    metricValue(dashboard, "my-queue", "Leads needing action"),
    metricValue(dashboard, "my-queue", "Call-ready leads"),
  )
  const draftsPrepared = Math.max(
    briefing?.approval_queue.pending_drafts ?? 0,
    metricValue(dashboard, "campaign-snapshot", "Approval queue"),
    metricValue(dashboard, "campaign-snapshot", "Active campaigns"),
  )

  const todayAtAGlance = [
    companiesReviewed > 0
      ? `Reviewed ${companiesReviewed} ${pluralize(companiesReviewed, "company", "companies")}`
      : null,
    draftsPrepared > 0
      ? `Prepared ${draftsPrepared} ${pluralize(draftsPrepared, "outreach draft", "outreach drafts")}`
      : null,
    approvalBlockedCount > 0
      ? `Waiting on ${approvalBlockedCount} ${pluralize(approvalBlockedCount, "approval", "approvals")}`
      : tasksCompleted > 0
        ? `Completed ${tasksCompleted} ${pluralize(tasksCompleted, "task", "tasks")} for you`
        : null,
  ].filter((line): line is string => line != null).slice(0, 3)

  const executiveKpis = [
    confidence.confidencePercent != null
      ? {
          id: "confidence",
          title: GROWTH_HOME_KPI_AVA_CONFIDENCE,
          value: `${confidence.confidencePercent}%`,
          status: confidence.confidenceLabel ?? "High confidence",
        }
      : null,
    tasksCompleted > 0
      ? {
          id: "tasks-completed",
          title: GROWTH_HOME_KPI_COMPLETED_FOR_YOU,
          value: String(tasksCompleted),
          status: "Handled automatically",
        }
      : null,
    approvalBlockedCount > 0
      ? {
          id: "needs-approval",
          title: GROWTH_HOME_KPI_NEEDS_APPROVAL,
          value: String(approvalBlockedCount),
          status: "Awaiting review",
        }
      : null,
    pipelineInfluence > 0
      ? {
          id: "revenue-influenced",
          title: GROWTH_HOME_KPI_PIPELINE_IMPACT,
          value: formatHomeCurrency(pipelineInfluence),
          status: "Estimated pipeline impact",
        }
      : null,
  ].filter((row): row is NonNullable<typeof row> => row != null)

  const opportunityAction =
    biggestOpportunity != null
      ? {
          title: biggestOpportunity,
          detail:
            executiveBrief.biggestWin?.detail ??
            (topQueueAction?.reason ? sanitizeHomeNarrative(topQueueAction.reason) : expectedOutcomeToday) ??
            "Act on the highest-impact opportunity in your queue.",
          ctaLabel: "Review now",
          ctaHref:
            topQueueAction?.href ??
            executiveBrief.primaryCta.href ??
            metricHref(dashboard, "my-queue", "Leads needing action"),
        }
      : null

  const riskAction =
    biggestRisk != null
      ? {
          title: biggestRisk,
          detail:
            executiveBrief.biggestRisk?.detail ??
            sanitizeHomeNarrative(briefing?.section_summaries.mailbox ?? briefing?.section_summaries.inbox ?? "") ??
            "Resolve before it slows outbound or follow-up.",
          ctaLabel: "Resolve",
          ctaHref:
            (briefing?.mailbox.warnings ?? 0) > 0 || (briefing?.mailbox.expired_mailboxes ?? 0) > 0
              ? "/growth/settings/communications/mailboxes"
              : executiveBrief.secondaryCta.href,
        }
      : null

  return {
    greeting: executiveBrief.greeting,
    introLine: queueEnabled
      ? "Here's my prioritized workday from the canonical revenue queue."
      : "Here's what I've been working on.",
    todayAtAGlance,
    revenueToday,
    executiveKpis,
    biggestOpportunity,
    biggestRisk,
    opportunityAction,
    riskAction,
    expectedOutcomeToday,
    overallConfidencePercent: confidence.confidencePercent,
    overallConfidenceLabel: confidence.confidenceLabel,
  }
}

function mapInboxPriority(
  priority: GrowthLeadInboxRow["candidate_priority"],
): GrowthHomeDailyWorkQueueItem["priority"] {
  if (priority === "urgent") return "critical"
  if (priority === "high") return "high"
  if (priority === "low") return "low"
  return "medium"
}

export function buildDailyWorkQueueItems(
  dashboard: GrowthWorkspaceDashboardViewModel,
): GrowthHomeDailyWorkQueueItem[] {
  if (hasCanonicalDailyWorkQueue(dashboard) && dashboard.dailyRevenueWorkQueueDisplay) {
    return mapCanonicalQueueDisplayToHomeItems(dashboard.dailyRevenueWorkQueueDisplay)
  }

  return []
}

export function buildAvaLiveStatus(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAvaLiveStatus | null {
  const briefing = dashboard.briefing
  const items: GrowthHomeAvaLiveStatus["items"] = []

  const researching =
    metricValue(dashboard, "intelligence", "Hot companies") +
    metricValue(dashboard, "my-queue", "Leads needing action")
  if (researching > 0) {
    items.push({
      id: "researching",
      verb: "Currently researching",
      label: `${researching} ${pluralize(researching, "company", "companies")}`,
    })
  }

  const writing = Math.max(
    briefing?.approval_queue.pending_drafts ?? 0,
    metricValue(dashboard, "campaign-snapshot", "Approval queue"),
  )
  if (writing > 0) {
    items.push({
      id: "writing",
      verb: "Writing",
      label: `${writing} personalized ${pluralize(writing, "email", "emails")}`,
    })
  }

  const monitoring =
    (briefing?.inbox.new_replies ?? 0) +
    metricValue(dashboard, "my-queue", "Inbox requiring replies") +
    metricValue(dashboard, "intelligence", "Conversation alerts")
  if (monitoring > 0) {
    items.push({
      id: "monitoring",
      verb: "Monitoring",
      label: `${monitoring} ${pluralize(monitoring, "conversation", "conversations")}`,
    })
  }

  const watching = metricValue(dashboard, "intelligence", "Hot companies")
  if (watching > 0) {
    items.push({
      id: "watching",
      verb: "Watching",
      label: `${watching} buying ${pluralize(watching, "signal", "signals")}`,
    })
  }

  if (items.length === 0) return null

  const learningLabel =
    (briefing?.revenue.replies ?? 0) > 0 || (briefing?.revenue.emails_sent ?? 0) > 0
      ? "Processing campaign outcomes"
      : null

  const runningJobs = briefing?.approval_queue.running_jobs ?? 0
  const runtimeNote =
    runningJobs > 0
      ? `${runningJobs} background ${pluralize(runningJobs, "job", "jobs")} in progress`
      : null

  return { items, learningLabel, runtimeNote }
}

export function buildThroughputMetrics(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeThroughputMetric[] {
  const briefing = dashboard.briefing
  const rows: GrowthHomeThroughputMetric[] = []

  const push = (id: string, label: string, value: number, hrefLabel: string, sectionId: string) => {
    if (value <= 0) return
    rows.push({
      id,
      label,
      value: String(value),
      href: metricHref(dashboard, sectionId, hrefLabel),
    })
  }

  push(
    "researched",
    "Companies researched",
    metricValue(dashboard, "intelligence", "Hot companies") +
      metricValue(dashboard, "my-queue", "Leads needing action"),
    "Hot companies",
    "intelligence",
  )
  push(
    "contacts",
    "Contacts discovered",
    metricValue(dashboard, "my-queue", "Call-ready leads"),
    "Call-ready leads",
    "my-queue",
  )
  push(
    "verified",
    "Emails verified",
    briefing?.revenue.emails_sent ?? metricValue(dashboard, "activity", "Emails sent today"),
    "Emails sent today",
    "activity",
  )
  push(
    "sequences",
    "Sequences prepared",
    Math.max(
      briefing?.approval_queue.pending_drafts ?? 0,
      metricValue(dashboard, "campaign-snapshot", "Active campaigns"),
    ),
    "Active campaigns",
    "campaign-snapshot",
  )
  push(
    "replies",
    "Replies received",
    briefing?.revenue.replies ?? metricValue(dashboard, "activity", "Replies today"),
    "Replies today",
    "activity",
  )
  push(
    "meetings",
    "Meetings booked",
    Math.max(briefing?.meetings.meetings_this_week ?? 0, metricValue(dashboard, "activity", "Meetings today")),
    "Meetings today",
    "activity",
  )
  push(
    "opportunities",
    "Opportunities created",
    Math.max(briefing?.revenue.opportunities ?? 0, metricValue(dashboard, "pipeline-snapshot", "Open opportunities")),
    "Open opportunities",
    "pipeline-snapshot",
  )

  const pipeline = Math.max(
    metricValue(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    metricValue(dashboard, "pipeline-snapshot", "Forecast value"),
  )
  if (pipeline > 0) {
    rows.push({
      id: "pipeline",
      label: "Pipeline influenced",
      value: formatHomeCurrency(pipeline),
      href: metricHref(dashboard, "pipeline-snapshot", "Weighted pipeline"),
    })
  }

  return rows
}

export function buildMailboxDomainHealth(
  dashboard: GrowthWorkspaceDashboardViewModel,
): GrowthHomeMailboxDomainHealth | null {
  const mailbox = dashboard.briefing?.mailbox
  if (!mailbox) return null

  const total = mailbox.healthy_mailboxes + mailbox.expired_mailboxes + mailbox.warnings
  if (total <= 0 && !dashboard.briefing?.section_summaries.mailbox) return null

  return {
    mailboxPool: {
      healthy: mailbox.healthy_mailboxes,
      warming: 0,
      paused: mailbox.expired_mailboxes,
      warning: mailbox.warnings,
      expired: mailbox.expired_mailboxes,
    },
    domainHealth: {
      spf: null,
      dkim: null,
      dmarc: null,
      mx: null,
      warmupPercent: null,
      dailyUtilization:
        (dashboard.briefing?.revenue.emails_sent ?? 0) > 0
          ? `${dashboard.briefing?.revenue.emails_sent} sends today`
          : null,
    },
    summary: sanitizeHomeNarrative(dashboard.briefing?.section_summaries.mailbox ?? null),
    href: "/growth/settings/communications/mailboxes",
  }
}

export function buildAutonomousReadiness(
  dashboard: GrowthWorkspaceDashboardViewModel,
): GrowthHomeAutonomousReadiness | null {
  const briefing = dashboard.briefing
  if (!briefing) return null

  const blocked =
    (briefing.mailbox.expired_mailboxes ?? 0) > 0 ||
    (briefing.summary.blocked_jobs ?? 0) > 0 ||
    (briefing.summary.pending_approvals ?? 0) > 0 ||
    (dashboard.dailyRevenueWorkQueueDisplay?.blocked_count ?? 0) > 0

  const readiness = overallConfidence(dashboard)

  return {
    mode: "Human Approval",
    executionReadinessPercent: readiness.confidencePercent,
    executionReadinessLabel: readiness.confidenceLabel,
    guardrails: "Active",
    killSwitch: blocked ? "Hold — review required" : "Ready",
  }
}

export function buildWaitingOnYouFromDashboard(
  dashboard: GrowthWorkspaceDashboardViewModel,
  fallback: GrowthHomeWaitingOnYouItem[],
): GrowthHomeWaitingOnYouItem[] {
  if (
    hasCanonicalDailyWorkQueue(dashboard) &&
    dashboard.dailyRevenueWorkQueue &&
    dashboard.dailyRevenueWorkQueueDisplay
  ) {
    return mapCanonicalQueueToWaitingOnYou(
      dashboard.dailyRevenueWorkQueue,
      dashboard.dailyRevenueWorkQueueDisplay,
    )
  }
  return fallback
}

export function buildAiOsUxViewModel(input: {
  dashboard: GrowthWorkspaceDashboardViewModel
  executiveBrief: GrowthHomeExecutiveBrief
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  waitingOnYouOverflow: number
  needsReview: GrowthHomeNeedsReview
}): GrowthHomeAiOsUxViewModel {
  const waitingOnYou = buildWaitingOnYouFromDashboard(input.dashboard, input.waitingOnYou)
  const queueEnabled = hasCanonicalDailyWorkQueue(input.dashboard)
  const approveItemsCount = queueEnabled
    ? (input.dashboard.dailyRevenueWorkQueueDisplay?.blocked_count ?? 0) +
      (input.dashboard.dailyRevenueWorkQueueDisplay?.waiting_count ?? 0) +
      waitingOnYou.filter((item) => /approve/i.test(item.label)).length
    : Math.max(
        input.dashboard.briefing?.summary.pending_approvals ?? 0,
        input.needsReview.totalCount,
        waitingOnYou.length,
      )

  return {
    qaMarker: GROWTH_HOME_AI_OS_UX_QA_MARKER,
    hero: buildExecutiveBriefingHero(input.dashboard, input.executiveBrief),
    waitingOnYou,
    waitingOnYouOverflow: Math.max(0, waitingOnYou.length - 5),
    approveItemsHref:
      waitingOnYou[0]?.href ??
      input.needsReview.reviewHref ??
      `${GROWTH_WORKSPACE_BASE_PATH}/campaigns/sequences`,
    approveItemsCount,
    liveStatus: buildAvaLiveStatus(input.dashboard),
    dailyWorkQueueBuckets: canonicalQueueBuckets(input.dashboard),
    dailyWorkQueue: buildDailyWorkQueueItems(input.dashboard),
    throughput: buildThroughputMetrics(input.dashboard),
    mailboxDomainHealth: buildMailboxDomainHealth(input.dashboard),
    autonomousReadiness: buildAutonomousReadiness(input.dashboard),
  }
}

export function buildLeadInboxHighlightsFromSections(
  sections: Array<{ id: string; items: unknown[] }>,
): GrowthWorkspaceDashboardViewModel["leadInboxHighlights"] {
  const rows: GrowthLeadInboxRow[] = []
  for (const section of sections) {
    for (const item of section.items) {
      if (!item || typeof item !== "object") continue
      const row = item as Partial<GrowthLeadInboxRow>
      if (!row.id || !row.company_name) continue
      rows.push(item as GrowthLeadInboxRow)
    }
  }

  return sortLeadInboxQueue(rows)
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      companyName: row.company_name,
      actionLabel:
        row.human_review_required
          ? "Human review"
          : row.pipeline_status === "running"
            ? "Research in progress"
            : row.candidate_reasoning[0] ?? "Review candidate",
      priority: mapInboxPriority(row.candidate_priority),
      href: `/growth/lead-inbox?candidate=${encodeURIComponent(row.id)}`,
      confidence: row.candidate_confidence > 1 ? row.candidate_confidence : row.candidate_confidence * 100,
    }))
}
