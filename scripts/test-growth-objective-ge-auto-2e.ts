/**
 * GE-AUTO-2E — Autonomous revenue operator execution certification.
 * Run: pnpm test:growth-objective-ge-auto-2e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  evaluateGrowthObjectiveStageCompletion,
  summarizeObjectiveExecutionContext,
  createEmptyObjectiveExecutionContext,
} from "../lib/growth/objectives/growth-objective-execution-context"
import { materializeGrowthObjectiveStage } from "../lib/growth/objectives/growth-objective-materialization-service"
import { createGrowthObjectiveWithPlan } from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { tickGrowthObjectiveRuntime } from "../lib/growth/objectives/growth-objective-runtime-service"
import {
  GROWTH_OBJECTIVE_EXECUTION_CONTEXT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_PHASE,
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

function createMockAdmin(): { schema: () => { from: (table: string) => MockQueryBuilder } } {
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

  return {
    schema: () => ({
      from: (table: string) => {
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
        return createMockQuery(() => ({ data: null, error: null }))
      },
    }),
  }
}

async function runTests(): Promise<void> {
  console.log("\n=== GE-AUTO-2E — Autonomous Revenue Operator Execution ===\n")

  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2F")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ 2E QA marker + phase")

  const migration = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EXECUTION_CONTEXT_SCHEMA_MIGRATION}`)
  assert.match(migration, /execution_context jsonb/)
  console.log("  ✓ Execution context migration")

  const materializationSource = readSource("lib/growth/objectives/growth-objective-materialization-service.ts")
  const executorSource = readSource("lib/growth/objectives/growth-objective-stage-executors.ts")
  const contextSource = readSource("lib/growth/objectives/growth-objective-execution-context.ts")
  const dashboardSource = readSource("components/growth/objectives/growth-objectives-dashboard.tsx")

  assert.match(materializationSource, /materializeGrowthObjectiveStage/)
  assert.match(materializationSource, /rebuildGrowthObjectiveExecutionContext/)
  assert.match(materializationSource, /createProspectSearchSavedSearch/)
  assert.match(materializationSource, /createGrowthAudience/)
  assert.match(materializationSource, /insertProspectResearchRun/)
  assert.match(materializationSource, /runEnrichmentProviders/)
  assert.match(executorSource, /materializeGrowthObjectiveStage/)
  assert.match(contextSource, /evaluateGrowthObjectiveStageCompletion/)
  assert.match(dashboardSource, /Execution health/)
  assert.match(dashboardSource, /rebuild_context/)
  console.log("  ✓ Materialization service + stage executors + dashboard wiring")

  const admin = createMockAdmin() as unknown as import("@supabase/supabase-js").SupabaseClient

  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos with medical equipment companies",
      description: "Objective-driven demo booking campaign.",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true, autoStart: true },
  )

  assert.ok(created.objective.runtime?.running)
  console.log("  ✓ Certification objective created and runtime started")

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

  const summary = summarizeObjectiveExecutionContext(objective.executionContext)
  assert.ok(summary.searchesCreated >= 1)
  assert.ok(summary.audiencesCreated >= 1)
  assert.ok(summary.pagesCreated >= 1 || summary.sequencesCreated >= 1)
  assert.ok(summary.launchesCreated >= 1)
  console.log("  ✓ Linear stages materialize searches, audiences, assets, and launch")

  objective = await tickGrowthObjectiveRuntime(admin, "org-1", objective.id, {
    certificationMode: true,
  })
  assert.ok(
    objective.runtime?.currentStageId === "monitor" ||
      objective.runtime?.currentStageId === "adapt" ||
      objective.runtime?.currentStageId === "book",
  )
  console.log("  ✓ Runtime advances through materialized pipeline into monitor/adapt loop")

  const discoverIncomplete = evaluateGrowthObjectiveStageCompletion("discover", {
    ...objective,
    executionContext: createEmptyObjectiveExecutionContext(),
  })
  assert.equal(discoverIncomplete.complete, false)
  console.log("  ✓ Stage completion rules enforce discover prerequisites")

  console.log("\nGE-AUTO-2E passed.\n")
}

void runTests()
