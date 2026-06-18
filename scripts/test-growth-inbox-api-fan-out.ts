/**
 * Phase 8F / 8F.2 — Growth inbox API fan-out hardening audit (local only).
 *
 * Usage: pnpm test:growth-inbox-api-fan-out
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_LOAD_SCHEDULER_QA_MARKER,
} from "../lib/growth/inbox/inbox-load-scheduler"
import {
  GROWTH_INBOX_REQUEST_INVENTORY,
  GROWTH_INBOX_REQUEST_INVENTORY_QA_MARKER,
} from "../lib/growth/inbox/growth-inbox-request-inventory"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log("\n=== Growth inbox API fan-out audit (growth-inbox-api-fan-out-v2) ===\n")

  const fetchUtil = readSource("lib/growth/platform-growth-client-fetch.ts")
  assert.match(fetchUtil, /PLATFORM_GROWTH_CLIENT_FETCH_TIMEOUT_MS = 9_000/)
  assert.match(fetchUtil, /PLATFORM_GROWTH_INBOX_MAX_CONCURRENT_FETCHES = 2/)
  assert.match(fetchUtil, /AbortController/)
  console.log("  ✓ platform growth client fetch timeout + concurrency helpers exist")

  const scheduler = readSource("lib/growth/inbox/inbox-load-scheduler.ts")
  assert.match(scheduler, /scheduleGrowthInboxIdleTask/)
  assert.match(scheduler, new RegExp(GROWTH_INBOX_LOAD_SCHEDULER_QA_MARKER))
  console.log("  ✓ inbox idle load scheduler exists")

  const workspaceProvider = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  assert.match(workspaceProvider, /scheduleGrowthInboxIdleTask/)
  assert.match(workspaceProvider, /loadSecondaryInboxData/)
  assert.match(workspaceProvider, /void loadSecondaryInboxData\(\)/)
  assert.match(workspaceProvider, /void loadThreadDetail\(nextSelected\)/)
  assert.doesNotMatch(
    workspaceProvider,
    /const load = useCallback[\s\S]*?sync\/dashboard/,
  )
  console.log("  ✓ workspace provider defers sync/mailboxes + thread detail until idle")

  const leadContext = readSource("components/growth/inbox/growth-inbox-lead-context-provider.tsx")
  assert.match(leadContext, /refreshConversationCore/)
  assert.match(leadContext, /refreshLeadEnrichment/)
  assert.match(leadContext, /scheduleGrowthInboxIdleTask/)
  console.log("  ✓ lead context staggers core vs enrichment fetches")

  const sharedData = readSource("components/growth/inbox/growth-inbox-shared-data-provider.tsx")
  assert.match(sharedData, /deferUntilLeadId/)
  assert.match(sharedData, /scheduleGrowthInboxIdleTask/)
  console.log("  ✓ command center defers until lead selection + idle")

  const replyDashboardHook = readSource("components/growth/inbox/use-growth-reply-intelligence-dashboard.ts")
  assert.match(replyDashboardHook, /deferLoad/)
  assert.match(replyDashboardHook, /scheduleGrowthInboxIdleTask/)
  const callCommsHook = readSource("components/growth/inbox/use-growth-inbox-call-communications.ts")
  assert.match(callCommsHook, /deferLoad/)
  assert.match(callCommsHook, /scheduleGrowthInboxIdleTask/)
  const metricsPanel = readSource("components/growth/inbox/growth-inbox-overview-metrics-panel.tsx")
  assert.match(metricsPanel, /deferLoad: true/)
  console.log("  ✓ secondary metrics hooks defer until idle")

  assert.equal(GROWTH_INBOX_REQUEST_INVENTORY.length, 21)
  const critical = GROWTH_INBOX_REQUEST_INVENTORY.filter((entry) => entry.criticalOnFirstPaint)
  const deferred = GROWTH_INBOX_REQUEST_INVENTORY.filter((entry) => !entry.criticalOnFirstPaint)
  assert.equal(critical.length, 4)
  assert.equal(deferred.length, 17)
  console.log(`  ✓ request inventory documented (${GROWTH_INBOX_REQUEST_INVENTORY_QA_MARKER})`)

  const replyDraft = readSource("components/growth/inbox/growth-inbox-action-center-reply-draft-embed.tsx")
  assert.doesNotMatch(replyDraft, /GrowthHumanInterventionsPanel/)
  assert.doesNotMatch(replyDraft, /GrowthConversationalPlaybooksPanel/)
  assert.doesNotMatch(replyDraft, /GrowthSmartFollowUpPoliciesPanel/)
  console.log("  ✓ action center reply draft embed does not mount orchestration panels")

  const smsDraft = readSource("components/growth/inbox/growth-inbox-action-center-sms-draft-embed.tsx")
  assert.doesNotMatch(smsDraft, /GrowthHumanInterventionsPanel/)
  assert.doesNotMatch(smsDraft, /GrowthConversationalPlaybooksPanel/)
  assert.doesNotMatch(smsDraft, /GrowthSmartFollowUpPoliciesPanel/)
  console.log("  ✓ action center SMS draft embed does not mount orchestration panels")

  const operatorPanel = readSource("components/growth/growth-operator-inbox-panel.tsx")
  assert.match(operatorPanel, /fetchPlatformGrowthClient/)
  assert.match(operatorPanel, /enabled: !compact/)
  console.log("  ✓ compact operator notifications skip realtime polling and use timeout fetch")

  const callComms = readSource("components/growth/inbox/use-growth-inbox-call-communications.ts")
  assert.doesNotMatch(callComms, /\/api\/platform\/growth\/operator-inbox/)
  assert.match(callComms, /fetchPlatformGrowthClient/)
  console.log("  ✓ call communications hook removed duplicate operator-inbox fetch")

  const humanInterventions = readSource("components/growth/growth-human-interventions-panel.tsx")
  assert.match(humanInterventions, /includeOrchestrationSurfaces = false/)
  assert.match(humanInterventions, /fetchPlatformGrowthClient/)
  console.log("  ✓ human interventions panel gates nested orchestration surfaces")

  const operationsPanel = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")
  assert.match(operationsPanel, /GrowthInboxExpandableLazyPanel/)
  assert.match(operationsPanel, /panelId="inbox-diagnostics"/)
  assert.match(operationsPanel, /useInboxConcurrencyLimit/)
  console.log("  ✓ operations tab lazy-loads panels with concurrency cap")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /GrowthInboxExpandableLazyPanel/)
  assert.match(workflowPanel, /GrowthInboxWorkflowIntelligenceSummary/)
  assert.match(workflowPanel, /panelId="human-interventions"/)
  console.log("  ✓ workflow tab defers execution panels behind expandable lazy mounts")

  const inboxPanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.doesNotMatch(inboxPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthRealtimeEventBusPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthInboxWorkspaceOperationsPanel/)
  assert.match(inboxPanel, /deferUntilLeadId/)
  console.log("  ✓ inbox tab does not mount operations-only panels")

  console.log("\nGrowth inbox API fan-out audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: "growth-inbox-api-fan-out-v2",
        inventory_marker: GROWTH_INBOX_REQUEST_INVENTORY_QA_MARKER,
        timeout_ms: 9000,
        max_concurrent_fetches: 2,
        critical_first_paint: critical.length,
        deferred_requests: deferred.length,
      },
      null,
      2,
    ),
  )
}

runAudit()
