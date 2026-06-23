/**
 * GE-AUTO-2B — Event-driven objective runtime certification.
 * Run: pnpm test:growth-objective-ge-auto-2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { buildGrowthObjectiveEventSubscriptions, objectiveMatchesSourceEvent } from "../lib/growth/objectives/growth-objective-subscriptions"
import { routeGrowthObjectiveSourceEvent } from "../lib/growth/objectives/growth-objective-event-router"
import { mapSourceEventToObjectiveSignal } from "../lib/growth/objectives/growth-objective-signal-mapper"
import { createGrowthObjectiveWithPlan } from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { runGrowthObjectiveRuntimeScheduler } from "../lib/growth/objectives/growth-objective-runtime-scheduler"
import {
  GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER,
  GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_PHASE,
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER,
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
  console.log("\nGE-AUTO-2B certification\n")
  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2F")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_EVENT_ROUTER_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_RUNTIME_SCHEDULER_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ QA markers")

  const migration = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION}`)
  assert.match(migration, /event_subscriptions/)
  console.log("  ✓ Event subscription migration")

  const routerSource = readSource("lib/growth/objectives/growth-objective-event-router.ts")
  assert.match(routerSource, /GrowthObjectiveEventRouter/)
  assert.match(routerSource, /routeGrowthObjectiveSourceEvent/)
  assert.match(routerSource, /ingestGrowthObjectiveSignal/)
  console.log("  ✓ Event router architecture")

  const leadRoute = readSource("lib/growth/signal-intelligence/route-lead-signal-event.ts")
  assert.match(leadRoute, /fanOutLeadSignalToObjectives/)
  console.log("  ✓ Lead signal router fan-in hook")

  const cronRoute = readSource("app/api/cron/growth-objective-runtime-scheduler/route.ts")
  assert.match(cronRoute, /runGrowthObjectiveRuntimeScheduler/)
  const vercel = readSource("vercel.json")
  assert.match(vercel, /growth-objective-runtime-scheduler/)
  console.log("  ✓ Runtime scheduler cron registered")

  const mapped = mapSourceEventToObjectiveSignal({
    organizationId: "org-1",
    source: "meeting",
    signalType: "booking_completed",
    leadId: "lead-1",
  })
  assert.equal(mapped?.type, "booking_completed")
  console.log("  ✓ Signal mapper")

  const admin = createMockAdmin() as never
  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos with medical equipment companies",
      description: "Event-driven cert scenario",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true },
  )

  assert.ok(created.objective.eventSubscriptions?.items.length)
  assert.ok(objectiveMatchesSourceEvent(created.objective, {
    organizationId: "org-1",
    source: "meeting",
    signalType: "booking_completed",
  }))
  console.log("  ✓ Objective subscriptions persisted from plan")

  let objective = created.objective
  for (let i = 0; i < 20; i += 1) {
    await routeGrowthObjectiveSourceEvent(admin, {
      organizationId: "org-1",
      source: "meeting",
      signalType: "booking_completed",
      leadId: `lead-${i}`,
      idempotencyKey: `cert-booking-${i}`,
    })
  }

  const { listGrowthObjectives } = await import("../lib/growth/objectives/growth-objective-repository")
  objective = (await listGrowthObjectives(admin, "org-1"))[0]
  assert.equal(objective.currentValue, 20)
  assert.equal(objective.status, "completed")
  assert.ok(objective.recentSignals.length >= 20)
  console.log("  ✓ Event router ingests booking signals without manual API injection")

  resetGrowthObjectiveMemoryStore()
  const restarted = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos — scheduler cert",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true },
  )
  assert.ok(restarted.objective.runtime?.running)
  const scheduler = await runGrowthObjectiveRuntimeScheduler(admin, { certificationMode: true })
  assert.ok(scheduler.objectivesScanned >= 1)
  console.log("  ✓ Runtime scheduler evaluates running objectives")

  const dashboard = readSource("components/growth/objectives/growth-objectives-dashboard.tsx")
  assert.match(dashboard, /isObjectiveRuntimeStalled/)
  assert.match(dashboard, /Retry stage/)
  assert.match(dashboard, /buildObjectiveSignalSnapshot/)
  console.log("  ✓ Dashboard runtime + signal enhancements")

  const subscriptions = buildGrowthObjectiveEventSubscriptions(restarted.objective)
  assert.ok(subscriptions.items.some((item) => item.resourceType === "opportunity"))
  console.log("  ✓ Subscription model covers plan resources")

  console.log("\nGE-AUTO-2B passed.\n")
}

void main()
