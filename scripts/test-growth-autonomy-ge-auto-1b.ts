/**
 * GE-AUTO-1B — Autonomy controls & safe internal enforcement certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDefaultGrowthAutonomySettings,
  GROWTH_AUTONOMY_ENFORCEABLE_CAPABILITIES,
  isGrowthAutonomyEnforceableCapability,
} from "../lib/growth/autonomy/growth-autonomy-config"
import { enforceGrowthAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-enforcement"
import { evaluateAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-policy-service"
import { GROWTH_AUTONOMY_QA_MARKER } from "../lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_SCHEMA_MIGRATION } from "../lib/growth/autonomy/growth-autonomy-schema-health"
import {
  mergeGrowthAutonomyCapabilityToggles,
  validateGrowthAutonomySettingsPatch,
} from "../lib/growth/autonomy/growth-autonomy-settings-patch"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null }>
  upsert: (...args: unknown[]) => MockQueryBuilder
  single: () => Promise<{ data: unknown; error: null }>
  then: Promise<{ data: unknown; error: null }>["then"]
  limit: () => Promise<{ error: null }>
}

function createMockQuery(resolve: () => { data: unknown; error: null }): MockQueryBuilder {
  const result = () => Promise.resolve(resolve())
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
    upsert: () => builder,
    single: result as MockQueryBuilder["single"],
    then: (...args) => result().then(...args),
    limit: async () => ({ error: null }),
  }
  return builder
}

function createMockAdmin(input: {
  settings?: ReturnType<typeof buildDefaultGrowthAutonomySettings>
  killSwitches?: Record<string, boolean>
  budgetCount?: number
}): { schema: () => { from: (table: string) => MockQueryBuilder } } {
  const killSwitchRows = Object.entries(
    input.killSwitches ?? {
      autonomy_enabled: false,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: false,
      autonomy_objective_mode_enabled: false,
    },
  ).map(([key, enabled]) => ({ key, enabled }))

  const settingsRow = input.settings
    ? {
        organization_id: input.settings.organizationId,
        master_mode: input.settings.masterMode,
        capability_toggles: input.settings.capabilityToggles,
        approval_policies: input.settings.approvalPolicies,
        channel_permissions: input.settings.channelPermissions,
        daily_budget_limits: input.settings.dailyBudgetLimits,
        updated_at: input.settings.updatedAt,
      }
    : null

  return {
    schema: () => ({
      from: (table: string) => {
        if (table === "organization_autonomy_settings") {
          return createMockQuery(async () => ({ data: settingsRow, error: null }))
        }
        if (table === "runtime_guardrail_settings") {
          return createMockQuery(async () => ({ data: killSwitchRows, error: null }))
        }
        if (table === "runtime_budgets") {
          return createMockQuery(async () => ({
            data: input.budgetCount ? { count: input.budgetCount, window_start: new Date().toISOString() } : null,
            error: null,
          }))
        }
        if (table === "runtime_guardrail_audit_log") {
          return createMockQuery(async () => ({ error: null }))
        }
        throw new Error(`Unexpected table: ${table}`)
      },
    }),
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_AUTONOMY_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")

  const migration = readSource(`supabase/migrations/${GROWTH_AUTONOMY_SCHEMA_MIGRATION}`)
  assert.match(migration, /organization_autonomy_settings/)
  assert.match(migration, /service_role/)
  assert.match(migration, /force row level security/)

  const apiRoute = readSource("app/api/growth/workspace/settings/autonomy/route.ts")
  assert.match(apiRoute, /export async function PATCH/)
  assert.match(apiRoute, /validateGrowthAutonomySettingsPatch/)

  const settingsPanel = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(settingsPanel, /Pause all autonomy/)
  assert.match(settingsPanel, /Outreach controls/)

  const enforcement = readSource("lib/growth/autonomy/growth-autonomy-enforcement.ts")
  assert.match(enforcement, /triggerSource === "operator"/)

  const actions = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions.ts")
  assert.match(actions, /enforceGrowthAutonomyCapability/)
  assert.match(actions, /recommendationsGate\.allowed/)

  const rejectedUnknownCapability = validateGrowthAutonomySettingsPatch({
    capabilityToggles: { not_a_capability: true },
  })
  assert.equal(rejectedUnknownCapability.ok, false)

  const acceptedEmailExecution = validateGrowthAutonomySettingsPatch({
    capabilityToggles: { email_execution: true },
  })
  assert.equal(acceptedEmailExecution.ok, true)

  const rejectedApproval = validateGrowthAutonomySettingsPatch({
    approvalPolicies: { research: "fully_autonomous" },
  })
  assert.equal(rejectedApproval.ok, false)

  const acceptedOutboundKill = validateGrowthAutonomySettingsPatch({
    killSwitches: { autonomyOutboundEnabled: true },
  })
  assert.equal(acceptedOutboundKill.ok, true)

  const merged = mergeGrowthAutonomyCapabilityToggles({}, { research: true })
  assert.equal(merged.email_execution, false)
  assert.equal(merged.research, true)

  const orgId = "00000000-0000-4000-8000-000000000001"

  const operatorBypass = await enforceGrowthAutonomyCapability(createMockAdmin({}) as never, {
    organizationId: orgId,
    capability: "recommendations",
    runtimeContext: "cert_operator",
    triggerSource: "operator",
  })
  assert.equal(operatorBypass.allowed, true)
  assert.equal(operatorBypass.skipped, true)

  const manualBlocked = await enforceGrowthAutonomyCapability(
    createMockAdmin({ settings: buildDefaultGrowthAutonomySettings(orgId) }) as never,
    {
      organizationId: orgId,
      capability: "recommendations",
      runtimeContext: "cert_manual",
      triggerSource: "autonomous",
    },
  )
  assert.equal(manualBlocked.allowed, false)

  const assistedSettings = buildDefaultGrowthAutonomySettings(orgId)
  assistedSettings.masterMode = "assisted"
  assistedSettings.capabilityToggles.recommendations = true
  assistedSettings.capabilityToggles.task_creation = true
  assistedSettings.dailyBudgetLimits.autonomous_research_runs = 50

  const assistedAdmin = createMockAdmin({
    settings: assistedSettings,
    killSwitches: {
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  })

  const assistedAllowed = await enforceGrowthAutonomyCapability(assistedAdmin as never, {
    organizationId: orgId,
    capability: "recommendations",
    runtimeContext: "cert_assisted",
    triggerSource: "autonomous",
  })
  assert.equal(assistedAllowed.allowed, true)

  const outboundBlocked = await enforceGrowthAutonomyCapability(assistedAdmin as never, {
    organizationId: orgId,
    capability: "email_execution",
    runtimeContext: "cert_outbound",
    triggerSource: "autonomous",
  })
  assert.equal(outboundBlocked.allowed, false)

  const objectiveBlocked = await evaluateAutonomyCapability(
    createMockAdmin({
      settings: { ...assistedSettings, masterMode: "objective" },
      killSwitches: {
        autonomy_enabled: true,
        autonomy_outbound_enabled: false,
        autonomy_generation_enabled: true,
        autonomy_objective_mode_enabled: true,
      },
    }) as never,
    {
      organizationId: orgId,
      capability: "strategy_adaptation",
      triggerSource: "autonomous",
      enforcementRequested: true,
    },
  )
  assert.equal(objectiveBlocked.blocked, true)

  const emergencyAdmin = createMockAdmin({
    settings: assistedSettings,
    killSwitches: {
      autonomy_enabled: false,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  })

  const emergencyBlocked = await enforceGrowthAutonomyCapability(emergencyAdmin as never, {
    organizationId: orgId,
    capability: "task_creation",
    runtimeContext: "cert_emergency_stop",
    triggerSource: "autonomous",
  })
  assert.equal(emergencyBlocked.allowed, false)

  for (const capability of GROWTH_AUTONOMY_ENFORCEABLE_CAPABILITIES) {
    assert.equal(isGrowthAutonomyEnforceableCapability(capability), true)
  }

  console.log("GE-AUTO-1B autonomy controls certification passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
