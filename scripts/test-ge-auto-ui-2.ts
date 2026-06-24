/**
 * GE-AUTO-UI-2 — Operator Autonomy Control Center redesign regression cert.
 * Run: pnpm test:ge-auto-ui-2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AUTO_UI_2_QA_MARKER,
  GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS,
  GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS,
  GROWTH_AUTONOMY_CONTROL_CENTER_SUBTITLE,
  GROWTH_AUTONOMY_CONTROL_CENTER_TITLE,
} from "../lib/growth/autonomy/growth-autonomy-operator-ui"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GE-AUTO-UI-2 ===\n")
  assert.equal(GE_AUTO_UI_2_QA_MARKER, "ge-auto-ui-2-v1")
  console.log("  ✓ QA marker")

  assert.equal(GROWTH_AUTONOMY_CONTROL_CENTER_TITLE, "Growth Autonomy")
  assert.match(GROWTH_AUTONOMY_CONTROL_CENTER_SUBTITLE, /approvals and safety limits/)
  console.log("  ✓ Operator hero copy")

  assert.ok(GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS.some((g) => g.title === "Find & Learn"))
  assert.ok(GROWTH_AUTONOMY_CAPABILITY_OPERATOR_GROUPS.some((g) => g.title === "Outreach"))
  assert.equal(GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS.autonomous_outbound_actions, "Autonomous sends")
  assert.doesNotMatch(GROWTH_AUTONOMY_BUDGET_OPERATOR_LABELS.autonomous_research_runs, /autonomous_/)
  console.log("  ✓ Operator label mapping layer")

  const controlCenter = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(controlCenter, /GrowthAutonomyControlCenter/)
  assert.match(controlCenter, /Operating mode/)
  assert.match(controlCenter, /What AI can do/)
  assert.match(controlCenter, /Daily safety limits/)
  assert.match(controlCenter, /Human approval/)
  assert.match(controlCenter, /Test without sending/)
  assert.match(controlCenter, /Advanced platform controls/)
  assert.match(controlCenter, /Advanced allowlists/)
  assert.match(controlCenter, /View objectives/)
  assert.match(controlCenter, /View approval queue/)
  assert.doesNotMatch(controlCenter, /Channel prepare &amp; send controls/)
  assert.doesNotMatch(controlCenter, /Kill switches/)
  assert.doesNotMatch(controlCenter, /QA marker:/)
  console.log("  ✓ Control center sections and operator navigation")

  const page = readSource("app/(growth)/growth/settings/autonomy/page.tsx")
  assert.match(page, /GrowthAutonomyControlCenter/)
  assert.doesNotMatch(page, /GrowthCommunicationsSettingsSection/)
  console.log("  ✓ Autonomy page uses dedicated control center shell")

  const outboundPanel = readSource("components/growth/autonomy/growth-autonomy-outbound-dashboard-panel.tsx")
  assert.match(outboundPanel, /Today&apos;s activity/)
  assert.match(outboundPanel, /Advanced outbound metrics are available to platform admins/)
  assert.doesNotMatch(outboundPanel, /Outbound autonomy dashboard/)
  console.log("  ✓ Outbound summary uses operator language")

  const settingsPanel = readSource("components/growth/settings/growth-autonomy-settings-panel.tsx")
  assert.match(settingsPanel, /GrowthAutonomyControlCenter/)
  console.log("  ✓ Settings panel re-exports control center")

  console.log("\nGE-AUTO-UI-2 passed.\n")
}

main()
