/** GE-AIOS-UX-1A Phase 2 — Workspace priority feed synthesizer (client-safe, read-model only). */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  growthWorkspaceInboxViewHref,
  growthWorkspacePipelineHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"
import {
  buildGrowthReviewHref,
  remapLegacyHrefToGrowthReview,
} from "@/lib/growth/workspace/ux-1a/review/growth-review-routes"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import {
  inferDecisionQueueCategory,
  isGrowthHomeDecisionQueueFiller,
  normalizeDecisionQueueHref,
} from "@/lib/growth/workspace/executive-briefing/growth-home-decision-queue-dedup"
import type {
  GrowthHomeAttentionItem,
  GrowthHomeMailboxDomainHealth,
  GrowthHomeThroughputMetric,
  GrowthHomeWaitingOnYouItem,
} from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildMailboxDomainHealth,
  buildThroughputMetrics,
  buildWaitingOnYouFromDashboard,
} from "@/lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import { resolveCanonicalApprovalQueueCount } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  formatHomeCountPhrase,
  sanitizeHomeNarrative,
} from "@/lib/growth/workspace/executive-briefing/growth-home-narrative-formatter"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { AiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"
import {
  buildUx1aWorkspaceHeroGreeting,
  buildUx1aWorkspaceHeroSubline,
  GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_MESSAGE,
  GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_TITLE,
} from "@/lib/growth/workspace/ux-1a/growth-workspace-priority-feed-copy"
import {
  GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER,
  type GrowthWorkspacePrimaryAction,
  type GrowthWorkspacePriorityFeedViewModel,
  type GrowthWorkspacePriorityItem,
  type GrowthWorkspaceProgressItem,
} from "@/lib/growth/workspace/ux-1a/growth-workspace-priority-feed-types"

const UX_1A_REVIEW_PACKAGES_HREF = buildGrowthReviewHref({ tab: "packages" })
const UX_1A_MAILBOX_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/settings/communications/mailboxes` as const
const UX_1A_TRAINING_HREF = `${GROWTH_WORKSPACE_BASE_PATH}/training` as const

const HUB_PATH_DENYLIST = [
  "/campaigns/sequences",
  "/campaigns",
  "/engagement",
  "/runbook",
  "/os/command",
] as const

function metricValue(dashboard: GrowthWorkspaceDashboardViewModel, sectionId: string, label: string): number {
  const section = dashboard.sections.find((row) => row.id === sectionId)
  return section?.metrics.find((metric) => metric.label === label)?.value ?? 0
}

export function remapUx1aOperatorHref(href: string | null | undefined): string | null {
  if (!href) return null
  const normalized = normalizeDecisionQueueHref(href)
  if (HUB_PATH_DENYLIST.some((segment) => normalized.includes(segment))) {
    if (normalized.includes("/mailboxes")) return UX_1A_MAILBOX_HREF
    if (normalized.includes("/inbox")) return growthWorkspaceInboxViewHref("needs_action")
    if (normalized.includes("/pipeline") || normalized.includes("/opportunities")) {
      return growthWorkspacePipelineHref()
    }
    if (normalized.includes("/training")) return UX_1A_TRAINING_HREF
    if (normalized.includes("/campaigns/sequences")) return remapLegacyHrefToGrowthReview(href)
    if (/approve|approval|review|send|outreach|package/i.test(normalized)) {
      return remapLegacyHrefToGrowthReview(href)
    }
    return UX_1A_REVIEW_PACKAGES_HREF
  }
  if (normalized.includes("/os/approvals")) return remapLegacyHrefToGrowthReview(href)
  if (normalized.includes("/pilot/lead-research/")) return remapLegacyHrefToGrowthReview(href)
  if (normalized === `${GROWTH_WORKSPACE_BASE_PATH}/os`) return UX_1A_REVIEW_PACKAGES_HREF
  return href
}

function translatePriorityTitle(label: string): string {
  const cleaned = sanitizeHomeNarrative(label)
  if (/approve pending send/i.test(cleaned)) {
    const match = cleaned.match(/(\d+)/)
    const count = match ? Number.parseInt(match[1]!, 10) : 1
    return count === 1 ? "Review 1 email" : `Review ${count} emails`
  }
  if (/reply/i.test(cleaned)) {
    const match = cleaned.match(/(\d+)/)
    const count = match ? Number.parseInt(match[1]!, 10) : 1
    return count === 1 ? "Reply to 1 prospect" : `Reply to ${count} prospects`
  }
  if (/mailbox|reconnect|sender/i.test(cleaned)) return "Reconnect mailbox"
  if (/training|runbook|setup/i.test(cleaned)) return "Complete business training"
  if (/meeting/i.test(cleaned) && /no|none|0/i.test(cleaned)) return "No meetings today"
  return cleaned
}

function extractCompanySubtitle(detail: string, fallback = "ready now"): string {
  const cleaned = sanitizeHomeNarrative(detail)
  if (!cleaned) return fallback
  const companyMatch = cleaned.match(/^([^·•|]+)/)
  const company = companyMatch?.[1]?.trim()
  if (company && company.length > 0 && company.length < 80) {
    const remainder = cleaned.slice(company.length).replace(/^[\s·•|-]+/, "").trim()
    return remainder ? `${company} · ${remainder}` : `${company} · ${fallback}`
  }
  return cleaned
}

function waitingItemToPriority(item: GrowthHomeWaitingOnYouItem): GrowthWorkspacePriorityItem | null {
  if (isGrowthHomeDecisionQueueFiller(item)) return null
  const category = inferDecisionQueueCategory(item)
  const href = remapUx1aOperatorHref(item.href)
  const kind: GrowthWorkspacePriorityItem["kind"] =
    category === "mailbox" ? "blocker" : category === "priority" ? "info" : "action"

  return {
    id: `waiting-${item.id}`,
    title: translatePriorityTitle(item.label),
    subtitle: extractCompanySubtitle(item.detail),
    href,
    kind,
    severity: item.severity ?? (kind === "blocker" ? 100 : 50),
    actionLabel: kind === "blocker" ? "Fix" : "Open",
  }
}

function attentionItemToPriority(item: GrowthHomeAttentionItem): GrowthWorkspacePriorityItem | null {
  if (item.id === "launch-runbook") return null
  const href = remapUx1aOperatorHref(item.ctaHref)
  if (!href) return null
  return {
    id: `attention-${item.id}`,
    title: translatePriorityTitle(item.headline),
    subtitle: extractCompanySubtitle(item.summary),
    href,
    kind: /mailbox|sender|training|setup/i.test(item.headline) ? "blocker" : "action",
    severity: item.impactScore,
    actionLabel: "Open",
  }
}

function buildMailboxBlocker(
  mailboxDomainHealth: GrowthHomeMailboxDomainHealth | null,
): GrowthWorkspacePriorityItem | null {
  const mailbox = mailboxDomainHealth
  if (!mailbox) return null
  const unhealthy =
    (mailbox.mailboxPool.expired ?? 0) + (mailbox.mailboxPool.warning ?? 0) + (mailbox.mailboxPool.paused ?? 0)
  if (unhealthy <= 0) return null
  return {
    id: "blocker-mailbox",
    title: "Reconnect mailbox",
    subtitle: mailbox.summary || "Sender authentication required",
    href: remapUx1aOperatorHref(mailbox.href),
    kind: "blocker",
    severity: 120,
    actionLabel: "Fix mailbox",
  }
}

function buildMeetingsInfo(
  dashboard: GrowthWorkspaceDashboardViewModel,
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null,
): GrowthWorkspacePriorityItem | null {
  const meetingsToday = Math.max(
    workspaceSummary?.meetings.today ?? 0,
    metricValue(dashboard, "activity", "Meetings today"),
    dashboard.briefing?.summary.meetings_today ?? 0,
  )
  if (meetingsToday > 0) return null
  return {
    id: "info-no-meetings",
    title: "No meetings today",
    subtitle: "Your calendar is clear",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/meetings`,
    kind: "info",
    severity: 0,
    actionLabel: "View meetings",
  }
}

