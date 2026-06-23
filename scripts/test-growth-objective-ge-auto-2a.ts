/**
 * GE-AUTO-2A — Closed-loop objective execution certification.
 * Run: pnpm test:growth-objective-ge-auto-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  canTransitionObjectiveRuntimeStage,
  computeObjectiveDashboardProgress,
} from "../lib/growth/objectives/growth-objective-stage-state-machine"
import { computeObjectiveProgressDelta } from "../lib/growth/objectives/growth-objective-signal-handler"
import {
  createGrowthObjectiveWithPlan,
  ingestGrowthObjectiveSignal,
} from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { tickGrowthObjectiveRuntime } from "../lib/growth/objectives/growth-objective-runtime-service"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
  GROWTH_OBJECTIVE_RUNTIME_SCHEMA_MIGRATION,
} from "../lib/growth/objectives/growth-objective-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  neq: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  order: (...args: unknown[]) => MockQueryBuilder
  insert: (...args: unknown[]) => MockQueryBuilder
  update: (...args: unknown[]) => MockQueryBuilder
  upsert: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null | { message: string } }>
  single: () => Promise<{ data: unknown; error: null | { message: string } }>
  then: Promise<{ data: unknown; error: null | { message: string } }>["then"]
  limit: () => Promise<{ data: unknown; error: null | { message: string } }>
}

function createMissingTableQuery(): MockQueryBuilder {
  const missingError = { message: 'relation "growth.organization_growth_objectives" does not exist' }
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({ data: null, error: null }),
    then: (...args) => Promise.resolve({ data: null, error: missingError }).then(...args),
    limit: async () => ({ data: null, error: missingError }),
  }
  return builder
}

function createMockQuery(resolve: () => { data: unknown; error: null }): MockQueryBuilder {
  const result = () => Promise.resolve(resolve())
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    in: () => builder,
    order: () => builder,
    insert: () => builder,
    update: () => builder,
    upsert: () => builder,
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
    single: result as MockQueryBuilder["single"],
    then: (...args) => result().then(...args),
    limit: async () => ({ data: null, error: null }),
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

async function main() {
  console.log("\nGE-AUTO-2A certification\n")
  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_RUNTIME_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ QA markers")

  const migration = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_RUNTIME_SCHEMA_MIGRATION}`)
  assert.match(migration, /runtime_state/)
  assert.match(migration, /execution_history/)
  console.log("  ✓ Runtime migration schema")

  const runtimeSource = readSource("lib/growth/objectives/growth-objective-runtime-service.ts")
  assert.match(runtimeSource, /GrowthObjectiveRuntimeService/)
  assert.match(runtimeSource, /tickGrowthObjectiveRuntime/)
  assert.match(runtimeSource, /ingestGrowthObjectiveSignal/)
  console.log("  ✓ Runtime service")

  const executors = readSource("lib/growth/objectives/growth-objective-stage-executors.ts")
  assert.match(executors, /enforceGrowthAutonomyCapability/)
  assert.match(executors, /materializeGrowthObjectiveStage/)
  const materialization = readSource("lib/growth/objectives/growth-objective-materialization-service.ts")
  assert.match(materialization, /runProspectSearch/)
  const production = readSource("lib/growth/objectives/growth-objective-production-materialization.ts")
  assert.match(production, /startSendrLaunchRun/)
  console.log("  ✓ Stage executors wired to existing services + policy")

  assert.equal(canTransitionObjectiveRuntimeStage("pending", "running"), true)
  assert.equal(canTransitionObjectiveRuntimeStage("running", "blocked"), true)
  assert.equal(canTransitionObjectiveRuntimeStage("blocked", "running"), true)
  assert.equal(canTransitionObjectiveRuntimeStage("completed", "running"), false)
  console.log("  ✓ Stage state machine transitions")

  assert.equal(computeObjectiveProgressDelta("demos_booked", { type: "booking_completed" }), 1)
  assert.equal(computeObjectiveProgressDelta("demos_booked", { type: "engagement_open" }), 0)
  console.log("  ✓ Automatic progress delta from signals")

  const admin = createMockAdmin() as never
  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos with medical equipment companies",
      description: "Closed-loop cert scenario",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true },
  )

  assert.ok(created.objective.plan)
  assert.ok(created.objective.runtime?.running)
  assert.ok(created.objective.executionHistory.length >= 1)
  console.log("  ✓ Create + auto-start runtime with execution history")

  let objective = created.objective
  for (let i = 0; i < 5 && objective.runtime?.currentStageId !== "book"; i += 1) {
    objective = await tickGrowthObjectiveRuntime(admin, "org-1", objective.id, { certificationMode: true })
  }
  assert.ok(objective.executionHistory.some((entry) => entry.policyGated))
  console.log("  ✓ Runtime ticks advance stages with policy-gated audit")

  for (let i = 0; i < 20; i += 1) {
    objective = await ingestGrowthObjectiveSignal(admin, "org-1", objective.id, {
      type: "booking_completed",
    }, { certificationMode: true })
  }
  assert.equal(objective.currentValue, 20)
  assert.ok(objective.recentSignals.length >= 20)
  console.log("  ✓ Signal wiring updates progress automatically")

  if (objective.status !== "completed") {
    objective = await tickGrowthObjectiveRuntime(admin, "org-1", objective.id, { certificationMode: true })
    if (objective.status !== "completed") {
      objective = await tickGrowthObjectiveRuntime(admin, "org-1", objective.id, { certificationMode: true })
    }
  }
  assert.equal(objective.status, "completed")
  assert.ok(computeObjectiveDashboardProgress(objective) >= 70)
  console.log("  ✓ Objective completes when target reached")

  assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/objectives/growth-objectives-dashboard.tsx")))
  const dashboard = readSource("components/growth/objectives/growth-objectives-dashboard.tsx")
  assert.match(dashboard, /Execution history/)
  assert.match(dashboard, /Recent signals/)
  console.log("  ✓ Dashboard shows live runtime, history, signals")

  console.log("\nGE-AUTO-2A passed.\n")
}

void main()
