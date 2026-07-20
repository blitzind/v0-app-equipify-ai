/**
 * GE-AIOS-LIVE-1A — Production mission operations certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-1a-production-mission-operations
 */
import assert from "node:assert/strict"
import {
  buildMissionPurposeResolutionContext,
  GE_AIOS_LIVE_1A_MISSION_PURPOSE_QA_MARKER,
  inferLeadMissionPurposeForMigration,
  inferObjectiveMissionPurposeForMigration,
  resolveLeadMissionPurpose,
  resolveObjectiveMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import {
  buildDefaultProductionLeadMetadata,
  readCanonicalLeadMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  buildProductionMissionAuthority,
  GE_AIOS_LIVE_1A_PRODUCTION_MISSION_OBJECTIVE,
} from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import {
  buildProductionMissionPurposeProjection,
  filterProductionOperatorApprovalSnapshot,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-operator-filter-1a"
import { GROWTH_MISSION_PURPOSE_1A_QA_MARKER } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { emptyCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthLead } from "@/lib/growth/types"
import { GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import { GROWTH_OBJECTIVE_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"

const PHASE = "GE-AIOS-LIVE-1A" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291"
const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
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
    runtime: input.runtime ?? { running: true, currentStageId: "discover" } as GrowthObjective["runtime"],
    executionHistory: input.executionHistory ?? [],
    recentSignals: input.recentSignals ?? [],
    recommendations: input.recommendations ?? [],
    eventSubscriptions: input.eventSubscriptions ?? null,
    executionContext: input.executionContext ?? null,
    emergencyStopActive: false,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: input.createdAt ?? "2026-07-10T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-07-10T00:00:00.000Z",
  }
}

function canonicalCertLead(
  lead: GrowthLead,
  context: ReturnType<typeof buildMissionPurposeResolutionContext>,
): GrowthLead {
  const inferred = inferLeadMissionPurposeForMigration({ lead, context })
  return leadFixture({
    ...lead,
    metadata: {
      ...lead.metadata,
      mission_purpose: inferred.purpose,
    },
  })
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Production mission operations certification`)
  assert.equal(GROWTH_MISSION_PURPOSE_1A_QA_MARKER, GE_AIOS_LIVE_1A_MISSION_PURPOSE_QA_MARKER)

  const context = buildMissionPurposeResolutionContext({
    organizationId: ORG,
    productionMissionActivatedAt: PRODUCTION_MISSION_ACTIVATED_AT,
    pendingApprovalLeadIds: new Set([BLOCK_LEAD_ID]),
    draftFactoryStateByLeadId: new Map([
      [BLITZ_LEAD_ID, "waiting_for_generation"],
      [BLOCK_LEAD_ID, "waiting_for_approval"],
    ]),
  })

  const blitzByName = inferLeadMissionPurposeForMigration({
    lead: leadFixture({
      id: BLITZ_LEAD_ID,
      companyName: "Blitz Industries (Transport Fidelity Cert)",
    }),
    context,
  })
  assert.equal(blitzByName.purpose, "certification")
  assert.equal(blitzByName.source, "company_name_pattern")
  console.log("  ✓ Blitz classified as certification via company name pattern")

  const blitzByMetadata = inferLeadMissionPurposeForMigration({
    lead: leadFixture({
      id: BLITZ_LEAD_ID,
      companyName: "Blitz Industries",
      metadata: { ge_aios_transport_fidelity_1c6_cert: true },
    }),
    context,
  })
  assert.equal(blitzByMetadata.purpose, "certification")
  console.log("  ✓ Blitz classified as certification via metadata cert key")

  const blockLegacy = inferLeadMissionPurposeForMigration({
    lead: leadFixture({
      id: BLOCK_LEAD_ID,
      companyName: "Block Imaging",
      createdAt: "2026-06-15T00:00:00.000Z",
    }),
    context,
  })
  assert.equal(blockLegacy.purpose, "certification")
  assert.equal(blockLegacy.source, "legacy_pre_production_fixture")
  console.log("  ✓ Block classified as certification via pre-production approval fixture rule")

  const productionLead = resolveLeadMissionPurpose({
    lead: leadFixture({
      id: "11111111-1111-1111-1111-111111111111",
      companyName: "Precision HVAC Services",
      createdAt: "2026-07-15T00:00:00.000Z",
      metadata: buildDefaultProductionLeadMetadata({ admission_state: "accepted" }),
    }),
    context,
  })
  assert.equal(productionLead.purpose, "production")
  assert.equal(productionLead.source, "canonical_persisted")
  console.log("  ✓ Production lead remains production via canonical missionPurpose")

  const certObjectiveRow = objectiveFixture({
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
      missionPurpose: "certification",
    },
  })
  const certObjective = resolveObjectiveMissionPurpose(certObjectiveRow)
  assert.equal(certObjective.purpose, "certification")
  assert.equal(
    inferObjectiveMissionPurposeForMigration(
      objectiveFixture({
        id: "obj-cert-legacy",
        title: "Revenue certification objective",
        executionContext: certObjectiveRow.executionContext
          ? { ...certObjectiveRow.executionContext, missionPurpose: undefined }
          : null,
      }),
    ).purpose,
    "certification",
  )
  console.log("  ✓ Certification objective excluded from production operations")

  const leads = [
    canonicalCertLead(
      leadFixture({ id: BLITZ_LEAD_ID, companyName: "Blitz Industries (Transport Fidelity Cert)" }),
      context,
    ),
    canonicalCertLead(
      leadFixture({ id: BLOCK_LEAD_ID, companyName: "Block Imaging", createdAt: "2026-06-15T00:00:00.000Z" }),
      context,
    ),
    leadFixture({
      id: "11111111-1111-1111-1111-111111111111",
      companyName: "Precision HVAC Services",
      createdAt: "2026-07-15T00:00:00.000Z",
      metadata: buildDefaultProductionLeadMetadata(),
    }),
  ]
  assert.equal(readCanonicalLeadMissionPurpose(leads[0]?.metadata), "certification")
  assert.equal(readCanonicalLeadMissionPurpose(leads[2]?.metadata), "production")

  const approvalSnapshot = {
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
  }

  const projection = buildProductionMissionPurposeProjection({
    organizationId: ORG,
    leads,
    objectives: [
      objectiveFixture({
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
      }),
      certObjectiveRow,
    ],
    context,
    approvalSnapshot,
  })

  assert.equal(projection.productionLeads.length, 1)
  assert.equal(projection.productionLeads[0]?.companyName, "Precision HVAC Services")
  assert.equal(projection.productionApproval?.pendingApprovalCount, 0)
  assert.equal(filterProductionOperatorApprovalSnapshot(approvalSnapshot, projection.purposeByLeadId)?.topPackage, null)
  console.log("  ✓ Production approval snapshot excludes Block certification package")

  const authority = buildProductionMissionAuthority({
    portfolioManager: {
      qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
      target: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        targetActiveCompanies: 25,
        minimumHealthyCompanies: 15,
        replenishBatchSize: 10,
        maximumDailyDiscovery: 50,
        maximumConcurrentResearch: 5,
        maximumQueuedAdmissions: 10,
        source: "defaults",
      },
      health: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        healthState: "needs_replenishment",
        needsCount: 12,
        discoveryRunning: true,
        researchRunning: true,
        admissionsPending: 2,
        counts: {
          activeCompanies: 3,
          researching: 2,
          awaitingAdmission: 2,
          awaitingReview: 0,
          qualified: 1,
          archived: 0,
          rejected: 0,
          invalid: 0,
          discoveryRemaining: 22,
        },
      },
      memory: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        lastReplenishmentAt: null,
        lastDiscoveryLaunchAt: null,
        consecutiveZeroYieldRuns: 0,
      },
      replenishment: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        shouldLaunchDiscovery: true,
        batchSize: 10,
        reason: "portfolio_below_target",
        cooldownRemainingMinutes: 0,
      },
      operator: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        targetActiveCompanies: 25,
        currentActiveCompanies: 3,
        minimumHealthyCompanies: 15,
        needsCount: 12,
        healthState: "needs_replenishment",
        healthLabel: "Portfolio needs more qualified companies.",
        discoveryRunning: true,
        discoveryRunningCount: 0,
        discoveryStatusDisplay: "Searching",
        nextBatchSize: 10,
        showEstimatedHealthy: false,
        researchRunning: true,
        researchRunningCount: 2,
        admissionsPending: 2,
        projectedCompletionLabel: null,
        manualFindOptions: [10, 25, 50, 100],
      },
      marketIntelligence: null,
    },
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "obj-prod",
      lifecycleState: "finding_leads",
      activityLabel: "Discovering companies",
      counters: {
        recordsImported: 4,
        newCompaniesFound: 43,
        researchingCount: 6,
        draftsPrepared: 0,
        pendingApprovals: 0,
      },
      searchSummary: "Equipment service ICP",
      audienceName: "Equipment service companies",
      recordsImported: 4,
      newCompaniesFound: 43,
      leadPoolVisible: 3,
      leadPoolHasMore: false,
      pipelineLow: true,
      lastEventSummary: "Overnight discovery batch imported",
      discoveryAction: "run_prospect_search",
      startupDiscoveryReady: true,
    },
  })

  assert.match(authority.objectiveStatement, /Maintain a healthy portfolio/)
  assert.equal(authority.objectiveStatement, GE_AIOS_LIVE_1A_PRODUCTION_MISSION_OBJECTIVE)
  assert.equal(authority.portfolioBelowTarget, true)
  assert.equal(authority.primaryFocus, "discovery")
  assert.ok(authority.operatorSummaryLines.some((line) => /43 new companies/i.test(line)))
  assert.ok(authority.operatorSummaryLines.some((line) => /below target/i.test(line)))
  assert.ok(!authority.operatorSummaryLines.some((line) => /Blitz|Block Imaging/i.test(line)))
  console.log("  ✓ Production mission authority drives portfolio-first discovery narrative")

  console.log(`[${PHASE}] PASS`)
}

void main()
