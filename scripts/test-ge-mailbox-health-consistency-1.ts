/**
 * GE-MAILBOX-HEALTH-CONSISTENCY-1 — Canonical mailbox health read-model certification.
 * Run: pnpm test:ge-mailbox-health-consistency-1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAidenPriorityRecommendations } from "../lib/growth/aiden/aiden-priority-engine"
import {
  GROWTH_MAILBOX_CANONICAL_HEALTH_QA_MARKER,
  aggregateMailboxCanonicalHealth,
  classifyMailboxCanonicalHealth,
} from "../lib/growth/mailboxes/mailbox-canonical-health"
import { buildMailboxDomainHealth } from "../lib/growth/workspace/executive-briefing/growth-home-ai-os-ux-synthesizer"
import type { GrowthWorkspaceDashboardViewModel } from "../lib/growth/workspace/growth-workspace-dashboard-types"

const PHASE = "GE-MAILBOX-HEALTH-CONSISTENCY-1" as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function healthyMailboxInput() {
  return {
    connectionStatus: "connected",
    healthTier: "healthy",
    healthScore: 95,
    tokenConfigured: true,
    tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    validationFailureCount: 0,
    needsReconnect: false,
    signatureStatus: "configured" as const,
    lastValidationAt: new Date().toISOString(),
    dailyCap: 50,
    operationalPaused: false,
  }
}

function emptySignals() {
  return {
    mailbox: { healthy_mailboxes: 0, expired_mailboxes: 0, warnings: 0 },
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
  }
}

function dashboardWithMailboxCounts(input: {
  healthy: number
  warnings: number
  expired: number
}): GrowthWorkspaceDashboardViewModel {
  return {
    generatedAt: new Date().toISOString(),
    briefing: {
      qa_marker: "aiden-daily-briefing-v1",
      greeting: "Good morning",
      operator_name: "Operator",
      generated_at: new Date().toISOString(),
      summary: {
        mailbox_label: input.warnings > 0 ? "Warning" : "Healthy",
        pending_approvals: 0,
        replies_needing_attention: 0,
        meetings_today: 0,
        blocked_jobs: 0,
        drafts_awaiting_review: 0,
        recommended_action: "Continue",
      },
      inbox: emptySignals().inbox,
      mailbox: {
        healthy_mailboxes: input.healthy,
        expired_mailboxes: input.expired,
        warnings: input.warnings,
      },
      approval_queue: emptySignals().approval_queue,
      meetings: emptySignals().meetings,
      revenue: emptySignals().revenue,
      priorities: [],
      section_summaries: {
        inbox: "",
        mailbox: input.warnings > 0 ? "One mailbox warning detected." : "Mailboxes healthy.",
        approval_queue: "",
        meetings: "",
        revenue: "",
      },
    },
    sections: [],
    operatorActionCards: [],
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Canonical mailbox health consistency certification`)

  assert.equal(GROWTH_MAILBOX_CANONICAL_HEALTH_QA_MARKER, "ge-mailbox-health-consistency-1-v1")

  const healthy = classifyMailboxCanonicalHealth(healthyMailboxInput())
  assert.equal(healthy.state, "healthy")
  assert.equal(healthy.warningReasons.length, 0)
  assert.equal(healthy.primaryLabel, "Healthy")

  const productionMismatch = classifyMailboxCanonicalHealth({
    ...healthyMailboxInput(),
    connectionStatus: "warning",
    healthScore: 90,
    needsReconnect: true,
  })
  assert.equal(productionMismatch.state, "warning")
  assert.ok(productionMismatch.warningReasons.length > 0)
  assert.ok(
    productionMismatch.warningReasons.some((reason) => /reconnect|review/i.test(reason)),
    "warning mailbox must include reconnect or review reason",
  )

  const dailyCapWarning = classifyMailboxCanonicalHealth({
    ...healthyMailboxInput(),
    dailyCap: 0,
  })
  assert.equal(dailyCapWarning.state, "warning")
  assert.ok(dailyCapWarning.warningReasons.some((reason) => /daily send cap/i.test(reason)))

  const sixHealthyOneWarning = aggregateMailboxCanonicalHealth([
    ...Array.from({ length: 5 }, () => healthyMailboxInput()),
    {
      ...healthyMailboxInput(),
      connectionStatus: "warning",
      healthScore: 90,
      needsReconnect: true,
    },
  ])
  assert.equal(sixHealthyOneWarning.healthyCount, 5)
  assert.equal(sixHealthyOneWarning.warningCount, 1)

  const healthyPriorities = buildAidenPriorityRecommendations({
    ...emptySignals(),
    mailbox: { healthy_mailboxes: 6, expired_mailboxes: 0, warnings: 0 },
  })
  assert.ok(!healthyPriorities.some((item) => /mailbox warning/i.test(item.title)))

  const warningPriorities = buildAidenPriorityRecommendations({
    ...emptySignals(),
    mailbox: { healthy_mailboxes: 5, expired_mailboxes: 0, warnings: 1 },
  })
  assert.ok(warningPriorities.some((item) => item.title === "Review mailbox warnings"))

  const healthyHomeHealth = buildMailboxDomainHealth(dashboardWithMailboxCounts({ healthy: 6, warnings: 0, expired: 0 }))
  assert.ok(healthyHomeHealth)
  assert.equal(healthyHomeHealth?.mailboxPool.healthy, 6)
  assert.equal(healthyHomeHealth?.mailboxPool.warning, 0)

  const warningHomeHealth = buildMailboxDomainHealth(dashboardWithMailboxCounts({ healthy: 5, warnings: 1, expired: 0 }))
  assert.ok(warningHomeHealth)
  assert.equal(warningHomeHealth?.mailboxPool.healthy, 5)
  assert.equal(warningHomeHealth?.mailboxPool.warning, 1)

  const aidenSource = readSource("lib/growth/aiden/aiden-briefing-repository.ts")
  assert.match(aidenSource, /buildConnectedMailboxesDashboard/)
  assert.doesNotMatch(aidenSource, /fetchMailboxHealthDashboard/)

  const connectedSource = readSource("lib/growth/mailboxes/connected-mailboxes-dashboard.ts")
  assert.match(connectedSource, /classifyMailboxCanonicalHealth/)
  assert.match(connectedSource, /canonicalHealthState/)
  assert.match(connectedSource, /warningMailboxes/)

  const uiSource = readSource("components/growth/mailboxes/growth-connected-mailboxes-dashboard.tsx")
  assert.match(uiSource, /resolveMailboxCardHealthDisplay/)
  assert.match(uiSource, /warningReasons/)
  assert.match(uiSource, /warningMailboxes/)
  assert.doesNotMatch(uiSource, /label={row\.connectionStatus}/)
  assert.doesNotMatch(uiSource, /label={row\.healthTier}/)

  const outboundPaths = [
    "lib/growth/outbound/process-event.ts",
    "lib/growth/warmup/warmup-send-executor.ts",
    "lib/growth/compliance/pre-send-infrastructure-guards.ts",
  ]
  for (const outboundPath of outboundPaths) {
    const before = fs.readFileSync(path.join(process.cwd(), outboundPath), "utf8")
    assert.ok(before.length > 0, `${outboundPath} must remain unchanged baseline`)
  }

  const corePaths = ["app/(core)", "components/core", "lib/core"]
  for (const corePath of corePaths) {
    assert.ok(!fs.existsSync(path.join(process.cwd(), corePath)), `Equipify Core path must not exist: ${corePath}`)
  }

  console.log(`[${PHASE}] Canonical mailbox health consistency checks passed`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