function dedupePriorities(items: GrowthWorkspacePriorityItem[]): GrowthWorkspacePriorityItem[] {
  const merged = new Map<string, GrowthWorkspacePriorityItem>()
  for (const item of items.sort((a, b) => b.severity - a.severity)) {
    const key = `${item.kind}|${item.title.toLowerCase()}|${item.href ?? ""}`
    const existing = merged.get(key)
    if (!existing || item.severity > existing.severity) merged.set(key, item)
  }
  return [...merged.values()].sort((a, b) => b.severity - a.severity)
}

function buildUx1aAttentionItems(dashboard: GrowthWorkspaceDashboardViewModel): GrowthHomeAttentionItem[] {
  const items: GrowthHomeAttentionItem[] = []

  for (const card of dashboard.operatorActionCards.slice(0, 4)) {
    items.push({
      id: card.id,
      headline: card.title,
      summary: sanitizeHomeNarrative(card.description),
      ctaLabel: "Review",
      ctaHref: card.href,
      impactScore: card.id.includes("approve") ? 90 : card.id.includes("review") ? 75 : 50,
    })
  }

  for (const priority of dashboard.briefing?.priorities?.slice(0, 2) ?? []) {
    items.push({
      id: `priority-${priority.priority}`,
      headline: priority.title,
      summary: sanitizeHomeNarrative(priority.detail),
      ctaLabel: "Open",
      ctaHref: priority.href,
      impactScore: 100 - priority.priority * 10,
    })
  }

  const deduped = new Map<string, GrowthHomeAttentionItem>()
  for (const item of items.sort((a, b) => b.impactScore - a.impactScore)) {
    if (!deduped.has(item.id)) deduped.set(item.id, item)
  }
  return [...deduped.values()].slice(0, 5)
}

