/**
 * GE-AUTO-2D — Production certification & real resource binding.
 * Run: pnpm test:growth-objective-ge-auto-2d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { rememberObjectiveSourceEventReceipt } from "../lib/growth/objectives/growth-objective-event-dedupe"
import { routeGrowthObjectiveSourceEvent } from "../lib/growth/objectives/growth-objective-event-router"
import { bindGrowthObjectiveResource } from "../lib/growth/objectives/growth-objective-resource-binding"
import { mergeObjectiveResourceSubscriptions } from "../lib/growth/objectives/growth-objective-subscriptions"
import { createGrowthObjectiveWithPlan } from "../lib/growth/objectives/growth-objective-service"
import { resetGrowthObjectiveMemoryStore } from "../lib/growth/objectives/growth-objective-repository"
import { GrowthObjectiveRuntimeScheduler } from "../lib/growth/objectives/growth-objective-runtime-scheduler"
import {
  GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION,
  GROWTH_OBJECTIVE_PHASE,
  GROWTH_OBJECTIVE_PRODUCTION_DEDUPE_QA_MARKER,
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
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
    single: result as MockQueryBuilder["single"],
    limit: async () => ({ data: null, error: null }),
    then: (...args) => result().then(...args),
  }
  return builder
}

function createReceiptQueryBuilder(receiptKeys: Set<string>): MockQueryBuilder {
  let pendingKey: string | null = null
  let duplicatePending = false
  const self: MockQueryBuilder = {
    select: () => self,
    eq: () => self,
    in: () => self,
    insert: (row: unknown) => {
      const key = (row as { idempotency_key?: string })?.idempotency_key ?? null
      pendingKey = key
      if (key && receiptKeys.has(key)) {
        duplicatePending = true
      } else if (key) {
        receiptKeys.add(key)
        duplicatePending = false
      }
      return self
    },
    update: () => self,
    maybeSingle: async () => {
      if (duplicatePending) {
        return { data: null, error: { message: "duplicate key", code: "23505" } }
      }
      return { data: pendingKey ? { idempotency_key: pendingKey } : null, error: null }
    },
    single: async () => ({ data: null, error: null }),
    limit: async () => ({ data: null, error: null }),
    then: (...args) => Promise.resolve({ data: null, error: null }).then(...args),
  }
  return self
}

function createMockAdmin(receiptKeys: Set<string>): {
  schema: () => { from: (table: string) => MockQueryBuilder }
} {
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
        if (table === "objective_source_event_receipts") {
          return createReceiptQueryBuilder(receiptKeys)
        }
        return createMockQuery(() => ({ data: null, error: null }))
      },
    }),
  }
}

async function main() {
  console.log("\nGE-AUTO-2D production certification\n")
  resetGrowthObjectiveMemoryStore()

  assert.equal(GROWTH_OBJECTIVE_PHASE, "GE-AUTO-2F")
  assert.equal(GROWTH_OBJECTIVE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  assert.equal(GROWTH_OBJECTIVE_PRODUCTION_DEDUPE_QA_MARKER, "growth-objective-ge-auto-2f-v1")
  console.log("  ✓ QA markers")

  const migration2b = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_EVENT_SCHEMA_MIGRATION}`)
  assert.match(migration2b, /event_subscriptions/)
  const migration2d = readSource(`supabase/migrations/${GROWTH_OBJECTIVE_PRODUCTION_SCHEMA_MIGRATION}`)
  assert.match(migration2d, /objective_source_event_receipts/)
  console.log("  ✓ Production migrations verified")

  const bindingHooks = [
    ["lib/growth/audiences/growth-audience-repository.ts", "bindGrowthObjectiveResources"],
    ["lib/growth/share-pages/share-page-repository.ts", "bindGrowthObjectiveResources"],
    ["lib/growth/sendr/growth-sendr-launch-run-service.ts", "bindGrowthObjectiveResources"],
    ["lib/growth/videos/growth-video-autopilot-page-builder.ts", "bindGrowthObjectiveResource"],
    ["lib/growth/outbound/process-event.ts", "finalizeIngestedReplyIntelligence"],
    ["lib/growth/replies/finalize-ingested-reply-intelligence.ts", "reply_received"],
    ["lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts", "step_scheduled"],
    ["lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts", "enrollment_paused"],
    ["lib/growth/objectives/growth-objective-event-dedupe.ts", "rememberObjectiveSourceEventReceipt"],
  ] as const

  for (const [file, needle] of bindingHooks) {
    assert.match(readSource(file), new RegExp(needle))
  }
  console.log("  ✓ Resource binding + fan-in hooks wired")

  const receiptKeys = new Set<string>()
  const admin = createMockAdmin(receiptKeys) as never

  const first = await rememberObjectiveSourceEventReceipt(admin, {
    idempotencyKey: "cert-dedupe-1",
    organizationId: "org-1",
    source: "engagement",
    signalType: "email_opened",
  })
  const second = await rememberObjectiveSourceEventReceipt(admin, {
    idempotencyKey: "cert-dedupe-1",
    organizationId: "org-1",
    source: "engagement",
    signalType: "email_opened",
  })
  assert.equal(first.duplicate, false)
  assert.equal(second.duplicate, true)
  console.log("  ✓ Persistent dedupe receipts")

  const created = await createGrowthObjectiveWithPlan(
    admin,
    "org-1",
    {
      title: "Book 1 demo with medical equipment companies",
      description: "GE-AUTO-2D E2E cert",
      objectiveType: "demos_booked",
      targetValue: 1,
    },
    { certificationMode: true },
  )

  const bound = await bindGrowthObjectiveResource(admin, {
    organizationId: "org-1",
    resourceType: "booking_page",
    resourceId: "real-booking-page-uuid",
    resourceKey: "demo-assistant",
    label: "Demo assistant",
  })
  assert.ok(bound >= 0)
  console.log("  ✓ Real resource binding helper")

  const merged = mergeObjectiveResourceSubscriptions(created.objective.eventSubscriptions!, [
    {
      resourceType: "booking_page",
      resourceKey: "demo-assistant",
      resourceId: "real-booking-page-uuid",
      label: "Demo assistant",
    },
  ])
  assert.ok(merged.items.some((item) => item.resourceId === "real-booking-page-uuid"))
  console.log("  ✓ Subscription merge with real UUID")

  await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "share_page",
    signalType: "booking_completed",
    leadId: "lead-cert",
    idempotencyKey: "cert-booking-complete",
  })

  const dupRoute = await routeGrowthObjectiveSourceEvent(admin, {
    organizationId: "org-1",
    source: "share_page",
    signalType: "booking_completed",
    leadId: "lead-cert",
    idempotencyKey: "cert-booking-complete",
  })
  assert.equal(dupRoute.duplicate, true)

  const { listGrowthObjectives } = await import("../lib/growth/objectives/growth-objective-repository")
  const objective = (await listGrowthObjectives(admin, "org-1"))[0]
  assert.ok(objective.currentValue >= 1 || objective.recentSignals.length > 0)
  console.log("  ✓ E2E booking event routing + dedupe")

  assert.ok(GrowthObjectiveRuntimeScheduler.MAX_OBJECTIVES_PER_TICK > 0)
  const schedulerSource = readSource("lib/growth/objectives/growth-objective-runtime-scheduler.ts")
  assert.match(schedulerSource, /lastSchedulerAt/)
  assert.match(schedulerSource, /schedulerRunCount/)
  console.log("  ✓ Scheduler persistence fields")

  const safetySource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-types.ts")
  assert.match(safetySource, /autonomous_approval_enabled: false/)
  console.log("  ✓ Safety flags unchanged")

  console.log("\nGE-AUTO-2D certification passed.\n")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
