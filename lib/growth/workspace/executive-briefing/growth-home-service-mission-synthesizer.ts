/** GE-AI-9C — Service Mission synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import {
  formatHomeCurrency,
  pluralize,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type {
  GrowthHomeServiceContribution,
  GrowthHomeServiceFollowUp,
  GrowthHomeServiceHealthItem,
  GrowthHomeServiceMission,
  GrowthHomeServiceOperationalInsight,
  GrowthHomeTechnicianAwarenessItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  deriveLiveGrowthHomeCustomerAccountNames,
  hasLiveGrowthHomeRuntimeActivity,
  isGrowthHomeDemoCustomerAccountName,
} from "@/lib/growth/workspace/executive-briefing/growth-home-runtime-activity"

/** Revenue Director coordinates — Home never duplicates scheduling or dispatch engines. */
export const GROWTH_HOME_SERVICE_MISSION_ORCHESTRATION_RULE = GROWTH_REVENUE_DIRECTOR_RUNTIME_RULE

const SERVICE_MISSION_LIMIT = 3
const CALLS_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/calls`
const MEETINGS_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/meetings`

export type GrowthHomeServiceMissionInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot
}

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

function metricHref(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): string {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.href ?? CALLS_HREF
}

function deriveTotalServiceMissionCount(dashboard: GrowthWorkspaceDashboardViewModel): number {
  const briefing = dashboard.briefing
  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const meetingsToday = briefing?.summary.meetings_today ?? metricValue(dashboard, "activity", "Meetings today")
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const leadsNeedingAction = metricValue(dashboard, "my-queue", "Leads needing action")
  const blockedJobs = briefing?.approval_queue.blocked_jobs ?? briefing?.summary.blocked_jobs ?? 0
  const runningJobs = briefing?.approval_queue.running_jobs ?? 0
  return callsToday + meetingsToday + callReady + Math.min(leadsNeedingAction, 8) + blockedJobs + runningJobs
}

function deriveServiceStage(input: {
  callsToday: number
  meetingsToday: number
  repliesNeedingAttention: number
  blockedJobs: number
  runningJobs: number
}): string {
  if (input.blockedJobs > 0) return "Awaiting Customer"
  if (input.repliesNeedingAttention > 0) return "Follow-up"
  if (input.runningJobs > 0 || input.callsToday > 0) return "In Progress"
  if (input.meetingsToday > 0) return "Scheduled"
  return "Preparation"
}

export function countTotalServiceMissions(dashboard: GrowthWorkspaceDashboardViewModel): number {
  return deriveTotalServiceMissionCount(dashboard)
}

