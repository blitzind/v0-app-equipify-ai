/**
 * GE-AUTO-2C — Production event fan-in certification.
 * Run: pnpm test:growth-objective-ge-auto-2c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  mergeObjectiveResourceSubscriptions,
  objectiveMatchesSourceEvent,
} from "../lib/growth/objectives/growth-objective-subscriptions"
import { routeGrowthObjectiveSourceEvent } from "../lib/growth/objectives/growth-objective-event-router"
import { mapSourceEventToObjectiveSignal } from "../lib/growth/objectives/growth-objective-signal-mapper"
import { isDuplicateObjectiveSignalIngest } from "../lib/growth/objectives/growth-objective-signal-handler"
import { createGrowthObjectiveWithPlan } from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { GrowthObjectiveRuntimeScheduler } from "../lib/growth/objectives/growth-objective-runtime-scheduler"
import {
  GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_PHASE,
  GROWTH_OBJECTIVE_PRODUCTION_FANIN_QA_MARKER,
  GROWTH_OBJECTIVE_QA_MARKER,
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
  settings.capabilityToggles.campaign_launch = true
  settings.capabilityToggles.recommendations = true
  settings.capabilityToggles.strategy_adaptation = true

  const killSwitchRows = [
    { key: "autonomy_enabled", enabled: true },
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
        return createMockQuery(() => ({ data: null, error: null }))
      },
    }),
  }
}

async function main() {
  console.log("\nGE-AUTO-2C production fan-in certification\n")
  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2F")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_PRODUCTION_FANIN_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ QA markers")

  const migration = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION}`)
  assert.match(migration, /event_subscriptions/)
  assert.match(migration, /organization_growth_objectives/)
  console.log("  ✓ GE-AUTO-2B migration verified (event_subscriptions)")

  const fanInSources = [
    ["lib/growth/tracking/tracking-repository.ts", "dispatchGrowthObjectiveEngagementEvent"],
    ["lib/growth/share-pages/share-page-analytics-service.ts", "fanInSharePageObjectiveEvent"],
    ["lib/growth/sequences/execution/sequence-job-runner.ts", "fanInGrowthObjectiveSequenceEvent"],
    ["lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts", "fanInGrowthObjectiveSequenceEvent"],
    ["lib/growth/automation-runtime/ge-v1-5-automation-runtime-execute.ts", "dispatchGrowthObjectiveAutomationRuntimeEvent"],
    ["lib/growth/signal-intelligence/route-lead-signal-event.ts", "dispatchGrowthObjectiveLeadSignalEvent"],
    ["lib/growth/objectives/growth-objective-launch-wiring.ts", "wireObjectiveLaunchResources"],
  ] as const

  for (const [file, needle] of fanInSources) {
    assert.match(readSource(file), new RegExp(needle))
  }
  console.log("  ✓ Production fan-in hooks wired")

  assert.ok(GrowthObjectiveRuntimeScheduler.MAX_OBJECTIVES_PER_TICK > 0)
  assert.ok(GrowthObjectiveRuntimeScheduler.MAX_ORGS_PER_TICK > 0)
  console.log("  ✓ Scheduler production limits configured")

  const mapped = mapSourceEventToObjectiveSignal({
    organizationId: "org-1",
    source: "share_page",
    signalType: "booking_completed",
    leadId: "lead-1",
    resourceId: "page-uuid",
  })
  assert.equal(mapped?.type, "booking_completed")
  console.log("  ✓ Booking/share-page signal mapping")

  const admin = createMockAdmin() as never
  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 20 demos with medical equipment companies",
      description: "GE-AUTO-2C cert scenario",
      objectiveType: "demos_booked",
      targetValue: 20,
    },
    { certificationMode: true },
  )

  const withResourceId = mergeObjectiveResourceSubscriptions(created.objective.eventSubscriptions!, [
    {
      resourceType: "booking_page",
      resourceKey: "demo-assistant",
      resourceId: "page-uuid-real",
      label: "Demo assistant",
    },
  ])

  const objectiveWithIds = { ...created.objective, eventSubscriptions: withResourceId }
  assert.ok(
    objectiveMatchesSourceEvent(objectiveWithIds, {
      organizationId: "org-1",
      source: "share_page",
      signalType: "booking_completed",
      resourceType: "booking_page",
      resourceId: "page-uuid-real",
      leadId: "lead-1",
    }),
  )
  console.log("  ✓ Resource ID subscription matching")

  await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "engagement",
    signalType: "email_opened",
    leadId: "lead-open",
    idempotencyKey: "cert-open-1",
  })

  const duplicateSignal = mapSourceEventToObjectiveSignal({
    organizationId: "org-1",
    source: "meeting",
    signalType: "booking_completed",
    leadId: "lead-dup",
    idempotencyKey: "cert-booking-dup",
  })!
  assert.equal(isDuplicateObjectiveSignalIngest(created.objective, duplicateSignal), false)

  await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "meeting",
    signalType: "booking_completed",
    leadId: "lead-dup",
    idempotencyKey: "cert-booking-dup",
  })

  const { listGrowthObjectives } = await import("../lib/growth/objectives/growth-objective-repository")
  let objective = (await listGrowthObjectives(admin, "org-1"))[0]
  assert.equal(isDuplicateObjectiveSignalIngest(objective, duplicateSignal), true)

  await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "meeting",
    signalType: "booking_completed",
    leadId: "lead-dup",
    idempotencyKey: "cert-booking-dup",
  })

  objective = (await listGrowthObjectives(admin, "org-1"))[0]
  const valueAfterDup = objective.currentValue

  for (let i = 0; i < 5; i += 1) {
    await routeGrowthObjectiveSourceEvent(admin, {
      organizationId: "org-1",
      source: "share_page",
      signalType: "booking_completed",
      leadId: `lead-${i}`,
      idempotencyKey: `cert-booking-${i}`,
    })
  }

  objective = (await listGrowthObjectives(admin, "org-1"))[0]
  assert.ok(objective.currentValue >= valueAfterDup + 1)
  assert.ok(objective.recentSignals.length > 0)
  console.log("  ✓ Idempotency + booking progress fan-in")

  const duplicateRoute = await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "engagement",
    signalType: "email_opened",
    leadId: "lead-open",
    idempotencyKey: "cert-open-1",
  })
  assert.equal(duplicateRoute.duplicate, true)
  console.log("  ✓ Router-level duplicate suppression")

  console.log("\nGE-AUTO-2C certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
