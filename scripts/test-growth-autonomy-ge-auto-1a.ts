/**
 * GE-AUTO-1A — Graduated autonomy foundation certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDefaultGrowthAutonomySettings,
  GROWTH_AUTONOMY_DEFAULT_MASTER_MODE,
  isCapabilityPermittedByMasterMode,
} from "../lib/growth/autonomy/growth-autonomy-config"
import {
  GROWTH_AUTONOMY_CAPABILITIES,
  GROWTH_AUTONOMY_QA_MARKER,
} from "../lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_SCHEMA_MIGRATION } from "../lib/growth/autonomy/growth-autonomy-schema-health"
import { evaluateAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-policy-service"
import { upsertGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-settings-repository"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type MockAdmin = {
  schema: () => {
    from: (table: string) => MockQueryBuilder
  }
}

type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null }>
  upsert: (...args: unknown[]) => MockQueryBuilder
  single: () => Promise<{ data: unknown; error: null }>
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
  }
  ;(builder as { limit: () => Promise<{ error: null }> }).limit = async () => ({ error: null })
  ;(builder as { then: Promise<{ data: unknown; error: null }>["then"] }).then = (...args) =>
    result().then(...args)
  return builder
}

function createMockAdmin(input: {
  settings?: ReturnType<typeof buildDefaultGrowthAutonomySettings>
  killSwitches?: Record<string, boolean>
}): MockAdmin {
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
          return createMockQuery(async () => ({ data: null, error: null }))
        }
        if (table === "runtime_guardrail_audit_log") {
          return createMockQuery(async () => ({ error: null }))
        }
        throw new Error(`Unexpected table in mock admin: ${table}`)
      },
    }),
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_AUTONOMY_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")
  assert.equal(GROWTH_AUTONOMY_DEFAULT_MASTER_MODE, "manual")

  const migration = readSource(`supabase/migrations/${GROWTH_AUTONOMY_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.organization_autonomy_settings/)
  assert.match(migration, /autonomy_enabled/)
  assert.match(migration, /autonomy_outbound_enabled/)
  assert.match(migration, /autonomy_generation_enabled/)
  assert.match(migration, /autonomy_objective_mode_enabled/)
  assert.match(migration, /service_role/)

  const guardrailConfig = readSource("lib/growth/runtime-guardrails/growth-runtime-guardrail-config.ts")
  assert.match(guardrailConfig, /autonomous_research_runs/)
  assert.match(guardrailConfig, /autonomous_page_generations/)
  assert.match(guardrailConfig, /autonomous_video_generations/)
  assert.match(guardrailConfig, /autonomous_campaigns/)
  assert.match(guardrailConfig, /autonomous_outbound_actions/)
  assert.match(guardrailConfig, /autonomy_enabled: false/)

  const policyService = readSource("lib/growth/autonomy/growth-autonomy-policy-service.ts")
  const evaluationService = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service.ts")
  assert.match(policyService, /evaluateAutonomyCapabilityFromPolicyEngine/)
  assert.match(evaluationService, /enforcementActive/)

  const signalProcessor = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-signal-processor.ts")
  assert.match(signalProcessor, /enforceGrowthAutonomyCapability/)

  const settingsPage = readSource("app/(growth)/growth/settings/autonomy/page.tsx")
  assert.match(settingsPage, /GrowthAutonomyControlCenter/)

  const orgId = "00000000-0000-4000-8000-000000000001"
  const manualAdmin = createMockAdmin({
    settings: buildDefaultGrowthAutonomySettings(orgId),
  })

  const manualResearch = await evaluateAutonomyCapability(manualAdmin as never, {
    organizationId: orgId,
    capability: "research",
  })
  assert.equal(manualResearch.allowed, false)
  assert.equal(manualResearch.blocked, true)
  assert.equal(manualResearch.requiresApproval, true)
  assert.equal(manualResearch.policyMetadata.enforcementActive, false)

  const assistedSettings = buildDefaultGrowthAutonomySettings(orgId)
  assistedSettings.masterMode = "assisted"
  assistedSettings.capabilityToggles.research = true
  assistedSettings.dailyBudgetLimits.autonomous_research_runs = 10

  const assistedAdmin = createMockAdmin({
    settings: assistedSettings,
    killSwitches: {
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  })

  const assistedResearch = await evaluateAutonomyCapability(assistedAdmin as never, {
    organizationId: orgId,
    capability: "research",
  })
  assert.equal(assistedResearch.allowed, true)
  assert.equal(assistedResearch.requiresApproval, true)

  const assistedEmail = await evaluateAutonomyCapability(assistedAdmin as never, {
    organizationId: orgId,
    capability: "email_execution",
  })
  assert.equal(assistedEmail.allowed, false)
  assert.equal(assistedEmail.blocked, true)
  assert.equal(assistedEmail.requiresApproval, true)

  const guardrailedSettings = buildDefaultGrowthAutonomySettings(orgId)
  guardrailedSettings.masterMode = "guardrailed"
  guardrailedSettings.capabilityToggles.page_generation = true
  guardrailedSettings.dailyBudgetLimits.autonomous_page_generations = 0

  const guardrailedAdmin = createMockAdmin({
    settings: guardrailedSettings,
    killSwitches: {
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  })

  const guardrailedPage = await evaluateAutonomyCapability(guardrailedAdmin as never, {
    organizationId: orgId,
    capability: "page_generation",
  })
  assert.equal(guardrailedPage.blocked, true)
  assert.match(guardrailedPage.reason ?? "", /budget/i)

  const channelSettings = buildDefaultGrowthAutonomySettings(orgId)
  channelSettings.masterMode = "channel"
  channelSettings.capabilityToggles.email_execution = true
  channelSettings.channelPermissions = {
    email: {
      enabled_for_prepare: true,
      max_prepared_per_day: 5,
      allowed_sender_profiles: ["sender-1"],
      allowed_sequences: [],
      allowed_audiences: [],
      minimum_confidence_score: 0,
      quiet_hours: { enabled: false, startHourUtc: 22, endHourUtc: 13 },
    },
  }

  const channelAdmin = createMockAdmin({
    settings: channelSettings,
    killSwitches: {
      autonomy_enabled: true,
      autonomy_outbound_enabled: true,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  })

  const channelEmail = await evaluateAutonomyCapability(channelAdmin as never, {
    organizationId: orgId,
    capability: "email_execution",
  })
  assert.equal(channelEmail.policyMetadata.channelPermission?.enabled_for_prepare, true)
  assert.equal(channelEmail.blocked, true)

  const objectiveSettings = buildDefaultGrowthAutonomySettings(orgId)
  objectiveSettings.masterMode = "objective"
  objectiveSettings.capabilityToggles.strategy_adaptation = true

  const objectiveAdmin = createMockAdmin({
    settings: objectiveSettings,
    killSwitches: {
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: false,
      autonomy_objective_mode_enabled: true,
    },
  })

  const objectiveStrategy = await evaluateAutonomyCapability(objectiveAdmin as never, {
    organizationId: orgId,
    capability: "strategy_adaptation",
  })
  assert.equal(objectiveStrategy.allowed, true)
  assert.equal(objectiveStrategy.requiresApproval, true)

  for (const capability of GROWTH_AUTONOMY_CAPABILITIES) {
    assert.equal(isCapabilityPermittedByMasterMode("manual", capability), false)
  }

  const defaults = buildDefaultGrowthAutonomySettings(orgId)
  for (const capability of GROWTH_AUTONOMY_CAPABILITIES) {
    assert.equal(defaults.capabilityToggles[capability], false)
    assert.equal(defaults.approvalPolicies[capability], "always_require_approval")
  }

  await upsertGrowthAutonomySettings(manualAdmin as never, orgId, {
    masterMode: "manual",
  })

  console.log("GE-AUTO-1A graduated autonomy foundation certification passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
