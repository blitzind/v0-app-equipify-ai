/**
 * GE-AIOS-MEMORY-RESOLVER-1B — Operator authority & semantic closure certification.
 * Run: pnpm test:ge-aios-memory-resolver-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER,
  projectCanonicalMemoryReviewRows,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import {
  HUMAN_MEMORY_KIND_METADATA_KEY,
  resolveAuthoritativeHumanMemoryKind,
} from "../lib/growth/lead-memory/canonical-human-memory-metadata"
import {
  humanMemoryKindsAreMergeCompatible,
  isActionCommitmentKind,
  isPersonalContextKind,
} from "../lib/growth/lead-memory/canonical-human-memory-semantics"
import {
  mapProfileEventToCanonicalRecord,
  resolveCurrentConclusions,
} from "../lib/growth/lead-memory/canonical-human-memory-evolution"
import { buildRelationshipMemorySlice } from "../lib/growth/lead-memory/canonical-human-memory-slices"
import { isCommitmentEvent } from "../lib/growth/lead-memory/memory-influence-projection"
import {
  isProfessionallyUsefulPersonalContext,
  sanitizeConclusionForMemory,
} from "../lib/growth/lead-memory/canonical-human-memory-constitution"
import { resolveAuthoritativeForm } from "../lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER } from "../lib/growth/lead-memory/canonical-human-memory-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`[${GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER}] certification`)

const personalAsEngagement = resolveAuthoritativeHumanMemoryKind({
  memoryCategory: "engagement_pattern",
  title: "Contact mentioned upcoming surgery — handle with empathy",
  metadata: { [HUMAN_MEMORY_KIND_METADATA_KEY]: "personal_context" },
})
assert.equal(personalAsEngagement, "personal_context")
assert.ok(isPersonalContextKind(personalAsEngagement))
console.log("  ✓ personal_context is not interpreted as engagement behavior")

const commitmentAsMeeting = resolveAuthoritativeHumanMemoryKind({
  memoryCategory: "meeting_signal",
  title: "Depot coordination checklist due Friday",
  metadata: { [HUMAN_MEMORY_KIND_METADATA_KEY]: "action_commitment" },
})
assert.equal(commitmentAsMeeting, "action_commitment")
assert.ok(isActionCommitmentKind(commitmentAsMeeting))
console.log("  ✓ action_commitment is not interpreted as a completed meeting")

const businessFact = resolveAuthoritativeHumanMemoryKind({
  memoryCategory: "industry_interest",
  title: "Current software: ServiceTitan",
  metadata: { [HUMAN_MEMORY_KIND_METADATA_KEY]: "business_fact" },
})
assert.equal(businessFact, "business_fact")
console.log("  ✓ business_fact retains semantic authority over industry_interest storage")

assert.equal(
  isCommitmentEvent({
    id: "e1",
    leadLabel: "masked",
    memoryCategory: "meeting_signal",
    confidence: "medium",
    title: "Meeting interest detected",
    evidenceSnippet: "Can we schedule a demo?",
    sourceSystem: "inbox",
    recordedAt: "2026-06-01T12:00:00.000Z",
  }),
  false,
)
assert.equal(
  isCommitmentEvent({
    id: "e2",
    leadLabel: "masked",
    memoryCategory: "meeting_signal",
    confidence: "high",
    title: "Depot coordination checklist due Friday",
    evidenceSnippet: "Send the checklist Friday",
    sourceSystem: "lead_memory",
    recordedAt: "2026-06-01T12:00:00.000Z",
    metadata: { [HUMAN_MEMORY_KIND_METADATA_KEY]: "action_commitment" },
  }),
  true,
)
console.log("  ✓ commitment projection respects human_memory_kind")

const corrected = mapProfileEventToCanonicalRecord(
  {
    id: "evt-corrected",
    leadLabel: "masked",
    memoryCategory: "industry_interest",
    confidence: "verified",
    title: "block imaging uses servicetitan",
    evidenceSnippet: "block imaging uses servicetitan",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "business_fact",
      operator_status: "corrected",
      operator_override_conclusion: "Block Imaging uses ServiceTitan",
      original_conclusion: "block imaging uses servicetitan",
    },
  },
  "Block Imaging",
)
assert.equal(corrected.conclusion, "Block Imaging uses ServiceTitan")
console.log("  ✓ operator correction remains authoritative in projection")

assert.equal(resolveAuthoritativeForm("Block Imaging"), "Block Imaging")
console.log("  ✓ correction path preserves canonical capitalization helpers")

const deleted = mapProfileEventToCanonicalRecord(
  {
    id: "evt-deleted",
    leadLabel: "masked",
    memoryCategory: "engagement_pattern",
    confidence: "low",
    title: "Maybe likes email",
    evidenceSnippet: "Maybe likes email",
    sourceSystem: "lead_memory",
    recordedAt: "2026-06-01T12:00:00.000Z",
    metadata: { operator_status: "deleted", superseded: true },
  },
  "Block Imaging",
)
const { active: afterDelete } = resolveCurrentConclusions([deleted])
assert.equal(afterDelete.length, 0)
console.log("  ✓ deleted memory disappears from active projections")

const pinned = mapProfileEventToCanonicalRecord(
  {
    id: "evt-pin",
    leadLabel: "masked",
    memoryCategory: "communication_preference",
    confidence: "high",
    title: "Prefers afternoon calls",
    evidenceSnippet: "Call me after 2 PM",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "communication_style",
      operator_status: "pinned",
      pinned: true,
    },
  },
  "Block Imaging",
)
const { active: pinnedActive } = resolveCurrentConclusions([pinned])
assert.equal(pinnedActive[0]?.conclusion, "Prefers afternoon calls")
assert.equal(pinnedActive[0]?.pinned, true)
console.log("  ✓ pinned communication preference remains durable")

const protectedFact = mapProfileEventToCanonicalRecord(
  {
    id: "evt-protect",
    leadLabel: "masked",
    memoryCategory: "industry_interest",
    confidence: "verified",
    title: "Current software: ServiceTitan",
    evidenceSnippet: "Current software: ServiceTitan",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: {
      human_memory_kind: "business_fact",
      operator_status: "protected",
      protected: true,
    },
  },
  "Block Imaging",
)
assert.equal(protectedFact.protected, true)
console.log("  ✓ protected operator-confirmed business fact surfaces as protected")

assert.equal(humanMemoryKindsAreMergeCompatible("business_fact", "business_fact"), true)
assert.equal(humanMemoryKindsAreMergeCompatible("business_fact", "sales_conclusion"), false)
console.log("  ✓ merge requires compatible human memory kinds")

const servicetitanA = mapProfileEventToCanonicalRecord(
  {
    id: "a",
    leadLabel: "masked",
    memoryCategory: "industry_interest",
    confidence: "high",
    title: "Current software: ServiceTitan",
    evidenceSnippet: "ServiceTitan",
    sourceSystem: "lead_memory",
    recordedAt: "2026-01-01T12:00:00.000Z",
    metadata: { human_memory_kind: "business_fact", confirmation_count: 2 },
  },
  "Block Imaging",
)
const servicetitanB = mapProfileEventToCanonicalRecord(
  {
    id: "b",
    leadLabel: "masked",
    memoryCategory: "industry_interest",
    confidence: "medium",
    title: "Current software: ServiceTitan",
    evidenceSnippet: "Using ServiceTitan today",
    sourceSystem: "voice_memory_bridge_v1",
    recordedAt: "2026-06-01T12:00:00.000Z",
    metadata: { human_memory_kind: "business_fact", confirmation_count: 1 },
  },
  "Block Imaging",
)
const { active: mergedActive } = resolveCurrentConclusions([servicetitanA, servicetitanB])
assert.equal(mergedActive.length, 1)
console.log("  ✓ duplicate ServiceTitan conclusions dedupe in projection")

const relationship = buildRelationshipMemorySlice({
  records: [
    mapProfileEventToCanonicalRecord(
      {
        id: "personal",
        leadLabel: "masked",
        memoryCategory: "engagement_pattern",
        confidence: "medium",
        title: "Contact mentioned upcoming surgery",
        evidenceSnippet: "Contact mentioned upcoming surgery",
        sourceSystem: "lead_memory",
        recordedAt: "2026-06-01T12:00:00.000Z",
        metadata: { human_memory_kind: "personal_context" },
      },
      "Block Imaging",
    ),
  ],
  profileView: null,
  priorReplySummaries: [],
  memoryOpenLoopSummaries: [],
})
assert.equal(relationship.records.length, 0)
console.log("  ✓ relationship slice excludes personal_context misfiled as engagement_pattern")

assert.equal(sanitizeConclusionForMemory("Operator: as an AI I noticed your budget"), null)
assert.ok(isProfessionallyUsefulPersonalContext("Contact mentioned upcoming surgery — handle with empathy"))
assert.equal(sanitizeConclusionForMemory("nice weather today"), null)
console.log("  ✓ constitution rejects transcript dumps, AI language, and small talk")

assert.ok(readSource("app/api/platform/growth/ai-os/completed-work/packages/[packageId]/memory-actions/route.ts").includes("applyOperatorMemoryReviewDecision"))
assert.ok(readSource("lib/growth/lead-memory/operator-memory-review-service.ts").includes("refreshMemoryReviewProjection"))
assert.ok(readSource("components/growth/ai-os/approvals/growth-ava-memory-review-section.tsx").includes("buildAvaOperatorPackageMemoryActionsApiPath"))
assert.ok(readSource("lib/growth/aios/approvals/approvals-operator-review-service.ts").includes("resolveCanonicalHumanMemoryForLead"))
console.log("  ✓ HAC API, service, UI, and fresh bundle refresh wired")

const reviewRows = projectCanonicalMemoryReviewRows({
  canonicalHumanMemory: {
    qaMarker: GROWTH_CANONICAL_HUMAN_MEMORY_RESOLVER_QA_MARKER,
    leadId: "6d9220f0-2960-468c-b4be-5d7595d292c3",
    organizationId: "org",
    generatedAt: new Date().toISOString(),
    identity: { company: { canonical: "Block Imaging" } } as never,
    influence: { available: false } as never,
    business: { records: [protectedFact], companyName: "Block Imaging", industry: null, equipment: [], growthInitiatives: [], currentSoftware: ["ServiceTitan"], competitiveLandscape: [], operationalPriorities: [] },
    personal: { records: [], communicationStyle: [], personalityNotes: [], preferredTerminology: [], personalContext: [] },
    relationship: { stage: null, summary: null, engagementTrend: null, trustSignals: [], champions: [], blockers: [], meetingHistory: [], commitments: [], records: [] },
    sales: { painPoints: [], businessPressures: [], objections: [], buyingTriggers: [], questionsThatWorked: [], questionsThatFailed: [], records: [] },
    actions: { openCommitments: [], promisedFollowUps: [], pendingDocuments: [], requestedInformation: [], records: [servicetitanB] },
    committee: null,
    institutionalAdvisory: null,
    packageSnapshot: null,
    liveDeltas: [],
    freshness: { generatedAt: new Date().toISOString(), totalActiveRecords: 2, expiredPersonalSensitivityCount: 0, lowConfidenceSuppressedCount: 0, operatorApprovedCount: 1, stalePackageSnapshot: false },
    relationshipContext: { priorTouchCount: 0, priorReplyCount: 0, priorOutboundSubjects: [], objectionSummaries: [], priorReplySummaries: [], sequenceHistorySummaries: [], memoryOpenLoopSummaries: [], buyingIntent: null, competitorPressure: null },
    learningWeights: null,
    institutionalAdvice: [],
    profileViewAvailable: true,
  },
})
assert.ok(reviewRows.some((row) => row.humanMemoryKind === "business_fact"))
assert.ok(reviewRows.every((row) => "pinned" in row && "protected" in row))
console.log("  ✓ operator review rows expose semantic kind and pin/protect state")

console.log(`[${GROWTH_AIOS_MEMORY_RESOLVER_1B_OPERATOR_LAYOUT_QA_MARKER}] PASS`)