type Ux1aOperatorSignals = {
  waitingOnYou: GrowthHomeWaitingOnYouItem[]
  approveItemsCount: number
  mailboxDomainHealth: GrowthHomeMailboxDomainHealth | null
  throughput: GrowthHomeThroughputMetric[]
}

function buildUx1aOperatorSignals(input: GrowthWorkspacePriorityFeedInput): Ux1aOperatorSignals {
  const waitingOnYouResult = buildWaitingOnYouFromDashboard(input.dashboard, [])
  const legacyApproveCount = Math.max(
    input.dashboard.briefing?.summary.pending_approvals ?? 0,
    metricValue(input.dashboard, "campaign-snapshot", "Approval queue"),
    waitingOnYouResult.items.filter((item) => /approve/i.test(item.label)).length,
  )
  const approveItemsCount = resolveCanonicalApprovalQueueCount(
    input.workspaceSummary?.canonicalOperatorApproval ?? null,
    legacyApproveCount,
  )

  const canonicalOperatorTask = input.workspaceSummary?.canonicalOperatorTask ?? null
  const waitingOnYou: GrowthHomeWaitingOnYouItem[] = canonicalOperatorTask
    ? [
        {
          id: canonicalOperatorTask.id,
          label: canonicalOperatorTask.title,
          detail: canonicalOperatorTask.detail,
          href: canonicalOperatorTask.href,
          severity: 100,
        },
      ]
    : waitingOnYouResult.items

  return {
    waitingOnYou,
    approveItemsCount,
    mailboxDomainHealth: buildMailboxDomainHealth(input.dashboard),
    throughput: buildThroughputMetrics(input.dashboard),
  }
}

