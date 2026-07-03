/**
 * GE-AIOS-4A — Lead Research Pilot certification.
 * Run: pnpm test:ge-aios-4a-lead-research-pilot-foundation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  LEAD_RESEARCH_PILOT_RUNTIME_RULE,
  LEAD_RESEARCH_PILOT_STEPS,
  GROWTH_AIOS_4A_PHASE,
  GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER,
} from "../lib/growth/aios/pilot/lead-research-pilot-types"
import {
  GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG,
  isLeadResearchPilotEnabled,
  resolveLeadResearchPilotConfig,
} from "../lib/growth/aios/pilot/lead-research-pilot-config"
import { lookupAiEventRegistryEntry } from "../lib/growth/aios/ai-event-registry"
import { ensureLeadResearchPilotMission } from "../lib/growth/aios/pilot/lead-research-pilot-mission-service"
import { LEAD_RESEARCH_PILOT_MISSION_TITLE } from "../lib/growth/aios/pilot/lead-research-pilot-types"
import {
  insertGrowthObjective,
  normalizeGrowthObjectiveExecutionPlan,
  resetGrowthObjectiveMemoryStore,
} from "../lib/growth/objectives/growth-objective-repository"
import { planGrowthObjective } from "../lib/growth/objectives/growth-objective-planner"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function assertNoCoreTouch(relativePath: string): void {
  const source = readSource(relativePath)
  for (const token of ["public.invoices", "public.quotes", "blitzpay", "public.work_orders"]) {
    assert.equal(source.includes(token), false, `${relativePath} must not reference ${token}`)
  }
}

type CapturedObjectiveInsert = Record<string, unknown>

function createMissingTableAdmin() {
  const missingError = { message: 'relation "growth.organization_growth_objectives" does not exist' }
  type MockQueryBuilder = {
    select: (...args: unknown[]) => MockQueryBuilder
    eq: (...args: unknown[]) => MockQueryBuilder
    neq: (...args: unknown[]) => MockQueryBuilder
    order: (...args: unknown[]) => MockQueryBuilder
    insert: (...args: unknown[]) => MockQueryBuilder
    update: (...args: unknown[]) => MockQueryBuilder
    maybeSingle: () => Promise<{ data: unknown; error: null | { message: string } }>
    single: () => Promise<{ data: unknown; error: null | { message: string } }>
    then: Promise<{ data: unknown; error: null | { message: string } }>["then"]
    limit: () => Promise<{ data: unknown; error: null | { message: string } }>
  }
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (...args) => Promise.resolve({ data: null, error: missingError }).then(...args),
    limit: async () => ({ data: null, error: missingError }),
  }
  return { schema: () => ({ from: () => builder }) }
}

function createObjectiveInsertCaptureAdmin(captured: { insert: CapturedObjectiveInsert | null }) {
  const rowFromInsert = (payload: CapturedObjectiveInsert) => ({
    ...payload,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  type MockQueryBuilder = {
    select: (...args: unknown[]) => MockQueryBuilder
    eq: (...args: unknown[]) => MockQueryBuilder
    neq: (...args: unknown[]) => MockQueryBuilder
    order: (...args: unknown[]) => MockQueryBuilder
    insert: (payload: CapturedObjectiveInsert) => MockQueryBuilder
    update: (payload: CapturedObjectiveInsert) => MockQueryBuilder
    maybeSingle: () => Promise<{ data: unknown; error: null }>
    single: () => Promise<{ data: unknown; error: null }>
    then: Promise<{ data: unknown; error: null }>["then"]
    limit: () => Promise<{ data: unknown; error: null }>
  }

  let lastInsert: CapturedObjectiveInsert | null = null
  let storedRows: Record<string, unknown>[] = []

  const builder = (): MockQueryBuilder => {
    const query: MockQueryBuilder = {
      select: () => query,
      eq: () => query,
      neq: () => query,
      order: () => query,
      insert: (payload) => {
        lastInsert = payload
        captured.insert = payload
        storedRows = [rowFromInsert(payload)]
        return query
      },
      update: (payload) => {
        if (storedRows[0]) storedRows[0] = { ...storedRows[0], ...payload }
        return query
      },
      maybeSingle: async () => ({ data: storedRows[0] ?? null, error: null }),
      single: async () => ({ data: storedRows[0] ?? rowFromInsert(lastInsert ?? {}), error: null }),
      then: (...args) =>
        Promise.resolve({ data: storedRows, error: null }).then(...args),
      limit: async () => ({ data: storedRows, error: null }),
    }
    return query
  }

  return {
    schema: () => ({
      from: (table: string) => {
        if (table !== "organization_growth_objectives") {
          throw new Error(`unexpected table ${table}`)
        }
        return builder()
      },
    }),
  }
}

async function runObjectivePlanRegressionTests(): Promise<void> {
  resetGrowthObjectiveMemoryStore()
  const memoryAdmin = createMissingTableAdmin() as never

  const memoryObjective = await insertGrowthObjective(memoryAdmin, "org-cert-7", {
    title: LEAD_RESEARCH_PILOT_MISSION_TITLE,
    objectiveType: "custom",
    targetValue: 1000,
  })
  assert.ok(memoryObjective.plan, "insertGrowthObjective must derive a non-null plan")
  assert.ok(
    normalizeGrowthObjectiveExecutionPlan(memoryObjective.plan),
    "derived plan must satisfy execution plan schema",
  )

  const captured: { insert: CapturedObjectiveInsert | null } = { insert: null }
  const admin = createObjectiveInsertCaptureAdmin(captured) as never
  await insertGrowthObjective(admin, "org-cert-7", {
    title: "Direct insert regression",
    objectiveType: "custom",
    targetValue: 25,
  })
  assert.ok(captured.insert, "DB insert path must capture payload")
  assert.notEqual(captured.insert.plan, null, "DB insert payload must not set plan=null")
  assert.ok(
    normalizeGrowthObjectiveExecutionPlan(captured.insert.plan),
    "DB insert plan must satisfy execution plan schema",
  )

  resetGrowthObjectiveMemoryStore()
  const mission = await ensureLeadResearchPilotMission(memoryAdmin, "org-cert-7")
  assert.equal(mission.title, LEAD_RESEARCH_PILOT_MISSION_TITLE)
  assert.ok(mission.plan, "lead research pilot mission must persist a derived plan")
  assert.ok(
    normalizeGrowthObjectiveExecutionPlan(mission.plan),
    "lead research pilot mission plan must satisfy execution plan schema",
  )

  const datamoonMissionPlan = planGrowthObjective({
    ...mission,
    title: LEAD_RESEARCH_PILOT_MISSION_TITLE,
    description: "GE-AIOS-4A autonomous lead research pilot mission container.",
  })
  assert.ok(datamoonMissionPlan.stages.length > 0, "datamoon research planning can derive stages from mission plan")

  const missionService = readSource("lib/growth/aios/pilot/lead-research-pilot-mission-service.ts")
  assert.ok(missionService.includes("insertGrowthObjective"))
  const repository = readSource("lib/growth/objectives/growth-objective-repository.ts")
  assert.ok(repository.includes("resolveObjectivePlanForPersistence"))
  assert.ok(repository.includes("planGrowthObjective"))
}

async function main(): Promise<void> {
  console.log(`[${GROWTH_AIOS_4A_PHASE}] Lead Research Pilot certification`)

assert.equal(GROWTH_AI_OS_LEAD_RESEARCH_PILOT_QA_MARKER, "growth-aios-4a-lead-research-pilot-v1")
assert.equal(LEAD_RESEARCH_PILOT_STEPS.length, 10)
assert.ok(LEAD_RESEARCH_PILOT_RUNTIME_RULE.includes("feature flag"))

assert.equal(isLeadResearchPilotEnabled({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "true" }), true)
assert.equal(isLeadResearchPilotEnabled({ [GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]: "false" }), false)
assert.equal(resolveLeadResearchPilotConfig({}).enableAiEvidence, false)

const pilotFiles = [
  "lib/growth/aios/pilot/lead-research-pilot-types.ts",
  "lib/growth/aios/pilot/lead-research-pilot-config.ts",
  "lib/growth/aios/pilot/lead-research-pilot-mission-service.ts",
  "lib/growth/aios/pilot/lead-research-pilot-observability.ts",
  "lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts",
  "lib/growth/aios/pilot/lead-research-agent-executor.ts",
  "app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts",
  "components/growth/ai-os/growth-ai-os-lead-research-pilot-panel.tsx",
]

for (const file of pilotFiles) {
  assertNoCoreTouch(file)
}

const orchestrator = readSource("lib/growth/aios/pilot/lead-research-pilot-orchestrator.ts")
assert.ok(orchestrator.includes("runExecutiveMissionPlanningTick"))
assert.ok(orchestrator.includes('mode: "create"'))
assert.ok(orchestrator.includes("prepareDecision: true"))
assert.ok(orchestrator.includes("isLeadResearchPilotEnabled"))
assert.ok(orchestrator.includes("executeResearchCompanyWorkOrderViaAiOs"))
for (const forbidden of ["runGrowthLeadResearch", "runAiTask", "runProspectResearch", "enroll_sequence"]) {
  assert.equal(orchestrator.includes(forbidden), false, `orchestrator must not reference ${forbidden}`)
}

const executor = readSource("lib/growth/aios/pilot/lead-research-agent-executor.ts")
assert.ok(executor.includes("claimAiOsWorkOrder"))
assert.ok(executor.includes("assembleAiContextForWorkOrder"))
assert.ok(executor.includes("invokeAiOsProviderWithContextPackage"))
assert.ok(executor.includes("applyGrowthLeadResearchEnrichment"))
assert.ok(executor.includes('toStatus: "completed"'))
for (const forbidden of ["runGrowthLeadResearch", "runAiTask", "invokeCoreProviderAdapter"]) {
  assert.equal(executor.includes(forbidden), false, `executor must not reference ${forbidden}`)
}

const leadRepo = readSource("lib/growth/lead-repository.ts")
assert.ok(leadRepo.includes("scheduleLeadResearchPilotForProspect"))

const pilotApi = readSource("app/api/platform/growth/ai-os/pilot/lead-research/[leadId]/route.ts")
assert.equal(pilotApi.includes("startLeadResearchPilotForProspect"), false)
assert.ok(pilotApi.includes("fetchLeadResearchPilotObservation"))

  assert.ok(lookupAiEventRegistryEntry("pilot.lead_research_started"))
  assert.ok(lookupAiEventRegistryEntry("pilot.lead_research_completed"))
  assert.ok(lookupAiEventRegistryEntry("growth.prospect_created"))

  await runObjectivePlanRegressionTests()
  console.log("  ✓ GE-AIOS-RESEARCH-OBJECTIVE-PLAN-FIX-1 regression — objective plan persisted on insert")

  console.log(`[${GROWTH_AIOS_4A_PHASE}] PASS — Lead Research Pilot certified (local)`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
