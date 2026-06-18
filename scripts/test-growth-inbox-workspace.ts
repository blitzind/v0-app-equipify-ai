/**
 * Growth inbox workspace tab shell audit (Phase 7G — local only).
 *
 * Usage: pnpm test:growth-inbox-workspace
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_TAB_SHELL_COMPONENT,
  GROWTH_INBOX_TAB_SHELL_PAGES,
} from "../lib/growth/navigation/growth-chrome-architecture"
import {
  GROWTH_INBOX_EXISTING_QUEUE_VIEWS,
  GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER,
} from "../lib/growth/navigation/growth-inbox-replies-architecture"
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
  filterInboxThreadsByQueueView,
} from "../lib/growth/inbox/inbox-thread-queue-filters"
import type { GrowthInboxThread } from "../lib/growth/inbox/inbox-types"
import {
  GROWTH_SHELL_NAV_GROUPS,
  isGrowthShellNavItemActive,
} from "../lib/growth/navigation/growth-workspace-shell-navigation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleThread(overrides: Partial<GrowthInboxThread>): GrowthInboxThread {
  return {
    id: "thread-1",
    lead_id: "00000000-0000-4000-8000-000000000001",
    lead_label: "Acme",
    channel: "email",
    provider_family: "manual",
    mailbox_connection_id: null,
    subject: "Pricing follow-up",
    thread_status: "open",
    reply_count: 1,
    last_message_at: new Date().toISOString(),
    owner_user_id: null,
    owner_label: null,
    priority_score: 80,
    priority_tier: "high",
    classification: "positive_interest",
    classification_confidence: 0.9,
    requires_human_review: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function runAudit(): void {
  console.log(`\n=== Growth inbox workspace audit (${GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER}) ===\n`)

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
  console.log("  ✓ tab routes resolve active states")

  const layoutSource = readSource("app/(growth)/growth/inbox/layout.tsx")
  assert.match(layoutSource, /GrowthInboxWorkspaceProvider/)
  assert.match(layoutSource, /GrowthInboxShell/)
  const shellSource = readSource(GROWTH_INBOX_TAB_SHELL_COMPONENT)
  assert.match(shellSource, /resolveGrowthInboxWorkspaceTabs/)
  assert.match(shellSource, /GrowthWorkspacePageHeader/)
  assert.match(shellSource, /cnDrawerTabButton/)
  console.log("  ✓ inbox layout composes link-based tab shell")

  for (const page of GROWTH_INBOX_TAB_SHELL_PAGES) {
    const source = readSource(page)
    assert.doesNotMatch(source, /GrowthWorkspacePageHeader/, `${page} must not duplicate page header inside shell`)
  }
  console.log("  ✓ tab pages omit duplicate GrowthWorkspacePageHeader chrome")

  const v2Panel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.match(v2Panel, /GrowthInboxOverviewMetricsPanel/)
  assert.match(v2Panel, /GrowthOperatorInboxPanel/)
  assert.match(v2Panel, /GrowthInboxWorkspaceShell/)
  assert.doesNotMatch(v2Panel, /GrowthInboxV2SupportingPanels/)
  const metricsBeforeNotifications =
    v2Panel.indexOf("GrowthInboxOverviewMetricsPanel") < v2Panel.indexOf("GrowthOperatorInboxPanel")
  assert.ok(metricsBeforeNotifications)
  assert.match(v2Panel, /notifications=\{<GrowthOperatorInboxPanel/)
  console.log("  ✓ inbox tab embeds metrics before notifications; notifications align in workspace grid")

  const replyIntelPanel = readSource("components/growth/inbox/growth-inbox-reply-intelligence-panel.tsx")
  assert.match(replyIntelPanel, /replies\/timeline/)
  assert.match(replyIntelPanel, /replies\/copilot/)
  assert.match(replyIntelPanel, /growthFeaturePath/)
  console.log("  ✓ reply intelligence panel uses existing reply APIs and registry-driven links")

  assert.ok(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.includes("objections"))
  assert.ok(GROWTH_INBOX_EXISTING_QUEUE_VIEWS.includes("high_priority"))

  const threads = [
    sampleThread({ id: "obj", classification: "budget", priority_tier: "normal" }),
    sampleThread({ id: "hi", priority_tier: "critical", classification: "question" }),
    sampleThread({ id: "arch", thread_status: "archived", classification: "budget" }),
  ]
  assert.equal(filterInboxThreadsByQueueView(threads, "objections").length, 1)
  assert.equal(filterInboxThreadsByQueueView(threads, "high_priority").length, 1)
  const queueUrlSync = readSource("components/growth/inbox/growth-inbox-queue-url-sync.tsx")
  assert.match(queueUrlSync, /useGrowthWorkspaceDefaultViewsReadonly/)
  assert.match(queueUrlSync, /shouldApplyGrowthInboxSavedDefaultFilter/)
  console.log("  ✓ inbox queue sync applies saved default filter when ?view= is absent")

  const workflowCrumbs = resolveGrowthBreadcrumbs(workflowRoute)
  assert.deepEqual(workflowCrumbs.map((crumb) => crumb.label), ["Growth", "Inbox", "Reply Workflow"])
  console.log("  ✓ workflow breadcrumbs unchanged")

  const inboxNav = GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === "inbox")
  assert.ok(inboxNav)
  assert.equal(isGrowthShellNavItemActive(workflowRoute, inboxNav), true)
  assert.equal(GROWTH_SHELL_NAV_GROUPS.flatMap((group) => group.items).length, 12)
  console.log("  ✓ sidebar highlights Inbox on workflow tab; remains 12 items")

  assert.ok(findGrowthRouteMetadataByPathname(inboxRoute))
  assert.ok(findGrowthRouteMetadataByPathname(workflowRoute))
  assert.ok(findGrowthRouteMetadataByPathname(operationsRoute))
  console.log("  ✓ registry routes include operations tab")

  const replyDashboard = readSource("components/growth/growth-reply-inbox-dashboard.tsx")
  assert.doesNotMatch(replyDashboard, /href="\/admin\/growth\/replies\/workflow"/)
  assert.match(replyDashboard, /growthFeaturePath/)
  console.log("  ✓ reply inbox dashboard workflow links use growthFeaturePath")

  console.log("\nGrowth inbox workspace audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER,
        architecture_qa_marker: GROWTH_INBOX_REPLIES_ARCHITECTURE_QA_MARKER,
        tabs: GROWTH_INBOX_WORKSPACE_TABS.length,
        queue_views: GROWTH_INBOX_EXISTING_QUEUE_VIEWS.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
