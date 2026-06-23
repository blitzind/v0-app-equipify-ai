/**
 * GE-AUTO-1F — Objective planner & adaptive orchestrator certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1f
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { evaluateAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-policy-service"
import { GROWTH_AUTONOMY_QA_MARKER } from "../lib/growth/autonomy/growth-autonomy-types"
import { generateGrowthObjectiveAdaptiveRecommendations } from "../lib/growth/objectives/growth-objective-adaptive-engine"
import { buildGrowthObjectiveForecast } from "../lib/growth/objectives/growth-objective-forecast"
import { evaluateObjectivePlanOrchestration } from "../lib/growth/objectives/growth-objective-orchestration"
import { planGrowthObjective } from "../lib/growth/objectives/growth-objective-planner"
import {
  resetGrowthObjectiveMemoryStore,
} from "../lib/growth/objectives/growth-objective-repository"
import {
  createGrowthObjectiveWithPlan,
  replanGrowthObjective,
} from "../lib/growth/objectives/growth-objective-service"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_STAGE_IDS,
  type GrowthObjective,
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
  maybeSingle: () => Promise<{ data: unknown; error: null }>
  single: () => Promise<{ data: unknown; error: null }>
  then: Promise<{ data: unknown; error: null }>["then"]
  limit: () => Promise<{ data: unknown; error: null }>
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
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
    single: result as MockQueryBuilder["single"],
    then: (...args) => result().then(...args),
    limit: async () => ({ data: null, error: null }),
  }
  return builder
}

function createMockAdmin(input: {
  settings?: ReturnType<typeof buildDefaultGrowthAutonomySettings>
  killSwitches?: Record<string, boolean>
}): { schema: () => { from: (table: string) => MockQueryBuilder } } {
  const killSwitchRows = Object.entries(
    input.killSwitches ?? {
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: true,
    },
  ).map(([key, enabled]) => ({ key, enabled }))

  const settings = input.settings ?? buildDefaultGrowthAutonomySettings("org-1")
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
          return createMockQuery(() => ({ data: null, error: null }))
        }
        if (table === "runtime_guardrail_audit_log") {
          return createMockQuery(() => ({ data: null, error: null }))
        }
        return createMockQuery(() => ({ data: null, error: null }))
      },
    }),
  }
}

function sampleObjective(): GrowthObjective {
  const now = new Date().toISOString()
  return {
    id: "obj-cert-1",
    organizationId: "org-1",
    title: "Book 20 demos with medical equipment companies",
    description: "Medical equipment demo booking objective",
    objectiveType: "demos_booked",
    targetValue: 20,
    currentValue: 0,
    startDate: now,
    targetDate: null,
    status: "active",
    ownerUserId: null,
    priority: "high",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    recommendations: [],
    emergencyStopActive: false,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: now,
    updatedAt: now,
  }
}

async function main() {
  console.log("\nGE-AUTO-1F certification\n")
  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_AUTONOMY_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2b-v1")
  console.log("  ✓ QA markers")

  const migration = readSource("supabase/migrations/20270929140000_growth_autonomy_ge_auto_1f.sql")
  assert.match(migration, /organization_growth_objectives/)
  assert.match(migration, /demos_booked/)
  console.log("  ✓ Objective migration schema")

  const plannerSource = readSource("lib/growth/objectives/growth-objective-planner.ts")
  assert.match(plannerSource, /planGrowthObjective/)
  assert.match(plannerSource, /inferIcpStrategy/)
  console.log("  ✓ Deterministic planner module")

  const orchestrationSource = readSource("lib/growth/objectives/growth-objective-orchestration.ts")
  assert.match(orchestrationSource, /enforceGrowthAutonomyCapability/)
  console.log("  ✓ Orchestration routes through autonomy enforcement")

  const objective = sampleObjective()
  const plan = planGrowthObjective(objective)

  assert.equal(plan.stages.length, GROWTH_OBJECTIVE_STAGE_IDS.length)
  assert.match(plan.icpStrategy.summary, /Healthcare|Medical|Equipment/i)
  assert.ok(plan.savedSearches.length >= 1)
  assert.ok(plan.audiences.length >= 1)
  assert.ok(plan.researchRequirements.length >= 1)
  assert.ok(plan.assetsRequired.length >= 3)
  assert.ok(plan.channelsRequired.includes("email"))
  assert.ok(plan.automationPlaybooks.length >= 1)
  console.log("  ✓ Medical equipment demo objective plan")

  const forecast = buildGrowthObjectiveForecast(objective, plan.icpStrategy)
  assert.ok(forecast.leadsNeeded >= objective.targetValue)
  assert.ok(forecast.estimatedSends > 0)
  console.log("  ✓ Forecast heuristics")

  const recommendations = generateGrowthObjectiveAdaptiveRecommendations({
    objective,
    signals: {
      opens: 100,
      clicks: 20,
      replies: 0,
      videoViews: 30,
      videoCompletions: 20,
      bookings: 2,
      engagementScore: 70,
      intentScore: 80,
      sequenceOpenRate: 0.1,
      sequenceReplyRate: 0.02,
    },
  })
  assert.ok(recommendations.length >= 2)
  assert.equal(recommendations.every((entry) => entry.requiresApproval), true)
  console.log("  ✓ Adaptive recommendations (approval required)")

  const orchestration = await evaluateObjectivePlanOrchestration(createMockAdmin({}) as never, {
    organizationId: "org-1",
    plan,
  })
  assert.ok(orchestration.length >= 5)
  const outbound = orchestration.filter((entry) =>
    ["email_execution", "sms_execution", "voice_execution"].includes(entry.capability),
  )
  assert.ok(outbound.every((entry) => entry.blocked || entry.requiresApproval))
  console.log("  ✓ Plan orchestration respects policy gates")

  const objectiveSettings = buildDefaultGrowthAutonomySettings("org-1")
  objectiveSettings.masterMode = "objective"
  objectiveSettings.capabilityToggles.strategy_adaptation = true
  objectiveSettings.capabilityToggles.recommendations = true

  const strategyAllowed = await evaluateAutonomyCapability(
    createMockAdmin({
      settings: objectiveSettings,
      killSwitches: {
        autonomy_enabled: true,
        autonomy_outbound_enabled: false,
        autonomy_generation_enabled: true,
        autonomy_objective_mode_enabled: true,
      },
    }) as never,
    {
      organizationId: "org-1",
      capability: "strategy_adaptation",
      triggerSource: "autonomous",
      enforcementRequested: true,
    },
  )
  assert.equal(strategyAllowed.allowed, true)
  assert.equal(strategyAllowed.requiresApproval, true)
  console.log("  ✓ Strategy adaptation allowed in objective mode with kill switch")

  const created = await createGrowthObjectiveWithPlan(createMockAdmin({ settings: objectiveSettings }) as never, "org-1", {
    title: objective.title,
    description: objective.description,
    objectiveType: "demos_booked",
    targetValue: 20,
  })
  assert.ok(created.objective.plan)
  assert.equal(created.objective.status, "active")
  console.log("  ✓ Create objective with plan + orchestration evaluation")

  const replanned = await replanGrowthObjective(
    createMockAdmin({ settings: objectiveSettings }) as never,
    "org-1",
    created.objective.id,
  )
  assert.ok(replanned.objective.plan?.generatedAt)
  console.log("  ✓ Replan regenerates execution plan")

  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(growth)/growth/objectives/page.tsx")))
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/objectives/growth-objectives-dashboard.tsx")))
  console.log("  ✓ Objectives dashboard page + component")

  console.log("\nGE-AUTO-1F passed.\n")
}

void main()
