/**
 * GE-AIOS-LIVE-1B — Canonical missionPurpose authority certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-1b-mission-purpose-authority
 */
import assert from "node:assert/strict"
import {
  buildDefaultProductionLeadMetadata,
  readCanonicalLeadMissionPurpose,
  readCanonicalObjectiveMissionPurpose,
  resolveLeadMissionPurposeForOperations,
  resolveObjectiveMissionPurposeForOperations,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  buildMissionPurposeResolutionContext,
  inferLeadMissionPurposeForMigration,
  inferObjectiveMissionPurposeForMigration,
  resolveLeadMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import {
  GROWTH_MISSION_PURPOSE_1B_QA_MARKER,
  GROWTH_MISSION_PURPOSE_METADATA_KEY,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { buildProductionMissionPurposeProjection } from "@/lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a"
import {
  GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER,
  mergeCanonicalLeadMissionPurposeMetadata,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-migration-1b"
import { emptyCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthLead } from "@/lib/growth/types"

const PHASE = "GE-AIOS-LIVE-1B" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PRODUCTION_LEAD_ID = "11111111-1111-1111-1111-111111111111"
const PRODUCTION_MISSION_ACTIVATED_AT = "2026-07-01T00:00:00.000Z"

function leadFixture(input: Partial<GrowthLead> & Pick<GrowthLead, "id" | "companyName">): GrowthLead {
  return {
    id: input.id,
    companyName: input.companyName,
    contactName: input.contactName ?? null,
    contactEmail: input.contactEmail ?? null,
    website: input.website ?? null,
    status: input.status ?? "qualified",
    sourceKind: input.sourceKind ?? "acquisition",
    sourceDetail: input.sourceDetail ?? null,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? "2026-06-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-06-01T00:00:00.000Z",
    archivedAt: input.archivedAt ?? null,
    promotedOrganizationId: input.promotedOrganizationId ?? ORG,
    workflowHealth: input.workflowHealth ?? "healthy",
    workflowHealthReason: input.workflowHealthReason ?? null,
  } as GrowthLead
}

function objectiveFixture(input: Partial<GrowthObjective> & Pick<GrowthObjective, "id" | "title">): GrowthObjective {
  return {
    id: input.id,
    organizationId: ORG,
    title: input.title,
    description: input.description ?? null,
    objectiveType: input.objectiveType ?? "opportunities_created",
    targetValue: input.targetValue ?? 10,
    currentValue: input.currentValue ?? 2,
    startDate: input.startDate ?? null,
    targetDate: input.targetDate ?? null,
    status: input.status ?? "active",
    ownerUserId: input.ownerUserId ?? null,
    priority: input.priority ?? "high",
    autonomyLevel: input.autonomyLevel ?? "objective",
    safetyMode: input.safetyMode ?? "strict",
    plan: input.plan ?? null,
    runtime: input.runtime ?? ({ running: true, currentStageId: "discover" } as GrowthObjective["runtime"]),
    executionHistory: input.executionHistory ?? [],
    recentSignals: input.recentSignals ?? [],
    recommendations: input.recommendations ?? [],
    eventSubscriptions: input.eventSubscriptions ?? null,
    executionContext: input.executionContext ?? null,
    emergencyStopActive: false,
    qa_marker: "growth-objective-ge-auto-2g-v1",
    createdAt: input.createdAt ?? "2026-07-10T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-07-10T00:00:00.000Z",
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Canonical missionPurpose authority certification`)
  assert.equal(GE_AIOS_LIVE_1B_MISSION_PURPOSE_MIGRATION_QA_MARKER, GROWTH_MISSION_PURPOSE_1B_QA_MARKER)

  const context = buildMissionPurposeResolutionContext({
    organizationId: ORG,
    productionMissionActivatedAt: PRODUCTION_MISSION_ACTIVATED_AT,
    pendingApprovalLeadIds: new Set([BLOCK_LEAD_ID]),
    draftFactoryStateByLeadId: new Map([
      [BLITZ_LEAD_ID, "waiting_for_generation"],
      [BLOCK_LEAD_ID, "waiting_for_approval"],
    ]),
  })

  const blitzLegacy = leadFixture({
    id: BLITZ_LEAD_ID,
    companyName: "Blitz Industries (Transport Fidelity Cert)",
  })
  const blockLegacy = leadFixture({
    id: BLOCK_LEAD_ID,
    companyName: "Block Imaging",
    createdAt: "2026-06-15T00:00:00.000Z",
  })
  const productionLegacy = leadFixture({
    id: PRODUCTION_LEAD_ID,
    companyName: "Precision HVAC Services",
    createdAt: "2026-07-15T00:00:00.000Z",
  })

  const blitzInferred = inferLeadMissionPurposeForMigration({ lead: blitzLegacy, context })
  assert.equal(blitzInferred.purpose, "certification")
  assert.notEqual(blitzInferred.source, "canonical_persisted")
  console.log("  ✓ Legacy Blitz infers certification once for migration")

  const blockInferred = inferLeadMissionPurposeForMigration({ lead: blockLegacy, context })
  assert.equal(blockInferred.purpose, "certification")
  console.log("  ✓ Legacy Block infers certification once for migration")

  const migratedAt = "2026-07-20T12:00:00.000Z"
  const blitzCanonicalMetadata = mergeCanonicalLeadMissionPurposeMetadata({
    metadata: blitzLegacy.metadata,
    purpose: blitzInferred.purpose,
    generatedAt: migratedAt,
  })
  const blockCanonicalMetadata = mergeCanonicalLeadMissionPurposeMetadata({
    metadata: blockLegacy.metadata,
    purpose: blockInferred.purpose,
    generatedAt: migratedAt,
  })
  const productionCanonicalMetadata = mergeCanonicalLeadMissionPurposeMetadata({
    metadata: buildDefaultProductionLeadMetadata(productionLegacy.metadata),
    purpose: "production",
    generatedAt: migratedAt,
  })

  assert.equal(readCanonicalLeadMissionPurpose(blitzCanonicalMetadata), "certification")
  assert.equal(readCanonicalLeadMissionPurpose(blockCanonicalMetadata), "certification")
  assert.equal(readCanonicalLeadMissionPurpose(productionCanonicalMetadata), "production")
  console.log("  ✓ Migration persists canonical missionPurpose on leads")

  const blitzCanonicalLead = leadFixture({
    ...blitzLegacy,
    metadata: blitzCanonicalMetadata,
  })
  const blockCanonicalLead = leadFixture({
    ...blockLegacy,
    metadata: blockCanonicalMetadata,
  })
  const productionCanonicalLead = leadFixture({
    ...productionLegacy,
    metadata: productionCanonicalMetadata,
  })

  const blitzOperational = resolveLeadMissionPurpose({ lead: blitzCanonicalLead, context })
  assert.equal(blitzOperational.purpose, "certification")
  assert.equal(blitzOperational.source, "canonical_persisted")
  console.log("  ✓ Home/Operations runtime reads canonical missionPurpose only")

  const idempotentBlitzMetadata = mergeCanonicalLeadMissionPurposeMetadata({
    metadata: blitzCanonicalMetadata,
    purpose: "production",
    generatedAt: "2026-07-21T00:00:00.000Z",
  })
  assert.equal(readCanonicalLeadMissionPurpose(idempotentBlitzMetadata), "certification")
  console.log("  ✓ Repeated migration is idempotent")

  const defaultProductionMetadata = buildDefaultProductionLeadMetadata({ admission_state: "accepted" })
  assert.equal(readCanonicalLeadMissionPurpose(defaultProductionMetadata), "production")
  assert.equal(defaultProductionMetadata[GROWTH_MISSION_PURPOSE_METADATA_KEY], "production")
  console.log("  ✓ New production discoveries default missionPurpose=production")

  const certObjectiveLegacy = objectiveFixture({
    id: "obj-cert",
    title: "Revenue certification objective",
    executionContext: {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {
        discover: {
          materializedAt: "2026-07-01T00:00:00.000Z",
          completedAt: "2026-07-01T00:00:00.000Z",
          artifacts: [
            {
              resourceType: "saved_search",
              resourceId: "saved-1",
              resourceKey: "saved-1",
              label: "Cert search",
              status: "completed",
              createdAt: "2026-07-01T00:00:00.000Z",
              metadata: { certificationMode: true },
            },
          ],
          blockers: [],
        },
      },
      recoveredAt: null,
      missionRuntime: null,
    },
  })
  const certObjectiveInferred = inferObjectiveMissionPurposeForMigration(certObjectiveLegacy)
  assert.equal(certObjectiveInferred.purpose, "certification")
  const certObjectiveCanonical = objectiveFixture({
    ...certObjectiveLegacy,
    executionContext: {
      ...certObjectiveLegacy.executionContext!,
      missionPurpose: "certification",
    },
  })
  assert.equal(
    resolveObjectiveMissionPurposeForOperations(certObjectiveCanonical).source,
    "canonical_persisted",
  )
  console.log("  ✓ Certification objectives migrate to canonical missionPurpose")

  const prodObjective = objectiveFixture({
    id: "obj-prod",
    title: "Equipify production pipeline",
    createdAt: "2026-07-15T00:00:00.000Z",
    executionContext: {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: null,
      missionPurpose: "production",
    },
  })

  const projection = buildProductionMissionPurposeProjection({
    organizationId: ORG,
    leads: [blitzCanonicalLead, blockCanonicalLead, productionCanonicalLead],
    objectives: [prodObjective, certObjectiveCanonical],
    context,
    approvalSnapshot: {
      ...emptyCanonicalOperatorApprovalSnapshot(),
      packages: [
        {
          itemId: "hac-block",
          packageId: `outreach-prep:${BLOCK_LEAD_ID}:2026-07-13T16:40:40.229Z`,
          leadId: BLOCK_LEAD_ID,
          companyName: "Block Imaging",
          decisionMaker: "Josh",
          draftCount: 4,
          preparedAt: "2026-07-13T16:40:40.229Z",
          channelLabel: "Email",
          reviewHref: `/growth/review?leadId=${BLOCK_LEAD_ID}`,
        },
      ],
      topPackage: {
        itemId: "hac-block",
        packageId: `outreach-prep:${BLOCK_LEAD_ID}:2026-07-13T16:40:40.229Z`,
        leadId: BLOCK_LEAD_ID,
        companyName: "Block Imaging",
        decisionMaker: "Josh",
        draftCount: 4,
        preparedAt: "2026-07-13T16:40:40.229Z",
        channelLabel: "Email",
        reviewHref: `/growth/review?leadId=${BLOCK_LEAD_ID}`,
      },
      outreachPackageCount: 1,
      outreachDraftCount: 4,
      pendingApprovalCount: 1,
      waitingForOperator: true,
    },
  })

  assert.equal(projection.productionLeads.length, 1)
  assert.equal(projection.productionLeads[0]?.id, PRODUCTION_LEAD_ID)
  assert.equal(projection.productionObjectives.length, 1)
  assert.equal(projection.productionObjectives[0]?.id, "obj-prod")
  assert.equal(projection.productionApproval?.pendingApprovalCount, 0)
  assert.equal(
    projection.purposeByLeadId.get(BLITZ_LEAD_ID)?.source,
    "canonical_persisted",
  )
  assert.equal(
    resolveLeadMissionPurposeForOperations({ lead: blitzLegacy }).source,
    "default_production",
  )
  console.log("  ✓ Portfolio and Operations consume canonical missionPurpose only")

  console.log(`[${PHASE}] PASS`)
}

void main()
