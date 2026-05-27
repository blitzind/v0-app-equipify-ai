/**
 * Regression checks for Growth Engine multi-channel revenue intelligence Phase 7.
 * Run: pnpm test:growth-multichannel-revenue-intelligence-v1
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeChannelAwareBuyingMomentum } from "../lib/growth/revenue-intelligence/channel-aware-momentum-engine"
import { buildMultichannelRevenueCopilot } from "../lib/growth/revenue-intelligence/multichannel-copilot-service"
import { computeBuyingMomentum } from "../lib/growth/revenue-intelligence/buying-momentum-engine"
import {
  GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
  GROWTH_MULTICHANNEL_CHANNELS,
} from "../lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

assert.equal(GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER, "growth-multichannel-revenue-intelligence-v1")
assert.ok(GROWTH_MULTICHANNEL_CHANNELS.includes("email"))
assert.ok(GROWTH_MULTICHANNEL_CHANNELS.includes("meeting"))

const base = computeBuyingMomentum({
  threadReplyCount: 2,
  responseLatencyMs: 2 * 60 * 60 * 1000,
  buyingSignalCount: 2,
  objectionCount: 1,
  resolvedObjectionCount: 0,
  outboundMessageCount: 4,
  stakeholderCount: 2,
})

const channelAware = computeChannelAwareBuyingMomentum({
  ...{
    threadReplyCount: 2,
    responseLatencyMs: 2 * 60 * 60 * 1000,
    buyingSignalCount: 2,
    objectionCount: 1,
    resolvedObjectionCount: 0,
    outboundMessageCount: 4,
    stakeholderCount: 2,
  },
  connectedCallCount: 2,
  totalCallDurationSeconds: 600,
  meetingsBooked: 1,
  meetingsAttended: 1,
  meetingsNoShow: 0,
  smsTouchCount: 1,
  smsReplyCount: 0,
  channelTouchCounts: { email: 3, call: 2, meeting: 1, website: 2 },
  engagementGapDays: 2,
})

assert.ok(channelAware.compositeMomentumScore >= base.momentumScore - 20)
assert.ok(channelAware.callEngagementScore > 0)
assert.ok(channelAware.meetingEngagementScore > 0)
assert.ok(channelAware.channelDiversityScore > 0)
assert.ok(channelAware.explainability.length > base.explainability.length)

const copilot = buildMultichannelRevenueCopilot({
  companyLabel: "Acme",
  momentum: channelAware,
  timelineEntries: [
    {
      id: "1",
      channel: "email",
      eventKind: "reply_received",
      eventSource: "outbound_replies",
      title: "Reply",
      summary: "Interested reply",
      evidenceExcerpt: "Can we schedule a demo?",
      occurredAt: new Date().toISOString(),
      attributionType: "reply",
      payload: {},
    },
  ],
  callMeeting: {
    meetingsBooked: 1,
    meetingsAttended: 1,
    meetingsNoShow: 0,
    connectedCallCount: 2,
    totalCallDurationSeconds: 600,
    objectionHeavyCallCount: 0,
    positiveSentimentIndicators: ["Call disposition: interested"],
    followUpCommitments: ["Follow-up scheduled 2026-05-28"],
    evidence: ["Meeting outcome: positive"],
  },
  intentCorrelation: {
    pageviewCount: 3,
    identifiedVisits: 1,
    outboundActivityCount: 2,
    replyCount: 1,
    meetingCount: 1,
    momentumScore: 70,
    correlationStrength: "moderate",
    evidence: ["3 pageview event(s) from intent pixel telemetry."],
  },
  bestNextTouchpoint: "Review channel mix manually.",
  engagementGaps: [],
})

assert.equal(copilot.assistedLabel, "AI-assisted")
assert.equal(copilot.qaMarker, GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER)
assert.ok(copilot.evidenceExcerpts.length > 0)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270603120000_growth_multichannel_revenue_intelligence_v1.sql"),
  "utf8",
)
assert.match(migrationSource, /multi_channel_activity_timeline_events/)
assert.match(migrationSource, /channel_effectiveness_snapshots/)
assert.match(migrationSource, /website_intent_correlation_snapshots/)
assert.match(migrationSource, /growth-multichannel-revenue-intelligence-v1/)
assert.match(migrationSource, /call_engagement_score/)

const processSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/process-multichannel-revenue-intelligence.ts"),
  "utf8",
)
assert.match(processSource, /processMultichannelRevenueIntelligence/)

const revenueProcess = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/process-revenue-intelligence.ts"),
  "utf8",
)
assert.match(revenueProcess, /processMultichannelRevenueIntelligence/)

const timelineSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/multi-channel-activity-timeline.ts"),
  "utf8",
)
assert.match(timelineSource, /fetchMultiChannelActivityTimeline/)
assert.match(timelineSource, /GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER/)

const workspaceUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-operator-execution-workspace-v2.tsx"),
  "utf8",
)
assert.match(workspaceUi, /GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER/)

const executiveUi = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-executive-revenue-ops-section.tsx"),
  "utf8",
)
assert.match(executiveUi, /GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER/)

const schemaHealth = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/multichannel-revenue-intelligence-schema-health.ts"),
  "utf8",
)
assert.match(schemaHealth, /probeGrowthMultichannelRevenueIntelligenceSchemaHealth/)

const analyticsSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/revenue-intelligence/channel-effectiveness-analytics.ts"),
  "utf8",
)
assert.match(analyticsSource, /computeGlobalChannelEffectiveness/)

console.log("growth-multichannel-revenue-intelligence-v1: all checks passed")
