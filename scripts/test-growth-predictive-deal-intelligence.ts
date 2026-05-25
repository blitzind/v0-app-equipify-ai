/**
 * Regression checks for Growth Predictive Deal Intelligence slice 6.29A.
 * Run: pnpm test:growth-predictive-deal-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeCommandActionImpact } from "../lib/growth/command/command-action-engine"
import { applyDealIntelligenceForecastAdjustment } from "../lib/growth/deal-intelligence/deal-intelligence-forecast"
import {
  GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER,
  type DealIntelligenceScoreInputs,
} from "../lib/growth/deal-intelligence/deal-intelligence-types"
import { predictDealCloseWindow } from "../lib/growth/deal-intelligence/deal-close-window"
import { computeDealIntelligenceScore, sanitizeScoreInputs } from "../lib/growth/deal-intelligence/deal-score-engine"
import { mapDealRiskLevel } from "../lib/growth/deal-intelligence/deal-risk-detector"
import { recommendDealOperatorAction } from "../lib/growth/deal-intelligence/deal-recommendation-engine"
import { dealIntelligenceActionImpactBoost } from "../lib/growth/deal-intelligence/nba-deal-intelligence-bridge"
import { resolveGrowthNotificationSeverity } from "../lib/growth/notifications/notification-priority"

assert.equal(GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER, "predictive-deal-intelligence-v1")

const healthyInputs: DealIntelligenceScoreInputs = {
  stageKey: "qualified",
  stageAgeDays: 10,
  amount: 25000,
  probability: 55,
  forecastCategory: "pipeline",
  isStale: false,
  riskScore: 20,
  engagementTier: "warm",
  engagementScore: 62,
  meetingsCompleted: 1,
  meetingsScheduled: 1,
  meetingNoShows: 0,
  repliesReceived: 2,
  unansweredReplies: 0,
  researchConfidence: 68,
  websiteMaturityScore: 55,
  painSignalCount: 3,
  hasOwner: true,
  overdueFollowUp: false,
  competitorPressure: 10,
  buyingIntent: "strong",
  closeDateOverdue: false,
  cadenceTasksOverdue: 0,
}

const healthyScore = computeDealIntelligenceScore({
  companyName: "Acme HVAC",
  scoreInputs: healthyInputs,
  expectedCloseDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
})

assert.ok(healthyScore.closeProbability >= 45 && healthyScore.closeProbability <= 100)
assert.ok(healthyScore.forecastConfidence >= 30)
assert.equal(mapDealRiskLevel(healthyScore.dealRiskScore, healthyScore.riskFactors.length), healthyScore.riskLevel)
assert.ok(["call_prospect", "send_followup", "schedule_meeting", "update_opportunity", "review_research", "manual_review", "wait"].includes(healthyScore.recommendedOperatorAction))
assert.match(healthyScore.explanation, /Human approval required/)
assert.doesNotMatch(healthyScore.explanation, /input_snapshot|raw payload|score_inputs json/i)

const riskyInputs: DealIntelligenceScoreInputs = {
  ...healthyInputs,
  isStale: true,
  stageAgeDays: 35,
  meetingNoShows: 1,
  unansweredReplies: 2,
  closeDateOverdue: true,
  hasOwner: false,
  competitorPressure: 55,
  cadenceTasksOverdue: 2,
}

const riskyScore = computeDealIntelligenceScore({
  companyName: "Risky Co",
  scoreInputs: riskyInputs,
  expectedCloseDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
})

assert.ok(riskyScore.dealRiskScore > healthyScore.dealRiskScore)
assert.ok(["high", "critical"].includes(riskyScore.riskLevel))
assert.ok(riskyScore.closeProbability <= healthyScore.closeProbability)

assert.equal(
  predictDealCloseWindow({
    closeProbability: 72,
    expectedCloseDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    meetingsScheduled: 1,
  }),
  "this_week",
)

assert.equal(
  recommendDealOperatorAction({
    scoreInputs: { ...riskyInputs, unansweredReplies: 1 },
    riskLevel: "high",
    closeProbability: 40,
    unansweredReplies: 1,
    meetingsScheduled: 0,
    researchConfidence: 50,
  }),
  "send_followup",
)

const sanitized = sanitizeScoreInputs({
  ...healthyInputs,
  // @ts-expect-error ensure no raw payload keys leak
  rawEmailBody: "secret",
})
assert.equal((sanitized as Record<string, unknown>).rawEmailBody, undefined)

const baseImpact = computeCommandActionImpact({ kind: "follow_up_now", overdueFollowUp: true })
const boostedImpact = computeCommandActionImpact({
  kind: "follow_up_now",
  overdueFollowUp: true,
  dealIntelligenceBoost: dealIntelligenceActionImpactBoost({
    dealCloseProbability: 75,
    dealRiskLevel: "critical",
    recommendedOperatorAction: "call_prospect",
  }),
})
assert.ok(boostedImpact > baseImpact)

const forecast = applyDealIntelligenceForecastAdjustment({
  baseForecastConfidence: 55,
  averageDealForecastConfidence: 70,
  scoredOpportunities: 8,
  criticalRiskDeals: 2,
})
assert.ok(forecast.aiInformedForecastConfidence >= 0 && forecast.aiInformedForecastConfidence <= 100)
assert.equal(forecast.scoredOpportunities, 8)
assert.match(forecast.riskAdjustedForecastNote, /scored opportunities/)

assert.equal(resolveGrowthNotificationSeverity("deal_risk_increased"), "high")
assert.equal(resolveGrowthNotificationSeverity("high_probability_deal"), "medium")
assert.equal(resolveGrowthNotificationSeverity("forecast_confidence_dropped"), "high")
assert.equal(resolveGrowthNotificationSeverity("close_window_detected"), "medium")
assert.equal(resolveGrowthNotificationSeverity("deal_needs_action"), "high")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270308120000_growth_engine_predictive_deal_intelligence.sql"),
  "utf8",
)
assert.match(migration, /growth\.deal_intelligence_scores/)
assert.match(migration, /close_probability/)
assert.match(migration, /force row level security/)
assert.match(migration, /latest_deal_intelligence_score_id/)

const getRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/opportunities/[opportunityId]/deal-intelligence/route.ts"),
  "utf8",
)
assert.match(getRoute, /requireGrowthEnginePlatformAccess/)
assert.match(getRoute, /GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER/)

const recomputeRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/opportunities/[opportunityId]/deal-intelligence/recompute/route.ts",
  ),
  "utf8",
)
assert.match(recomputeRoute, /recomputeDealIntelligenceScore/)
assert.doesNotMatch(recomputeRoute, /updateGrowthOpportunityStage|closed_won|closed_lost|autonomous/i)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/deal-intelligence/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /fetchGrowthDealIntelligenceDashboard/)

const card = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-predictive-deal-intelligence-card.tsx"),
  "utf8",
)
assert.match(card, /data-qa-marker=\{GROWTH_PREDICTIVE_DEAL_INTELLIGENCE_QA_MARKER\}/)
assert.match(card, /no autonomous CRM movement/i)
assert.doesNotMatch(card, /score_inputs|raw payload|jsonb/i)

const commandSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-deal-intelligence-section.tsx"),
  "utf8",
)
assert.match(commandSection, /Predictive Deal Intelligence/)

const commandRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/command/command-dashboard-repository.ts"),
  "utf8",
)
assert.match(commandRepo, /dealIntelligence/)
assert.match(commandRepo, /dealIntelligenceActionImpactBoost/)

const revenueDash = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-revenue-operating-dashboard.tsx"),
  "utf8",
)
assert.match(revenueDash, /dealIntelligenceForecast/)
assert.match(revenueDash, /AI-informed/)

const masterContext = fs.readFileSync(path.join(process.cwd(), "lib/admin/master-context.ts"), "utf8")
assert.match(masterContext, /6\.29A|predictive-deal-intelligence-v1|deal_intelligence_scores/)

console.log("growth-predictive-deal-intelligence: all checks passed")
