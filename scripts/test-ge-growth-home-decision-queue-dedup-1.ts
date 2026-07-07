/**
 * GE-GROWTH-HOME-DECISION-QUEUE-DEDUP-1 — Needs Your Decision queue certification.
 * Run: pnpm test:ge-growth-home-decision-queue-dedup-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAidenPriorityRecommendations } from "../lib/growth/aiden/aiden-priority-engine"
import {
  aggregateMailboxCanonicalHealth,
  classifyMailboxCanonicalHealth,
  resolveMailboxCardHealthDisplay,
} from "../lib/growth/mailboxes/mailbox-canonical-health"
import {
  GROWTH_HOME_DECISION_QUEUE_DEDUP_QA_MARKER,
  GROWTH_HOME_DECISION_QUEUE_EMPTY_MESSAGE,
  dedupeGrowthHomeDecisionQueueItems,
  finalizeGrowthHomeDecisionQueue,
  growthHomeDecisionQueueDedupKey,
  isGrowthHomeDecisionQueueFiller,
} from "../lib/growth/workspace/executive-briefing/growth-home-decision-queue-dedup"
import { buildWaitingOnYou } from "../lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer"
import type { GrowthHomeNeedsReview } from "../lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import type { GrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-types"

const PHASE = "GE-GROWTH-HOME-DECISION-QUEUE-DEDUP-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function emptyNeedsReview(overrides: Partial<GrowthHomeNeedsReview> = {}): GrowthHomeNeedsReview {
  return {
    totalCount: 0,
    groups: [],
    reviewHref: "/growth/campaigns/sequences",
    attentionItems: [],
    ...overrides,
  }
}

function dashboardFixture(
  overrides: Partial<GrowthWorkspaceDashboardViewModel> = {},
): GrowthWorkspaceDashboardViewModel {
  return {
    generatedAt: new Date().toISOString(),
    briefing: {
      qa_marker: "aiden-daily-briefing-v1",
      greeting: "Good morning",
      operator_name: "Operator",
      generated_at: new Date().toISOString(),
      summary: {
        mailbox_label: "Healthy",
        pending_approvals: 0,
        replies_needing_attention: 0,
        meetings_today: 0,
        blocked_jobs: 0,
        drafts_awaiting_review: 0,
        recommended_action: "Continue",
      },
      inbox: {
        new_replies: 0,
        replies_needing_attention: 0,
        positive_interest: 0,
        meeting_requests: 0,
        objections: 0,
        unsubscribes: 0,
      },
      mailbox: { healthy_mailboxes: 6, expired_mailboxes: 0, warnings: 0 },
      approval_queue: { pending_drafts: 0, pending_jobs: 0, blocked_jobs: 0, running_jobs: 0 },
      meetings: { meetings_today: 0, meetings_this_week: 0, opportunities_pending: 0 },
      revenue: { emails_sent: 0, replies: 0, meetings: 0, opportunities: 0, revenue: 0 },
      priorities: [
        {
          priority: 1,
          title: "Review mailbox warnings",
          detail: "1 mailbox warning(s) detected — validate before approving sends.",
          href: "/growth/settings/communications/mailboxes",
        },
        {
          priority: 2,
          title: "Review dashboard metrics",
          detail: "No urgent blockers.",
          href: "/admin/growth/command",
        },
      ],
      section_summaries: {
        inbox: "",
        mailbox: "Mailboxes healthy.",
        approval_queue: "",
        meetings: "",
        revenue: "",
      },
    },
    sections: [],
    operatorActionCards: [
      {
        id: "launch-runbook",
        title: "Follow the launch runbook",
        description: "Repeatable path from prospect search to booked demo.",
        href: "/growth/runbook",
      },
    ],
    ...overrides,
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Needs Your Decision queue certification`)

  assert.equal(GROWTH_HOME_DECISION_QUEUE_DEDUP_QA_MARKER, "ge-growth-home-decision-queue-dedup-1-v1")
  assert.equal(GROWTH_HOME_DECISION_QUEUE_EMPTY_MESSAGE, "Nothing requires your approval right now.")

  const runbookDuplicates = dedupeGrowthHomeDecisionQueueItems([
    {
      id: "waiting-attention-launch-runbook",
      label: "Follow the launch runbook",
      detail: "Repeatable path from prospect search to booked demo.",
      href: "/growth/runbook",
      severity: 50,
    },
    {
      id: "waiting-card-launch-runbook",
      label: "Follow the launch runbook",
      detail: "Repeatable path from prospect search to booked demo.",
      href: "/growth/runbook",
      severity: 50,
    },
  ])
  assert.equal(runbookDuplicates.length, 1)

  const mailboxDuplicates = dedupeGrowthHomeDecisionQueueItems([
    {
      id: "waiting-attention-priority-1",
      label: "Review mailbox warnings",
      detail: "1 mailbox warning(s) detected.",
      href: "/growth/settings/communications/mailboxes",
      severity: 90,
    },
    {
      id: "waiting-priority-1",
      label: "Review mailbox warnings",
      detail: "1 mailbox warning(s) detected — validate before approving sends.",
      href: "/growth/settings/communications/mailboxes",
      severity: 80,
    },
  ])
  assert.equal(mailboxDuplicates.length, 1)
  assert.equal(mailboxDuplicates[0]?.severity, 90)

  const distinct = dedupeGrowthHomeDecisionQueueItems([
    {
      id: "approve",
      label: "Approve pending sends",
      detail: "3 sequence steps waiting.",
      href: "/growth/campaigns/sequences",
      severity: 90,
    },
    {
      id: "reply",
      label: "Reply to 2 leads",
      detail: "Unanswered replies waiting in inbox.",
      href: "/admin/growth/inbox",
      severity: 80,
    },
  ])
  assert.equal(distinct.length, 2)

  const fillerOnly = finalizeGrowthHomeDecisionQueue([
    {
      id: "runbook",
      label: "Follow the launch runbook",
      detail: "Repeatable path.",
      href: "/growth/runbook",
    },
    {
      id: "metrics",
      label: "Review dashboard metrics",
      detail: "No urgent blockers.",
      href: "/admin/growth/command",
    },
  ])
  assert.equal(fillerOnly.items.length, 0)
  assert.equal(fillerOnly.overflowCount, 0)

  const ownershipSource = readSource(
    "lib/growth/workspace/executive-briefing/growth-home-ownership-synthesizer.ts",
  )
  assert.doesNotMatch(ownershipSource, /for \(const card of dashboard\.operatorActionCards\)/)
  assert.doesNotMatch(ownershipSource, /for \(const priority of dashboard\.briefing\?\.priorities/)
  assert.match(ownershipSource, /finalizeGrowthHomeDecisionQueue/)

  const waiting = buildWaitingOnYou(
    dashboardFixture(),
    emptyNeedsReview({
      attentionItems: [
        {
          id: "launch-runbook",
          headline: "Follow the launch runbook",
          summary: "Repeatable path from prospect search to booked demo.",
          ctaLabel: "Review",
          ctaHref: "/growth/runbook",
          impactScore: 50,
        },
        {
          id: "priority-1",
          headline: "Review mailbox warnings",
          summary: "1 mailbox warning(s) detected.",
          ctaLabel: "Open",
          ctaHref: "/growth/settings/communications/mailboxes",
          impactScore: 90,
        },
      ],
    }),
    null,
  )
  assert.equal(
    waiting.items.filter((item) => /launch runbook/i.test(item.label)).length,
    0,
    "filler runbook should not appear in decision queue",
  )
  assert.equal(
    waiting.items.filter((item) => /mailbox warning/i.test(item.label)).length,
    0,
    "mailbox warning should be suppressed when canonical warnings are zero",
  )

  const warningWaiting = buildWaitingOnYou(
    dashboardFixture({
      briefing: {
        ...dashboardFixture().briefing!,
        mailbox: { healthy_mailboxes: 5, expired_mailboxes: 0, warnings: 1 },
      },
    }),
    emptyNeedsReview({
      attentionItems: [
        {
          id: "priority-1",
          headline: "Review mailbox warnings",
          summary: "1 mailbox warning(s) detected.",
          ctaLabel: "Open",
          ctaHref: "/growth/settings/communications/mailboxes",
          impactScore: 90,
        },
      ],
    }),
    null,
  )
  assert.equal(warningWaiting.items.filter((item) => /mailbox warning/i.test(item.label)).length, 1)

  const healthyMailbox = classifyMailboxCanonicalHealth({
    connectionStatus: "connected",
    healthTier: "healthy",
    healthScore: 95,
    tokenConfigured: true,
    lastValidationAt: new Date().toISOString(),
    signatureStatus: "configured",
    dailyCap: 50,
  })
  const warningMailbox = classifyMailboxCanonicalHealth({
    connectionStatus: "warning",
    healthTier: "healthy",
    healthScore: 90,
    needsReconnect: true,
    tokenConfigured: true,
    lastValidationAt: new Date().toISOString(),
    signatureStatus: "configured",
    dailyCap: 50,
  })
  const aggregate = aggregateMailboxCanonicalHealth([
    {
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
    {
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
    {
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
    {
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
    {
      connectionStatus: "connected",
      healthTier: "healthy",
      healthScore: 95,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
    {
      connectionStatus: "warning",
      healthTier: "healthy",
      healthScore: 90,
      needsReconnect: true,
      tokenConfigured: true,
      lastValidationAt: new Date().toISOString(),
      signatureStatus: "configured",
      dailyCap: 50,
    },
  ])
  assert.equal(aggregate.healthyCount, 5)
  assert.equal(aggregate.warningCount, 1)
  assert.equal(healthyMailbox.state, "healthy")
  assert.equal(warningMailbox.state, "warning")
  assert.ok(warningMailbox.warningReasons.length > 0)

  const noReasonDisplay = resolveMailboxCardHealthDisplay({
    canonicalHealthState: "warning",
    canonicalHealthLabel: "Warning",
    warningReasons: [],
  })
  assert.equal(noReasonDisplay.state, "healthy")
  assert.equal(noReasonDisplay.label, "Healthy")

  const priorities = buildAidenPriorityRecommendations({
    mailbox: { healthy_mailboxes: 5, expired_mailboxes: 0, warnings: 1 },
    inbox: {
      new_replies: 0,
      replies_needing_attention: 0,
      positive_interest: 0,
      meeting_requests: 0,
      objections: 0,
      unsubscribes: 0,
    },
    approval_queue: { pending_drafts: 0, pending_jobs: 0, blocked_jobs: 0, running_jobs: 0 },
    meetings: { meetings_today: 0, meetings_this_week: 0, opportunities_pending: 0 },
    revenue: { emails_sent: 0, replies: 0, meetings: 0, opportunities: 0, revenue: 0 },
  })
  assert.equal(
    priorities.filter((item) => item.title === "Review mailbox warnings").length,
    1,
  )

  const uiSource = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(uiSource, /resolveMailboxCardHealthDisplay/)
  assert.match(uiSource, /warningReasons\.length > 0/)

  const waitingUi = readSource(
    "components/growth/workspace/executive-briefing/growth-home-ai-os-waiting-on-you-section.tsx",
  )
  assert.match(waitingUi, /GROWTH_HOME_NOTHING_REQUIRES_APPROVAL/)
  assert.match(waitingUi, /border-emerald-200/)

  assert.equal(
    growthHomeDecisionQueueDedupKey({
      label: "Review dashboard metrics",
      href: "/admin/growth/command",
    }),
    growthHomeDecisionQueueDedupKey({
      label: "Review dashboard metrics (1)",
      href: "/admin/growth/command/",
    }),
  )
  assert.ok(isGrowthHomeDecisionQueueFiller({ label: "Follow the launch runbook" }))

  const corePaths = ["app/(core)", "components/core", "lib/core"]
  for (const corePath of corePaths) {
    assert.ok(!fs.existsSync(path.join(process.cwd(), corePath)), `Equipify Core path must not exist: ${corePath}`)
  }

  console.log(`[${PHASE}] Needs Your Decision queue checks passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
