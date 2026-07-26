/**
 * AVA-OUTREACH-PIPELINE-RECOVERY-1A — Certification (local, no email send).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ava-outreach-pipeline-recovery-1a.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateDraftFactoryApprovalArtifactPresence,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER,
  isOrphanWaitingForApprovalRow,
} from "../lib/growth/draft-factory/draft-factory-orphan-approval-package-artifact-1a"
import {
  applyOrphanApprovalPackageReconcileMutation,
  GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER,
  isOrphanApprovalReconcileCorrectedOutcome,
  planOrphanApprovalPackageReconcile,
  resolveOrphanApprovalPackageRecoveryFromEvidence,
} from "../lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-1a"
import { advanceDraftFactoryForLead } from "../lib/growth/draft-factory/draft-factory-durable-service"
import { createMemoryDraftFactoryRepository } from "../lib/growth/draft-factory/draft-factory-durable-memory-repository"
import type { AiOsDraftFactoryCanonicalEvidence } from "../lib/growth/draft-factory/draft-factory-durable-types"
import {
  buildGrowthHomeReviewQueuePresentation,
  isActionableHomeReviewPackagePreview,
} from "../lib/growth/home/growth-home-review-queue-1b"
import { mergeSupervisedAvaIntoApprovalSnapshot } from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { buildCanonicalDecisionSuppressionHints } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import type { GrowthHumanApprovalItem } from "../lib/growth/aios/approvals/growth-human-approval-center-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const QA = "ava-outreach-pipeline-recovery-1a-v1" as const
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const MD = "e7466319-9112-40a3-af46-d33c63f35823"
const CLAIM = "4f443634-54bf-4eb9-a114-93a287712a83"
const DIVERSE = "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5"
const BLOCK_GEN = "2bbacf99-b884-442f-a5b2-ce78132368cf"
const ORPHAN_PKG = `outreach-prep:${MD}:2026-07-23T05:41:10.332Z`
const LEGACY_PKG = `outreach-prep:${BLOCK}:2026-07-13T16:40:40.229Z`

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function baseEvidence(partial?: Partial<AiOsDraftFactoryCanonicalEvidence>): AiOsDraftFactoryCanonicalEvidence {
  return {
    admitted: true,
    researchCurrent: true,
    knowledgeComplete: true,
    portfolioSelected: true,
    decisionMakerAvailable: true,
    contactVerifiedForEmail: true,
    personalizationReady: true,
    draftValid: false,
    approved: false,
    stopInvestment: false,
    failed: false,
    packageId: null,
    investmentState: "increase_investment",
    spendAuthorized: true,
    ...partial,
  }
}

console.log(`[${QA}] AVA-OUTREACH-PIPELINE-RECOVERY-1A certification`)

assert.equal(GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_ARTIFACT_1A_QA_MARKER, "ava-outreach-pipeline-recovery-1a-orphan-artifact-v1")
assert.equal(GROWTH_DRAFT_FACTORY_ORPHAN_APPROVAL_RECONCILE_1A_QA_MARKER, "ava-outreach-pipeline-recovery-1a-orphan-reconcile-v1")

// 1–3 orphan reconcile planner
const orphanPlan = planOrphanApprovalPackageReconcile({
  rows: [
    {
      leadId: MD,
      state: "waiting_for_approval",
      packageId: ORPHAN_PKG,
      artifactFacts: {
        state: "waiting_for_approval",
        packageId: ORPHAN_PKG,
        hasPreparationRunForPackageId: false,
        preparationRunHasApprovalBody: false,
        hasSupervisedGenerationForLead: false,
      },
      recoveryEvidence: baseEvidence(),
    },
    {
      leadId: BLOCK,
      state: "waiting_for_approval",
      packageId: LEGACY_PKG,
      artifactFacts: {
        state: "waiting_for_approval",
        packageId: LEGACY_PKG,
        hasPreparationRunForPackageId: true,
        preparationRunHasApprovalBody: true,
        hasSupervisedGenerationForLead: true,
      },
      recoveryEvidence: baseEvidence(),
    },
  ],
})
assert.equal(orphanPlan.candidatesFound, 1)
assert.equal(orphanPlan.candidates[0]?.leadId, MD)

const legacyBlockerPlan = planOrphanApprovalPackageReconcile({
  rows: [
    {
      leadId: CLAIM,
      state: "waiting_for_approval",
      packageId: `outreach-prep:${CLAIM}:2026-07-23T05:41:10.332Z`,
      artifactFacts: {
        state: "waiting_for_approval",
        packageId: `outreach-prep:${CLAIM}:2026-07-23T05:41:10.332Z`,
        hasPreparationRunForPackageId: true,
        preparationRunHasApprovalBody: true,
        hasSupervisedGenerationForLead: false,
      },
      recoveryEvidence: baseEvidence(),
    },
  ],
})
assert.equal(legacyBlockerPlan.candidatesFound, 1)
console.log("  ✓ legacy-only waiting_for_approval without supervised generation is reconcilable")

const eligibleRecovery = resolveOrphanApprovalPackageRecoveryFromEvidence(baseEvidence())
assert.equal(eligibleRecovery.nextState, "waiting_for_generation")
assert.equal(eligibleRecovery.readiness.generationEligible, true)
console.log("  ✓ orphan + still eligible → waiting_for_generation")

const stopRecovery = resolveOrphanApprovalPackageRecoveryFromEvidence(
  baseEvidence({ stopInvestment: true, investmentState: "stop_investment" }),
)
assert.equal(stopRecovery.nextState, "paused")
assert.equal(stopRecovery.pausedReason, "stop_investment")
console.log("  ✓ orphan + no longer eligible → paused/stop_investment")

const contactRecovery = resolveOrphanApprovalPackageRecoveryFromEvidence(
  baseEvidence({ contactVerifiedForEmail: false, decisionMakerAvailable: true }),
)
assert.equal(contactRecovery.nextState, "waiting_for_contact_verification")
console.log("  ✓ orphan + missing contact → contact gate")

const researchRecovery = resolveOrphanApprovalPackageRecoveryFromEvidence(
  baseEvidence({ researchCurrent: false, knowledgeComplete: false, researchSufficientForPackage: false }),
)
assert.equal(researchRecovery.nextState, "waiting_for_research")
console.log("  ✓ orphan + incomplete research → research gate")

const reconciled = applyOrphanApprovalPackageReconcileMutation({
  row: {
    organizationId: ORG,
    leadId: MD,
    state: "waiting_for_approval",
    earliestIncompleteStage: "approval",
    version: 1,
    packageId: ORPHAN_PKG,
    researchRunId: null,
    decisionMakerId: "dm-1",
    personalizationId: null,
    lastWakeType: "capacity_available",
    lastWakeAt: "2026-07-23T05:41:10.332Z",
    nextEligibleWakeAt: null,
    attemptCounts: { research: 1, decisionMaker: 1, contactVerification: 1, personalization: 1, generation: 2 },
    lastErrorCode: null,
    lastErrorStage: null,
    pausedReason: null,
    leaseOwner: null,
    leaseExpiresAt: null,
    createdAt: "2026-07-23T05:41:10.332Z",
    updatedAt: "2026-07-23T05:41:10.332Z",
  },
  recovery: eligibleRecovery,
  orphanReason: "package_id has no resolvable approval artifact",
  now: "2026-07-26T12:00:00.000Z",
  workerId: "cert",
})
assert.ok(reconciled)
assert.equal(reconciled!.state, "waiting_for_generation")
assert.equal(reconciled!.packageId, null)
assert.equal(reconciled!.earliestIncompleteStage, "generation")
console.log("  ✓ eligible orphan reconciles with cleared package_id to canonical recovery state")

// 4 valid supervised untouched by reconcile mutation (no DF row needed)
assert.equal(
  applyOrphanApprovalPackageReconcileMutation({
    row: {
      organizationId: ORG,
      leadId: BLOCK,
      state: "draft_ready",
      earliestIncompleteStage: "generation",
      version: 0,
      packageId: null,
      researchRunId: null,
      decisionMakerId: null,
      personalizationId: null,
      lastWakeType: null,
      lastWakeAt: null,
      nextEligibleWakeAt: null,
      attemptCounts: { research: 0, decisionMaker: 0, contactVerification: 0, personalization: 0, generation: 0 },
      lastErrorCode: null,
      lastErrorStage: null,
      pausedReason: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: "",
      updatedAt: "",
    },
    recovery: eligibleRecovery,
    orphanReason: "not orphan",
    now: "2026-07-26T12:00:00.000Z",
    workerId: "cert",
  }),
  null,
)
console.log("  ✓ Block Imaging pattern (no orphan DF row) untouched by reconcile mutation")

// 5–7 approved/sent untouched
for (const state of ["approved", "executed"] as const) {
  assert.equal(
    isOrphanWaitingForApprovalRow({
      state,
      packageId: LEGACY_PKG,
      artifact: evaluateDraftFactoryApprovalArtifactPresence({
        state,
        packageId: LEGACY_PKG,
        hasPreparationRunForPackageId: true,
        preparationRunHasApprovalBody: true,
        hasSupervisedGenerationForLead: false,
        packageApproved: state === "approved",
        packageSent: state === "executed",
      }),
    }),
    false,
  )
}
console.log("  ✓ approved/sent packages not classified as orphan")

// 8–9 Home queue excludes orphans; 3 stale + 1 valid => 1
const staleLegacy = (leadId: string, companyName: string) => ({
  itemId: `legacy:${leadId}`,
  packageId: `outreach-prep:${leadId}:2026-07-23T05:41:10.332Z`,
  leadId,
  companyName,
  decisionMaker: null,
  draftCount: 0,
  preparedAt: "2026-07-23T05:41:10.332Z",
  preparedAgoLabel: null,
  channelLabel: "Email sequence",
  statusLabel: "Waiting for approval",
  reviewHref: `/growth/review/${leadId}`,
  packageSource: "legacy_hac_package" as const,
})

const queue = buildGrowthHomeReviewQueuePresentation({
  packages: [
    staleLegacy(MD, "MD Equipment Services"),
    staleLegacy(CLAIM, "ClaimLinx"),
    staleLegacy(DIVERSE, "Diverse Power Foundation"),
    {
      itemId: `supervised-draft:${BLOCK_GEN}`,
      packageId: BLOCK_GEN,
      leadId: BLOCK,
      companyName: "Block Imaging",
      decisionMaker: "Josh Block",
      draftCount: 1,
      preparedAt: "2026-07-24T17:27:00.000Z",
      preparedAgoLabel: null,
      channelLabel: "Quick intro",
      statusLabel: "Ready for review",
      reviewHref: `/growth/review/${BLOCK}`,
      packageSource: "supervised_ava_generation",
    },
  ],
  supervisedReadyByLeadId: new Map([
    [
      BLOCK,
      {
        generationId: BLOCK_GEN,
        leadId: BLOCK,
        companyName: "Block Imaging",
        contactName: "Josh Block",
        subject: "Quick intro",
        rationale: "Valid supervised draft",
        preparedAt: "2026-07-24T17:27:00.000Z",
        reviewHref: `/growth/review/${BLOCK}`,
      },
    ],
  ]),
})
assert.equal(queue.rows.length, 1)
assert.equal(queue.awaitingReviewCount, 1)
assert.equal(queue.rows[0]?.companyName, "Block Imaging")
console.log("  ✓ Home queue excludes orphan packages (3 stale + 1 valid => awaiting review = 1)")

// 10 preview path wiring for legacy completed-work
const previewClient = readSource("lib/growth/home/growth-home-review-queue-preview-client-1b.ts")
assert.match(previewClient, /completed-work\/packages/)
assert.match(previewClient, /parseOutreachPrepPackageId/)
console.log("  ✓ legacy preview routes outreach-prep IDs to completed-work API")

// 11 suppressDuplicatePackage guard clears after orphan reconcile (no operatorReviewRequired)
const afterReconcileHints = buildCanonicalDecisionSuppressionHints({
  decisionFingerprint: "test",
  primaryAction: "contact",
  operatorReviewRequired: false,
  transportBlocked: true,
  sourceSummary: { approvalStatus: null },
  blockedBy: [],
  suppressedActions: [],
  waitUntil: null,
} as never)
assert.equal(afterReconcileHints.suppressDuplicatePackage, false)
console.log("  ✓ suppressDuplicatePackage not armed when operatorReviewRequired is false")

async function certifyDraftFactoryInvariant() {
  const repo = createMemoryDraftFactoryRepository("cert")
  const now = "2026-07-26T12:00:00.000Z"
  const readyEvidence = baseEvidence()

  await repo.upsertLeadState(
    {
      organizationId: ORG,
      leadId: "lead-no-5f",
      state: "waiting_for_generation",
      earliestIncompleteStage: "generation",
      version: 0,
      packageId: null,
      researchRunId: null,
      decisionMakerId: null,
      personalizationId: null,
      lastWakeType: null,
      lastWakeAt: null,
      nextEligibleWakeAt: now,
      attemptCounts: {
        research: 1,
        decisionMaker: 1,
        contactVerification: 1,
        personalization: 1,
        generation: 0,
      },
      lastErrorCode: null,
      lastErrorStage: null,
      pausedReason: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
    null,
  )

  const deferred = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-no-5f",
    wake: { type: "capacity_available", sourceId: "cert:capacity" },
    now,
    evidence: readyEvidence,
    repository: repo,
    completionHints: { completeCurrentStage: true, generationCapacityAvailable: true },
  })
  assert.notEqual(deferred.nextState, "waiting_for_approval")
  assert.equal(deferred.packageId, null)

  await repo.upsertLeadState(
    {
      organizationId: ORG,
      leadId: "lead-with-5f",
      state: "waiting_for_generation",
      earliestIncompleteStage: "generation",
      version: 0,
      packageId: null,
      researchRunId: null,
      decisionMakerId: null,
      personalizationId: null,
      lastWakeType: null,
      lastWakeAt: null,
      nextEligibleWakeAt: now,
      attemptCounts: {
        research: 1,
        decisionMaker: 1,
        contactVerification: 1,
        personalization: 1,
        generation: 0,
      },
      lastErrorCode: null,
      lastErrorStage: null,
      pausedReason: null,
      leaseOwner: null,
      leaseExpiresAt: null,
      createdAt: now,
      updatedAt: now,
    },
    null,
  )

  const confirmed = await advanceDraftFactoryForLead({
    organizationId: ORG,
    leadId: "lead-with-5f",
    wake: { type: "capacity_available", sourceId: "cert:capacity:2" },
    now,
    evidence: readyEvidence,
    repository: repo,
    completionHints: { completeCurrentStage: true, generationCapacityAvailable: true },
    generateViaGrowth5F: async () => ({
      packageId: `outreach-prep:lead-with-5f:${now}`,
      pendingHumanApproval: true,
      transportBlocked: true,
    }),
  })
  assert.equal(confirmed.nextState, "waiting_for_approval")
  assert.ok(confirmed.packageId?.startsWith("outreach-prep:"))
  console.log("  ✓ waiting_for_approval requires Growth 5F confirmation; stub path defers instead")
}

async function main() {
  await certifyDraftFactoryInvariant()

  const durableSrc = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
  assert.match(durableSrc, /generationPackageConfirmed/)
  assert.match(durableSrc, /refusing synthetic package_id/)
  const reconcileSrc = readSource("lib/growth/draft-factory/draft-factory-orphan-approval-package-reconcile-1a.ts")
  assert.match(reconcileSrc, /resolveOrphanApprovalPackageRecoveryFromEvidence/)
  assert.match(reconcileSrc, /resolveEarliestIncompleteDurableStage/)
  const dueTick = readSource("lib/growth/draft-factory/draft-factory-due-scheduler-tick.ts")
  assert.match(dueTick, /reconcileOrphanApprovalPackagesForOrganization/)
  const repairScript = readSource("scripts/repair-ava-outreach-pipeline-orphans-1a-production.ts")
  assert.match(repairScript, /dryRun/)
  assert.match(repairScript, /AVA_OUTREACH_PIPELINE_RECOVERY_1A_CONFIRM/)

  assert.ok(
    isOrphanApprovalReconcileCorrectedOutcome({
      previousState: "waiting_for_approval",
      nextState: "waiting_for_generation",
      previousPackageId: ORPHAN_PKG,
      nextPackageId: null,
    }),
  )
  console.log("  ✓ reconciliation + repair script wiring present")

  const now = "2026-07-26T12:00:00.000Z"
  const hacItem: GrowthHumanApprovalItem = {
    id: "outreach:orphan",
    organizationId: ORG,
    source: "outreach_package",
    actionType: "approve_outreach_package",
    channel: "email",
    subjectType: "lead",
    subjectId: MD,
    title: "Outreach package — MD Equipment Services",
    summary: "orphan",
    riskLevel: "medium",
    priorityScore: 50,
    status: "needs_review",
    evidence: [],
    policy: { requiresHumanApproval: true, enforcementSource: "test" },
    route: `/growth/review?packageId=${encodeURIComponent(ORPHAN_PKG)}`,
    createdAt: now,
  }
  const snapshot = buildCanonicalOperatorApprovalSnapshot({ hacItems: [hacItem], packagesById: new Map() })
  assert.equal(snapshot.packages.length, 0)

  const legacyPkg: GrowthAutonomousOutreachApprovalPackage = {
    packageId: LEGACY_PKG,
    leadId: BLOCK,
    companyName: "Block Imaging Legacy",
    preparedAt: now,
    pendingHumanApproval: true,
    transportBlocked: true,
    confidence: 0.8,
    expectedOutcome: "Review",
    recommendedChannel: "email",
    recommendedSequence: "email_first",
    generatedAssets: [{ channel: "email", preview: "Hello", assetId: "a1" }],
    supportingResearch: [],
    personalizationEvidence: [],
    complianceNotes: [],
  }
  const legacySnapshot = buildCanonicalOperatorApprovalSnapshot({
    hacItems: [
      {
        ...hacItem,
        id: "outreach:legacy",
        subjectId: BLOCK,
        title: "Outreach package — Block Imaging",
        route: `/growth/review?packageId=${encodeURIComponent(LEGACY_PKG)}`,
      },
    ],
    packagesById: new Map([[LEGACY_PKG, legacyPkg]]),
  })
  assert.equal(legacySnapshot.packages.length, 0)
  console.log("  ✓ legacy HAC packages excluded from supervised Home actionable snapshot")

  const merged = mergeSupervisedAvaIntoApprovalSnapshot({
    base: {
      qaMarker: "ge-aios-operator-experience-1a-canonical-v1" as never,
      outreachPackageCount: 3,
      outreachDraftCount: 0,
      pendingApprovalCount: 3,
      waitingForOperator: true,
      packages: [staleLegacy(MD, "MD Equipment Services"), staleLegacy(CLAIM, "ClaimLinx")],
      topPackage: staleLegacy(MD, "MD Equipment Services"),
    },
    attention: {
      qaMarker: "ava-home-projection-cutover-1a-v1" as never,
      readyForReview: [
        {
          generationId: BLOCK_GEN,
          leadId: BLOCK,
          companyName: "Block Imaging",
          contactName: "Josh Block",
          subject: "Intro",
          rationale: "Pursue",
          preparedAt: now,
          reviewHref: `/growth/review/${BLOCK}`,
        },
      ],
      needsInformation: [],
      sentLeadIds: [],
      rejectedCount: 0,
    },
  })
  assert.equal(merged.packages.length, 1)
  assert.equal(merged.packages[0]?.packageSource, "supervised_ava_generation")
  console.log("  ✓ supervised merge drops non-actionable legacy rows")

  assert.equal(
    isActionableHomeReviewPackagePreview({
      pkg: staleLegacy(MD, "MD Equipment Services"),
    }),
    false,
  )
  console.log("  ✓ isActionableHomeReviewPackagePreview rejects orphan legacy rows")

  console.log(`\n[${QA}] PASS — AVA-OUTREACH-PIPELINE-RECOVERY-1A certification complete`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
