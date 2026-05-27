/**
 * Regression checks for Growth True Call Intelligence slice 6.30A.
 * Run: pnpm test:growth-true-call-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { applyCallIntelligenceToDealScoreInputs } from "../lib/growth/call-intelligence/call-intelligence-deal-adjustments"
import {
  callIntelligenceActionImpactBoost,
  callIntelligenceNbaReason,
  mapCallIntelligenceRecommendationToCommandKind,
} from "../lib/growth/call-intelligence/call-intelligence-nba-bridge"
import {
  GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER,
  type CallIntelligenceScoreInputs,
} from "../lib/growth/call-intelligence/call-intelligence-types"
import { extractCallIntelligenceSignals } from "../lib/growth/call-intelligence/call-signal-extractor"
import {
  computeCallIntelligenceScore,
  mapCallOutcome,
  mapCallRiskLevel,
  recommendCallNextAction,
} from "../lib/growth/call-intelligence/call-score-engine"
import { computeCommandActionImpact } from "../lib/growth/command/command-action-engine"
import { computeDealIntelligenceScore } from "../lib/growth/deal-intelligence/deal-score-engine"
import type { DealIntelligenceScoreInputs } from "../lib/growth/deal-intelligence/deal-intelligence-types"
import { resolveGrowthNotificationSeverity } from "../lib/growth/notifications/notification-priority"

assert.equal(GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER, "true-call-intelligence-v1")

const healthyCallInputs: CallIntelligenceScoreInputs = {
  transcriptFinalizedCount: 12,
  guidanceGeneratedCount: 6,
  objectionCount: 1,
  buyingSignalCount: 2,
  discoveryGapCount: 1,
  competitorPressureCount: 0,
  providerInterruptions: 0,
  averageTranscriptLatencyMs: 120,
  sessionHealthScore: 82,
  guidanceLatencyMs: 400,
  executionScore: 78,
  talkRatioInGoalRange: true,
  repTalkPercent: 45,
  discoveryCoveragePercent: 80,
  nextStepSecured: true,
  meetingCompleted: true,
  meetingNoShow: false,
  meetingOutcomeMissing: false,
  meetingFollowUpDue: false,
  acceptedGuidanceCount: 2,
}

const healthySignals = extractCallIntelligenceSignals({
  snapshot: {
    objections: [{ key: "pricing_objection", label: "Price concern", severity: "medium" }],
    buyingSignals: [{ key: "pricing_interest", label: "Asked pricing", strength: "medium" }],
    talkRatio: { repPercent: 45, inGoalRange: true },
    discovery: { covered: ["timeline_asked", "budget_asked"], missing: ["decision_maker_confirmed"] },
    riskFlags: [],
    competitorGuidance: [],
    recommendedNextQuestion: null,
    recommendedResponse: null,
    guidanceTips: [],
    computedAt: new Date().toISOString(),
  },
  nextStepSecured: true,
})

const healthyScore = computeCallIntelligenceScore({
  scoreInputs: healthyCallInputs,
  signals: healthySignals,
  insufficientData: false,
})

assert.ok(healthyScore.overallScore >= 50 && healthyScore.overallScore <= 100)
assert.ok(healthyScore.buyingSignalScore >= 50)
assert.equal(mapCallRiskLevel({
  overallScore: healthyScore.overallScore,
  competitorRiskScore: healthyScore.competitorRiskScore,
  objectionCount: 1,
  nextStepScore: healthyScore.nextStepScore,
  meetingNoShow: false,
  sessionHealthScore: 82,
}), healthyScore.riskLevel)
assert.ok(["positive", "neutral", "negative", "unknown"].includes(healthyScore.outcome))
assert.doesNotMatch(healthyScore.recommendedNextAction, /transcript|audio|payload/i)

const incompleteScore = computeCallIntelligenceScore({
  scoreInputs: healthyCallInputs,
  signals: healthySignals,
  insufficientData: true,
})
assert.equal(incompleteScore.metrics.incomplete, true)
assert.equal(incompleteScore.outcome, "unknown")
assert.equal(incompleteScore.overallScore, 0)

assert.equal(
  mapCallRiskLevel({
    overallScore: 30,
    competitorRiskScore: 70,
    objectionCount: 4,
    nextStepScore: 20,
    meetingNoShow: true,
    sessionHealthScore: 40,
  }),
  "critical",
)

assert.equal(
  mapCallOutcome({
    overallScore: 72,
    buyingSignalScore: 68,
    nextStepScore: 75,
    meetingNoShow: false,
    competitorRiskScore: 20,
  }),
  "positive",
)

assert.match(recommendCallNextAction({
  nextStepScore: 30,
  objectionHandlingScore: 60,
  competitorRiskScore: 20,
  buyingSignalScore: 50,
  meetingFollowUpDue: false,
  meetingOutcomeMissing: false,
}), /next step/i)

const signals = extractCallIntelligenceSignals({
  snapshot: {
    objections: [{ key: "competitor_mention", label: "Uses ServiceTitan", severity: "high" }],
    buyingSignals: [{ key: "timeline_urgency", label: "Asked timeline", strength: "high" }],
    talkRatio: { repPercent: 70, inGoalRange: false },
    discovery: { covered: ["timeline_asked"], missing: ["budget_asked", "decision_maker_confirmed"] },
    riskFlags: ["talking_too_much", "low_discovery"],
    competitorGuidance: [{ competitor: "ServiceTitan", severity: "high", guidance: "Differentiate on workflow" }],
    recommendedNextQuestion: null,
    recommendedResponse: null,
    guidanceTips: [],
    computedAt: new Date().toISOString(),
  },
  nextStepSecured: false,
  meetingOutcomeMissing: true,
})

assert.ok(signals.detectedObjections.some((entry) => entry.key === "competitor"))
assert.ok(signals.buyingSignals.some((entry) => entry.key === "asked_timeline"))
assert.ok(signals.competitorMentions.some((entry) => entry.key === "servicetitan"))
assert.ok(signals.discoveryGaps.some((entry) => entry.key === "no_budget_confirmed"))

const dealInputs: DealIntelligenceScoreInputs = {
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
  callOverallScore: 78,
  callBuyingSignalScore: 68,
  callCompetitorRiskScore: 25,
  callNextStepScore: 72,
  callOutcome: "positive",
  meetingCompletedWithHighScore: true,
}

const withoutCall = computeDealIntelligenceScore({
  companyName: "Acme HVAC",
  scoreInputs: { ...dealInputs, callOverallScore: null, callBuyingSignalScore: null, callCompetitorRiskScore: null, callNextStepScore: null, callOutcome: null, meetingCompletedWithHighScore: false },
})
const withCall = computeDealIntelligenceScore({
  companyName: "Acme HVAC",
  scoreInputs: dealInputs,
})
assert.ok(withCall.closeProbability >= withoutCall.closeProbability)
assert.ok(withCall.forecastConfidence >= withoutCall.forecastConfidence)

const callAdjustments = applyCallIntelligenceToDealScoreInputs({
  callBuyingSignalScore: 68,
  callOverallScore: 78,
  callOutcome: "positive",
  callCompetitorRiskScore: 55,
  callNextStepScore: 30,
  meetingCompletedWithHighScore: true,
})
assert.ok(callAdjustments.closeProbabilityBoost > 0)
assert.ok(callAdjustments.riskBoost > 0)
assert.ok(callAdjustments.momentumBoost < 0)

const baseImpact = computeCommandActionImpact({ kind: "follow_up_now", overdueFollowUp: true })
const boostedImpact = computeCommandActionImpact({
  kind: "follow_up_now",
  overdueFollowUp: true,
  callIntelligenceBoost: callIntelligenceActionImpactBoost({
    overallScore: 40,
    riskLevel: "critical",
    nextStepScore: 30,
    objectionCount: 3,
  }),
})
assert.ok(boostedImpact > baseImpact)

assert.equal(mapCallIntelligenceRecommendationToCommandKind("Secure explicit next step"), "follow_up_now")
assert.match(callIntelligenceNbaReason({
  id: "x",
  leadId: "y",
  opportunityId: null,
  meetingId: null,
  realtimeSessionId: null,
  ownerUserId: null,
  overallScore: 70,
  conversationQualityScore: 70,
  discoveryScore: 70,
  objectionHandlingScore: 70,
  buyingSignalScore: 70,
  nextStepScore: 70,
  talkListenBalanceScore: 70,
  competitorRiskScore: 20,
  confidenceScore: 70,
  riskLevel: "low",
  outcome: "positive",
  detectedObjections: [],
  buyingSignals: [],
  competitorMentions: [],
  discoveryGaps: [],
  nextStepCommitments: [],
  coachingOpportunities: [],
  safeSummary: "Strong call.",
  recommendedNextAction: "Advance opportunity with human approval",
  metrics: {},
  computedAt: new Date().toISOString(),
}) ?? "", /Call intelligence suggests/)

assert.equal(resolveGrowthNotificationSeverity("call_score_low"), "high")
assert.equal(resolveGrowthNotificationSeverity("next_step_missing"), "medium")
assert.equal(resolveGrowthNotificationSeverity("competitor_risk_detected"), "high")
assert.equal(resolveGrowthNotificationSeverity("unresolved_objection"), "medium")
assert.equal(resolveGrowthNotificationSeverity("strong_buying_signal"), "medium")
assert.equal(resolveGrowthNotificationSeverity("call_followup_due"), "medium")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270309120000_growth_engine_true_call_intelligence.sql"),
  "utf8",
)
assert.match(migration, /growth\.call_intelligence_scorecards/)
assert.match(migration, /overall_score/)
assert.match(migration, /force row level security/)
assert.match(migration, /detected_objections/)
assert.doesNotMatch(migration, /transcript_text|audio_url|audio_blob/i)

const getRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/call-intelligence/route.ts"),
  "utf8",
)
assert.match(getRoute, /requireGrowthEnginePlatformAccess/)
assert.match(getRoute, /GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER/)

const recomputeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/call-intelligence/recompute/route.ts"),
  "utf8",
)
assert.match(recomputeRoute, /generateCallIntelligenceScorecard/)
assert.doesNotMatch(recomputeRoute, /autonomous|closed_won|sendEmail/i)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-intelligence/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /fetchGrowthCallIntelligenceDashboard/)

const card = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-intelligence-scorecard-card.tsx"),
  "utf8",
)
assert.match(card, /data-qa-marker=\{GROWTH_TRUE_CALL_INTELLIGENCE_QA_MARKER\}/)
assert.match(card, /no audio replay/i)
assert.doesNotMatch(card, /score_inputs|raw payload|jsonb/i)

const commandSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-call-intelligence-section.tsx"),
  "utf8",
)
assert.match(commandSection, /Call Intelligence/)

const commandRepo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/command/command-dashboard-repository.ts"),
  "utf8",
)
assert.match(commandRepo, /callIntelligence/)
assert.match(commandRepo, /callIntelligenceActionImpactBoost/)

const repo = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/call-intelligence/call-intelligence-repository.ts"),
  "utf8",
)
assert.match(repo, /safe_summary/)
assert.doesNotMatch(repo, /transcript_content|audio_url|audio_blob/i)

const masterContext = fs.readFileSync(path.join(process.cwd(), "lib/admin/master-context.manual.before.md"), "utf8")
assert.match(masterContext, /6\.30A|true-call-intelligence-v1|call_intelligence_scorecards/)

console.log("growth-true-call-intelligence: all checks passed")
