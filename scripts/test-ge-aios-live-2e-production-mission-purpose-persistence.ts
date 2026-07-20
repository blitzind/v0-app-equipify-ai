/**
 * GE-AIOS-LIVE-2E — Production mission purpose persistence certification (local).
 *
 * Run:
 *   pnpm test:ge-aios-live-2e-production-mission-purpose-persistence
 */
import assert from "node:assert/strict"
import {
  findActiveProductionBootstrapMission,
  isProductionAcquisitionObjective,
  isProductionBootstrapMissionReady,
} from "@/lib/growth/mission-purpose/growth-autonomous-production-mission-bootstrap-2a"
import {
  readCanonicalObjectiveMissionPurpose,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-canonical-1b"
import {
  inferObjectiveMissionPurposeForMigration,
} from "@/lib/growth/mission-purpose/growth-mission-purpose-1a"
import { GROWTH_MISSION_PURPOSE_1B_QA_MARKER } from "@/lib/growth/mission-purpose/growth-mission-purpose-1a-types"
import { mergeCanonicalLeadMissionPurposeMetadata } from "@/lib/growth/mission-purpose/growth-mission-purpose-migration-1b"
import { LIVE_1B_EQUIPIFY_MISSION_TITLE } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
  type GrowthObjective,
} from "@/lib/growth/objectives/growth-objective-types"
import { normalizeObjectiveExecutionContext } from "@/lib/growth/objectives/growth-objective-execution-context"

const PHASE = "GE-AIOS-LIVE-2E" as const
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
      currentStageId: "monitor",
      stageStates: {},
    } as GrowthObjective["runtime"]),
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
  console.log(`[${PHASE}] Production mission purpose persistence certification`)

  const rawDbContext = {
    qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
    version: 1,
    stages: {},
    recoveredAt: "2026-07-20T19:00:26.665452+00:00",
    missionPurpose: "production",
    missionRuntime: {
      lifecycleState: "finding_leads",
      activityLabel: "Finding leads",
      counters: { discovered: 0, enriched: 0, launched: 0 },
    },
  }

  const normalized = normalizeObjectiveExecutionContext(rawDbContext)
  assert.equal(readCanonicalObjectiveMissionPurpose(normalized), "production")
  console.log("  ✓ Repository normalization preserves executionContext.missionPurpose")

  const legacyProductionBootstrap = objectiveFixture({
    id: "legacy-production-bootstrap",
    title: LIVE_1B_EQUIPIFY_MISSION_TITLE,
    executionContext: {
      qa_marker: GROWTH_OBJECTIVE_EXECUTION_CONTEXT_QA_MARKER,
      version: 1,
      stages: {},
      recoveredAt: "2026-07-20T19:00:26.665452+00:00",
      missionRuntime: {
        lifecycleState: "finding_leads",
        activityLabel: "Finding leads",
        counters: { discovered: 0, enriched: 0, launched: 0 },
      },
    },
  })

  const inferred = inferObjectiveMissionPurposeForMigration(legacyProductionBootstrap)
  assert.equal(inferred.purpose, "production")
  assert.notEqual(inferred.source, "canonical_persisted")
  console.log("  ✓ LIVE-1B migration authority classifies legacy production bootstrap objective once")

  const certObjective = objectiveFixture({
    id: "cert-objective",
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
  assert.equal(inferObjectiveMissionPurposeForMigration(certObjective).purpose, "certification")
  console.log("  ✓ Certification objectives remain certification during migration inference")

  const migratedProduction = objectiveFixture({
    ...legacyProductionBootstrap,
    executionContext: {
      ...legacyProductionBootstrap.executionContext!,
      missionPurpose: "production",
    },
  })
  const objectives = [migratedProduction, certObjective]
  const activeBootstrap = findActiveProductionBootstrapMission(objectives)
  assert.equal(activeBootstrap?.id, migratedProduction.id)
  assert.equal(readCanonicalObjectiveMissionPurpose(activeBootstrap?.executionContext), "production")
  assert.equal(isProductionBootstrapMissionReady(activeBootstrap!), true)
  console.log("  ✓ Active production bootstrap mission reads canonical missionPurpose=production")

  const activeProduction = objectives.filter(
    (row) =>
      isProductionAcquisitionObjective(row) &&
      row.status === "active" &&
      row.runtime?.running &&
      !row.emergencyStopActive,
  )
  assert.equal(activeProduction.length, 1)
  console.log("  ✓ No duplicate active production bootstrap missions in fixture scope")

  const idempotentMetadata = mergeCanonicalLeadMissionPurposeMetadata({
    metadata: { mission_purpose: "production" },
    purpose: "certification",
    generatedAt: "2026-07-21T00:00:00.000Z",
  })
  assert.equal(idempotentMetadata.mission_purpose, "production")
  assert.equal(GROWTH_MISSION_PURPOSE_1B_QA_MARKER.length > 0, true)
  console.log("  ✓ Migration authority remains idempotent once canonical purpose is persisted")

  console.log(`[${PHASE}] PASS`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
