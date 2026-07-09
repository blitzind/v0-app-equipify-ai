/** GE-AIOS-10A — Normalize workspace summary facts into narrative context (no English). */

import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type {
  GrowthHomeAccomplishmentGroup,
  GrowthHomeDailyWorkQueueItem,
  GrowthHomeTimelinePeriod,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { AvaNarrativeContext, AvaNarrativeFact } from "@/lib/growth/ava-home/narrative/narrative-types"

export type BuildAvaNarrativeContextInput = {
  workspaceSummary: Pick<
    GrowthHomeWorkspaceSummaryPayload,
    "kpis" | "meetings" | "inbox" | "operatorTasks" | "avaConsole" | "dashboard" | "leadPool"
  >
  accomplishments: GrowthHomeAccomplishmentGroup[]
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  dailyWorkQueue: GrowthHomeDailyWorkQueueItem[]
  timeline: GrowthHomeTimelinePeriod[]
}

function fact(
  partial: Omit<AvaNarrativeFact, "id"> & { id?: string },
): AvaNarrativeFact {
  return {
    id: partial.id ?? `${partial.kind}:${partial.label.slice(0, 24)}`,
    kind: partial.kind,
    label: partial.label,
    detail: partial.detail ?? null,
    href: partial.href ?? null,
    count: partial.count,
    companyName: partial.companyName ?? null,
    industry: partial.industry ?? null,
    severity: partial.severity,
  }
}

function inferIndustryFromResearch(
  researchLoopSummary: GrowthHomeWorkspaceSummaryPayload["avaConsole"]["researchLoopSummary"],
): string | null {
  const names = researchLoopSummary?.leadResults
    ?.map((row) => row.companyName?.trim())
    .filter(Boolean) as string[] | undefined
  if (!names?.length) return null
  const joined = names.join(" ").toLowerCase()
  if (/medical|biomed|health|hospital|clinical/.test(joined)) return "medical equipment"
  if (/service|field|repair|maintenance/.test(joined)) return "service companies"
  return null
}

function inferBusinessUnderstanding(input: BuildAvaNarrativeContextInput): AvaNarrativeContext["businessUnderstanding"] {
  const suggested = input.workspaceSummary.avaConsole.suggestedNextAction?.toLowerCase() ?? ""
  const waitingLabels = input.waitingOnYou.map((row) => row.label.toLowerCase()).join(" ")
  const needsProfile =
    /business profile|business understanding|learn.*business|update.*profile|growth profile/i.test(
      `${suggested} ${waitingLabels}`,
    )
  const hasResearch = Boolean(input.workspaceSummary.avaConsole.researchLoopSummary?.researchCompleted)
  const hasApprovedProfile = !needsProfile && hasResearch
  return {
    hasApprovedProfile,
    hasBusinessResearch: hasResearch,
    profileIncomplete: needsProfile,
  }
}

export function buildAvaNarrativeContext(input: BuildAvaNarrativeContextInput): AvaNarrativeContext {
  const { workspaceSummary, accomplishments, waitingOnYou, dailyWorkQueue, timeline } = input
  const { kpis, meetings, inbox, operatorTasks, avaConsole } = workspaceSummary
  const research = avaConsole.researchLoopSummary

  const researched = research?.researchCompleted ?? research?.companiesReviewed ?? 0
  const qualified = research?.qualificationCompleted ?? 0
  const readyForReview = research?.readyForOutreachReview ?? 0
  const industry = inferIndustryFromResearch(research)

  const discoveries: AvaNarrativeFact[] = []
  if (researched > 0) {
    discoveries.push(
      fact({
        kind: "discovery",
        label: "researched_companies",
        count: researched,
        industry,
      }),
    )
  }
  if (qualified > 0) {
    discoveries.push(
      fact({
        kind: "discovery",
        label: "qualified_companies",
        count: qualified,
        industry,
      }),
    )
  }
  if ((research?.buyingSignalsVerified ?? 0) > 0) {
    discoveries.push(
      fact({
        kind: "discovery",
        label: "growth_signals_detected",
        count: research?.buyingSignalsVerified ?? 0,
        industry,
      }),
    )
  }

  const opportunities: AvaNarrativeFact[] = dailyWorkQueue.slice(0, 3).map((item) =>
    fact({
      kind: "opportunity",
      label: item.actionLabel,
      detail: item.reason ?? null,
      href: item.href,
      companyName: item.companyName,
      count: 1,
    }),
  )

  if (readyForReview > 0 && opportunities.length === 0) {
    const topLead = research?.leadResults?.find((row) => row.readyForOutreachReview && row.companyName)
    opportunities.push(
      fact({
        kind: "opportunity",
        label: "ready_for_outreach",
        count: readyForReview,
        companyName: topLead?.companyName ?? null,
        industry,
      }),
    )
  }

  const approvalsWaiting: AvaNarrativeFact[] = waitingOnYou
    .filter((item) => /approve|review|draft|outreach|research|qualif/i.test(item.label))
    .map((item) =>
      fact({
        kind: "approval",
        label: item.label,
        detail: item.detail,
        href: item.href,
        severity: item.severity,
      }),
    )

  if (approvalsWaiting.length === 0 && operatorTasks.pendingApprovals > 0) {
    approvalsWaiting.push(
      fact({
        kind: "approval",
        label: "pending_approvals",
        count: operatorTasks.pendingApprovals,
      }),
    )
  }

  const inboxWaiting: AvaNarrativeFact[] = []
  if (inbox.repliesNeedingAttention > 0) {
    inboxWaiting.push(
      fact({
        kind: "waiting",
        label: "inbox_replies",
        count: inbox.repliesNeedingAttention,
      }),
    )
  }

  const repliesReceived: AvaNarrativeFact[] = []
  if (kpis.repliesToday > 0) {
    repliesReceived.push(
      fact({
        kind: "reply",
        label: "replies_today",
        count: kpis.repliesToday,
      }),
    )
  }

  const meetingsBooked: AvaNarrativeFact[] = []
  if (meetings.today > 0) {
    meetingsBooked.push(
      fact({
        kind: "meeting",
        label: "meetings_today",
        count: meetings.today,
      }),
    )
  }

  const accomplishmentFacts: AvaNarrativeFact[] = []
  for (const group of accomplishments) {
    for (const item of group.items) {
      accomplishmentFacts.push(
        fact({
          kind: "accomplishment",
          label: item,
        }),
      )
    }
  }

  const risks: AvaNarrativeFact[] = []
  const businessUnderstanding = inferBusinessUnderstanding(input)
  if (businessUnderstanding.profileIncomplete) {
    risks.push(
      fact({
        kind: "risk",
        label: "business_understanding_incomplete",
        severity: 2,
      }),
    )
  }
  const mailboxWarnings = workspaceSummary.dashboard.briefing?.mailbox?.warnings ?? 0
  const expiredMailboxes = workspaceSummary.dashboard.briefing?.mailbox?.expired_mailboxes ?? 0
  if (mailboxWarnings > 0 || expiredMailboxes > 0) {
    risks.push(
      fact({
        kind: "risk",
        label: "mailbox_health",
        detail: workspaceSummary.dashboard.briefing?.section_summaries.mailbox ?? null,
        severity: 1,
      }),
    )
  }

  const missionsRunning: AvaNarrativeFact[] = []
  if (dailyWorkQueue.length > 0) {
    missionsRunning.push(
      fact({
        kind: "mission",
        label: "pipeline_mission",
        count: dailyWorkQueue.length,
      }),
    )
  } else if (avaConsole.suggestedNextAction) {
    missionsRunning.push(
      fact({
        kind: "mission",
        label: avaConsole.suggestedNextAction,
      }),
    )
  }

  const leadPool = workspaceSummary.leadPool
  if (leadPool?.has_more) {
    missionsRunning.push(
      fact({
        id: "scale:lead_pool",
        kind: "mission",
        label: "pipeline_beyond_page",
        detail:
          leadPool.total_estimated_count != null && leadPool.total_estimated_count > leadPool.visible_count
            ? `${leadPool.visible_count} visible of ~${leadPool.total_estimated_count} relationships`
            : `${leadPool.visible_count} visible; more relationships beyond this page`,
        count: leadPool.total_estimated_count ?? leadPool.visible_count,
      }),
    )
  }

  const activityTimeline: AvaNarrativeFact[] = timeline.flatMap((period) =>
    period.items.map((item, index) =>
      fact({
        id: `${period.id}:${index}`,
        kind: "general",
        label: item,
      }),
    ),
  )

  return {
    accomplishments: accomplishmentFacts,
    discoveries,
    opportunities,
    approvalsWaiting,
    inboxWaiting,
    repliesReceived,
    meetingsBooked,
    risks,
    missionsRunning,
    businessUnderstanding,
    activityTimeline,
    metrics: {
      researched,
      qualified,
      readyForReview,
      repliesToday: kpis.repliesToday,
      meetingsToday: meetings.today,
      approvalsWaiting: Math.max(kpis.approvalQueueCount, operatorTasks.pendingApprovals, waitingOnYou.length),
      hotCompanies: kpis.hotCompanies,
    },
  }
}

export function buildAvaNarrativeMetricsSnapshotFromContext(context: AvaNarrativeContext): {
  capturedAt: string
  researched: number
  qualified: number
  readyForReview: number
  repliesToday: number
  meetingsToday: number
  approvalsWaiting: number
  opportunitiesCount: number
} {
  return {
    capturedAt: new Date().toISOString(),
    researched: context.metrics.researched,
    qualified: context.metrics.qualified,
    readyForReview: context.metrics.readyForReview,
    repliesToday: context.metrics.repliesToday,
    meetingsToday: context.metrics.meetingsToday,
    approvalsWaiting: context.metrics.approvalsWaiting,
    opportunitiesCount: context.opportunities.length,
  }
}
