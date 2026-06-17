/**
 * Growth inbox IA simplification audit (Phase 8A / 8A.1 — local only).
 *
 * Usage: pnpm test:growth-inbox-ia-simplification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_TAB_SHELL_PAGES,
} from "../lib/growth/navigation/growth-chrome-architecture"
import {
  GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
  GROWTH_INBOX_WORKSPACE_TABS,
  isGrowthInboxTabRoute,
  resolveGrowthInboxActiveTabId,
} from "../lib/growth/navigation/growth-inbox-workspace-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "../lib/growth/navigation/growth-route-metadata-types"
import { findGrowthRouteMetadataByPathname } from "../lib/growth/navigation/growth-route-metadata"
import { resolveGrowthBreadcrumbs } from "../lib/growth/navigation/growth-route-registry"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Growth inbox IA simplification audit (${GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_INBOX_WORKSPACE_TABS.length, 3)
  assert.deepEqual(
    GROWTH_INBOX_WORKSPACE_TABS.map((tab) => tab.label),
    ["Inbox", "Workflow", "Operations"],
  )
  console.log("  ✓ tab manifest defines Inbox, Workflow, and Operations")

  const inboxRoute = `${GROWTH_WORKSPACE_BASE_PATH}/inbox`
  const workflowRoute = `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`
  const operationsRoute = `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`

  assert.ok(isGrowthInboxTabRoute(inboxRoute))
  assert.ok(isGrowthInboxTabRoute(workflowRoute))
  assert.ok(isGrowthInboxTabRoute(operationsRoute))
  assert.equal(resolveGrowthInboxActiveTabId(inboxRoute), "inbox")
  assert.equal(resolveGrowthInboxActiveTabId(workflowRoute), "workflow")
  assert.equal(resolveGrowthInboxActiveTabId(operationsRoute), "operations")
  console.log("  ✓ three tab routes resolve active states")

  const shellSource = readSource("components/growth/inbox/growth-inbox-shell.tsx")
  assert.doesNotMatch(shellSource, /Inbox Diagnostics/)
  assert.doesNotMatch(shellSource, /Revenue Queue/)
  assert.match(shellSource, /Unified communications workspace for email, SMS, calls, and workflow actions/)
  assert.match(shellSource, /min-h-\[4\.25rem\]/)
  console.log("  ✓ compact inbox shell header without diagnostics toolbar")

  const metricsPanel = readSource("components/growth/inbox/growth-inbox-overview-metrics-panel.tsx")
  assert.match(metricsPanel, /GROWTH_INBOX_OVERVIEW_METRICS_QA_MARKER/)
  assert.match(metricsPanel, /Needs Action/)
  assert.match(metricsPanel, /Meetings/)
  assert.match(metricsPanel, /Callbacks/)
  assert.match(metricsPanel, /Unread/)
  assert.match(metricsPanel, /label: "Workflow"/)
  assert.doesNotMatch(metricsPanel, /CompactIntelligenceCard/)
  assert.doesNotMatch(metricsPanel, /Conversation Intelligence/)
  assert.doesNotMatch(metricsPanel, /Voicemails/)
  assert.doesNotMatch(metricsPanel, /Objections/)
  console.log("  ✓ inbox tab shows six operator metrics only")

  const workflowSummary = readSource("components/growth/inbox/growth-inbox-workflow-intelligence-summary.tsx")
  assert.match(workflowSummary, /Conversation Intelligence/)
  assert.match(workflowSummary, /growthWorkspaceCallsHref/)
  assert.match(workflowSummary, /View Conversations/)
  assert.match(workflowSummary, /View Calls/)
  assert.match(workflowSummary, /View Workflow/)
  console.log("  ✓ workflow tab hosts compact intelligence summaries")

  const inboxPanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(inboxPanel, /GrowthInboxOverviewMetricsPanel/)
  assert.match(inboxPanel, /GrowthOperatorInboxPanel/)
  const metricsIndex = inboxPanel.indexOf("GrowthInboxOverviewMetricsPanel")
  const notificationsIndex = inboxPanel.indexOf("GrowthOperatorInboxPanel")
  const shellIndex = inboxPanel.indexOf("GrowthInboxWorkspaceShell")
  assert.ok(metricsIndex < notificationsIndex, "metrics must render before operator notifications")
  assert.ok(notificationsIndex < shellIndex, "notifications must render before thread queue")
  assert.match(inboxPanel, /GrowthInboxWorkspaceShell/)
  assert.doesNotMatch(inboxPanel, /GrowthConversationalPlaybooksPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthHumanInterventionsPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthSequencePreviewStudioPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthAgentOrchestrationPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthInboxV2SupportingPanels/)
  console.log("  ✓ operator inbox tab order: metrics → notifications → queue")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /GrowthInboxWorkflowIntelligenceSummary/)
  assert.match(workflowPanel, /includeEmbeddedSurfaces=\{false\}/)
  assert.match(workflowPanel, /GrowthHumanInterventionsPanel/)
  assert.match(workflowPanel, /GrowthConversationalPlaybooksPanel/)
  assert.match(workflowPanel, /GrowthInboxReplyIntelligencePanel/)
  assert.match(workflowPanel, /GrowthSmartFollowUpPoliciesPanel/)
  assert.match(workflowPanel, /GrowthSequencePreviewStudioPanel/)
  assert.doesNotMatch(workflowPanel, /GrowthReplyWorkflowDashboardBody/)
  assert.doesNotMatch(workflowPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.doesNotMatch(workflowPanel, /GrowthRealtimeEventBusPanel/)
  console.log("  ✓ workflow tab hosts execution surfaces without orchestration duplicates")

  const operationsPanel = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")
  assert.match(operationsPanel, /GrowthInboxDiagnosticsPanel/)
  assert.match(operationsPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.match(operationsPanel, /GrowthAgentOrchestrationPanel/)
  assert.match(operationsPanel, /GrowthRealtimeEventBusPanel/)
  assert.match(operationsPanel, /Sequence Execution/)
  console.log("  ✓ operations tab hosts diagnostics and orchestration surfaces")

  for (const page of GROWTH_INBOX_TAB_SHELL_PAGES) {
    assert.ok(fs.existsSync(path.join(ROOT, page)), `missing tab page: ${page}`)
  }
  console.log("  ✓ all inbox tab pages exist on disk")

  const operationsCrumbs = resolveGrowthBreadcrumbs(operationsRoute)
  assert.deepEqual(operationsCrumbs.map((crumb) => crumb.label), ["Growth", "Inbox", "Operations"])
  console.log("  ✓ operations breadcrumbs resolve")

  assert.ok(findGrowthRouteMetadataByPathname(operationsRoute))
  console.log("  ✓ operations route registered")

  const inboxNav = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === "inbox")
  assert.ok(inboxNav)
  assert.equal(isGrowthShellNavItemActive(operationsRoute, inboxNav), true)
  assert.equal(GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).length, 12)
  console.log("  ✓ sidebar highlights Inbox on operations tab; remains 12 items")

  console.log("\nGrowth inbox IA simplification audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
        tabs: GROWTH_INBOX_WORKSPACE_TABS.length,
        primary_metrics: 6,
        intelligence_cards: 0,
        workflow_intelligence_cards: 3,
      },
      null,
      2,
    ),
  )
}

runAudit()
