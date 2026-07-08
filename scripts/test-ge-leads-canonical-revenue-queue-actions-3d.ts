/**
 * GE-LEADS-CANONICAL-3D — Static tests for Revenue Queue canonical actions + default API flip.
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-leads-canonical-revenue-queue-actions-3d.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { parseRevenueQueueApiSource } from "@/lib/growth/revenue-queue/revenue-queue-api-bridge"
import { GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER } from "@/lib/growth/revenue-queue/revenue-queue-action-bridge"

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8")
}

function main(): void {
  assert.equal(parseRevenueQueueApiSource(null), "canonical", "default API source must be canonical")
  assert.equal(parseRevenueQueueApiSource(undefined), "canonical")
  assert.equal(parseRevenueQueueApiSource("legacy"), "legacy")
  assert.equal(parseRevenueQueueApiSource("canonical"), "canonical")

  const actionsRoute = read("app/api/platform/growth/lead-inbox/[leadId]/actions/route.ts")
  assert.match(actionsRoute, /executeRevenueQueueAction/)
  assert.doesNotMatch(actionsRoute, /fetchLeadInboxById/)
  assert.doesNotMatch(actionsRoute, /claimLead\(/)

  const actionBridge = read("lib/growth/revenue-queue/revenue-queue-action-bridge.ts")
  assert.match(actionBridge, /resolveRevenueQueueActionTarget/)
  assert.match(actionBridge, /fetchGrowthLeadById[\s\S]*?fetchLeadInboxById/, "canonical resolution first")
  assert.match(actionBridge, /applyCanonicalLeadAction/)
  assert.match(actionBridge, /updateGrowthLead/)
  assert.match(actionBridge, /archiveGrowthLeads/)
  assert.match(actionBridge, /recomputeGrowthLeadWorkflowSignals/)
  assert.doesNotMatch(
    actionBridge,
    /async function applyCanonicalLeadAction[\s\S]*?claimLead\(/,
    "canonical path must not call inbox claimLead",
  )
  assert.equal(GROWTH_REVENUE_QUEUE_ACTION_BRIDGE_QA_MARKER, "growth-revenue-queue-action-bridge-v1")

  const detailBridge = read("lib/growth/revenue-queue/revenue-queue-detail-bridge.ts")
  assert.match(
    detailBridge,
    /fetchGrowthLeadById[\s\S]*?fetchLeadInboxById/,
    "detail bridge prefers canonical id",
  )

  const dashboard = read("components/growth/lead-operator/growth-lead-inbox-dashboard.tsx")
  assert.doesNotMatch(dashboard, /source=legacy/)
  assert.match(dashboard, /\/api\/platform\/growth\/lead-inbox\?sort=/)

  const hubMetrics = read("lib/growth/hubs/growth-leads-hub-metrics-client.ts")
  assert.match(hubMetrics, /\/api\/platform\/growth\/lead-inbox\?sort=priority/)
  assert.doesNotMatch(hubMetrics, /source=legacy/)

  console.log(
    JSON.stringify(
      {
        ok: true,
        qa_marker: "GE-LEADS-CANONICAL-3D-ACTIONS-STATIC-TEST",
        checks_passed: true,
      },
      null,
      2,
    ),
  )
}

main()
