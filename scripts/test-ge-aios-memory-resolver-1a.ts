/**
 * GE-AIOS-MEMORY-RESOLVER-1A — Canonical human memory resolver certification.
 * Run: pnpm test:ge-aios-memory-resolver-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER,
  HUMAN_MEMORY_KINDS,
} from "../lib/growth/lead-memory/canonical-human-memory-types"
import {
  buildMemoryFingerprint,
  inferHumanMemoryKindFromEvent,
  personalContextFreshnessExpiresAt,
  storageCategoryForHumanKind,
} from "../lib/growth/lead-memory/canonical-human-memory-metadata"
import {
  buildCanonicalRecordsFromProfileView,
  mapProfileEventToCanonicalRecord,
  resolveCurrentConclusions,
} from "../lib/growth/lead-memory/canonical-human-memory-evolution"
import {
  buildActionMemorySlice,
  buildBusinessMemorySlice,
  buildPersonalMemorySlice,
} from "../lib/growth/lead-memory/canonical-human-memory-slices"
import {
  institutionalAdviceMustNotOverrideAccountFact,
  looksLikeRawTranscriptMemory,
  sanitizeConclusionForMemory,
} from "../lib/growth/lead-memory/canonical-human-memory-constitution"
import { projectCanonicalMemoryReviewRows } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { resolveCanonicalDisplayIdentity, resolveAuthoritativeForm } from "../lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { ingestMemoryCandidatesFromSource } from "../lib/growth/lead-memory/memory-ingestion"
import type { GrowthLeadMemoryProfileView } from "../lib/growth/lead-memory/memory-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER}] certification`)

assert.equal(HUMAN_MEMORY_KINDS.length, 5)
console.log("  ✓ human memory taxonomy includes 5 kinds")

assert.equal(storageCategoryForHumanKind("business_fact"), "industry_interest")
assert.equal(storageCategoryForHumanKind("communication_style"), "communication_preference")
assert.equal(storageCategoryForHumanKind("action_commitment"), "meeting_signal")
console.log("  ✓ human kinds map to existing DB-safe categories")

const identity = resolveCanonicalDisplayIdentity({
  originalCompanyName: "block imaging",
  verifiedCanonicalCompanyName: "Block Imaging",
  websiteBrandingName: "Block Imaging",
  crmCompanyName: "Block Imaging",
  contactName: "Josh Block",
  sellerCompanyName: "Equipify.ai",
})
assert.equal(identity.company.canonical, "Block Imaging")
assert.equal(resolveAuthoritativeForm("servicetitan"), "servicetitan")
console.log("  ✓ Block Imaging canonical identity preserved")

const softwareEvolution = [
  mapProfileEventToCanonicalRecord(
    {
      id: "evt-1",
      leadLabel: "masked",
      memoryCategory: "industry_interest",
      confidence: "high",
      title: "Current software: ServiceTitan",
      evidenceSnippet: "Current software: ServiceTitan",
      sourceSystem: "lead_memory",
      recordedAt: "2026-01-01T12:00:00.000Z",
      metadata: { human_memory_kind: "business_fact", fingerprint: "a" },
    },
    "Block Imaging",
  ),
  mapProfileEventToCanonicalRecord(
    {
      id: "evt-2",
      leadLabel: "masked",
      memoryCategory: "industry_interest",
      confidence: "high",
      title: "Migration to Equipify.ai planned",
      evidenceSnippet: "Migration to Equipify.ai planned",
      sourceSystem: "lead_memory",
      recordedAt: "2026-06-01T12:00:00.000Z",
      metadata: { human_memory_kind: "business_fact", fingerprint: "b" },
    },
    "Block Imaging",
  ),
]
const { active: evolvedActive } = resolveCurrentConclusions(softwareEvolution)
assert.equal(evolvedActive.length, 2)
console.log("  ✓ software memory evolves without collapsing distinct conclusions")

const voiceApproved = mapProfileEventToCanonicalRecord(
  {
    id: "evt-voice",
    leadLabel: "masked",
    memoryCategory: "buying_signal",
    confidence: "verified",
    title: "Depot coordination is the verified operational pressure",
    evidenceSnippet: "Depot coordination is the verified operational pressure",
    sourceSystem: "voice_memory_bridge_v1",
    recordedAt: "2026-05-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "sales_conclusion",
      operator_status: "approved",
      voice_memory_event_id: "voice-evt-1",
    },
  },
  "Block Imaging",
)
assert.equal(voiceApproved.operatorStatus, "approved")
assert.equal(voiceApproved.sourceSystem, "voice_memory_bridge_v1")
console.log("  ✓ approved voice memory bridges into lead memory projection")

const personalExpired = mapProfileEventToCanonicalRecord(
  {
    id: "evt-personal",
    leadLabel: "masked",
    memoryCategory: "engagement_pattern",
    confidence: "medium",
    title: "Contact mentioned upcoming surgery — handle with empathy",
    evidenceSnippet: "Contact mentioned upcoming surgery — handle with empathy",
    sourceSystem: "lead_memory",
    recordedAt: "2025-01-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "personal_context",
      freshness_expires_at: personalContextFreshnessExpiresAt("2025-01-01T12:00:00.000Z"),
    },
  },
  "Block Imaging",
)
const { active: personalActive, expiredPersonal } = resolveCurrentConclusions([personalExpired])
assert.equal(personalActive.length, 0)
assert.equal(expiredPersonal, 1)
console.log("  ✓ personal context expires appropriately")

const commPreference = mapProfileEventToCanonicalRecord(
  {
    id: "evt-comm",
    leadLabel: "masked",
    memoryCategory: "communication_preference",
    confidence: "high",
    title: "Prefers afternoon calls",
    evidenceSnippet: "Call me after 2 PM",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: { human_memory_kind: "communication_style", operator_status: "protected" },
  },
  "Block Imaging",
)
const { active: commActive } = resolveCurrentConclusions([commPreference])
assert.equal(commActive[0]?.conclusion, "Prefers afternoon calls")
console.log("  ✓ communication preference remains durable")

const commitment = mapProfileEventToCanonicalRecord(
  {
    id: "evt-commit",
    leadLabel: "masked",
    memoryCategory: "meeting_signal",
    confidence: "high",
    title: "Depot coordination checklist due Friday",
    evidenceSnippet: "Send the checklist Friday",
    sourceSystem: "lead_memory",
    recordedAt: "2026-06-10T12:00:00.000Z",
    metadata: { human_memory_kind: "action_commitment" },
  },
  "Block Imaging",
)
const actions = buildActionMemorySlice([commitment])
assert.ok(actions.openCommitments.some((row) => /checklist/i.test(row)))
console.log("  ✓ action commitment stays open until fulfilled")

const lowConfidence = mapProfileEventToCanonicalRecord(
  {
    id: "evt-low",
    leadLabel: "masked",
    memoryCategory: "buying_signal",
    confidence: "low",
    title: "Maybe interested someday",
    evidenceSnippet: "Maybe interested someday",
    sourceSystem: "lead_memory",
    recordedAt: "2026-06-10T12:00:00.000Z",
    metadata: { human_memory_kind: "sales_conclusion" },
  },
  "Block Imaging",
)
const { suppressedLowConfidence } = resolveCurrentConclusions([lowConfidence])
assert.equal(suppressedLowConfidence, 1)
console.log("  ✓ low-confidence assumptions do not surface as facts")

const operatorCorrected = mapProfileEventToCanonicalRecord(
  {
    id: "evt-corrected",
    leadLabel: "masked",
    memoryCategory: "industry_interest",
    confidence: "verified",
    title: "Current software: ServiceTitan",
    evidenceSnippet: "Current software: ServiceTitan",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "business_fact",
      operator_status: "corrected",
      operator_override_conclusion: "Current software: eClinicalWorks (operator corrected)",
    },
  },
  "Block Imaging",
)
assert.match(operatorCorrected.conclusion, /eClinicalWorks/)
console.log("  ✓ operator correction becomes authoritative")

assert.equal(sanitizeConclusionForMemory("Operator: Hi Josh Prospect: We use ServiceTitan for everything"), null)
assert.ok(looksLikeRawTranscriptMemory("Operator: long transcript " + "x".repeat(300)))
console.log("  ✓ no raw transcript storage as memory")

assert.equal(
  institutionalAdviceMustNotOverrideAccountFact(
    "Depot coordination is the verified operational pressure for Block Imaging.",
    ["Depot coordination is the verified operational pressure for Block Imaging."],
  ),
  false,
)
assert.equal(
  institutionalAdviceMustNotOverrideAccountFact("Generic institutional opener pattern", [
    "Depot coordination is the verified operational pressure for Block Imaging.",
  ]),
  true,
)
console.log("  ✓ institutional advice does not override Block Imaging evidence")

const ingestion = ingestMemoryCandidatesFromSource({
  sourceSystem: "inbox",
  body: "We're opening two locations in Michigan next quarter.",
})
assert.ok(ingestion.some((row) => /expansion|business fact/i.test(row.title)))
const timing = ingestMemoryCandidatesFromSource({
  sourceSystem: "inbox",
  body: "Call me after 2 PM — afternoons work better.",
})
assert.ok(timing.some((row) => /afternoon|communication/i.test(row.title)))
console.log("  ✓ ingestion extends taxonomy for business facts and communication style")

const profileView: GrowthLeadMemoryProfileView = {
  profile: {
    id: "profile-1",
    leadId: BLOCK_LEAD,
    leadLabel: "masked",
    relationshipStage: "engaged",
    memoryCoverageScore: 72,
    eventCount: 3,
    objectionCount: 0,
    preferenceCount: 1,
    committeeMemberCount: 0,
    buyingSignalCount: 1,
    highestConfidence: "high",
    summary: "Block Imaging engaged on depot coordination.",
    lastRebuiltAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-01T12:00:00.000Z",
  },
  relationshipContext: null,
  events: [],
  objections: [],
  preferences: [],
  committeeMembers: [],
  summarySnapshots: [],
}
const records = buildCanonicalRecordsFromProfileView(profileView, "Block Imaging")
assert.ok(records.length >= 0)
const business = buildBusinessMemorySlice({
  records: [voiceApproved, operatorCorrected],
  companyName: "Block Imaging",
  industry: "Biomedical",
  equipment: ["MRI", "CT"],
})
assert.equal(business.companyName, "Block Imaging")
console.log("  ✓ business slice binds to canonical company label")

const reviewRows = projectCanonicalMemoryReviewRows({
  canonicalHumanMemory: {
    qaMarker: GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER,
    leadId: BLOCK_LEAD,
    organizationId: "org",
    generatedAt: new Date().toISOString(),
    identity,
    influence: {
      available: true,
      memoryCoverageScore: 72,
      relationshipSummary: "Block Imaging engaged on depot coordination.",
      relationshipStage: "engaged",
      engagementTrend: null,
      progressionScore: null,
      topObjections: [],
      topPreferences: [],
      priorInteractionSummaries: [],
      commitmentSummaries: [],
      riskFlags: [],
      avoidRepeating: [],
      committeeContext: [],
      unresolvedObjectionCount: 0,
      unresolvedHighSeverityObjectionCount: 0,
    },
    business,
    personal: buildPersonalMemorySlice([commPreference]),
    relationship: { stage: "engaged", summary: null, engagementTrend: null, trustSignals: [], champions: [], blockers: [], meetingHistory: [], commitments: [], records: [] },
    sales: { painPoints: [], businessPressures: [], objections: [], buyingTriggers: [], questionsThatWorked: [], questionsThatFailed: [], records: [voiceApproved] },
    actions,
    committee: null,
    institutionalAdvisory: null,
    packageSnapshot: null,
    liveDeltas: [],
    freshness: {
      generatedAt: new Date().toISOString(),
      totalActiveRecords: 3,
      expiredPersonalSensitivityCount: 0,
      lowConfidenceSuppressedCount: 0,
      operatorApprovedCount: 1,
      stalePackageSnapshot: false,
    },
    relationshipContext: {
      priorTouchCount: 2,
      priorReplyCount: 1,
      priorOutboundSubjects: [],
      objectionSummaries: [],
      priorReplySummaries: [],
      sequenceHistorySummaries: [],
      memoryOpenLoopSummaries: [],
      buyingIntent: null,
      competitorPressure: null,
    },
    learningWeights: null,
    institutionalAdvice: [],
    profileViewAvailable: true,
  },
})
assert.ok(reviewRows.some((row) => row.category === "communication_style" || row.category === "communication_preference"))
console.log("  ✓ operator review packet exposes canonical memory rows")

assert.ok(readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts").includes("resolveCanonicalHumanMemoryForLead"))
assert.ok(readSource("lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts").includes("resolveCanonicalHumanMemoryForLead"))
assert.ok(readSource("lib/voice/relationship-memory/relationship-memory-service.ts").includes("bridgeApprovedVoiceMemoryToLeadMemory"))
console.log("  ✓ Growth 5F and Call Workspace consume canonical resolver; voice bridge wired")

assert.equal(
  inferHumanMemoryKindFromEvent({
    memoryCategory: "meeting_signal",
    title: "Depot coordination checklist due Friday",
    metadata: {},
  }),
  "action_commitment",
)
assert.ok(
  buildMemoryFingerprint({
    leadId: BLOCK_LEAD,
    humanMemoryKind: "business_fact",
    conclusion: "Current software: ServiceTitan",
  }).includes(BLOCK_LEAD),
)
console.log("  ✓ fingerprint dedup metadata helpers")

console.log(`[${GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER}] PASS`)