export function buildServiceMissions(input: GrowthHomeServiceMissionInput): GrowthHomeServiceMission[] {
  const { dashboard, revenueDirectorSnapshot } = input
  if (!hasLiveGrowthHomeRuntimeActivity(dashboard)) {
    return []
  }

  const briefing = dashboard.briefing
  const missions: GrowthHomeServiceMission[] = []

  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const meetingsToday = briefing?.summary.meetings_today ?? metricValue(dashboard, "activity", "Meetings today")
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const blockedJobs = briefing?.approval_queue.blocked_jobs ?? briefing?.summary.blocked_jobs ?? 0
  const runningJobs = briefing?.approval_queue.running_jobs ?? 0
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  const stage = deriveServiceStage({ callsToday, meetingsToday, repliesNeedingAttention, blockedJobs, runningJobs })
  const liveCustomers = deriveLiveGrowthHomeCustomerAccountNames(dashboard)

  for (let index = 0; index < liveCustomers.length && missions.length < SERVICE_MISSION_LIMIT; index += 1) {
    const customer = liveCustomers[index]!
    if (isGrowthHomeDemoCustomerAccountName(customer)) continue

    const missionStage =
      callsToday > 0 && index === 0
        ? "Implementation"
        : meetingsToday > 0 && index === 1
          ? "Onboarding"
          : repliesNeedingAttention > 0 && index === liveCustomers.length - 1
            ? "Adoption"
            : stage === "In Progress"
              ? "Implementation"
              : stage === "Scheduled"
                ? "Onboarding"
                : stage === "Follow-up"
                  ? "Adoption"
                  : "Onboarding"

    missions.push({
      id: `service-mission-${index}`,
      customer,
      workOrder: `ONB-${1040 + index}`,
      currentStage: missionStage,
      technician: index === 0 ? "Ava · Onboarding" : index === 1 ? "Ava · Adoption" : "Ava · Customer Growth",
      progressPercent: Math.max(20, Math.min(95, blockedJobs > 0 && index === liveCustomers.length - 1 ? 40 : 55 + index * 10)),
      blocker:
        blockedJobs > 0 && index === liveCustomers.length - 1
          ? "Awaiting kickoff confirmation"
          : repliesNeedingAttention > 0 && index === liveCustomers.length - 1
            ? "Account hasn't completed onboarding survey"
            : null,
      eta: missionStage === "Implementation" ? "This week" : missionStage === "Onboarding" ? "Today" : "Next week",
      expectedValue: formatHomeCurrency(Math.round(1200 + index * 850)),
      reviewHref: index === 1 ? MEETINGS_HREF : metricHref(dashboard, "my-queue", "Call-ready leads"),
      health: blockedJobs > 0 && index === liveCustomers.length - 1 ? "blocked" : missionStage === "In Progress" ? "healthy" : "waiting",
    })
  }

  if (callReady > 0 && missions.length < SERVICE_MISSION_LIMIT) {
    missions.push({
      id: "service-call-ready",
      customer: "New Equipify accounts",
      workOrder: `ONB-Q-${callReady}`,
      currentStage: "Onboarding",
      technician: "Ava · Customer Growth",
      progressPercent: 45,
      blocker: null,
      eta: "Next available slot",
      expectedValue: formatHomeCurrency(callReady * 650),
      reviewHref: metricHref(dashboard, "my-queue", "Call-ready leads"),
      health: "healthy",
    })
  }

  if (revenueDirectorSnapshot && missions.length < SERVICE_MISSION_LIMIT) {
    const work = revenueDirectorSnapshot.operationsDashboard?.activeWork?.[0]
    if (work) {
      missions.push({
        id: `service-rd-${work.id}`,
        customer: sanitizeHomeNarrative(work.title),
        workOrder: work.id,
        currentStage: work.category === "blocked" ? "Adoption" : "Onboarding",
        technician: "Ava · Delivery Intelligence",
        progressPercent: 50,
        blocker: work.category === "blocked" ? sanitizeHomeNarrative(work.summary) : null,
        eta: "Coordinated by Revenue Director",
        expectedValue: formatHomeCurrency(2400),
        reviewHref: work.href ?? CALLS_HREF,
        health: work.category === "blocked" ? "blocked" : "waiting",
      })
    }
  }

  return missions.slice(0, SERVICE_MISSION_LIMIT)
}

export function buildServiceHealth(input: GrowthHomeServiceMissionInput): GrowthHomeServiceHealthItem[] {
  if (!hasLiveGrowthHomeRuntimeActivity(input.dashboard)) {
    return []
  }

  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeServiceHealthItem[] = []

  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const meetingsToday = briefing?.summary.meetings_today ?? 0
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const blockedJobs = briefing?.approval_queue.blocked_jobs ?? briefing?.summary.blocked_jobs ?? 0
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0

  if (blockedJobs === 0 && relationshipAlerts <= 1) {
    items.push({
      id: "health-on-track",
      summary: "Onboarding pipeline is on track.",
      evidence: `${callsToday + meetingsToday} ${pluralize(callsToday + meetingsToday, "account touchpoint", "account touchpoints")} this week.`,
    })
  }

  if (callReady >= 4 || callsToday + meetingsToday >= 4) {
    items.push({
      id: "health-overloaded",
      summary: "One onboarding cohort needs extra attention.",
      evidence: `${callReady} new ${pluralize(callReady, "account", "accounts")} entering onboarding.`,
    })
  }

  if (repliesNeedingAttention > 0 || blockedJobs > 0) {
    items.push({
      id: "health-awaiting-confirmation",
      summary: `${Math.max(repliesNeedingAttention, blockedJobs)} Equipify ${pluralize(Math.max(repliesNeedingAttention, blockedJobs), "account", "accounts")} ${Math.max(repliesNeedingAttention, blockedJobs) === 1 ? "needs" : "need"} onboarding follow-up.`,
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox and approval queue read models."),
    })
  }

  if (relationshipAlerts > 0 || blockedJobs > 0) {
    items.push({
      id: "health-sla-risk",
      summary: `${Math.max(relationshipAlerts, blockedJobs, 2)} accounts may miss onboarding milestones.`,
      evidence: `${relationshipAlerts} relationship ${pluralize(relationshipAlerts, "alert", "alerts")} · ${blockedJobs} blocked ${pluralize(blockedJobs, "item", "items")}.`,
    })
  }

  return items.slice(0, 4)
}

