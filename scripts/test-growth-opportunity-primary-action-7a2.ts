/**
 * GS-GROWTH-OPS-7A.2 — Opportunity NBA primary action certification.
 * Run: pnpm test:growth-opportunity-primary-action-7a2
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER,
  resolveGrowthOpportunityNbaPrimaryAction,
} from "../lib/growth/operator-ux/growth-operator-primary-actions-7a2"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.2 Opportunity NBA Primary Action Certification ===\n")
  assert.ok(GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER)

  const card = readSource("components/growth/growth-opportunity-next-best-action-card.tsx")
  assert.match(card, /resolveGrowthOpportunityNbaPrimaryAction/)
  assert.match(card, /buildGrowthOpportunityNbaSecondaryActions/)
  assert.match(card, /DropdownMenu/)
  assert.match(card, /nextBestAction/)
  assert.doesNotMatch(card, /nextBestActionScore|recompute|calculate/)
  console.log("  ✓ NBA card renders one primary action with overflow secondary links")

  assert.equal(resolveGrowthOpportunityNbaPrimaryAction("call_now", "lead-1").label, "Start Call")
  assert.equal(resolveGrowthOpportunityNbaPrimaryAction("owner_close_motion", "lead-1").label, "Book Meeting")
  assert.equal(resolveGrowthOpportunityNbaPrimaryAction(null, "lead-1").label, "Generate Follow-Up")
  console.log("  ✓ persisted NBA maps to display-only primary labels")

  console.log("\nGS-GROWTH-OPS-7A.2 opportunity NBA primary action certification passed.\n")
}

main()
