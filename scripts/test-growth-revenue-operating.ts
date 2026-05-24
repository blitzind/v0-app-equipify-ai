/**
 * Regression checks for Growth Engine revenue operating layer (slice 6.20A).
 * Run: pnpm test:growth-revenue-operating
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_REVENUE_OPERATING_QA_MARKER } from "../lib/growth/revenue-operating/revenue-operating-types"
import {
  computeGrowthRevenueForecastTotals,
  computeGrowthRevenueGoalPacing,
  type OpportunityRollupRow,
} from "../lib/growth/revenue-operating/revenue-forecast-rollup"
import { detectGrowthRevenueMovements } from "../lib/growth/revenue-operating/revenue-movement-detector"
import { resolveGrowthRevenueDateRange } from "../lib/growth/revenue-operating/revenue-date-ranges"

assert.equal(GROWTH_REVENUE_OPERATING_QA_MARKER, "growth-revenue-operating-v1")

const range = resolveGrowthRevenueDateRange("this_quarter")
const baseRow: OpportunityRollupRow = {
  id: "opp-1",
  lead_id: "lead-1",
  owner_user_id: "user-1",
  company_name: "Acme",
  title: "Acme deal",
  stage_key: "proposal",
  stage_order: 4,
  amount: 100000,
  weighted_amount: 60000,
  probability: 60,
  forecast_category: "commit",
  expected_close_date: "2026-06-15",
  risk_score: 20,
  is_stale: false,
  age_days: 10,
  stage_entered_at: new Date().toISOString(),
  closed_won_at: null,
  closed_lost_at: null,
  created_at: new Date().toISOString(),
}

const totals = computeGrowthRevenueForecastTotals({ rows: [baseRow], range })
assert.equal(totals.weightedPipelineAmount, 60000)
assert.equal(totals.commitForecast, 60000)

const goalPacing = computeGrowthRevenueGoalPacing({
  totals,
  settings: {
    id: "s",
    monthlyGoal: 0,
    quarterlyGoal: 120000,
    defaultForecastPeriod: "this_quarter",
    staleDealThresholdDays: 14,
    coverageTargetMultiplier: 3,
    highValueDealThreshold: 25000,
    updatedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  period: "this_quarter",
})

assert.equal(goalPacing.gapToGoal, 60000)
assert.ok(goalPacing.coverageRatio > 0)

const movements = detectGrowthRevenueMovements({
  previous: [],
  current: [
    {
      id: "opp-1",
      leadId: "lead-1",
      companyName: "Acme",
      amount: 100000,
      weightedAmount: 60000,
      stageKey: "proposal",
      stageOrder: 4,
      forecastCategory: "commit",
      expectedCloseDate: "2026-06-15",
      riskScore: 20,
      isStale: false,
      ownerUserId: "user-1",
      closedWon: false,
      closedLost: false,
    },
  ],
})
assert.equal(movements[0]?.movementType, "new_opportunity")

const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-operating/revenue-operating-dashboard-repository.ts"),
  "utf8",
)
assert.match(dashboardSource, /recomputeGrowthRevenueOperatingDashboard/)
assert.doesNotMatch(dashboardSource, /openai|anthropic/i)

const routeSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/revenue-operating/dashboard/route.ts"),
  "utf8",
)
assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270227120000_growth_engine_revenue_operating.sql"),
  "utf8",
)
assert.match(migrationSource, /revenue_forecast_settings/)
assert.match(migrationSource, /revenue_forecast_movements/)

console.log("growth revenue operating tests passed")
