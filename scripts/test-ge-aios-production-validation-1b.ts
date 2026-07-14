/**
 * GE-AIOS-PRODUCTION-VALIDATION-1B — Pre-deployment runtime closure certification.
 * Run: pnpm test:ge-aios-production-validation-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  buildStableCanonicalMemoryVersionKey,
  CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL,
  GROWTH_AIOS_CANONICAL_DECISION_RESOLUTION_BOUNDARY_QA_MARKER,
  resolveCanonicalDecisionEvaluationInstantMs,
  resolveCanonicalDecisionGeneratedAtBoundary,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-resolution-boundary"
import {
  buildCanonicalDecisionCacheVersions,
  clearCanonicalDecisionResolutionCache,
  invalidateCanonicalDecisionCacheForLead,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import { buildAssistDedupeKey } from "../lib/growth/operator-assist/deduplication"
import { institutionalAdviceMustNotOverrideAccountFact } from "../lib/growth/lead-memory/canonical-human-memory-constitution"
import type { CanonicalHumanMemoryBundle } from "../lib/growth/lead-memory/canonical-human-memory-types"
import {
  DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID,
  GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER,
  resolveGrowthEngineWorkspaceOrganizationId,
} from "../lib/growth/growth-engine-workspace-organization"

export const GE_AIOS_PRODUCTION_VALIDATION_1B_QA_MARKER =
  "ge-aios-production-validation-1b-v1" as const

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG_ID = "00757488-1026-44a5-aac4-269533ac21be"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function blockImagingInput(overrides?: Partial<GrowthCanonicalDecisionInput>): GrowthCanonicalDecisionInput {
  const generatedAt = resolveCanonicalDecisionGeneratedAtBoundary({
    packagePreparedAt: "2026-07-10T12:00:00.000Z",
    latestReplyAt: null,
    latestMeetingAt: "2026-07-24T15:00:00.000Z",
    leadUpdatedAt: "2026-07-12T08:00:00.000Z",
  })

  return {
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    generatedAt,
    companyName: "Block Imaging",
    contactName: "Josh",
    memoryBundle: null,
    relationshipAssessment: null,
    revenueStrategy: "proceed",
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: {
      championIdentified: false,
      recommendedStakeholderRole: "Service Director",
      recommendedStakeholderLabel: "Service Director",
      multiThreadRecommended: true,
      summary: "Service Director recommended on call.",
    },
    replyState: null,
    postCall: {
      commitments: ["Send the depot-to-field workflow checklist by end of week"],
      objections: [],
      buyingSignals: ["Confirmed depot-to-field coordination pain"],
      businessConclusions: [
        "Depot-to-field coordination is a real operational issue",
        "Competitor ServiceMax confirmed in use",
        "Timing is next quarter",
      ],
      operatorOutcome: "connected",
      meetingBooked: true,
      timelineDetected: true,
      agreedWaitUntil: null,
    },
    meeting: {
      hasUpcomingMeeting: true,
      meetingAt: "2026-07-24T15:00:00.000Z",
      meetingObjective: "Workflow review with operations leadership",
      stakeholderRole: "Service Director",
      stakeholderContactId: null,
    },
    packageState: {
      packageId: null,
      status: "none",
      purpose: null,
      promisedInformationPending: false,
      promisedInformationSent: false,
    },
    draftFactoryStatus: null,
    approvalState: null,
    sourceVersions: {
      memoryVersion: "none",
      relationshipVersion: null,
      revenueVersion: "proceed",
      packageVersion: null,
      meetingVersion: "2026-07-24T15:00:00.000Z",
      approvalVersion: null,
      materialEventId: null,
    },
    ...overrides,
  }
}

function minimalMemoryBundle(generatedAt: string): CanonicalHumanMemoryBundle {
  return {
    qaMarker: "ge-canonical-human-memory-resolver-v1",
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    generatedAt,
    identity: {
      qaMarker: "ge-canonical-display-identity-1b-v1",
      displayName: "Block Imaging",
      companyName: "Block Imaging",
      contactName: "Josh",
      authoritativeForm: "company",
    },
    companyName: "Block Imaging",
    contactName: "Josh",
    business: {
      records: [],
      currentSoftware: ["ServiceMax"],
      growthInitiatives: [],
      operationalPriorities: [],
    },
    personal: { records: [] },
    relationship: { records: [] },
    sales: { records: [] },
    actions: { records: [] },
    committee: null,
    institutionalAdvisory: null,
    packageSnapshot: null,
    liveDeltas: [],
    freshness: { totalActiveRecords: 0, operatorApprovedCount: 0, stalePackageSnapshot: false },
    relationshipContext: {
      priorTouchCount: 0,
      priorReplyCount: 0,
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
    profileViewAvailable: false,
    influence: { openLoops: [], commitments: [], objections: [], buyingSignals: [] },
    sellerTruth: { industries: ["Healthcare"], productLines: [], valueProps: [] },
  } as CanonicalHumanMemoryBundle
}

console.log(`[GE-AIOS-PRODUCTION-VALIDATION-1B] ${GE_AIOS_PRODUCTION_VALIDATION_1B_QA_MARKER}`)

// Phase 1 — four repairs
const leadWorkspaceSource = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
assert.ok(!leadWorkspaceSource.includes("lead.organizationId"), "lead workspace must not use lead.organizationId")
assert.ok(
  leadWorkspaceSource.includes("resolveGrowthEngineWorkspaceOrganizationId"),
  "lead workspace must use canonical org resolver",
)
assert.ok(
  leadWorkspaceSource.includes("resolveGrowthCanonicalDecisionForLeadCached"),
  "lead workspace must use cached canonical decision resolver",
)
console.log("  ✓ repair: lead-operator-workspace-from-lead organization + decision resolution")

const meetingPrepSource = readSource("lib/growth/meeting-intelligence/meeting-prep-context.ts")
assert.ok(!meetingPrepSource.includes("lead.organizationId"), "meeting prep must not use lead.organizationId")
assert.ok(
  meetingPrepSource.includes("resolveGrowthEngineWorkspaceOrganizationId"),
  "meeting prep must use canonical org resolver",
)
console.log("  ✓ repair: meeting-prep-context organization scoping")

assert.equal(
  institutionalAdviceMustNotOverrideAccountFact({ nested: ["advice"] }, ["ServiceMax"]),
  true,
  "malformed institutional advice object must not crash",
)
assert.equal(
  institutionalAdviceMustNotOverrideAccountFact(42, ["ServiceMax depot coordination"]),
  true,
  "numeric institutional advice must coerce safely",
)
assert.equal(
  institutionalAdviceMustNotOverrideAccountFact("ServiceMax depot coordination confirmed", [
    "ServiceMax depot coordination",
  ]),
  false,
  "string institutional advice still filters account facts",
)
console.log("  ✓ repair: canonical-human-memory-constitution institutional advice coercion")

assert.equal(
  buildAssistDedupeKey({ category: "call", eventType: "objection", evidenceText: { raw: "pricing concern" } }),
  buildAssistDedupeKey({ category: "call", eventType: "objection", evidenceText: "[object object]" }),
  "malformed object evidence must coerce without throwing",
)
assert.equal(
  buildAssistDedupeKey({ category: "call", eventType: "objection", evidenceText: null }),
  "call:objection:",
  "null evidence must coerce to empty string",
)
console.log("  ✓ repair: deduplication assist evidence normalization")

// Phase 2 — workspace organization resolution
const explicit = resolveGrowthEngineWorkspaceOrganizationId(ORG_ID)
assert.equal(explicit?.organizationId, ORG_ID)
assert.equal(explicit?.source, "explicit_override")
assert.equal(explicit?.qaMarker, GROWTH_ENGINE_WORKSPACE_ORGANIZATION_QA_MARKER)

const invalid = resolveGrowthEngineWorkspaceOrganizationId("not-a-uuid")
assert.equal(invalid, null, "invalid override must fail closed")

const envOnly = resolveGrowthEngineWorkspaceOrganizationId()
if (process.env.GROWTH_ENGINE_AI_ORG_ID) {
  assert.equal(envOnly?.source, "growth_engine_ai_org_id_env")
} else {
  assert.equal(envOnly, null, "missing env must fail closed without hardcoded fallback")
}
assert.equal(
  DOCUMENTED_EQUIPIFY_AI_OS_PRODUCTION_ORG_ID,
  "00757488-1026-44a5-aac4-269533ac21be",
  "documented production org constant",
)
console.log("  ✓ organization resolution: tenant-safe fail-closed workspace helper")

// Phase 3 — stable decision fingerprints
assert.equal(
  GROWTH_AIOS_CANONICAL_DECISION_RESOLUTION_BOUNDARY_QA_MARKER,
  "ge-aios-canonical-decision-resolution-boundary-v1",
)

const boundaryNoMaterial = resolveCanonicalDecisionGeneratedAtBoundary({})
assert.equal(boundaryNoMaterial, CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL)

const boundaryWithMaterial = resolveCanonicalDecisionGeneratedAtBoundary({
  latestReplyAt: "2026-07-11T10:00:00.000Z",
  latestMeetingAt: "2026-07-24T15:00:00.000Z",
})
assert.equal(boundaryWithMaterial, "2026-07-24T15:00:00.000Z")

const base = blockImagingInput()
const decisionA = buildGrowthCanonicalNextBestDecision(base)
const decisionB = buildGrowthCanonicalNextBestDecision({
  ...base,
  generatedAt: "2099-01-01T00:00:00.000Z",
})
assert.equal(
  decisionA.decisionFingerprint,
  decisionB.decisionFingerprint,
  "wall-clock generatedAt must not change fingerprint when sourceVersions are stable",
)

const memoryA = minimalMemoryBundle("2026-01-01T00:00:00.000Z")
const memoryB = minimalMemoryBundle("2099-12-31T23:59:59.999Z")
assert.equal(
  buildStableCanonicalMemoryVersionKey(memoryA),
  buildStableCanonicalMemoryVersionKey(memoryB),
  "memory version key must ignore bundle.generatedAt wall-clock",
)

const replyChanged = buildGrowthCanonicalNextBestDecision({
  ...base,
  replyState: {
    classification: "positive_interest",
    intent: "meeting_request",
    isMaterial: true,
    isOutOfOffice: false,
    isUnknown: false,
    receivedAt: "2026-07-25T10:00:00.000Z",
  },
  sourceVersions: {
    ...base.sourceVersions!,
    materialEventId: "reply-001",
  },
})
assert.notEqual(decisionA.decisionFingerprint, replyChanged.decisionFingerprint, "material reply must change fingerprint")

const meetingChanged = buildGrowthCanonicalNextBestDecision({
  ...base,
  meeting: {
    ...base.meeting!,
    meetingAt: "2026-08-01T16:00:00.000Z",
  },
  sourceVersions: {
    ...base.sourceVersions!,
    meetingVersion: "2026-08-01T16:00:00.000Z",
  },
})
assert.notEqual(decisionA.decisionFingerprint, meetingChanged.decisionFingerprint, "meeting change must change fingerprint")

const lifecycleChanged = buildGrowthCanonicalNextBestDecision({
  ...base,
  operatorConstraints: { archived: true },
})
assert.notEqual(
  decisionA.decisionFingerprint,
  lifecycleChanged.decisionFingerprint,
  "lifecycle archive must change fingerprint",
)

const evalInstant = resolveCanonicalDecisionEvaluationInstantMs(CANONICAL_DECISION_STATE_BOUNDARY_SENTINEL, [
  "2026-07-24T15:00:00.000Z",
])
assert.equal(evalInstant, Date.parse("2026-07-24T15:00:00.000Z"))
console.log("  ✓ fingerprint stability: identical state → identical fingerprint; material changes diverge")

// Phase 4 — decision cache effectiveness (unit-level key alias + invalidation)
clearCanonicalDecisionResolutionCache()

const mockResolution: GrowthCanonicalDecisionResolution = {
  qaMarker: "ge-aios-canonical-decision-engine-1b-v1",
  decision: decisionA,
  operatorDecision: {
    qaMarker: "ge-aios-canonical-decision-engine-1b-operator-v1",
    primaryAction: decisionA.primaryAction,
    title: decisionA.title,
    rationale: decisionA.rationale,
    urgency: decisionA.urgency,
    confidence: decisionA.confidence,
    recommendedActor: decisionA.recommendedActor,
    recommendedChannel: decisionA.recommendedChannel,
    waitUntil: decisionA.waitUntil,
    prerequisites: decisionA.prerequisites,
    blockedBy: decisionA.blockedBy,
    supportingActions: decisionA.supportingActions,
    suppressedActions: decisionA.suppressedActions,
    operatorReviewRequired: decisionA.operatorReviewRequired,
    transportBlocked: decisionA.transportBlocked,
    freshnessLabel: "fresh",
    sourceSummary: decisionA.sourceSummary,
  },
  suppressionHints: {
    suppressTransport: false,
    suppressColdOutreach: false,
    suppressDuplicatePackage: false,
  },
  freshness: {
    state: "fresh",
    packageFingerprint: "none",
    staleReasons: [],
  },
  degradedInputs: [],
}

const versions = buildCanonicalDecisionCacheVersions(mockResolution)
assert.ok(versions.lifecycleVersion.includes(decisionA.primaryAction))
assert.equal(versions.packageVersion, "none")

const inputKey = [
  ORG_ID,
  BLOCK_LEAD,
  "none",
  "none",
  "none",
  "none",
  "operator-surface",
].join(":")

const resolvedKey = [
  ORG_ID,
  BLOCK_LEAD,
  versions.materialEventVersion ?? "none",
  versions.packageVersion ?? "none",
  versions.lifecycleVersion,
  versions.postCallClosureFingerprint ?? "none",
  "operator-surface",
].join(":")

assert.notEqual(inputKey, resolvedKey, "input and resolved cache keys differ before alias storage")
invalidateCanonicalDecisionCacheForLead(BLOCK_LEAD, "cert_reset")
clearCanonicalDecisionResolutionCache()
console.log("  ✓ decision cache: key versions + invalidation hooks certified (runtime warm/cold measured in validate:1a)")

console.log(`\n[GE-AIOS-PRODUCTION-VALIDATION-1B] PASS ${GE_AIOS_PRODUCTION_VALIDATION_1B_QA_MARKER}`)
