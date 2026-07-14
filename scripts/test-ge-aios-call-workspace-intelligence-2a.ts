/**
 * GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2A certification (no production mutations).
 * Run: pnpm test:ge-aios-call-workspace-intelligence-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { mapAiosLiveReasoningToAssistEvents, buildAiosSayThisNextSnapshot } from "../lib/growth/operator-assist/aios-live-assist-mapper"
import { buildCallWorkspaceAiosLiveReasoningSnapshot } from "../lib/growth/operator-assist/call-workspace-aios-live-reasoning-builder"
import { GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER } from "../lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import { buildUnifiedOperatorAssistSnapshot } from "../lib/growth/operator-assist/orchestration"
import { resolveSayThisNext } from "../lib/growth/operator-assist/resolve-say-this-next"
import { resolveUnifiedNextBestAction } from "../lib/growth/operator-assist/nba-resolver"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

assert.equal(GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER, "ge-aios-call-workspace-intelligence-2a-v1")

const orchestration = readSource("lib/growth/operator-assist/orchestration.ts")
const operatorAssistService = readSource("lib/growth/operator-assist/operator-assist-service.ts")
const sayThisNext = readSource("lib/growth/operator-assist/resolve-say-this-next.ts")
const nbaResolver = readSource("lib/growth/operator-assist/nba-resolver.ts")
const unifiedAssistPanel = readSource("components/growth/growth-call-workspace-unified-assist-panel.tsx")
const workspaceBridge = readSource("lib/voice/browser-calling/workspace-bridge.ts")

assert.match(orchestration, /mapAiosLiveReasoningToAssistEvents/)
assert.match(orchestration, /input\.aiosLiveReasoning/)
assert.match(orchestration, /const voiceEvents = input\.aiosLiveReasoning\s*\?\s*\[\]/)
assert.match(operatorAssistService, /resolveCallWorkspaceAiosLiveReasoning/)
assert.match(sayThisNext, /buildAiosSayThisNextSnapshot/)
assert.match(nbaResolver, /aiosLiveReasoning/)
assert.match(unifiedAssistPanel, /GrowthCallWorkspaceAiosLiveAssistPanel/)
assert.doesNotMatch(workspaceBridge, /resolveCallWorkspaceAiosLiveReasoning/)
assert.match(workspaceBridge, /fetchUnifiedOperatorAssistSnapshot/)

const sellerTruth = buildOutreachSellerTruth({
  profileId: null,
  profile: null,
  sellerCompanyName: "Equipify",
  biEnrichmentLines: [],
  organizationalKnowledge: [],
  knowledgeCenterLines: [],
  industryPlaybook: null,
  prospectIndustry: "Healthcare",
  prospectTitle: "Operations Director",
})

const brief = buildOutreachSalesStrategyBrief({
  leadId: "lead-cert-1",
  companyName: "Acme Imaging",
  preparedAt: new Date().toISOString(),
  contactName: "Jordan Lee",
  contactTitle: "Operations Director",
  relationshipStrengthTier: "warm",
  contactTemperature: "warm",
  leadStatus: "contacted",
  sellerTruth,
  verifiedEvidence: ["Service indicator: depot coordination pressure"],
  equipmentServiced: ["MRI"],
})

const liveSnapshot = {
  objections: [{ key: "pricing", label: "Pricing concern", excerpt: "That sounds expensive", sequenceNumber: 4 }],
  buyingSignals: [{ key: "decision_maker_confirmed", label: "Decision maker confirmed", excerpt: "I make those calls", sequenceNumber: 5 }],
  talkRatio: { repTalkPercent: 42, prospectTalkPercent: 58, inGoalRange: true },
  discovery: { covered: ["pain_point"], missing: ["budget"] },
  riskFlags: ["pricing_pushback"],
  competitorGuidance: [],
  recommendedNextQuestion: "How are you handling depot-to-field handoffs today?",
  recommendedResponse: null,
  guidanceTips: [],
  computedAt: new Date().toISOString(),
}

const reasoning = buildCallWorkspaceAiosLiveReasoningSnapshot({
  generatedAt: new Date().toISOString(),
  leadId: "lead-cert-1",
  companyName: "Acme Imaging",
  brief,
  leadMemory: null,
  relationshipContext: {
    priorTouchCount: 2,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Follow-up on service coordination"],
    objectionSummaries: [],
    priorReplySummaries: ["Asked about pricing last week"],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: null,
    competitorPressure: null,
  },
  leadSignals: {
    relationshipStrengthScore: 62,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "contacted",
    hasMeetingScheduled: false,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 1,
    singleThreadRisk: true,
  },
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: false,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 25,
    rolesPresent: ["operations"],
    rolesMissing: ["finance", "executive"],
    verifiedMemberCount: 1,
  },
  institutionalLearning: null,
  institutionalAdvice: ["Companies like this usually respond better when you lead with operational pressure, not product features."],
  learningWeights: null,
  adaptiveEvents: [],
  liveSnapshot,
  voiceTranscript: {
    voiceCallId: "voice-1",
    segments: [
      {
        id: "seg-1",
        sequenceNumber: 4,
        speakerType: "customer",
        text: "That sounds expensive for what we need.",
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
      },
    ],
    updatedAt: new Date().toISOString(),
  },
})

assert.equal(reasoning.qaMarker, GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER)
assert.ok(reasoning.sayThisNext.recommendedNextSentence.length > 10)
assert.ok(reasoning.consultantDiscoveryIntelligence || reasoning.revenueStrategyIntelligence)
assert.ok(reasoning.relationshipAssessment?.available || reasoning.relationshipAssessment === null)

const assistEvents = mapAiosLiveReasoningToAssistEvents(reasoning)
assert.ok(assistEvents.some((event) => event.source === "aios_reasoning"))
assert.ok(assistEvents.some((event) => event.eventType === "aios_say_this_next"))

const operatorAssist = buildUnifiedOperatorAssistSnapshot({
  coachingState: null,
  coachingMode: "lead_linked",
  coachingLeadId: "lead-cert-1",
  realtimeSessionId: "rt-1",
  voiceCallId: "voice-1",
  conversationIntelligence: null,
  voiceTranscript: null,
  liveSnapshot,
  leadContext: null,
  aiosLiveReasoning: reasoning,
})

assert.equal(operatorAssist.aiosLiveReasoning?.leadId, "lead-cert-1")
assert.ok(operatorAssist.feed.every((event) => event.source !== "voice_intelligence"))
assert.ok(operatorAssist.feed.some((event) => event.source === "aios_reasoning"))

const resolvedSayThisNext = resolveSayThisNext(operatorAssist, null)
assert.equal(resolvedSayThisNext?.source, "aios_live_reasoning")
assert.equal(resolvedSayThisNext?.phrase, reasoning.sayThisNext.recommendedNextSentence)

const nba = resolveUnifiedNextBestAction({
  coachingState: null,
  liveSnapshot,
  conversationIntelligence: null,
  leadContext: null,
  rankedAssistEvents: operatorAssist.feed,
  aiosLiveReasoning: reasoning,
})
assert.equal(nba.primary?.source, "aios_live_reasoning")

const regressionSources = [
  "lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts",
  "lib/growth/aios/growth/growth-relationship-strategy-2a.ts",
  "lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence.ts",
  "lib/growth/aios/growth/growth-institutional-learning-1a-resolver.ts",
  "lib/growth/aios/growth/growth-institutional-learning-1b.ts",
  "lib/growth/aios/growth/growth-adaptive-loop-1a.ts",
  "lib/growth/aios/growth/growth-channels-1a-canonical-resolver.ts",
  "lib/growth/aios/growth/growth-send-plane-1a-canonical-loader.ts",
  "lib/growth/aios/approvals/growth-human-approval-center-engine.ts",
]

for (const source of regressionSources) {
  assert.ok(fs.existsSync(path.join(ROOT, source)), `missing canonical AI OS source: ${source}`)
}

console.log(
  JSON.stringify(
    {
      ok: true,
      qa_marker: GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER,
      say_this_next: resolvedSayThisNext?.phrase,
      assist_event_count: operatorAssist.feed.length,
      legacy_voice_events_suppressed: operatorAssist.feed.every((event) => event.source !== "voice_intelligence"),
    },
    null,
    2,
  ),
)

console.log("\nGE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2A certification PASS")
