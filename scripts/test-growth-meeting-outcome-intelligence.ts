/**
 * Regression checks for Growth Meeting Outcome Intelligence slice 6.33A.
 * Run: pnpm test:growth-meeting-outcome-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyMeetingOutcomeToDealScoreInputs,
  applyMeetingOutcomeToExecutionPriority,
} from "../lib/growth/meeting-outcome-intelligence/meeting-outcome-deal-adjustments"
import { computeMeetingOutcomeIntelligenceScore } from "../lib/growth/meeting-outcome-intelligence/meeting-outcome-score-engine"
import { GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER } from "../lib/growth/meeting-outcome-intelligence/meeting-outcome-intelligence-types"

assert.equal(GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER, "meeting-outcome-intelligence-v1")

const noShow = computeMeetingOutcomeIntelligenceScore({
  meetingStatus: "no_show",
  meetingOutcome: null,
  meetingFollowUpOverdue: false,
  meetingOutcomeMissing: false,
  meetingNoShow: true,
  callOverallScore: 50,
  callBuyingSignalScore: 40,
  callNextStepScore: 35,
  callCompetitorRiskScore: 20,
  callObjectionCount: 0,
  callBuyingSignalCount: 0,
  replyIntent: null,
  replyPriority: null,
  dealCloseProbability: 40,
  dealRiskScore: 30,
  executionReadinessScore: 40,
  engagementScore: 45,
  priorMeetingCount: 1,
  priorNoShowCount: 1,
  attendeeCount: 1,
})
assert.equal(noShow.followUpRecommendation, "no_show_recovery")
assert.equal(noShow.momentumTrend, "at_risk")

const strong = computeMeetingOutcomeIntelligenceScore({
  meetingStatus: "completed",
  meetingOutcome: "budget approved with timeline Q2",
  meetingFollowUpOverdue: false,
  meetingOutcomeMissing: false,
  meetingNoShow: false,
  callOverallScore: 78,
  callBuyingSignalScore: 72,
  callNextStepScore: 70,
  callCompetitorRiskScore: 15,
  callObjectionCount: 0,
  callBuyingSignalCount: 3,
  replyIntent: "pricing_question",
  replyPriority: "high",
  dealCloseProbability: 68,
  dealRiskScore: 25,
  executionReadinessScore: 72,
  engagementScore: 70,
  priorMeetingCount: 0,
  priorNoShowCount: 0,
  attendeeCount: 3,
})
assert.ok(strong.meetingOutcomeScore >= 70)
assert.ok(
  strong.followUpRecommendation === "strong_opportunity" ||
    strong.followUpRecommendation === "send_proposal_recommendation",
)

const dealAdjustments = applyMeetingOutcomeToDealScoreInputs({
  meetingOutcomeScore: 80,
  meetingQualityScore: 75,
  followUpRecommendation: "strong_opportunity",
  buyingSignalCount: 3,
})
assert.ok(dealAdjustments.closeProbabilityBoost >= 10)

const executionWeight = applyMeetingOutcomeToExecutionPriority({
  meetingQualityScore: 72,
  meetingOutcomeScore: 78,
  followUpRecommendation: "risk_of_stall",
})
assert.ok(executionWeight >= 8)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270314120000_growth_engine_meeting_outcome_intelligence.sql"),
  "utf8",
)
assert.match(migration, /meeting_outcome_intelligence_scores/)
assert.match(migration, /meeting_outcome_score/)
assert.match(migration, /follow_up_recommendation/)

const dashboardRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/meeting-outcomes/dashboard/route.ts"),
  "utf8",
)
assert.match(dashboardRoute, /requireGrowthEnginePlatformAccess/)
assert.match(dashboardRoute, /GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER/)

const leadRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/meeting-outcomes/route.ts"),
  "utf8",
)
assert.match(leadRoute, /fetchGrowthMeetingOutcomeLeadView/)

const recomputeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/leads/[leadId]/meeting-outcomes/recompute/route.ts"),
  "utf8",
)
assert.match(recomputeRoute, /recomputeGrowthMeetingOutcomesForLead/)

const commandSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-command-meeting-outcomes-section.tsx"),
  "utf8",
)
assert.match(commandSection, /Meeting Outcomes/)
assert.match(commandSection, /GROWTH_MEETING_OUTCOME_INTELLIGENCE_QA_MARKER/)

const leadCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-outcome-intelligence.tsx"),
  "utf8",
)
assert.match(leadCard, /Meeting Outcome Intelligence/)
assert.match(leadCard, /No auto-send/)

const drawer = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-lead-drawer.tsx"), "utf8")
assert.match(drawer, /GrowthLeadMeetingOutcomeIntelligence/)

const meetingIntel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-lead-meeting-intelligence.tsx"),
  "utf8",
)
assert.match(meetingIntel, /GrowthMeetingOutcomeIntelligenceInline/)

const notificationTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/notifications/notification-types.ts"),
  "utf8",
)
assert.match(notificationTypes, /meeting_follow_up_recommended/)
assert.match(notificationTypes, /meeting_at_risk/)
assert.match(notificationTypes, /meeting_high_quality/)
assert.match(notificationTypes, /meeting_stalled/)

const dealEngine = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/deal-intelligence/deal-score-engine.ts"),
  "utf8",
)
assert.match(dealEngine, /applyMeetingOutcomeToDealScoreInputs/)

const executionEngine = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/execution/execution-priority-engine.ts"),
  "utf8",
)
assert.match(executionEngine, /applyMeetingOutcomeToExecutionPriority/)

const mutateMeeting = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/meeting-intelligence/mutate-meeting.ts"),
  "utf8",
)
assert.match(mutateMeeting, /recomputeMeetingOutcomeForMeeting/)

console.log("growth-meeting-outcome-intelligence: all checks passed")
