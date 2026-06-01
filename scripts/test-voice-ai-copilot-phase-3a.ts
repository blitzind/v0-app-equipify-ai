/**
 * Voice AI Copilot — Phase 3A regression checks.
 * Run: pnpm test:voice-ai-copilot-phase-3a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generateDeterministicCopilotDrafts } from "../lib/voice/ai-copilot/deterministic-template-provider"
import {
  buildCopilotDedupeKey,
  dedupeCopilotDrafts,
  isDuplicateCopilotSuggestion,
} from "../lib/voice/ai-copilot/deduplication"
import {
  detectGuardrailViolations,
  filterGuardedCopilotDrafts,
  passesEvidenceRequirement,
} from "../lib/voice/ai-copilot/guardrails"
import { isOpenAiCopilotConfigured } from "../lib/voice/ai-copilot/openai-provider"
import { resolveVoiceAiCopilotProviderMode } from "../lib/voice/ai-copilot/provider-registry"
import { buildAiCopilotWorkspaceSnapshot } from "../lib/voice/ai-copilot/snapshot-builder"
import { resolveVoiceCallForCopilot } from "../lib/voice/ai-copilot/resolve-voice-call-for-copilot"
import {
  VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED,
  VOICE_AI_COPILOT_EVIDENCE_REQUIRED,
  VOICE_AI_COPILOT_GENERATION_COOLDOWN_MS,
  VOICE_AI_COPILOT_GUARDRAILS_ENABLED,
  VOICE_AI_COPILOT_LIFECYCLE_ACTIONS,
  VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL,
  VOICE_AI_COPILOT_MAX_SOURCE_EVENTS,
  VOICE_AI_COPILOT_PASSIVE_MODE_ENABLED,
  VOICE_AI_COPILOT_PROVIDER_TIMEOUT_MS,
  VOICE_AI_COPILOT_QA_MARKER,
  VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS,
} from "../lib/voice/ai-copilot/types"
import { VOICE_SCHEMA_MIGRATION_ID, VOICE_SCHEMA_PROBE_VERSION } from "../lib/voice/schema-health"

assert.equal(VOICE_AI_COPILOT_QA_MARKER, "voice-ai-copilot-v1")
assert.equal(VOICE_SCHEMA_PROBE_VERSION, "v20")
assert.equal(VOICE_SCHEMA_MIGRATION_ID, "20270620120000_voice_multichannel_intelligence_phase_6a")
assert.equal(VOICE_AI_COPILOT_PASSIVE_MODE_ENABLED, true)
assert.equal(VOICE_AI_COPILOT_AUTONOMOUS_ACTIONS_DISABLED, true)
assert.equal(VOICE_AI_COPILOT_EVIDENCE_REQUIRED, true)
assert.equal(VOICE_AI_COPILOT_GUARDRAILS_ENABLED, true)
assert.deepEqual(VOICE_AI_COPILOT_LIFECYCLE_ACTIONS, ["acknowledge", "dismiss", "copied", "expire"])
assert.equal(VOICE_AI_COPILOT_MAX_SUGGESTIONS_PER_CALL, 8)
assert.equal(VOICE_AI_COPILOT_MAX_SOURCE_EVENTS, 12)
assert.equal(VOICE_AI_COPILOT_TRANSCRIPT_WINDOW_SEGMENTS, 8)
assert.equal(VOICE_AI_COPILOT_GENERATION_COOLDOWN_MS, 15_000)
assert.equal(VOICE_AI_COPILOT_PROVIDER_TIMEOUT_MS, 8_000)

const assistEvent = {
  id: "voice:obj-1",
  source: "voice_intelligence",
  category: "objection",
  title: "Pricing objection",
  evidenceText: "That price is too high for our budget this quarter",
  recommendation: "Acknowledge budget concern and clarify value before quoting.",
}

const context = {
  organizationId: "org-1",
  voiceCallId: "call-1",
  callState: "active",
  operatorAssistEvents: [assistEvent],
  retentionSignals: [],
  revenueSignals: [],
  transcriptWindow: [
    {
      id: "seg-1",
      sequenceNumber: 1,
      speakerType: "customer",
      text: "That price is too high for our budget this quarter",
    },
  ],
  relationshipSummary: null,
  contactLabel: "Alex",
}

const drafts = generateDeterministicCopilotDrafts(context)
assert.ok(drafts.some((draft) => draft.suggestionType === "objection_response"))
assert.ok(drafts.some((draft) => draft.suggestionType === "live_summary_draft"))
assert.ok(drafts.some((draft) => draft.suggestionType === "call_note_draft"))
assert.ok(drafts.every((draft) => draft.evidenceText.trim().length >= 8))

const knownEvidence = [assistEvent.evidenceText, context.transcriptWindow[0].text]
const guarded = filterGuardedCopilotDrafts(drafts, knownEvidence)
assert.ok(guarded.length >= 1)

const blocked = filterGuardedCopilotDrafts(
  [
    {
      suggestionType: "next_best_response",
      priority: 90,
      title: "Bad suggestion",
      body: "Automatically send the contract and book the meeting for them.",
      evidenceText: assistEvent.evidenceText,
      sourceEventIds: [assistEvent.id],
    },
  ],
  knownEvidence,
)
assert.equal(blocked.length, 0)
assert.ok(detectGuardrailViolations("Automatically transfer the call now.").length > 0)

assert.equal(
  passesEvidenceRequirement(
    {
      suggestionType: "objection_response",
      priority: 80,
      title: "Test",
      body: "Body",
      evidenceText: assistEvent.evidenceText,
      sourceEventIds: [],
    },
    knownEvidence,
  ),
  true,
)

const dedupeKey = buildCopilotDedupeKey({
  suggestionType: "objection_response",
  title: "Address objection",
  evidenceText: assistEvent.evidenceText,
})
assert.ok(dedupeKey.includes("objection_response"))

const deduped = dedupeCopilotDrafts([...drafts, ...drafts])
assert.ok(deduped.length <= drafts.length)

const existingSuggestion = {
  id: "s1",
  organizationId: "org-1",
  voiceCallId: "call-1",
  relationshipMemoryProfileId: null,
  relatedCustomerId: null,
  relatedProspectId: null,
  relatedOpportunityId: null,
  suggestionType: "objection_response" as const,
  priority: 85,
  title: "Address objection with evidence",
  body: "Body",
  evidenceText: assistEvent.evidenceText,
  sourceEventIds: [assistEvent.id],
  status: "active" as const,
  generatedByProvider: "deterministic_template" as const,
  createdAt: new Date().toISOString(),
  acknowledgedAt: null,
  dismissedAt: null,
  copiedAt: null,
}

assert.equal(
  isDuplicateCopilotSuggestion(existingSuggestion ? [existingSuggestion] : [], {
    suggestionType: "objection_response",
    priority: 85,
    title: "Address objection with evidence",
    body: "Another body",
    evidenceText: assistEvent.evidenceText,
    sourceEventIds: [assistEvent.id],
  }),
  true,
)

const snapshot = buildAiCopilotWorkspaceSnapshot({
  voiceCallId: "call-1",
  providerMode: "deterministic_template",
  suggestions: [existingSuggestion],
  generationCooldownRemainingMs: 0,
  canGenerate: true,
})
assert.equal(snapshot.qaMarker, VOICE_AI_COPILOT_QA_MARKER)
assert.equal(snapshot.autonomousActionsDisabled, true)
assert.ok(snapshot.message.includes("does not act automatically"))

const prevOpenAi = process.env.VOICE_AI_COPILOT_OPENAI_ENABLED
const prevProvider = process.env.VOICE_AI_COPILOT_PROVIDER
const prevKey = process.env.OPENAI_API_KEY
delete process.env.VOICE_AI_COPILOT_OPENAI_ENABLED
delete process.env.VOICE_AI_COPILOT_PROVIDER
delete process.env.OPENAI_API_KEY
assert.equal(isOpenAiCopilotConfigured(), false)
assert.equal(resolveVoiceAiCopilotProviderMode(), "deterministic_template")
if (prevOpenAi) process.env.VOICE_AI_COPILOT_OPENAI_ENABLED = prevOpenAi
if (prevProvider) process.env.VOICE_AI_COPILOT_PROVIDER = prevProvider
if (prevKey) process.env.OPENAI_API_KEY = prevKey

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270612120000_voice_ai_copilot_phase_3a.sql"),
  "utf8",
)
assert.match(migration, /voice_ai_copilot_suggestions/)
assert.match(migration, /voice_ai_copilot_suggestion_type/)

const workspaceBridge = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/browser-calling/workspace-bridge.ts"),
  "utf8",
)
assert.match(workspaceBridge, /fetchAiCopilotWorkspaceSnapshot/)

const assistPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-unified-assist-panel.tsx"),
  "utf8",
)
assert.match(assistPanel, /GrowthCallWorkspaceAiCopilotSection/)

const copilotSection = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-call-workspace-ai-copilot-section.tsx"),
  "utf8",
)
assert.match(copilotSection, /VOICE_AI_COPILOT_QA_MARKER/)
assert.match(copilotSection, /AI does not act automatically/)
assert.match(copilotSection, /workspaceSessionId/)

const generateRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/voice/calls/[callId]/ai-copilot/generate/route.ts"),
  "utf8",
)
assert.match(generateRoute, /resolveVoiceCallForCopilot/)
assert.match(generateRoute, /workspaceSessionId: resolved\.nativeSessionId/)

const resolverModule = fs.readFileSync(
  path.join(process.cwd(), "lib/voice/ai-copilot/resolve-voice-call-for-copilot.ts"),
  "utf8",
)
assert.match(resolverModule, /realtime_session_id/)
assert.match(resolverModule, /native_call_workspace_sessions/)
assert.equal(typeof resolveVoiceCallForCopilot, "function")

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-voice-infrastructure-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /GrowthAiCopilotReadinessSection/)

console.log("voice-ai-copilot-phase-3a: all checks passed")
