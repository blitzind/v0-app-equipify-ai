/**
 * GE-AUTO-1C — Channel autonomy preparation certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDefaultGrowthAutonomyChannelPermissions,
  GROWTH_AUTONOMY_CHANNEL_PREPARE_QA_MARKER,
  isGrowthAutonomyPrepareCapability,
  isWithinChannelQuietHours,
} from "../lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  scoreAutonomyOutboundConfidence,
} from "../lib/growth/autonomy/growth-autonomy-confidence-scorer"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import { enforceGrowthAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-enforcement"
import { evaluateAutonomyCapability } from "../lib/growth/autonomy/growth-autonomy-policy-service"
import {
  mergeGrowthAutonomyChannelPermissions,
  validateGrowthAutonomySettingsPatch,
} from "../lib/growth/autonomy/growth-autonomy-settings-patch"
import { GROWTH_AUTONOMY_QA_MARKER } from "../lib/growth/autonomy/growth-autonomy-types"
import {
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { buildGeV15PrepareConfidenceInput } from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare"

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
      autonomy_enabled: true,
      autonomy_outbound_enabled: false,
      autonomy_generation_enabled: true,
      autonomy_objective_mode_enabled: false,
    },
  ).map(([key, enabled]) => ({ key, enabled }))

  const settings = input.settings ?? buildDefaultGrowthAutonomySettings("org-1")
  const settingsRow = {
    organization_id: settings.organizationId,
    master_mode: settings.masterMode,
    capability_toggles: settings.capabilityToggles,
    approval_policies: settings.approvalPolicies,
    channel_permissions: settings.channelPermissions,
    daily_budget_limits: settings.dailyBudgetLimits,
    updated_at: settings.updatedAt,
  }

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
  console.log("\n=== GE-AUTO-1C — Channel Autonomy Preparation ===\n")

  assert.equal(GROWTH_AUTONOMY_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")
  assert.equal(GROWTH_AUTONOMY_CHANNEL_PREPARE_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")
  console.log("  ✓ QA markers")

  const migration = readSource("supabase/migrations/20270928120000_growth_autonomy_ge_auto_1c.sql")
  assert.match(migration, /enabled_for_prepare/)
  assert.match(migration, /DO NOT APPLY until operator approves migration/)
  console.log("  ✓ 1C migration documents channel prepare JSONB shape")

  const defaults = buildDefaultGrowthAutonomyChannelPermissions()
  assert.equal(defaults.email.enabled_for_prepare, false)
  assert.equal(defaults.email.max_prepared_per_day, 0)
  assert.deepEqual(defaults.email.allowed_sender_profiles, [])
  console.log("  ✓ Channel defaults disabled with zero limits")

  const score = scoreAutonomyOutboundConfidence({
    intentType: "pricing",
    leadScore: 80,
    engagementScore: 70,
    bookingStatus: "started",
  })
  assert.ok(score >= 50 && score <= 100)
  console.log("  ✓ Deterministic confidence scorer")

  const lowScore = scoreAutonomyOutboundConfidence({ intentType: "other", leadScore: 5 })
  assert.ok(lowScore < score)
  console.log("  ✓ Lower-intent signals score lower")

  assert.equal(isGrowthAutonomyPrepareCapability("email_prepare"), true)
  assert.equal(isGrowthAutonomyPrepareCapability("email_execution"), false)
  console.log("  ✓ Prepare capability type guard")

  const blockedManual = await evaluateAutonomyCapability(createMockAdmin({}) as never, {
    organizationId: "org-1",
    capability: "email_prepare",
    triggerSource: "autonomous",
    prepareContext: { confidenceScore: 90, senderProfileId: "sender-1" },
  })
  assert.equal(blockedManual.blocked, true)
  console.log("  ✓ Email prepare blocked in manual mode by default")

  const enabledSettings = buildDefaultGrowthAutonomySettings("org-1")
  enabledSettings.masterMode = "channel"
  enabledSettings.channelPermissions = buildDefaultGrowthAutonomyChannelPermissions()
  enabledSettings.channelPermissions.email = {
    ...enabledSettings.channelPermissions.email,
    enabled_for_prepare: true,
    max_prepared_per_day: 5,
    allowed_sender_profiles: ["sender-1"],
    minimum_confidence_score: 40,
  }

  const allowed = await evaluateAutonomyCapability(
    createMockAdmin({ settings: enabledSettings, killSwitches: { autonomy_enabled: true, autonomy_outbound_enabled: false, autonomy_generation_enabled: true, autonomy_objective_mode_enabled: false } }) as never,
    {
      organizationId: "org-1",
      capability: "email_prepare",
      triggerSource: "autonomous",
      prepareContext: { confidenceScore: 75, senderProfileId: "sender-1" },
    },
  )
  assert.equal(allowed.allowed, true)
  assert.equal(allowed.requiresApproval, true)
  assert.equal(allowed.policyMetadata.channelPolicyMetadata?.outboundSendBlocked, true)
  console.log("  ✓ Email prepare allowed with policy metadata when configured")

  const disallowedSender = await evaluateAutonomyCapability(
    createMockAdmin({ settings: enabledSettings, killSwitches: { autonomy_enabled: true, autonomy_outbound_enabled: false, autonomy_generation_enabled: true, autonomy_objective_mode_enabled: false } }) as never,
    {
      organizationId: "org-1",
      capability: "email_prepare",
      triggerSource: "autonomous",
      prepareContext: { confidenceScore: 75, senderProfileId: "other-sender" },
    },
  )
  assert.equal(disallowedSender.blocked, true)
  console.log("  ✓ Disallowed sender blocks prepare")

  enabledSettings.channelPermissions.email.minimum_confidence_score = 90
  const belowThreshold = await evaluateAutonomyCapability(
    createMockAdmin({ settings: enabledSettings, killSwitches: { autonomy_enabled: true, autonomy_outbound_enabled: false, autonomy_generation_enabled: true, autonomy_objective_mode_enabled: false } }) as never,
    {
      organizationId: "org-1",
      capability: "email_prepare",
      triggerSource: "autonomous",
      prepareContext: { confidenceScore: 50, senderProfileId: "sender-1" },
    },
  )
  assert.equal(belowThreshold.blocked, true)
  console.log("  ✓ Below confidence threshold blocks prepare")

  enabledSettings.channelPermissions.email.quiet_hours.enabled = true
  enabledSettings.channelPermissions.email.quiet_hours.startHourUtc = 0
  enabledSettings.channelPermissions.email.quiet_hours.endHourUtc = 23
  const quietBlocked = await evaluateAutonomyCapability(
    createMockAdmin({ settings: enabledSettings, killSwitches: { autonomy_enabled: true, autonomy_outbound_enabled: false, autonomy_generation_enabled: true, autonomy_objective_mode_enabled: false } }) as never,
    {
      organizationId: "org-1",
      capability: "email_prepare",
      triggerSource: "autonomous",
      prepareContext: { confidenceScore: 95, senderProfileId: "sender-1", now: new Date("2026-06-23T12:00:00Z") },
    },
  )
  assert.equal(quietBlocked.blocked, true)
  assert.ok(isWithinChannelQuietHours(enabledSettings.channelPermissions.email.quiet_hours))
  console.log("  ✓ Quiet hours block prepare")

  const emergencyBlocked = await evaluateAutonomyCapability(
    createMockAdmin({ settings: enabledSettings, killSwitches: { autonomy_enabled: false, autonomy_outbound_enabled: false, autonomy_generation_enabled: true, autonomy_objective_mode_enabled: false } }) as never,
    {
      organizationId: "org-1",
      capability: "sms_prepare",
      triggerSource: "autonomous",
      prepareContext: { confidenceScore: 95, senderProfileId: "sender-1" },
    },
  )
  assert.equal(emergencyBlocked.blocked, true)
  console.log("  ✓ Emergency stop / autonomy kill switch blocks prepare")

  const outboundSend = await enforceGrowthAutonomyCapability(createMockAdmin({ settings: enabledSettings }) as never, {
    organizationId: "org-1",
    capability: "email_execution",
    runtimeContext: "cert",
    triggerSource: "autonomous",
  })
  assert.equal(outboundSend.blocked, true)
  console.log("  ✓ Outbound send execution remains blocked")

  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled, false)
  console.log("  ✓ GE-v1-5 safety flags keep send and auto-approval disabled")

  const actionsSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions.ts")
  assert.match(actionsSource, /prepareGeV15OutboundAction/)
  console.log("  ✓ GE-v1-5 prepare actions wired through autonomy gate")

  const settingsPanel = readSource("components/growth/autonomy/growth-autonomy-control-center.tsx")
  assert.match(settingsPanel, /Outreach controls/)
  assert.match(settingsPanel, /Send automatically/)
  assert.match(settingsPanel, /Enable shadow mode/)
  console.log("  ✓ Settings UI exposes channel prepare + send controls and shadow mode")

  const approvalPanel = readSource("components/growth/automation/ge-v1-5-automation-runtime-approval-panel.tsx")
  assert.match(approvalPanel, /Autonomy prepared/)
  assert.match(approvalPanel, /Confidence/)
  console.log("  ✓ Approval queue UX shows autonomy badge and confidence")

  const patchValidation = validateGrowthAutonomySettingsPatch({
    channelPermissions: {
      email: { enabled_for_prepare: true, max_prepared_per_day: 3 },
    },
  })
  assert.equal(patchValidation.ok, true)
  const merged = mergeGrowthAutonomyChannelPermissions(buildDefaultGrowthAutonomyChannelPermissions(), {
    email: { enabled_for_prepare: true, max_prepared_per_day: 3 },
  })
  assert.equal(merged.email.enabled_for_prepare, true)
  assert.equal(merged.email.max_prepared_per_day, 3)
  console.log("  ✓ Channel permissions patch + merge")

  const pricingConfidence = buildGeV15PrepareConfidenceInput({
    trigger: "question_asked",
    triggerPayload: { intent: "pricing" },
    leadScore: 70,
    intentScore: 80,
  })
  assert.equal(pricingConfidence.intentType, "pricing")
  console.log("  ✓ GE-v1-5 prepare confidence input builder")

  console.log("\nGE-AUTO-1C passed.\n")
}

void main()
