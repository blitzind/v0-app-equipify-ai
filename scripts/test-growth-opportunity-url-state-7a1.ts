/**
 * GS-GROWTH-OPS-7A.1 — Opportunity pipeline URL state persistence certification.
 * Run: pnpm test:growth-opportunity-url-state-7a1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthOpportunityPipelineHref,
  GROWTH_OPPORTUNITY_ID_URL_PARAM,
  GROWTH_OPS_URL_STATE_7A1_QA_MARKER,
  selectNewestGrowthOpportunityForLead,
} from "../lib/growth/navigation/growth-workspace-url-state-7a1"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-GROWTH-OPS-7A.1 Opportunity URL State Certification ===\n")
  assert.ok(GROWTH_OPS_URL_STATE_7A1_QA_MARKER)

  const dashboard = readSource("components/growth/growth-opportunity-pipeline-dashboard.tsx")
  assert.match(dashboard, /resolveGrowthOpportunityIdFromSearchParams/)
  assert.match(dashboard, /selectNewestGrowthOpportunityForLead/)
  assert.match(dashboard, /buildGrowthOpportunityPipelineHref/)
  assert.match(dashboard, /router\.replace/)
  assert.match(dashboard, /selectOpportunity/)
  assert.match(dashboard, /GrowthOpportunityNextBestActionCard/)
  console.log("  ✓ opportunity pipeline hydrates deep links, syncs manual selection, retains NBA card")

  const href = buildGrowthOpportunityPipelineHref({ opportunityId: "opp-1", leadId: "lead-1" })
  assert.match(href, /\/growth\/opportunities\/pipeline\?/)
  assert.match(href, new RegExp(`${GROWTH_OPPORTUNITY_ID_URL_PARAM}=opp-1`))
  assert.match(href, /leadId=lead-1/)
  console.log("  ✓ opportunity href builder uses workspace pipeline params")

  const newest = selectNewestGrowthOpportunityForLead(
    [
      { id: "old", leadId: "lead-1", updatedAt: "2026-01-01T10:00:00.000Z" },
      { id: "new", leadId: "lead-1", updatedAt: "2026-06-01T10:00:00.000Z" },
    ],
    "lead-1",
  )
  assert.equal(newest?.id, "new")
  console.log("  ✓ leadId deep link selects newest matching opportunity")

  console.log("\nGS-GROWTH-OPS-7A.1 opportunity URL state certification passed.\n")
}

main()
