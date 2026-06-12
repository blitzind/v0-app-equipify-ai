/**
 * Apollo Personalization & Content Generation Integration — Phase 9 certification.
 * Run: pnpm test:apollo-personalization-integration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildApolloCallIntelligence,
  APOLLO_CALL_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/apollo/apollo-call-intelligence"
import {
  buildApolloUnifiedPersonalizationContextFromPacket,
  APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER,
} from "../lib/growth/apollo/apollo-unified-personalization-context"
import { normalizeToE164, isValidE164 } from "../lib/growth/sms/phone-normalization"
import {
  evaluateApolloSmsSendReadiness,
  isApolloEmailPlaceholderContent,
  isApolloSmsPlaceholderBody,
  APOLLO_SMS_PLACEHOLDER_BLOCK_CODE,
  APOLLO_SEQUENCE_PLACEHOLDER_GUARD_QA_MARKER,
} from "../lib/growth/apollo/apollo-sequence-placeholder-guard"
import {
  APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER,
  APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER,
} from "../lib/growth/apollo/apollo-sequence-personalization-constants"
import { evaluateApolloSequenceCandidateContentReadiness } from "../lib/growth/apollo/apollo-sequence-draft-readiness"
import { evaluateApolloExecutionMaterializationChannelDrafts, evaluateApollo25CompanyPilotCohortPersonalization } from "../lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation"
import {
  isApolloSmsPersonalizationRequired,
  resolveRequiredApolloPersonalizationAssets,
} from "../lib/growth/apollo/apollo-25-company-pilot-personalization-asset-requirements"
import { buildApolloSequenceExecutionDraftRecords } from "../lib/growth/apollo/apollo-sequence-draft-generation"
import {
  isApolloSequenceDraftPlaceholderContent,
  summarizeApolloSequenceCandidateDraftReadiness,
} from "../lib/growth/apollo/apollo-sequence-draft-readiness"
import { buildApolloVoiceDropIntelligenceFromUnifiedContext } from "../lib/growth/apollo/apollo-voice-drop-intelligence-engine"
import { generateApolloVoiceDropScriptFromUnifiedContext } from "../lib/growth/apollo/apollo-voice-drop-script-generation"
import type { OutreachContextPacket } from "../lib/growth/outreach/personalization/personalization-types"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-unified-personalization-context.ts",
  "lib/growth/apollo/apollo-sequence-placeholder-guard.ts",
  "lib/growth/apollo/apollo-call-intelligence.ts",
  "lib/growth/apollo/apollo-sequence-personalization-service.ts",
  "lib/growth/apollo/apollo-sequence-personalization-constants.ts",
  "lib/growth/apollo/apollo-sequence-execution-queue.ts",
  "lib/growth/apollo/apollo-sequence-execution-bridge.ts",
  "lib/growth/sequences/execution/sequence-sms-runner.ts",
  "lib/growth/sequences/execution/sequence-sms-send-builder.ts",
  "lib/growth/sequences/execution/sequence-send-builder.ts",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing file: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

console.log("  ✓ personalization integration file inventory")

const smsPlaceholder =
  "Alex, quick follow-up from Equipify re: Summit Medical. Reply STOP to opt out. [Draft placeholder — no SMS sent.]"
assert.equal(isApolloSmsPlaceholderBody(smsPlaceholder), true)
assert.equal(evaluateApolloSmsSendReadiness(smsPlaceholder).allowed, false)
assert.equal(evaluateApolloSmsSendReadiness(smsPlaceholder).code, APOLLO_SMS_PLACEHOLDER_BLOCK_CODE)
assert.equal(evaluateApolloSmsSendReadiness("Hi Alex — Equipify follow-up on service workflows. Reply STOP to opt out.").allowed, true)
console.log("  ✓ SMS placeholder detection and transport block")

assert.equal(
  isApolloEmailPlaceholderContent({ subject: "Follow up", body: "Following up on our conversation." }),
  true,
)
assert.equal(
  isApolloEmailPlaceholderContent({ subject: "Quick idea for Summit Medical", body: "Hi Alex, noticed your team..." }),
  false,
)
console.log("  ✓ email generic fallback detection")

const smsRunnerSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/sequences/execution/sequence-sms-runner.ts"),
  "utf8",
)
assert.match(smsRunnerSource, /evaluateApolloSmsSendReadiness/)
assert.match(smsRunnerSource, /isApolloSmsPlaceholderBody/)
const sendBuilderSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/sequences/execution/sequence-send-builder.ts"),
  "utf8",
)
assert.match(sendBuilderSource, /isApolloEmailPlaceholderContent/)
assert.match(sendBuilderSource, /missing_generation/)
console.log("  ✓ execution runners wired for placeholder guards")

const queueSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-sequence-execution-queue.ts"),
  "utf8",
)
assert.match(queueSource, /personalizeApolloSequenceCandidateContent/)
const bridgeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-sequence-execution-bridge.ts"),
  "utf8",
)
assert.match(bridgeSource, /smsDraftBody: null/)
console.log("  ✓ draft approval auto-personalization and bridge SMS placeholder omission")

const samplePacket: OutreachContextPacket = {
  companyName: "Summit Medical",
  industryLabel: "Healthcare",
  website: "https://summitmedical.example",
  employeeSize: "200-500",
  location: "Denver, CO",
  decisionMakerName: "Alex Rivera",
  decisionMakerTitle: "VP Operations",
  fitScore: 82,
  engagementScore: 40,
  opportunityReadinessTier: "warm",
  buyingIntent: "moderate",
  competitorPressure: null,
  capacitySignals: ["Field service backlog"],
  websiteSummary: "Regional medical equipment service provider.",
  websiteTextExcerpt: null,
  websiteFindings: ["Multi-site service operations"],
  hiringSignals: [],
  enrichmentFindings: [],
  researchRecommendedNextAction: "Offer a brief workflow review.",
  priorTouchSummaries: [],
  priorReplySummaries: [],
  objectionSummaries: [],
  sequenceHistorySummaries: [],
  timelineEventSummaries: [],
  researchConfidence: 0.75,
  researchPainPoints: ["Dispatch coordination delays"],
  equipmentServiceIndicators: ["Biomedical fleet maintenance"],
  companySummary: "Summit Medical maintains regional clinical equipment.",
  outreachAngles: ["Reduce downtime across service sites"],
  priorOutboundSubjects: [],
  priorTouchCount: 0,
  hasWebsiteResearch: true,
  hasDecisionMaker: true,
  memoryAvailable: false,
  memoryCoverageScore: null,
  relationshipStage: null,
  relationshipSummary: null,
  memoryPreferenceSummaries: [],
  memoryInteractionSummaries: [],
  memoryCommitmentSummaries: [],
  memoryAvoidRepeating: [],
  memoryRiskFlags: [],
  memoryCommitteeSummaries: ["Operations and clinical engineering stakeholders"],
  memoryOpenLoopSummaries: [],
  memoryEngagementTrend: null,
  memoryProgressionScore: null,
  memoryUnresolvedObjectionCount: 0,
  leadEngineGuidance: null,
}

const unifiedContext = buildApolloUnifiedPersonalizationContextFromPacket({
  packet: samplePacket,
  contact_full_name: "Alex Rivera",
  contact_title: "VP Operations",
  contact_company_name: "Summit Medical",
  qualification_score: 80,
  apollo_evidence_summary: "Apollo Primary Contact Acquisition",
  account_playbook_summary: "Committee coverage partial — expand operations stakeholders.",
  attribution_chain: ["Apollo", "Qualification", "Enrollment"],
})

assert.equal(unifiedContext.qa_marker, APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER)
assert.ok(unifiedContext.buying_committee_summary)
assert.equal(normalizeToE164(null), null)
assert.equal(normalizeToE164(undefined), null)
assert.equal(normalizeToE164(""), null)
assert.equal(isValidE164(null), false)
assert.equal(isValidE164(undefined), false)
assert.equal(isValidE164(""), false)
console.log("  ✓ unified personalization context packet")
console.log("  ✓ null phone E.164 normalization does not trim throw")

const callIntel = buildApolloCallIntelligence(unifiedContext)
assert.equal(callIntel.qa_marker, APOLLO_CALL_INTELLIGENCE_QA_MARKER)
assert.ok(callIntel.opening_angle.includes("Alex"))
assert.ok(callIntel.likely_pain_points.length > 0)
assert.ok(callIntel.discovery_questions.length > 0)
assert.ok(callIntel.objection_handling.length > 0)
assert.ok(callIntel.cta.trim())
assert.ok(callIntel.evidence_sources.length > 0)
console.log("  ✓ call intelligence upgrade")

const voiceIntel = buildApolloVoiceDropIntelligenceFromUnifiedContext({
  unified_context: unifiedContext,
  fit_score: 82,
})
assert.ok(voiceIntel.personalization_opportunities.some((entry) => /Business problem|Role insight|Playbook/i.test(entry)))
const voiceScript = generateApolloVoiceDropScriptFromUnifiedContext({
  script_type: voiceIntel.recommended_script_type,
  unified_context: unifiedContext,
})
assert.ok(voiceScript.full_script.trim())
assert.ok(!voiceScript.full_script.includes("[Draft placeholder"))
console.log("  ✓ voice drop quality upgrade from unified context")

const handoff = {
  multichannel_sequence_candidate_id: "mc-1",
  voice_drop_candidate_id: "vd-1",
  enrollment_candidate_id: "e-1",
  company_candidate_id: "c-1",
  company_contact_id: "cc-1",
  growth_lead_id: "l-1",
  company_name: "Summit Medical",
  full_name: "Alex Rivera",
  title: "VP Operations",
  email: "alex@example.com",
  phone: "+15551234567",
  qualification_score: 80,
  sequence_key: "certification_minimal_email",
  sequence_label: "Certification Email",
  channel_order: ["email", "sms", "voice_drop", "call"],
  scheduling_plan: {
    total_days: 4,
    touches: [
      { day_offset: 1, channel: "email", spacing_days_from_prior: 0, cadence_label: "email", reason: "Day 1" },
      { day_offset: 2, channel: "sms", spacing_days_from_prior: 1, cadence_label: "sms", reason: "Day 2" },
      { day_offset: 3, channel: "voice_drop", spacing_days_from_prior: 1, cadence_label: "voice_drop", reason: "Day 3" },
      { day_offset: 4, channel: "call", spacing_days_from_prior: 1, cadence_label: "call", reason: "Day 4" },
    ],
  },
  source_attribution: {},
}

const steps = [
  {
    step_number: 1,
    channel: "email" as const,
    orchestration_channel: "email" as const,
    scheduled_offset_days: 1,
    scheduled_for_label: "Day 1",
    generation_type: "follow_up_email",
    approval_status: "pending_draft_approval" as const,
    pattern_step_key: "email",
  },
  {
    step_number: 2,
    channel: "sms" as const,
    orchestration_channel: "sms" as const,
    scheduled_offset_days: 2,
    scheduled_for_label: "Day 2",
    generation_type: null,
    approval_status: "pending_draft_approval" as const,
    pattern_step_key: "sms",
  },
  {
    step_number: 3,
    channel: "voice_drop" as const,
    orchestration_channel: "voice_drop" as const,
    scheduled_offset_days: 3,
    scheduled_for_label: "Day 3",
    generation_type: null,
    approval_status: "pending_draft_approval" as const,
    pattern_step_key: "voice_drop",
  },
  {
    step_number: 4,
    channel: "call" as const,
    orchestration_channel: "call" as const,
    scheduled_offset_days: 4,
    scheduled_for_label: "Day 4",
    generation_type: null,
    approval_status: "pending_draft_approval" as const,
    pattern_step_key: "call",
  },
]

const placeholderDrafts = buildApolloSequenceExecutionDraftRecords({ handoff, steps })
assert.ok(placeholderDrafts.every((draft) => isApolloSequenceDraftPlaceholderContent(draft.body_placeholder)))
const notReady = summarizeApolloSequenceCandidateDraftReadiness(placeholderDrafts)
assert.equal(notReady.is_send_ready, false)

const readinessEval = evaluateApolloSequenceCandidateContentReadiness({
  drafts: placeholderDrafts,
  unified_context: unifiedContext,
})
assert.equal(readinessEval.ready, false)
assert.ok(readinessEval.placeholder_count > 0)
assert.equal(APOLLO_SEQUENCE_PERSONALIZATION_SERVICE_QA_MARKER, "apollo-sequence-personalization-service-v1")
console.log("  ✓ draft approval requires content readiness (placeholders blocked)")

assert.equal(APOLLO_SEQUENCE_PLACEHOLDER_GUARD_QA_MARKER, "apollo-sequence-placeholder-guard-v1")

const personalizationServiceSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-sequence-personalization-service.ts"),
  "utf8",
)
assert.match(personalizationServiceSource, /buildApolloEmailPersonalizationFallback/)
assert.match(personalizationServiceSource, /smsPhoneUnavailable/)
assert.doesNotMatch(personalizationServiceSource, /Email personalization blocked:/)
const validationActorSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-pilot-materialization-validation-actor.ts"),
  "utf8",
)
assert.match(validationActorSource, /listGrowthRepRoster/)
assert.match(validationActorSource, /normalizeGrowthActorUserIdForDb/)
const materializeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-25-company-pilot-asset-materialization.ts"),
  "utf8",
)
assert.match(materializeSource, /shouldPersistPersonalizedDrafts/)
assert.match(materializeSource, /APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER/)
assert.match(materializeSource, /isApolloSmsPersonalizationRequired/)
assert.doesNotMatch(materializeSource, /runSequenceExecutionJob/)
const channelBefore = evaluateApolloExecutionMaterializationChannelDrafts(placeholderDrafts)
assert.equal(channelBefore.email_assets, false)
assert.equal(channelBefore.sms_assets, false)
console.log("  ✓ pilot materialize persists channel drafts without sequence execution sends")

const nullPhoneHandoff = { ...handoff, phone: null }
const nullPhoneDrafts = buildApolloSequenceExecutionDraftRecords({
  handoff: nullPhoneHandoff,
  steps,
})
assert.ok(
  nullPhoneDrafts.some(
    (draft) => draft.draft_type === "email" && isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  ),
)
assert.ok(
  nullPhoneDrafts.some(
    (draft) => draft.draft_type === "sms" && isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  ),
)
assert.ok(
  nullPhoneDrafts.some(
    (draft) =>
      draft.draft_type === "voice_drop" && isApolloSequenceDraftPlaceholderContent(draft.body_placeholder),
  ),
)

const nullPhoneVoiceScript = generateApolloVoiceDropScriptFromUnifiedContext({
  script_type: voiceIntel.recommended_script_type,
  unified_context: unifiedContext,
})
assert.ok(nullPhoneVoiceScript.full_script.trim())
assert.ok(!nullPhoneVoiceScript.full_script.includes("[Draft placeholder"))

const personalizedEmailDraft = {
  ...nullPhoneDrafts.find((draft) => draft.draft_type === "email")!,
  subject_placeholder: "Quick idea for Summit Medical",
  body_placeholder: "Hi Alex, noticed your team at Summit Medical...",
}
const personalizedVoiceDraft = {
  ...nullPhoneDrafts.find((draft) => draft.draft_type === "voice_drop")!,
  body_placeholder: nullPhoneVoiceScript.full_script,
  voice_drop_script_reference: nullPhoneVoiceScript.full_script,
}
const smsPlaceholderDraft = nullPhoneDrafts.find((draft) => draft.draft_type === "sms")!
const nullPhoneChannelDrafts = [personalizedEmailDraft, smsPlaceholderDraft, personalizedVoiceDraft]
const nullPhoneChannelState = evaluateApolloExecutionMaterializationChannelDrafts(nullPhoneChannelDrafts)
assert.equal(nullPhoneChannelState.email_assets, true)
assert.equal(nullPhoneChannelState.voice_drop_assets, true)
assert.equal(nullPhoneChannelState.sms_assets, false)
assert.equal(APOLLO_SMS_PERSONALIZATION_MISSING_PHONE_BLOCKER, "sms_personalization:missing_phone")
console.log("  ✓ null phone fixture — email/voice personalization path without SMS throw")

const readinessSnapshotCompany = {
  company_candidate_id: "readiness-co-1",
  company_name: "Readiness Co",
  qualification_score: 80,
  verified_email_count: 1,
  sequence_ready_count: 1,
  canonical_company_id: "canonical-readiness-co-1",
  enrollment_status: null,
  cohort_rank: 1,
  cohort_reason: "production_rules_passed",
  ranking_explanation: "rank 1",
}

const personalizedEmailDraftRecord = {
  draft_id: "draft-email-1",
  draft_type: "email" as const,
  step_number: 1,
  channel: "email" as const,
  subject_placeholder: "Quick idea",
  body_placeholder: "Hi Alex, personalized outreach for your team.",
  voice_drop_script_reference: null,
  approval_status: "pending_draft_approval" as const,
  content_summary: "email",
}

function evaluateChannelAwarePersonalizationFixture(input: {
  selected_template?: string
  selected_channels?: string[]
  sms_capable?: boolean
  execution_drafts?: typeof personalizedEmailDraftRecord[]
  has_voice_drop_candidate?: boolean
}) {
  return evaluateApollo25CompanyPilotCohortPersonalization({
    snapshot_companies: [readinessSnapshotCompany],
    materialization_by_company: {
      [readinessSnapshotCompany.company_candidate_id]: {
        has_account_playbook: true,
        has_personalization_generation: true,
        execution_drafts: input.execution_drafts ?? [personalizedEmailDraftRecord],
        has_voice_drop_candidate: input.has_voice_drop_candidate ?? true,
        sequence_key: input.selected_template ?? null,
        selected_channels: input.selected_channels,
        sms_capable: input.sms_capable,
      },
    },
  }).companies[0]
}

const emailOnlyReady = evaluateChannelAwarePersonalizationFixture({
  selected_template: "certification_minimal_email",
  selected_channels: ["email"],
  sms_capable: false,
})
assert.equal(emailOnlyReady.ready, true)
assert.deepEqual(emailOnlyReady.missing_assets, [])
assert.ok(emailOnlyReady.required_assets.includes("email_assets"))
assert.ok(!emailOnlyReady.required_assets.includes("sms_assets"))
console.log("  ✓ channel-aware readiness — email-only template ready without SMS assets")

const smsSelectedMissing = evaluateChannelAwarePersonalizationFixture({
  selected_channels: ["email", "sms"],
  sms_capable: true,
})
assert.equal(smsSelectedMissing.ready, false)
assert.deepEqual(smsSelectedMissing.missing_assets, ["sms_assets"])
console.log("  ✓ channel-aware readiness — SMS-selected template requires sms_assets")

const voiceSelectedMissing = evaluateChannelAwarePersonalizationFixture({
  selected_channels: ["email", "voice_drop"],
  has_voice_drop_candidate: false,
})
assert.equal(voiceSelectedMissing.ready, false)
assert.deepEqual(voiceSelectedMissing.missing_assets, ["voice_drop_assets"])
console.log("  ✓ channel-aware readiness — voice-selected template requires voice_drop_assets")

const emailOnlySmsBlocker = isApolloSmsPersonalizationRequired({
  sequence_key: "certification_minimal_email",
  selected_channels: ["email"],
})
assert.equal(emailOnlySmsBlocker, false)
const smsTemplateBlocker = isApolloSmsPersonalizationRequired({
  selected_channels: ["email", "sms"],
})
assert.equal(smsTemplateBlocker, true)
const emailOnlyRequirements = resolveRequiredApolloPersonalizationAssets({
  sequence_key: "certification_minimal_email",
  selected_channels: ["email"],
})
assert.equal(emailOnlyRequirements.channel_availability.sms, "not_applicable")
assert.equal(emailOnlyRequirements.channel_availability.voice_drop, "optional")
console.log("  ✓ channel-aware readiness — SMS blocker not applicable for email-only templates")

console.log("\nApollo Personalization Integration checks passed.")
