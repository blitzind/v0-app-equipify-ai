/**
 * Phase 8F — Growth inbox API fan-out hardening audit (local only).
 *
 * Usage: pnpm test:growth-inbox-api-fan-out
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log("\n=== Growth inbox API fan-out audit (growth-inbox-api-fan-out-v1) ===\n")

  const fetchUtil = readSource("lib/growth/platform-growth-client-fetch.ts")
  assert.match(fetchUtil, /PLATFORM_GROWTH_CLIENT_FETCH_TIMEOUT_MS = 9_000/)
  assert.match(fetchUtil, /PLATFORM_GROWTH_INBOX_MAX_CONCURRENT_FETCHES = 2/)
  assert.match(fetchUtil, /AbortController/)
  console.log("  ✓ platform growth client fetch timeout + concurrency helpers exist")

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
  assert.match(operationsPanel, /<GrowthInboxExpandableLazyPanel title="Inbox Diagnostics"/)
  assert.match(operationsPanel, /useInboxConcurrencyLimit/)
  console.log("  ✓ operations tab lazy-loads panels with concurrency cap")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /GrowthInboxExpandableLazyPanel/)
  assert.match(workflowPanel, /GrowthInboxWorkflowIntelligenceSummary/)
  assert.match(workflowPanel, /<GrowthInboxExpandableLazyPanel title="Human Interventions"/)
  console.log("  ✓ workflow tab defers execution panels behind expandable lazy mounts")

  const inboxPanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.doesNotMatch(inboxPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthRealtimeEventBusPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthInboxWorkspaceOperationsPanel/)
  console.log("  ✓ inbox tab does not mount operations-only panels")

  const leadContext = readSource("components/growth/inbox/growth-inbox-lead-context-provider.tsx")
  assert.match(leadContext, /fetchPlatformGrowthClient/)
  console.log("  ✓ lead context provider uses timeout-guarded fetches")

  console.log("\nGrowth inbox API fan-out audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: "growth-inbox-api-fan-out-v1",
        timeout_ms: 9000,
        max_concurrent_fetches: 2,
      },
      null,
      2,
    ),
  )
}

runAudit()
