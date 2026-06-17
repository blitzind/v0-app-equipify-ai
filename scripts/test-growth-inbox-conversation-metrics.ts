/**
 * Growth inbox conversation overview metrics audit (Phase 7P — local only).
 *
 * Usage: pnpm test:growth-inbox-conversation-metrics
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_CONVERSATIONS_DASHBOARD_CLIENT_QA_MARKER,
} from "../lib/growth/conversations/growth-conversations-dashboard-client"
import {
  GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_DEFERRED,
  GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER,
  deriveGrowthInboxConversationOverviewMetrics,
} from "../lib/growth/inbox/inbox-conversation-overview-metrics"
import { GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX } from "../lib/growth/navigation/growth-inbox-conversations-convergence-architecture"
import { GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS } from "../lib/growth/navigation/growth-workspace-sidebar-ia"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleDashboard() {
  return {
    averageHealth: 68,
    strongHealth: [{ id: "lead-1", companyName: "Acme" }],
    buyingIntent: [{ id: "lead-2", companyName: "Beta" }, { id: "lead-3", companyName: "Gamma" }],
    sentimentShift: [{ id: "lead-4", companyName: "Delta" }],
    competitorMentions: [],
    topObjections: [],
    urgencyTrends: [{ id: "lead-5", companyName: "Echo" }],
    conversationRisk: [{ id: "lead-6", companyName: "Foxtrot" }, { id: "lead-7", companyName: "Golf" }],
  }
}

function runAudit(): void {
  console.log(`\n=== Growth inbox conversation metrics audit (${GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER}) ===\n`)

  const empty = deriveGrowthInboxConversationOverviewMetrics(null)
  assert.equal(empty.needsAttention, 0)
  assert.equal(empty.averageHealth, 0)
  console.log("  ✓ empty dashboard yields safe zero metrics")

  const dashboard = sampleDashboard()
  const metrics = deriveGrowthInboxConversationOverviewMetrics(dashboard)
  assert.equal(metrics.qaMarker, GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_QA_MARKER)
  assert.equal(metrics.needsAttention, 2)
  assert.equal(metrics.negativeSentiment, 1)
  assert.equal(metrics.highUrgency, 1)
  assert.equal(metrics.strongBuyingIntent, 2)
  assert.equal(metrics.activeConversationLeads, 7)
  assert.equal(metrics.averageHealth, 68)
  console.log("  ✓ conversation metrics derive from existing dashboard payload")

  assert.ok(GROWTH_INBOX_CONVERSATION_OVERVIEW_METRICS_DEFERRED.length >= 3)
  console.log("  ✓ unsupported metrics documented as deferred")

  const client = readSource("lib/growth/conversations/growth-conversations-dashboard-client.ts")
  assert.match(client, new RegExp(GROWTH_CONVERSATIONS_DASHBOARD_CLIENT_QA_MARKER))
  assert.match(client, /\/api\/platform\/growth\/conversations\/dashboard/)
  assert.doesNotMatch(client, /insert\(|\.from\(/)
  console.log("  ✓ shared dashboard client uses existing API only")

  const overviewPanel = readSource("components/growth/inbox/growth-inbox-overview-metrics-panel.tsx")
  assert.match(overviewPanel, /useGrowthConversationsDashboard/)
  assert.match(overviewPanel, /deriveGrowthInboxConversationOverviewMetrics/)
  assert.match(overviewPanel, /Conversation Intelligence/)
  assert.match(overviewPanel, /growthWorkspaceConversationsHref/)
  assert.match(overviewPanel, /Conversation metrics unavailable/)
  assert.doesNotMatch(overviewPanel, /\/growth\/replies/)
  console.log("  ✓ inbox overview panel surfaces conversation metrics with non-blocking fallback")

  const hook = readSource("components/growth/inbox/use-growth-conversations-dashboard.ts")
  assert.match(hook, /fetchGrowthConversationsDashboard/)
  console.log("  ✓ inbox conversations dashboard hook reuses shared client")

  const matrixRow = GROWTH_INBOX_CONVERSATIONS_CONVERGENCE_MATRIX.find((row) => row.id === "inbox-overview-metrics")
  assert.equal(matrixRow?.status, "available")
  console.log("  ✓ conversations remains canonical intelligence surface; inbox shows summaries only")

  assert.equal(GROWTH_WORKSPACE_SIDEBAR_OPERATOR_NAV_IDS.length, 12)
  console.log("  ✓ sidebar remains 12 items")

  console.log("\nGrowth inbox conversation metrics audit passed.\n")
}

runAudit()
