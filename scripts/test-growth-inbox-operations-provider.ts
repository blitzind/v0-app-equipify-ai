/**
 * Phase 8A.3 — Growth inbox operations provider scope audit.
 *
 * Usage: pnpm test:growth-inbox-operations-provider
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
  console.log("\n=== Growth inbox operations provider audit (growth-inbox-operations-provider-v1) ===\n")

  const layout = readSource("app/(growth)/growth/inbox/layout.tsx")
  const inboxPage = readSource("app/(growth)/growth/inbox/page.tsx")
  const workflowPage = readSource("app/(growth)/growth/inbox/workflow/page.tsx")
  const operationsPage = readSource("app/(growth)/growth/inbox/operations/page.tsx")
  const provider = readSource("components/growth/inbox/growth-inbox-workspace-provider.tsx")
  const supportingPanels = readSource("components/growth/inbox/growth-inbox-v2-supporting-panels.tsx")
  const operationsPanel = readSource("components/growth/inbox/growth-inbox-workspace-operations-panel.tsx")

  assert.match(layout, /GrowthInboxWorkspaceProvider/)
  assert.match(layout, /GrowthInboxShell/)
  assert.doesNotMatch(inboxPage, /GrowthInboxWorkspaceProvider/)
  console.log("  ✓ inbox layout mounts a single shared GrowthInboxWorkspaceProvider")

  assert.match(workflowPage, /GrowthInboxWorkspaceWorkflowPanel/)
  assert.match(operationsPage, /GrowthInboxWorkspaceOperationsPanel/)
  console.log("  ✓ workflow and operations pages render tab panels under inbox layout")

  assert.match(operationsPanel, /GrowthInboxV2SupportingPanels/)
  assert.match(supportingPanels, /useOptionalGrowthInboxWorkspace/)
  assert.match(supportingPanels, /Inbox workspace unavailable/)
  assert.match(provider, /useOptionalGrowthInboxWorkspace/)
  console.log("  ✓ supporting panels guard missing provider context")

  assert.equal(
    (layout.match(/<GrowthInboxWorkspaceProvider/g) ?? []).length,
    1,
    "layout must not duplicate providers",
  )
  console.log("  ✓ no duplicate GrowthInboxWorkspaceProvider in workspace inbox layout")

  console.log("\nGrowth inbox operations provider audit PASS\n")
  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: "growth-inbox-operations-provider-v1",
        operations_panel_qa_marker: "growth-inbox-operations-panel-v3",
      },
      null,
      2,
    ),
  )
}

runAudit()
