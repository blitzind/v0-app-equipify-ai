/**
 * GS-GROWTH-OPS-6C — Opportunity persisted NBA display certification.
 * Run: pnpm test:growth-opportunity-nba-display-6c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_OPPORTUNITY_NEXT_BEST_ACTION_CARD_QA_MARKER } from "../components/growth/growth-opportunity-next-best-action-card"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-6C Opportunity NBA Display Certification ===\n")
  assert.ok(GROWTH_OPPORTUNITY_NEXT_BEST_ACTION_CARD_QA_MARKER)

  const card = readSource("components/growth/growth-opportunity-next-best-action-card.tsx")
  assert.match(card, /GROWTH_NEXT_BEST_ACTION_LABELS/)
  assert.match(card, /nextBestAction/)
  assert.match(card, /Generate Follow-Up/)
  assert.match(card, /Open Personalization/)
  assert.match(card, /Start Call/)
  assert.match(card, /Open Activity/)
  assert.match(card, /Book Meeting/)
  assert.doesNotMatch(card, /nextBestActionScore|recompute|calculate/)
  console.log("  ✓ NBA card is display-only with operator action shortcuts")

  const pipeline = readSource("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  assert.match(pipeline, /GrowthOpportunityNextBestActionCard/)
  console.log("  ✓ pipeline detail panel mounts NBA card")

  const workspace = readSource("components/growth/growth-opportunity-workspace-dashboard.tsx")
  assert.match(workspace, /GrowthOpportunityNextBestActionCard/)
  console.log("  ✓ opportunity workspace mounts NBA card for selected account")

  console.log("\nGS-GROWTH-OPS-6C opportunity NBA display certification passed.\n")
}

main()
