/**
 * GS-GROWTH-OPS-7A.2 — Call workspace shortcut certification.
 * Run: pnpm test:growth-call-shortcuts-7a2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER } from "../lib/growth/operator-ux/growth-operator-primary-actions-7a2"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 Call Workspace Shortcuts Certification ===\n")
  assert.ok(GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER)

  const rail = readSource("components/growth/growth-call-workspace-intelligence-rail.tsx")
  assert.match(rail, /buildGrowthActivityHref/)
  assert.match(rail, /buildGrowthMeetingsHref/)
  assert.match(rail, /View Lead/)
  assert.match(rail, /GrowthPersonalizationEmbeddedPanel/)
  assert.match(rail, /data-growth-ops-click-reduction/)
  console.log("  ✓ call intelligence rail exposes Activity, Meetings, View Lead, and Personalization")

  console.log("\nGS-GROWTH-OPS-7A.2 call workspace shortcuts certification passed.\n")
}

main()