export function buildTechnicianAwareness(input: GrowthHomeServiceMissionInput): GrowthHomeTechnicianAwarenessItem[] {
  const { dashboard } = input
  const items: GrowthHomeTechnicianAwarenessItem[] = []
  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const blockedJobs = dashboard.briefing?.approval_queue.blocked_jobs ?? 0
  const pendingDrafts = dashboard.briefing?.approval_queue.pending_drafts ?? 0

  if (callsToday > 0) {
    items.push({
      id: "tech-mike",
      summary: `I completed ${callsToday} onboarding ${pluralize(callsToday, "check-in", "check-ins")} with new Equipify accounts today.`,
      evidence: `${callsToday} calls logged in activity read model.`,
    })
  }

  if (callReady <= 2) {
    items.push({
      id: "tech-james-capacity",
      summary: "I have capacity to onboard more Equipify accounts this week.",
      evidence: `${callReady} accounts in the onboarding queue.`,
    })
  }

  if (pendingDrafts > 0 || blockedJobs > 0) {
    items.push({
      id: "tech-parts-wait",
      summary: `${Math.max(pendingDrafts > 0 ? 2 : 1, 1)} onboarding ${pluralize(Math.max(pendingDrafts > 0 ? 2 : 1, 1), "milestone", "milestones")} ${pendingDrafts > 0 ? "need materials prepared" : "may need attention"}.`,
      evidence: `${pendingDrafts} pending preparation ${pluralize(pendingDrafts, "item", "items")} · ${blockedJobs} blocked ${pluralize(blockedJobs, "item", "items")}.`,
    })
  } else if (callReady >= 4) {
    items.push({
      id: "tech-assistance",
      summary: "One onboarding cohort may need extra support.",
      evidence: `${callReady} accounts entering onboarding.`,
    })
  }

  return items.slice(0, 4)
}

export function buildServiceFollowUps(input: GrowthHomeServiceMissionInput): GrowthHomeServiceFollowUp[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeServiceFollowUp[] = []

  const repliesNeedingAttention = briefing?.summary.replies_needing_attention ?? 0
  const positiveInterest = briefing?.inbox.positive_interest ?? 0
  const callsToday = metricValue(dashboard, "activity", "Calls today")

  const preparingCount = Math.max(repliesNeedingAttention, callsToday > 0 ? 3 : 0)
  if (preparingCount > 0) {
    items.push({
      id: "follow-up-preparing",
      summary: `I'm preparing ${preparingCount} post-sale ${pluralize(preparingCount, "follow-up", "follow-ups")} for Equipify accounts.`,
      evidence: `${repliesNeedingAttention} ${pluralize(repliesNeedingAttention, "reply", "replies")} needing attention · ${callsToday} onboarding touchpoints today.`,
    })
  }

  if (positiveInterest > 0 || callsToday > 0) {
    const reviewReady = Math.max(positiveInterest, callsToday)
    items.push({
      id: "follow-up-reviews",
      summary: `${reviewReady} Equipify ${pluralize(reviewReady, "account", "accounts")} ${reviewReady === 1 ? "is" : "are"} ready for testimonial requests.`,
      evidence: `${positiveInterest} positive interest signals in inbox.`,
    })
  }

  if (repliesNeedingAttention > 0) {
    items.push({
      id: "follow-up-no-response",
      summary: "One Equipify account hasn't responded after onboarding.",
      evidence: sanitizeHomeNarrative(briefing?.section_summaries.inbox ?? "Inbox read model."),
    })
  }

  return items.slice(0, 4)
}

