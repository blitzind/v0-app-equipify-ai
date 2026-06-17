/**
 * Growth inbox viewport polish audit (Phase 8A.2 — local only).
 *
 * Usage: pnpm test:growth-inbox-viewport-polish
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
  console.log("\n=== Growth inbox viewport polish audit (growth-inbox-viewport-polish-v1) ===\n")

  const operatorPanel = readSource("components/growth/growth-operator-inbox-panel.tsx")
  assert.match(operatorPanel, /!compact \?/)
  assert.match(operatorPanel, /compact=\{compact\}/)
  assert.match(operatorPanel, /compactTitle=\{title\}/)
  assert.match(operatorPanel, /max-h-\[7\.5rem\]/)
  console.log("  ✓ operator notifications compact mode skips embedded orchestration panels")

  const inboxPanel = readSource("components/growth/inbox/growth-inbox-workspace-v2-panel.tsx")
  assert.doesNotMatch(inboxPanel, /GrowthInboxV2SupportingPanels/)
  assert.doesNotMatch(inboxPanel, /GrowthHumanInterventionsPanel/)
  assert.doesNotMatch(inboxPanel, /GrowthCampaignBuilderWizardPanel/)
  assert.doesNotMatch(inboxPanel, /import \{ GrowthInboxSetupEmptyState \}/)
  assert.match(inboxPanel, /GrowthInboxCompactPanelState/)
  const metricsIndex = inboxPanel.indexOf("GrowthInboxOverviewMetricsPanel")
  const notificationsIndex = inboxPanel.indexOf("GrowthOperatorInboxPanel")
  const shellIndex = inboxPanel.indexOf("GrowthInboxWorkspaceShell")
  assert.ok(metricsIndex < notificationsIndex && notificationsIndex < shellIndex)
  console.log("  ✓ inbox tab is viewport-first with compact states and no supporting panels")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /includeEmbeddedSurfaces=\{false\}/)
  assert.equal((workflowPanel.match(/<GrowthHumanInterventionsPanel/g) ?? []).length, 1)
  assert.equal((workflowPanel.match(/<GrowthConversationalPlaybooksPanel/g) ?? []).length, 1)
  assert.equal((workflowPanel.match(/<GrowthSmartFollowUpPoliciesPanel/g) ?? []).length, 1)
  assert.equal((workflowPanel.match(/<GrowthSequencePreviewStudioPanel/g) ?? []).length, 1)
  assert.equal((workflowPanel.match(/<GrowthInboxReplyIntelligencePanel/g) ?? []).length, 1)
  assert.doesNotMatch(workflowPanel, /GrowthReplyWorkflowDashboardBody/)
  console.log("  ✓ workflow tab mounts each execution surface once")

  const workflowActions = readSource("components/growth/growth-reply-workflow-actions-panel.tsx")
  assert.match(workflowActions, /includeEmbeddedSurfaces/)
  console.log("  ✓ workflow action center supports surface-only mode")

  const shell = readSource("components/growth/inbox/growth-inbox-workspace-shell.tsx")
  assert.match(shell, /min-h-\[min\(420px,46vh\)\]/)
  console.log("  ✓ tri-column shell height reduced for laptop viewport")

  const operationsPanel = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")
  assert.match(operationsPanel, /GrowthInboxV2SupportingPanels/)
  console.log("  ✓ team queue supporting panel relocated to operations tab")

  const compactState = readSource("components/growth/inbox/growth-inbox-compact-panel-state.tsx")
  assert.match(compactState, /max-h-\[7\.5rem\]/)
  assert.match(compactState, /Unavailable/)
  console.log("  ✓ compact panel state component enforces 80–120px target")

  console.log("\nGrowth inbox viewport polish audit PASS\n")
}

runAudit()
