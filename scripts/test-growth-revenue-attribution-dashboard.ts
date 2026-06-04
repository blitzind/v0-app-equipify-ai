/**
 * Phase 6.32B-2 — Revenue attribution dashboard regression.
 * Run: pnpm test:growth-revenue-attribution-dashboard
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildAttributionPathFromTouches } from "../lib/growth/revenue-attribution/attribution-path-utils"
import {
  attributionModelLabel,
  GROWTH_ATTRIBUTION_MODELS,
  GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER,
} from "../lib/growth/revenue-attribution/revenue-attribution-dashboard-types"
import type { GrowthAttributionTouch } from "../lib/growth/revenue-attribution/attribution-touch-types"
import { defaultChannelForTouchType } from "../lib/growth/revenue-attribution/attribution-touch-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function touch(partial: Partial<GrowthAttributionTouch> & Pick<GrowthAttributionTouch, "id" | "touchType" | "touchedAt">): GrowthAttributionTouch {
  return {
    leadId: "lead-1",
    opportunityId: null,
    channel: defaultChannelForTouchType(partial.touchType),
    sequenceId: null,
    sequenceStepId: null,
    sequenceEnrollmentId: null,
    senderAccountId: null,
    repUserId: null,
    campaignId: null,
    deliveryAttemptId: null,
    revenueAttributionEventId: null,
    attributionSource: "test",
    attributionConfidence: 1,
    metadata: {},
    createdAt: new Date().toISOString(),
    ...partial,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_REVENUE_ATTRIBUTION_DASHBOARD_QA_MARKER, "growth-revenue-attribution-dashboard-v2")
  assert.equal(GROWTH_ATTRIBUTION_MODELS.length, 4)
  assert.equal(attributionModelLabel("linear"), "Linear")
  assert.equal(attributionModelLabel("time_decay"), "Time decay")

  const path = buildAttributionPathFromTouches(
    [
      touch({ id: "a", touchType: "lead_import", touchedAt: "2026-01-01T00:00:00Z" }),
      touch({ id: "b", touchType: "email_send", touchedAt: "2026-01-02T00:00:00Z", channel: "email" }),
      touch({ id: "c", touchType: "opportunity_won", touchedAt: "2026-01-03T00:00:00Z", opportunityId: "opp-1" }),
    ],
    { leadId: "lead-1", opportunityId: null, pathScope: "lead" },
  )
  assert.equal(path.firstTouchId, "a")
  assert.equal(path.lastTouchId, "c")

  const querySource = readSource("lib/growth/revenue-attribution/revenue-attribution-dashboard-queries.ts")
  assert.match(querySource, /attribution_touches/)
  assert.match(querySource, /attribution_paths/)

  const dashSource = readSource("lib/growth/revenue-attribution/revenue-attribution-dashboard.ts")
  assert.match(dashSource, /creditsFromPathSummaryOrCompute/)
  assert.match(readSource("lib/growth/revenue-attribution/attribution-credit-model.ts"), /time_decay/)
  assert.match(dashSource, /fetchGrowthRevenueAttributionDashboard/)

  const apiSource = readSource("app/api/platform/growth/revenue-attribution/dashboard/route.ts")
  assert.match(apiSource, /fetchGrowthRevenueAttributionDashboard/)
  assert.match(apiSource, /attribution_model/)

  const uiSource = readSource("components/growth/growth-revenue-attribution-dashboard.tsx")
  assert.match(uiSource, /revenue-attribution\/dashboard/)
  assert.match(uiSource, /time_decay/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /revenue-attribution/)

  console.log("growth revenue attribution dashboard tests passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