function buildUx1aPriorities(input: {
  dashboard: GrowthWorkspaceDashboardViewModel
  signals: Ux1aOperatorSignals
  attentionItems: GrowthHomeAttentionItem[]
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
}): GrowthWorkspacePriorityItem[] {
  const raw: GrowthWorkspacePriorityItem[] = []

  const mailboxBlocker = buildMailboxBlocker(input.signals.mailboxDomainHealth)
  if (mailboxBlocker) raw.push(mailboxBlocker)

  for (const item of input.signals.waitingOnYou) {
    const mapped = waitingItemToPriority(item)
    if (mapped) raw.push(mapped)
  }

  for (const item of input.attentionItems) {
    const mapped = attentionItemToPriority(item)
    if (mapped) raw.push(mapped)
  }

  for (const card of input.dashboard.operatorActionCards) {
    if (card.id === "launch-runbook" || card.id === "monitor-engagement") continue
    const mapped = attentionItemToPriority({
      id: card.id,
      headline: card.title,
      summary: card.description,
      ctaLabel: "Open",
      ctaHref: card.href,
      impactScore: card.id.includes("approve") ? 95 : 70,
    })
    if (mapped) raw.push(mapped)
  }

  const approvalCount = input.signals.approveItemsCount
  if (approvalCount > 0 && !raw.some((row) => /review/i.test(row.title))) {
    raw.push({
      id: "review-approvals",
      title: approvalCount === 1 ? "Review 1 email" : `Review ${approvalCount} emails`,
      subtitle: "Ready for your decision",
      href: buildGrowthReviewHref({ tab: "packages" }),
      kind: "action",
      severity: 110,
      actionLabel: "Review",
    })
  }

  const replyCount = Math.max(
    input.workspaceSummary?.inbox.repliesNeedingAttention ?? 0,
    metricValue(input.dashboard, "my-queue", "Inbox requiring replies"),
  )
  if (replyCount > 0 && !raw.some((row) => /reply/i.test(row.title))) {
    raw.push({
      id: "reply-inbox",
      title: replyCount === 1 ? "Reply to 1 prospect" : `Reply to ${replyCount} prospects`,
      subtitle: "Waiting in your inbox",
      href: growthWorkspaceInboxViewHref("needs_action"),
      kind: "action",
      severity: 85,
      actionLabel: "Reply",
    })
  }

  const meetingsInfo = buildMeetingsInfo(input.dashboard, input.workspaceSummary)
  if (meetingsInfo) raw.push(meetingsInfo)

  return dedupePriorities(raw).slice(0, 8)
}

function buildUx1aPrimaryActions(priorities: GrowthWorkspacePriorityItem[]): GrowthWorkspacePrimaryAction[] {
  const actions: GrowthWorkspacePrimaryAction[] = []
  const seen = new Set<string>()

  const candidates: Array<{ id: string; label: string; match: RegExp; fallbackHref: string }> = [
    {
      id: "review-email",
      label: "Review Email",
      match: /review.*email|approve|outreach|package/i,
      fallbackHref: buildGrowthReviewHref({ tab: "packages" }),
    },
    { id: "reply", label: "Reply", match: /reply/i, fallbackHref: growthWorkspaceInboxViewHref("needs_action") },
    { id: "fix-mailbox", label: "Fix Mailbox", match: /mailbox|reconnect|sender/i, fallbackHref: UX_1A_MAILBOX_HREF },
    {
      id: "open-pipeline",
      label: "Open Pipeline",
      match: /pipeline|opportunity/i,
      fallbackHref: growthWorkspacePipelineHref(),
    },
  ]

  for (const candidate of candidates) {
    const match = priorities.find((row) => candidate.match.test(row.title) || candidate.match.test(row.subtitle))
    if (!match) continue
    if (seen.has(candidate.id)) continue
    seen.add(candidate.id)
    actions.push({
      id: candidate.id,
      label: candidate.label,
      href: match.href ?? candidate.fallbackHref,
      description: match.subtitle,
    })
    if (actions.length >= 4) break
  }

  return actions
}

