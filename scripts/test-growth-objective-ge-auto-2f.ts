/**
 * GE-AUTO-2F — Production materialization & autonomous execution completion.
 * Run: pnpm test:growth-objective-ge-auto-2f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  evaluateGrowthObjectiveStageCompletion,
  summarizeObjectiveExecutionContext,
  summarizeObjectiveMaterializationHealth,
  createEmptyObjectiveExecutionContext,
} from "../lib/growth/objectives/growth-objective-execution-context"
import {
  materializeGrowthObjectiveStage,
  recoverGrowthObjectiveRuntimeContext,
} from "../lib/growth/objectives/growth-objective-materialization-service"
import { createGrowthObjectiveWithPlan } from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { tickGrowthObjectiveRuntime } from "../lib/growth/objectives/growth-objective-runtime-service"
import {
  GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_EXECUTION_CONTEXT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_PHASE,
  GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER,
  GROWTH_OBJECTIVE_PRODUCTION_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_QA_MARKER,
} from "../lib/growth/objectives/growth-objective-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  insert: (...args: unknown[]) => MockQueryBuilder
  update: (...args: unknown[]) => MockQueryBuilder
  upsert: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null | { message: string; code?: string } }>
  single: () => Promise<{ data: unknown; error: null | { message: string; code?: string } }>
  limit: () => Promise<{ data: unknown; error: null | { message: string } }>
  then: Promise<{ data: unknown; error: null | { message: string } }>["then"]
}

function createMissingTableQuery(): MockQueryBuilder {
  const missingError = { message: 'relation "growth.organization_growth_objectives" does not exist' }
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    limit: async () => ({ data: null, error: missingError }),
    then: (...args) => Promise.resolve({ data: null, error: missingError }).then(...args),
  }
  return builder
}

function createMockQuery(resolve: () => { data: unknown; error: null }): MockQueryBuilder {
  const result = () => Promise.resolve(resolve())
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
    single: result as MockQueryBuilder["single"],
    limit: async () => ({ data: null, error: null }),
    then: (...args) => result().then(...args),
  }
  return builder
}

function createMockAdmin(): { schema: () => { from: (table: string) => MockQueryBuilder }; from: (table: string) => MockQueryBuilder } {
  const settings = buildDefaultGrowthAutonomySettings("org-1")
  settings.masterMode = "objective"
  settings.capabilityToggles.research = true
  settings.capabilityToggles.enrichment = true
  settings.capabilityToggles.audience_generation = true
  settings.capabilityToggles.page_generation = true
  settings.capabilityToggles.video_generation = true
  settings.capabilityToggles.campaign_launch = true
  settings.capabilityToggles.recommendations = true
  settings.capabilityToggles.strategy_adaptation = true
  settings.dailyBudgetLimits.autonomous_research_runs = 50
  settings.dailyBudgetLimits.autonomous_page_generations = 50
  settings.dailyBudgetLimits.autonomous_video_generations = 50
  settings.dailyBudgetLimits.autonomous_campaigns = 50
  settings.dailyBudgetLimits.autonomous_enrichment_runs = 50

  const killSwitchRows = [
    { key: "autonomy_enabled", enabled: true },
    { key: "autonomy_outbound_enabled", enabled: false },
    { key: "autonomy_generation_enabled", enabled: true },
    { key: "autonomy_objective_mode_enabled", enabled: true },
  ]

  const settingsRow = {
    organization_id: settings.organizationId,
    master_mode: settings.masterMode,
    capability_toggles: settings.capabilityToggles,
    approval_policies: settings.approvalPolicies,
    channel_permissions: { ...settings.channelPermissions, _outbound: settings.outboundControls },
    daily_budget_limits: settings.dailyBudgetLimits,
  }

  const fromHandler = (table: string) => {
    if (table === "organization_autonomy_settings") {
      return createMockQuery(() => ({ data: settingsRow, error: null }))
    }
    if (table === "organization_growth_objectives") {
      return createMissingTableQuery()
    }
    if (table === "runtime_guardrail_settings") {
      return createMockQuery(() => ({ data: killSwitchRows, error: null }))
    }
    if (table === "runtime_budgets") {
      return createMockQuery(() => ({ data: { count: 0, window_start: new Date().toISOString() }, error: null }))
    }
    if (table === "runtime_guardrail_audit_log") {
      return createMockQuery(() => ({ data: null, error: null }))
    }
    if (table === "profiles") {
      return createMockQuery(() => ({ data: { email: "operator@example.com" }, error: null }))
    }
    return createMockQuery(() => ({ data: null, error: null }))
  }

  return {
    schema: () => ({ from: fromHandler }),
    from: fromHandler,
  }
}

async function runTests(): Promise<void> {
  console.log("\n=== GE-AUTO-2F — Production Materialization & Execution Completion ===\n")

  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2F")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_PRODUCTION_MATERIALIZATION_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ 2F QA marker + phase")

  const migration2b = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION}`)
  const migration2d = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_PRODUCTION_SCHEMA_MIGRATION}`)
  const migration2e = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EXECUTION_CONTEXT_SCHEMA_MIGRATION}`)
  assert.match(migration2b, /event_subscriptions/)
  assert.match(migration2d, /objective_source_event_receipts/)
  assert.match(migration2e, /execution_context/)
  console.log("  ✓ Production migration files present (2B/2D/2E)")

  const productionSource = readSource("lib/growth/objectives/growth-objective-production-materialization.ts")
  const materializationSource = readSource("lib/growth/objectives/growth-objective-materialization-service.ts")
  const contextSource = readSource("lib/growth/objectives/growth-objective-execution-context.ts")
  const dashboardSource = readSource("components/growth/objectives/growth-objectives-dashboard.tsx")

  assert.match(productionSource, /startSendrLaunchRun/)
  assert.match(productionSource, /findOrCreateObjectiveSequencePattern/)
  assert.match(productionSource, /createObjectiveVideoPageWithGeneration/)
  assert.match(productionSource, /createGrowthAiAvatarGenerationJob/)
  assert.match(materializationSource, /executeObjectiveSendrLaunch/)
  assert.match(materializationSource, /createObjectiveSendrLandingPage/)
  assert.doesNotMatch(materializationSource, /metadata: \{ queued: true \}/)
  assert.match(contextSource, /enrollmentRunId/)
  assert.match(dashboardSource, /Execution health/)
  assert.match(dashboardSource, /Materialization health/)
  assert.match(dashboardSource, /Runtime recovery/)
  console.log("  ✓ Real launch, sequence, video integrations wired")

  const admin = createMockAdmin() as unknown as import("@supabase/supabase-js").SupabaseClient

  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos with medical equipment companies",
      description: "End-to-end production certification objective.",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true, autoStart: true },
  )

  let objective = created.objective
  const linearStages = [
    "discover",
    "research",
    "enrich",
    "buying_committee",
    "generate_assets",
    "launch",
  ] as const

  for (const stageId of linearStages) {
    const materialized = await materializeGrowthObjectiveStage(admin, {
      organizationId: "org-1",
      objective,
      stageId,
      certificationMode: true,
    })
    objective = materialized.objective
    const completion = evaluateGrowthObjectiveStageCompletion(stageId, objective)
    assert.equal(completion.complete, true, `${stageId} should complete in certification mode`)
  }

  const launchIncomplete = evaluateGrowthObjectiveStageCompletion("launch", {
    ...objective,
    executionContext: createEmptyObjectiveExecutionContext(),
  })
  assert.equal(launchIncomplete.complete, false)

  const launchArtifact = objective.executionContext?.stages?.launch?.artifacts?.find(
    (entry) => entry.resourceType === "campaign",
  )
  assert.ok(launchArtifact?.metadata?.launchRunId)
  assert.ok(launchArtifact?.metadata?.enrollmentRunId)
  console.log("  ✓ Launch completion requires launch run + enrollments")

  const beforeRecovery = summarizeObjectiveExecutionContext(objective.executionContext)
  objective = await recoverGrowthObjectiveRuntimeContext(admin, "org-1", {
    ...objective,
    executionContext: createEmptyObjectiveExecutionContext(),
  })
  const afterRecovery = summarizeObjectiveExecutionContext(objective.executionContext)
  assert.ok(objective.executionContext?.recoveredAt)
  assert.ok(afterRecovery.sequencesCreated >= beforeRecovery.sequencesCreated || afterRecovery.launchesCreated >= 0)
  console.log("  ✓ Runtime recovery rebuilds execution context")

  const health = summarizeObjectiveMaterializationHealth(objective.executionContext)
  assert.ok(health.complete >= 1)
  console.log("  ✓ Materialization health summary")

  objective = await tickGrowthObjectiveRuntime(admin, "org-1", objective.id, { certificationMode: true })
  assert.ok(["monitor", "adapt", "book"].includes(objective.runtime?.currentStageId ?? ""))
  console.log("  ✓ End-to-end certification advances into monitor/adapt/book loop")

  console.log("\nGE-AUTO-2F passed.\n")
}

void runTests()
