/**
 * GE-AIOS-LIVE-2A — Autonomous production mission bootstrap certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-2a-autonomous-production-mission-bootstrap
 */
import assert from "node:assert/strict"
import {
  evaluateProductionMissionBootstrapRequirement,
  findActiveProductionBootstrapMission,
  isProductionBootstrapMissionReady,
  isProductionAcquisitionObjective,
  selectCanonicalProductionBootstrapObjective,
  GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER,
  GE_AIOS_LIVE_2A_PRODUCTION_MISSION_OBJECTIVE,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import { buildProductionMissionAuthority } from "@/lib/growth/mission-purpose/growth-production-mission-authority-1a"
import { GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER } from "@/lib/growth/mission-center/growth-mission-runtime-types"
import { GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import { LIVE_1B_EQUIPIFY_MISSION_TITLE } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const PHASE = "GE-AIOS-LIVE-2A" as const
const ORG = "00757488-1026-44a5-aac4-269533ac21be"

function objectiveFixture(input: Partial<GrowthObjective> & Pick<GrowthObjective, "id" | "title">): GrowthObjective {
  return {
    id: input.id,
    organizationId: ORG,
    title: input.title,
    description: input.description ?? null,
    objectiveType: input.objectiveType ?? "customers_acquired",
    targetValue: input.targetValue ?? 25,
    currentValue: input.currentValue ?? 0,
    startDate: input.startDate ?? "2026-07-01T00:00:00.000Z",
    targetDate: input.targetDate ?? null,
    status: input.status ?? "active",
    ownerUserId: input.ownerUserId ?? "22222222-2222-2222-2222-222222222222",
    priority: input.priority ?? "high",
    autonomyLevel: input.autonomyLevel ?? "objective",
    safetyMode: input.safetyMode ?? "strict",
    plan: input.plan ?? null,
    runtime: input.runtime ?? ({
      running: true,
      currentStageId: "discover",
      stageStates: {},
    } as GrowthObjective["runtime"]),
    executionHistory: input.executionHistory ?? [],
    recentSignals: input.recentSignals ?? [],
    recommendations: input.recommendations ?? [],
    eventSubscriptions: input.eventSubscriptions ?? null,
    executionContext: input.executionContext ?? {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {},
      recoveredAt: null,
      missionRuntime: null,
      missionPurpose: "production",
    },
    emergencyStopActive: false,
    qa_marker: "growth-objective-ge-auto-2g-v1",
    createdAt: input.createdAt ?? "2026-07-10T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-07-10T00:00:00.000Z",
  }
}

async function main(): Promise<void> {
  console.log(`[${PHASE}] Autonomous production mission bootstrap certification`)
  assert.equal(
    GE_AIOS_LIVE_2A_PRODUCTION_MISSION_OBJECTIVE.includes("Maintain a healthy portfolio"),
    true,
  )

  const productionObjective = objectiveFixture({
    id: "obj-production",
    title: LIVE_1B_EQUIPIFY_MISSION_TITLE,
    executionContext: {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {},
      recoveredAt: null,
      missionPurpose: "production",
      missionRuntime: {
        qa_marker: GROWTH_AVA_MISSION_RUNTIME_1A_QA_MARKER,
        approved: true,
        approvedAt: "2026-07-20T00:00:00.000Z",
        lifecycleState: "finding_leads",
        activityLabel: "Discovering companies",
        lastOrchestrationAt: null,
        counters: {
          newCompaniesFound: 0,
          recordsImported: 0,
          researchingCount: 0,
          draftsPrepared: 0,
          pendingApprovals: 0,
        },
        audience: null,
        datamoon: {
          lastRunId: null,
          importRequestJson: '{"name":"Equipify production discovery"}',
          lastPollAt: null,
          lastImportedCount: 0,
          provider: "datamoon_audience",
          source: "find_leads",
          searchSummary: "Equipment service ICP",
          audienceName: "Equipment service companies",
        },
        events: [],
      },
    },
  })

  const certificationObjective = objectiveFixture({
    id: "obj-cert",
    title: "Revenue certification objective",
    executionContext: {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {},
      recoveredAt: null,
      missionPurpose: "certification",
      missionRuntime: null,
    },
  })

  assert.equal(isProductionAcquisitionObjective(productionObjective), true)
  assert.equal(isProductionAcquisitionObjective(certificationObjective), false)
  console.log("  ✓ Certification objectives are excluded from production bootstrap selection")

  assert.equal(
    selectCanonicalProductionBootstrapObjective(
      [certificationObjective, productionObjective],
      LIVE_1B_EQUIPIFY_MISSION_TITLE,
    )?.id,
    "obj-production",
  )
  console.log("  ✓ Canonical production bootstrap objective prefers LIVE-1B mission title")

  const required = evaluateProductionMissionBootstrapRequirement({
    approvedProfilePresent: true,
    portfolioHealth: {
      needsCount: 12,
      approvedProfilePresent: true,
      healthState: "needs_replenishment",
    } as never,
    autonomyEnabled: true,
    objectiveModeEnabled: true,
    activeProductionMission: null,
    bootstrapMissionReady: false,
  })
  assert.equal(required.required, true)
  assert.equal(required.portfolioDeficit, 12)
  console.log("  ✓ Bootstrap required when portfolio is below target and no active mission exists")

  const skipped = evaluateProductionMissionBootstrapRequirement({
    approvedProfilePresent: true,
    portfolioHealth: {
      needsCount: 12,
      approvedProfilePresent: true,
      healthState: "needs_replenishment",
    } as never,
    autonomyEnabled: true,
    objectiveModeEnabled: true,
    activeProductionMission: productionObjective,
    bootstrapMissionReady: true,
  })
  assert.equal(skipped.required, false)
  assert.equal(skipped.reason, "production_mission_ready")
  console.log("  ✓ Bootstrap skipped when production mission is already orchestration-ready")

  assert.equal(isProductionBootstrapMissionReady(productionObjective), true)
  assert.equal(findActiveProductionBootstrapMission([productionObjective])?.id, "obj-production")
  console.log("  ✓ Active production bootstrap mission detected without certification bleed")

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
        discoveryRunning: false,
        researchRunning: false,
        admissionsPending: 0,
        counts: {
          activeCompanies: 3,
          researching: 0,
          awaitingAdmission: 0,
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
        shouldReplenish: true,
        shouldResumeActiveDiscovery: false,
        batchSize: 10,
        resumeBatchSize: 0,
        reason: "portfolio_below_target",
        blockedByDailyLimit: false,
        blockedByQueueLimit: false,
        blockedByResearchLimit: false,
        duplicateDiscoveryPrevented: false,
      },
      operator: {
        qaMarker: "growth-autonomous-portfolio-manager-1a-v1",
        targetActiveCompanies: 25,
        currentActiveCompanies: 3,
        minimumHealthyCompanies: 15,
        needsCount: 12,
        healthState: "needs_replenishment",
        healthLabel: "Portfolio needs more qualified companies.",
        discoveryRunning: false,
        discoveryRunningCount: 0,
        discoveryStatusDisplay: "Searching",
        nextBatchSize: 10,
        showEstimatedHealthy: false,
        researchRunning: false,
        researchRunningCount: 0,
        admissionsPending: 0,
        projectedCompletionLabel: null,
        manualFindOptions: [10, 25, 50, 100],
      },
      marketIntelligence: null,
    },
    missionDiscovery: {
      qaMarker: "ge-aios-18g-mission-discovery-snapshot-v1",
      missionId: "obj-production",
      lifecycleState: "finding_leads",
      activityLabel: "Discovering companies",
      counters: {
        recordsImported: 0,
        newCompaniesFound: 0,
        researchingCount: 0,
        draftsPrepared: 0,
        pendingApprovals: 0,
      },
      searchSummary: "Equipment service ICP",
      audienceName: "Equipment service companies",
      recordsImported: 0,
      newCompaniesFound: 0,
      leadPoolVisible: 3,
      leadPoolHasMore: false,
      pipelineLow: true,
      lastEventSummary: null,
      discoveryAction: "run_prospect_search",
      startupDiscoveryReady: true,
    },
  })

  assert.equal(authority.discoveryActive, true)
  assert.equal(authority.portfolioBelowTarget, true)
  assert.equal(authority.primaryFocus, "discovery")
  console.log("  ✓ Production mission authority treats replenishment as active discovery")

  assert.equal(GROWTH_AUTONOMOUS_PRODUCTION_MISSION_BOOTSTRAP_2A_QA_MARKER.includes("live-2a"), true)
  console.log("  ✓ LIVE-2A QA marker present")

  console.log(`[${PHASE}] PASS`)
}

void main()