function buildUx1aRecentProgress(input: {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
  signals: Ux1aOperatorSignals
}): GrowthWorkspaceProgressItem[] {
  const rows: GrowthWorkspaceProgressItem[] = []
  const salesDaily = input.workspaceSummary?.salesOutcomes?.dailySummary
  const kpis = input.workspaceSummary?.kpis

  const researched = Math.max(
    salesDaily?.researched ?? 0,
    metricValue(input.dashboard, "intelligence", "Hot companies"),
  )
  if (researched > 0) {
    rows.push({
      id: "progress-researched",
      label: `${researched} ${researched === 1 ? "company" : "companies"} researched`,
      status: "prepared",
    })
  }

  const outreachPrepared = Math.max(salesDaily?.outreach_prepared ?? 0, 0)
  if (outreachPrepared > 0) {
    rows.push({
      id: "progress-outreach-prepared",
      label: `${formatHomeCountPhrase(outreachPrepared, "outreach package", "outreach packages")} prepared`,
      status: "prepared",
    })
  }

  const pendingReview = Math.max(
    salesDaily?.approvals_pending ?? 0,
    input.signals.approveItemsCount,
    kpis?.approvalQueueCount ?? 0,
  )
  if (pendingReview > 0) {
    rows.push({
      id: "progress-pending-review",
      label: `${formatHomeCountPhrase(pendingReview, "send", "sends")} waiting for review`,
      status: "ready_for_review",
    })
  }

  const queued = Math.max(
    input.dashboard.briefing?.approval_queue.pending_drafts ?? 0,
    metricValue(input.dashboard, "campaign-snapshot", "Approval queue") > pendingReview
      ? metricValue(input.dashboard, "campaign-snapshot", "Approval queue") - pendingReview
      : 0,
  )
  if (queued > 0) {
    rows.push({
      id: "progress-queued",
      label: `${formatHomeCountPhrase(queued, "message", "messages")} queued`,
      status: "queued",
    })
  }

  const delivered = Math.max(kpis?.emailsSentToday ?? 0, input.dashboard.briefing?.revenue.emails_sent ?? 0)
  rows.push({
    id: "progress-delivered",
    label: `${delivered} ${delivered === 1 ? "message" : "messages"} delivered`,
    status: "delivered",
  })

  return rows.slice(0, 5)
}

export type GrowthWorkspacePriorityFeedInput = {
  dashboard: GrowthWorkspaceDashboardViewModel
  workspaceSummary: GrowthHomeWorkspaceSummaryPayload | null
  teammate: AiTeammatePresentation
  operatorDisplayName?: string | null
  teammateIdentityAvailable?: boolean
}

export function synthesizeGrowthWorkspacePriorityFeed(
  input: GrowthWorkspacePriorityFeedInput,
): GrowthWorkspacePriorityFeedViewModel {
  const attentionItems = buildUx1aAttentionItems(input.dashboard)
  const signals = buildUx1aOperatorSignals(input)
  const priorities = buildUx1aPriorities({
    dashboard: input.dashboard,
    signals,
    attentionItems,
    workspaceSummary: input.workspaceSummary,
  })

  const actionableCount = priorities.filter((row) => row.kind !== "info").length
  const readyCount = Math.max(actionableCount, signals.approveItemsCount)
  const heroSubline = buildUx1aWorkspaceHeroSubline({
    readyCount,
    teammate: input.teammate,
    teammateIdentityAvailable: input.teammateIdentityAvailable !== false,
  })

  const primaryActions = buildUx1aPrimaryActions(priorities)
  const isCaughtUp = actionableCount === 0 && primaryActions.length === 0

  return {
    qaMarker: GROWTH_WORKSPACE_PRIORITY_FEED_QA_MARKER,
    hero: {
      greeting: buildUx1aWorkspaceHeroGreeting(
        input.operatorDisplayName ?? input.dashboard.welcome.operatorName ?? input.dashboard.operatorName,
      ),
      subline: isCaughtUp
        ? GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_MESSAGE
        : heroSubline.subline,
      readyCount,
      teammateNamedInSubline: isCaughtUp ? false : heroSubline.teammateNamedInSubline,
    },
    priorities,
    primaryActions,
    recentProgress: buildUx1aRecentProgress({
      dashboard: input.dashboard,
      workspaceSummary: input.workspaceSummary,
      signals,
    }),
    isCaughtUp,
    caughtUpTitle: GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_TITLE,
    caughtUpMessage: GROWTH_WORKSPACE_PRIORITY_FEED_CAUGHT_UP_MESSAGE,
  }
}

/** Count actionable priorities for hero — exported for certification. */
export function countUx1aActionablePriorities(priorities: GrowthWorkspacePriorityItem[]): number {
  return priorities.filter((row) => row.kind !== "info").length
}
