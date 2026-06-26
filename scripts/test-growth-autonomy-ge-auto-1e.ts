/**
 * GE-AUTO-1E — Confidence-gated autonomous sending certification.
 * Run: pnpm test:growth-autonomy-ge-auto-1e
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildDefaultGrowthAutonomyChannelPrepareConfig,
  normalizeGrowthAutonomyChannelPrepareConfig,
} from "../lib/growth/autonomy/growth-autonomy-channel-prepare"
import { buildDefaultGrowthAutonomySettings } from "../lib/growth/autonomy/growth-autonomy-config"
import {
  evaluateAutonomyOutboundSendPolicy,
} from "../lib/growth/autonomy/growth-autonomy-outbound-send-policy"
import {
  GROWTH_AUTONOMY_DEFAULT_MIN_SEND_CONFIDENCE,
  GROWTH_AUTONOMY_QA_MARKER,
} from "../lib/growth/autonomy/growth-autonomy-types"
import {
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
} from "../lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

type MockQueryBuilder = {
  select: (...args: unknown[]) => MockQueryBuilder
  eq: (...args: unknown[]) => MockQueryBuilder
  in: (...args: unknown[]) => MockQueryBuilder
  maybeSingle: () => Promise<{ data: unknown; error: null }>
  then: Promise<{ data: unknown; error: null }>["then"]
  limit: () => Promise<{ data: unknown; error: null }>
}

function createMockQuery(resolve: () => { data: unknown; error: null }): MockQueryBuilder {
  const result = () => Promise.resolve(resolve())
  const builder: MockQueryBuilder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    maybeSingle: result as MockQueryBuilder["maybeSingle"],
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
      autonomy_outbound_enabled: true,
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
    channel_permissions: { ...settings.channelPermissions, _outbound: settings.outboundControls },
    daily_budget_limits: settings.dailyBudgetLimits,
  }

  return {
    schema: () => ({
      from: (table: string) => {
        if (table === "organization_autonomy_settings") {
          return createMockQuery(() => ({ data: settingsRow, error: null }))
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

async function main() {
  console.log("\nGE-AUTO-1E certification\n")

  assert.equal(GROWTH_AUTONOMY_QA_MARKER, "growth-autonomy-ge-auto-1f-v1")
  assert.equal(GROWTH_AUTONOMY_DEFAULT_MIN_SEND_CONFIDENCE, 90)
  console.log("  ✓ QA marker and default min send confidence")

  const defaults = buildDefaultGrowthAutonomyChannelPrepareConfig()
  assert.equal(defaults.enabled_for_send, false)
  assert.equal(defaults.max_sends_per_day, 0)
  assert.equal(defaults.minimum_send_confidence, 90)
  console.log("  ✓ Channel send config defaults off")

  const normalized = normalizeGrowthAutonomyChannelPrepareConfig({
    enabled_for_send: true,
    max_sends_per_day: 12,
    minimum_send_confidence: 92,
  })
  assert.equal(normalized.enabled_for_send, true)
  assert.equal(normalized.max_sends_per_day, 12)
  console.log("  ✓ Channel send config normalization")

  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.autonomous_approval_enabled, false)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.policy_gated_autonomous_send_enabled, true)
  assert.equal(GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled, false)
  console.log("  ✓ Safety flags: policy-gated send on, auto-approval off, compile-time outbound off")

  const outboundPolicy = readSource("lib/growth/autonomy/growth-autonomy-outbound-send-policy.ts")
  const outboundEvaluation = readSource("lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service.ts")
  assert.match(outboundPolicy, /evaluateAutonomyOutboundSendPolicyFromPolicyEngine/)
  assert.match(outboundEvaluation, /shadow_would_send/)
  assert.match(outboundEvaluation, /approval_queue/)
  console.log("  ✓ Outbound send policy evaluator with shadow + queue paths")

  const autonomousSend = readSource(
    "lib/growth/automation-runtime/ge-v1-5-automation-runtime-autonomous-send.ts",
  )
  assert.match(autonomousSend, /maybeAutonomousSendGeV15PreparedAction/)
  assert.match(autonomousSend, /evaluateGeV15PrepareSuppression/)
  assert.match(autonomousSend, /logGrowthAutonomyOutboundSendDecision/)
  console.log("  ✓ Autonomous send orchestration with suppression + audit")

  const actionsSource = readSource("lib/growth/automation-runtime/ge-v1-5-automation-runtime-actions.ts")
  assert.match(actionsSource, /maybeAutonomousSendGeV15PreparedAction/)
  console.log("  ✓ Prepare flow wired to autonomous send attempt")

  const enabledSettings = buildDefaultGrowthAutonomySettings("org-1")
  enabledSettings.masterMode = "channel"
  enabledSettings.capabilityToggles.email_execution = true
  enabledSettings.dailyBudgetLimits.autonomous_outbound_actions = 50
  enabledSettings.channelPermissions.email = {
    ...buildDefaultGrowthAutonomyChannelPrepareConfig(),
    enabled_for_prepare: true,
    enabled_for_send: true,
    max_prepared_per_day: 5,
    max_sends_per_day: 5,
    minimum_confidence_score: 80,
    minimum_send_confidence: 90,
    allowed_sender_profiles: ["sender-1"],
  }

  const highConfidence = await evaluateAutonomyOutboundSendPolicy(createMockAdmin({ settings: enabledSettings }) as never, {
    organizationId: "org-1",
    channel: "email",
    sendContext: {
      senderProfileId: "sender-1",
      confidenceScore: 96,
      leadId: "lead-1",
    },
  })
  assert.equal(highConfidence.decision, "autonomous_send")
  assert.equal(highConfidence.allowed, true)
  console.log("  ✓ High confidence qualifies for autonomous send")

  const lowConfidence = await evaluateAutonomyOutboundSendPolicy(createMockAdmin({ settings: enabledSettings }) as never, {
    organizationId: "org-1",
    channel: "email",
    sendContext: {
      senderProfileId: "sender-1",
      confidenceScore: 70,
      leadId: "lead-1",
    },
  })
  assert.equal(lowConfidence.decision, "approval_queue")
  console.log("  ✓ Low confidence routes to approval queue")

  enabledSettings.outboundControls.shadowModeEnabled = true
  const shadow = await evaluateAutonomyOutboundSendPolicy(createMockAdmin({ settings: enabledSettings }) as never, {
    organizationId: "org-1",
    channel: "email",
    sendContext: {
      senderProfileId: "sender-1",
      confidenceScore: 96,
      leadId: "lead-1",
    },
  })
  assert.equal(shadow.decision, "shadow_would_send")
  console.log("  ✓ Shadow mode logs would-send without transport")

  enabledSettings.outboundControls.shadowModeEnabled = false
  const emergency = await evaluateAutonomyOutboundSendPolicy(
    createMockAdmin({
      settings: enabledSettings,
      killSwitches: {
        autonomy_enabled: false,
        autonomy_outbound_enabled: true,
        autonomy_generation_enabled: true,
        autonomy_objective_mode_enabled: false,
      },
    }) as never,
    {
      organizationId: "org-1",
      channel: "email",
      sendContext: { senderProfileId: "sender-1", confidenceScore: 96 },
    },
  )
  assert.equal(emergency.decision, "approval_queue")
  assert.match(emergency.reason ?? "", /emergency stop/i)
  console.log("  ✓ Emergency stop blocks autonomous send")

  assert.ok(fs.existsSync(path.join(process.cwd(), "lib/growth/autonomy/growth-autonomy-outbound-dashboard.ts")))
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/growth/autonomy/growth-autonomy-outbound-dashboard-panel.tsx")))
  console.log("  ✓ Outbound dashboard module + panel present")

  console.log("\nGE-AUTO-1E passed.\n")
}

void main()
