/**
 * Regression checks for Growth Engine opportunity pipeline (slice 6.19A).
 * Run: pnpm test:growth-opportunity-pipeline
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER,
  GROWTH_OPPORTUNITY_STAGE_KEYS,
} from "../lib/growth/opportunity-pipeline/pipeline-types"
import {
  computeGrowthOpportunityWeightedAmount,
  DEFAULT_STAGE_PROBABILITY,
  resolveGrowthOpportunityStageProbability,
} from "../lib/growth/opportunity-pipeline/pipeline-probability"
import { computeGrowthOpportunityRisk } from "../lib/growth/opportunity-pipeline/pipeline-risk"

assert.equal(GROWTH_OPPORTUNITY_PIPELINE_QA_MARKER, "growth-opportunity-pipeline-v1")
assert.equal(DEFAULT_STAGE_PROBABILITY.discovery, 20)
assert.equal(DEFAULT_STAGE_PROBABILITY.qualified, 40)
assert.equal(DEFAULT_STAGE_PROBABILITY.proposal, 60)
assert.equal(DEFAULT_STAGE_PROBABILITY.negotiation, 75)
assert.equal(DEFAULT_STAGE_PROBABILITY.verbal_commit, 90)
assert.equal(DEFAULT_STAGE_PROBABILITY.closed_won, 100)
assert.equal(DEFAULT_STAGE_PROBABILITY.closed_lost, 0)

assert.equal(
  resolveGrowthOpportunityStageProbability("proposal", { proposal: 65 }),
  65,
)

assert.equal(computeGrowthOpportunityWeightedAmount(100000, 60), 60000)

const risk = computeGrowthOpportunityRisk({
  stageKey: "proposal",
  stageAgeDays: 20,
  ageDays: 30,
  staleStageDays: 14,
  staleActivityDays: 21,
  lastActivityAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  expectedCloseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  followUpAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  engagementTrend: "declining",
  ownerOverloaded: true,
})

assert.ok(risk.riskScore >= 50)
assert.ok(risk.isStale)
assert.ok(risk.riskSignals.some((signal) => signal.key === "close_date_passed"))

const mutateSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/opportunity-pipeline/mutate-opportunity.ts"),
  "utf8",
)
assert.match(mutateSource, /updateGrowthOpportunityStage/)
assert.doesNotMatch(mutateSource, /auto.*close/i)

const pipelineRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/opportunities/pipeline/route.ts"),
  "utf8",
)
assert.match(pipelineRoute, /requireGrowthEnginePlatformAccess/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270226120000_growth_engine_opportunity_pipeline.sql"),
  "utf8",
)
assert.match(migrationSource, /growth\.opportunities/)
assert.match(migrationSource, /opportunity_created/)
assert.match(migrationSource, /stage_changed/)

assert.ok(GROWTH_OPPORTUNITY_STAGE_KEYS.includes("closed_won"))
assert.ok(GROWTH_OPPORTUNITY_STAGE_KEYS.includes("closed_lost"))

console.log("growth opportunity pipeline tests passed")