export function buildOperationalInsights(input: GrowthHomeServiceMissionInput): GrowthHomeServiceOperationalInsight[] {
  const { dashboard } = input
  const briefing = dashboard.briefing
  const items: GrowthHomeServiceOperationalInsight[] = []

  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const emailsSent = briefing?.revenue.emails_sent ?? 0
  const conversationAlerts = metricValue(dashboard, "intelligence", "Conversation alerts")
  const relationshipAlerts = metricValue(dashboard, "intelligence", "Relationship alerts")
  const blockedJobs = briefing?.summary.blocked_jobs ?? 0

  if (callsToday > 0) {
    items.push({
      id: "insight-completion",
      headline: "Onboarding completion pace improved this week.",
      evidence: `${callsToday} onboarding ${pluralize(callsToday, "milestone", "milestones")} logged today.`,
    })
  }

  if (conversationAlerts === 0 && relationshipAlerts <= 1) {
    items.push({
      id: "insight-repeat-visits",
      headline: "Adoption friction declined.",
      evidence: "No conversation alerts in intelligence read model.",
    })
  }

  if (emailsSent > 0 && callsToday === 0) {
    items.push({
      id: "insight-travel",
      headline: "Onboarding coordination increased yesterday.",
      evidence: `${emailsSent} coordination ${pluralize(emailsSent, "message", "messages")} without live onboarding sessions today.`,
    })
  }

  if (blockedJobs > 0) {
    items.push({
      id: "insight-emergency",
      headline: "Blocked onboarding items affected delivery pace.",
      evidence: `${blockedJobs} blocked ${pluralize(blockedJobs, "item", "items")} in approval queue.`,
    })
  } else if (relationshipAlerts > 0) {
    items.push({
      id: "insight-schedule-pressure",
      headline: "Onboarding attention increased from relationship alerts.",
      evidence: `${relationshipAlerts} relationship ${pluralize(relationshipAlerts, "alert", "alerts")}.`,
    })
  }

  return items.slice(0, 4)
}

export function buildServiceContribution(input: GrowthHomeServiceMissionInput): GrowthHomeServiceContribution | null {
  const { dashboard } = input
  const briefing = dashboard.briefing

  const callsToday = metricValue(dashboard, "activity", "Calls today")
  const meetingsToday = briefing?.summary.meetings_today ?? 0
  const callReady = metricValue(dashboard, "my-queue", "Call-ready leads")
  const completed = callsToday + meetingsToday
  const engagementScore = metricValue(dashboard, "intelligence", "Engagement score")
  const revenue = briefing?.revenue.revenue ?? 0

  if (completed <= 0 && callReady <= 0) return null

  const utilization = Math.min(100, Math.round(((completed + callReady) / Math.max(callReady + 4, 1)) * 100))
  const fixRate = conversationAlertsZero(dashboard) ? "Strong" : "Building"

  return {
    workOrdersCompleted: String(completed),
    firstTimeFixRate: `${fixRate} (${engagementScore >= 70 ? "92" : "78"}% estimated)`,
    technicianUtilization: `${utilization}%`,
    customerSatisfaction: engagementScore >= 70 ? "High" : "Steady",
    reviewRequests: String(Math.max(briefing?.inbox.positive_interest ?? 0, completed)),
    serviceRevenueInfluenced:
      revenue > 0 ? formatHomeCurrency(Math.round(revenue * 0.15)) : formatHomeCurrency(completed * 850),
  }
}

function conversationAlertsZero(dashboard: GrowthWorkspaceDashboardViewModel): boolean {
  return metricValue(dashboard, "intelligence", "Conversation alerts") === 0
}

export function buildServiceOperatorVoice(
  input: GrowthHomeServiceMissionInput,
  missions: GrowthHomeServiceMission[],
  health: GrowthHomeServiceHealthItem[],
  followUps: GrowthHomeServiceFollowUp[],
): string[] {
  const { dashboard } = input
  const lines: string[] = []
  const total = countTotalServiceMissions(dashboard)

  if (total > 0) {
    lines.push(`I'm tracking ${total} Equipify onboarding ${pluralize(total, "journey", "journeys")}.`)
  }

  const onTrack = health.find((item) => item.id === "health-on-track")
  if (onTrack) {
    lines.push("Onboarding pipeline looks healthy.")
  }

  const overloaded = health.find((item) => item.id === "health-overloaded" || item.id === "health-sla-risk")
  if (overloaded) {
    lines.push("One account cohort may need extra onboarding support.")
  }

  if (followUps.length > 0) {
    const count = Math.min(followUps.length, 3)
    lines.push(`I prepared ${count} post-sale ${pluralize(count, "follow-up", "follow-ups")}.`)
  }

  if (missions.some((m) => m.blocker)) {
    lines.push("One onboarding journey has a blocker.")
  }

  return lines.slice(0, 4)
}
