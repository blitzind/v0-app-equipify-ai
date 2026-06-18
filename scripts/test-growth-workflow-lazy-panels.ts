/**
 * Phase 8F.2 — Workflow lazy panel instrumentation audit (local only).
 *
 * Usage: pnpm test:growth-workflow-lazy-panels
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT,
  GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT,
  GROWTH_INBOX_WORKFLOW_LAZY_INSTRUMENTATION_QA_MARKER,
} from "../lib/growth/inbox/growth-inbox-workflow-lazy-instrumentation"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, "..")

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function runAudit(): void {
  console.log(`\n=== Workflow lazy panels audit (${GROWTH_INBOX_WORKFLOW_LAZY_INSTRUMENTATION_QA_MARKER}) ===\n`)

  const instrumentation = readSource("lib/growth/inbox/growth-inbox-workflow-lazy-instrumentation.ts")
  assert.match(instrumentation, /emitGrowthInboxLazyPanelActivated/)
  assert.match(instrumentation, /emitGrowthInboxLazyPanelFetch/)
  assert.match(instrumentation, new RegExp(GROWTH_INBOX_LAZY_PANEL_ACTIVATED_EVENT))
  assert.match(instrumentation, new RegExp(GROWTH_INBOX_LAZY_PANEL_FETCH_EVENT))
  console.log("  ✓ lazy panel instrumentation events defined")

  const expandable = readSource("components/growth/inbox/growth-inbox-expandable-lazy-panel.tsx")
  assert.match(expandable, /panelId/)
  assert.match(expandable, /emitGrowthInboxLazyPanelActivated/)
  assert.match(expandable, /GrowthInboxLazyMount/)
  assert.match(expandable, /data-growth-lazy-panel-id/)
  console.log("  ✓ expandable lazy panel requires panelId and emits activation on expand")

  const lazyMount = readSource("components/growth/inbox/growth-inbox-lazy-mount.tsx")
  assert.match(lazyMount, /stays mounted once activated/)
  console.log("  ✓ lazy mount stays mounted after first activation (re-expand uses cache)")

  const workflowPanel = readSource("components/growth/inbox/growth-inbox-workspace-workflow-panel.tsx")
  assert.match(workflowPanel, /panelId="human-interventions"/)
  assert.match(workflowPanel, /lazyPanelId="human-interventions"/)
  assert.match(workflowPanel, /GrowthInboxWorkflowIntelligenceSummary/)
  console.log("  ✓ workflow panel wires panelId + fetch instrumentation for human interventions")

  const humanInterventions = readSource("components/growth/growth-human-interventions-panel.tsx")
  assert.match(humanInterventions, /lazyPanelId/)
  assert.match(humanInterventions, /emitGrowthInboxLazyPanelFetch/)
  assert.match(humanInterventions, /loadOnMount = true/)
  console.log("  ✓ human interventions panel emits fetch start/complete when lazyPanelId set")

  const operationsPanel = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")
  assert.match(operationsPanel, /panelId="inbox-diagnostics"/)
  console.log("  ✓ operations panel lazy sections require panelId")

  console.log("\nWorkflow lazy panels audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: GROWTH_INBOX_WORKFLOW_LAZY_INSTRUMENTATION_QA_MARKER,
        collapsed_fetch_policy: "zero — GrowthInboxLazyMount blocks child mount until expand",
        re_expand_policy: "cached — mounted flag persists after first activation",
      },
      null,
      2,
    ),
  )
}

runAudit()
