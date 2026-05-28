/**
 * Voice passive conversation intelligence — Phase 2A regression checks.
 * Run: pnpm test:voice-conversation-intelligence-phase-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  combineSegmentConfidence,
  filterEvidenceBackedInsights,
  hasStrongIntelligenceEvidence,
  VOICE_INTELLIGENCE_MIN_CONFIDENCE,
} from "../lib/voice/intelligence/evidence"
import { analyzeTranscriptSegmentWithDeterministicRules } from "../lib/voice/intelligence/deterministic-rules-provider"
import {
  resolveConfiguredIntelligenceAnalysisProvider,
} from "../lib/voice/intelligence/registry"
import {
  VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER,
} from "../lib/voice/intelligence/types"
import {
  voiceIntelligenceAllowsAutonomousAction,
  VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED,
} from "../lib/voice/intelligence/passive-mode-guard"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER, "voice-conversation-intelligence-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v16")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270616120000_voice_compliance_orchestration_phase_4c")
assert.equal(VOICE_INTELLIGENCE_PASSIVE_MODE_ENABLED, true)
assert.equal(VOICE_INTELLIGENCE_AUTONOMOUS_ACTIONS_DISABLED, true)
assert.equal(voiceIntelligenceAllowsAutonomousAction(), false)

assert.equal(
  hasStrongIntelligenceEvidence({
    transcriptText: "That price is too high for our budget this quarter.",
    evidenceText: "price is too high",
    confidenceScore: 0.88,
  }),
  true,
)
assert.equal(
  hasStrongIntelligenceEvidence({
    transcriptText: "Hello there",
    evidenceText: "missing phrase",
    confidenceScore: 0.99,
  }),
  false,
)

const weakInsights = filterEvidenceBackedInsights("Please stop calling me about this.", [
  {
    category: "risk",
    eventType: "opt_out_intent",
    confidenceScore: 0.4,
    evidenceText: "stop calling",
    suggestedOperatorAction: "Review compliance.",
  },
])
assert.equal(weakInsights.length, 0)

const pricingAnalysis = analyzeTranscriptSegmentWithDeterministicRules({
  organizationId: "org-1",
  voiceCallId: "call-1",
  transcriptSessionId: "session-1",
  transcriptSegmentId: "segment-1",
  sequenceNumber: 1,
  speakerType: "customer",
  transcriptText: "Honestly the price is too high for what we get today.",
  confidenceScore: 0.92,
})
assert.ok(pricingAnalysis.insights.some((insight) => insight.eventType === "pricing_objection"))
assert.ok(
  pricingAnalysis.insights.every((insight) =>
    insight.evidenceText.length >= 8 && insight.confidenceScore >= VOICE_INTELLIGENCE_MIN_CONFIDENCE,
  ),
)

const bookingAnalysis = analyzeTranscriptSegmentWithDeterministicRules({
  organizationId: "org-1",
  voiceCallId: "call-1",
  transcriptSessionId: "session-1",
  transcriptSegmentId: "segment-2",
  sequenceNumber: 2,
  speakerType: "customer",
  transcriptText: "Can we schedule a demo this week?",
  confidenceScore: 0.9,
})
assert.ok(bookingAnalysis.insights.some((insight) => insight.eventType === "ready_to_book"))

const riskAnalysis = analyzeTranscriptSegmentWithDeterministicRules({
  organizationId: "org-1",
  voiceCallId: "call-1",
  transcriptSessionId: "session-1",
  transcriptSegmentId: "segment-3",
  sequenceNumber: 3,
  speakerType: "customer",
  transcriptText: "Please stop calling me and remove me from your list.",
  confidenceScore: 0.95,
})
assert.ok(riskAnalysis.insights.some((insight) => insight.eventType === "opt_out_intent"))

assert.equal(typeof resolveConfiguredIntelligenceAnalysisProvider(), "string")
assert.ok(combineSegmentConfidence(0.9, 0.8) >= 0.55)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270607120000_voice_conversation_intelligence_phase_2a.sql"),
  "utf8",
)
for (const object of [
  "voice_conversation_intelligence_events",
  "voice_objection_events",
  "voice_buying_signal_events",
  "voice_risk_events",
  "voice_operator_guidance_events",
  "voice_conversation_memory_drafts",
  "voice_intelligence_analysis_provider",
  "pending_review",
]) {
  assert.match(migration, new RegExp(object))
}

const schemaHealth = fs.readFileSync(path.join(process.cwd(), "lib/voice/schema-health.ts"), "utf8")
assert.match(schemaHealth, /voice_conversation_intelligence_events/)
assert.match(schemaHealth, /voice_conversation_memory_drafts/)
assert.match(schemaHealth, /"v16"/)
assert.match(schemaHealth, /voice_ai_copilot_suggestions/)

const serviceSource = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/intelligence/intelligence-service.ts"),
  "utf8",
)
assert.match(serviceSource, /processTranscriptSegmentIntelligence/)
assert.match(serviceSource, /fetchVoiceCallConversationIntelligenceSnapshot/)
assert.doesNotMatch(serviceSource, /executeSend|transferCall|createOpportunity/)

const mediaService = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/media-streaming/media-session-service.ts"),
  "utf8",
)
assert.match(mediaService, /processTranscriptSegmentIntelligence/)

const intelligenceRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/intelligence/route.ts"),
  "utf8",
)
assert.match(intelligenceRoute, /VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER/)
assert.match(intelligenceRoute, /fetchVoiceCallConversationIntelligenceSnapshot/)

const workspacePanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-conversation-intelligence-panel.tsx"),
  "utf8",
)
assert.match(workspacePanel, /Live signals/)
assert.match(workspacePanel, /Objections/)
assert.match(workspacePanel, /Buying signals/)
assert.match(workspacePanel, /Risk \/ compliance/)
assert.match(workspacePanel, /Suggested next best action/)
assert.match(workspacePanel, /VOICE_CONVERSATION_INTELLIGENCE_QA_MARKER/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /Voice intelligence readiness/)
assert.match(settingsPanel, /Passive mode enabled/)
assert.match(settingsPanel, /Autonomous actions disabled/)

console.log("voice-conversation-intelligence-phase-2a: all checks passed")
