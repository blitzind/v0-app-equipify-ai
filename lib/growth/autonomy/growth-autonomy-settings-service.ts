import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_AUTONOMY_APPROVAL_POLICY_LABELS,
  GROWTH_AUTONOMY_BUDGET_LABELS,
  GROWTH_AUTONOMY_CAPABILITY_LABELS,
  GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS,
  GROWTH_AUTONOMY_EDITABLE_CAPABILITIES,
  GROWTH_AUTONOMY_LOCKED_OUTBOUND_CAPABILITIES,
  GROWTH_AUTONOMY_MASTER_MODE_DESCRIPTIONS,
  GROWTH_AUTONOMY_MASTER_MODE_LABELS,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import { logGrowthAutonomySettingsChange } from "@/lib/growth/autonomy/growth-autonomy-policy-logger"
import {
  fetchGrowthAutonomySettings,
  upsertGrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import {
  mergeGrowthAutonomyCapabilityToggles,
  mergeGrowthAutonomyChannelPermissions,
  mergeGrowthAutonomyDailyBudgetLimits,
  type GrowthAutonomySettingsPatchInput,
} from "@/lib/growth/autonomy/growth-autonomy-settings-patch"
import {
  GROWTH_AUTONOMY_CHANNEL_KEYS,
  GROWTH_AUTONOMY_CHANNEL_LABELS,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  GROWTH_AUTONOMY_APPROVAL_POLICIES,
  GROWTH_AUTONOMY_BUDGET_KEYS,
  GROWTH_AUTONOMY_CAPABILITIES,
  GROWTH_AUTONOMY_MASTER_MODES,
  GROWTH_AUTONOMY_QA_MARKER,
  type GrowthAutonomyCapability,
  type GrowthAutonomySettingsSnapshot,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import type { GrowthAiOsAutonomyPolicyIntegrationSummary } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  buildAutonomyPolicyIntegrationSummary,
  deriveExecutionPilotControlFromPolicy,
  deriveOutreachPreparationPilotControlFromPolicy,
  deriveMeetingPilotControlFromPolicy,
  derivePlanningPilotControlFromPolicy,
  deriveQualificationPilotControlFromPolicy,
  deriveResearchPilotControlFromPolicy,
} from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-synthesizer"
import {
  getAutonomousOutreachPreparationPilotOrgState,
  setAutonomousOutreachPreparationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import {
  getAutonomousMeetingPilotOrgState,
  setAutonomousMeetingPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-store"
import {
  getAutonomousExecutionPilotOrgState,
  setAutonomousExecutionPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-store"
import {
  getAutonomousPlanningPilotOrgState,
  setAutonomousPlanningPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-store"
import {
  getAutonomousQualificationPilotOrgState,
  setAutonomousQualificationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-store"
import {
  getAutonomousResearchPilotOrgState,
  setAutonomousResearchPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-store"
import {
  getRuntimeKillSwitchStates,
  setRuntimeKillSwitch,
} from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export type GrowthAutonomyStatusSummary = {
  masterMode: GrowthAutonomySettingsSnapshot["masterMode"]
  masterModeLabel: string
  autonomyPaused: boolean
  outboundLocked: boolean
  shadowModeEnabled: boolean
  prepareEnabled: boolean
  sendEnabled: boolean
  emergencyStopAvailable: true
  enabledCapabilities: string[]
  remainingBudgets: Array<{
    id: string
    label: string
    cap: number
    remaining: number
    exceeded: boolean
  }>
}

export type GrowthAutonomySettingsViewModel = {
  qaMarker: typeof GROWTH_AUTONOMY_QA_MARKER
  readOnly: false
  settings: GrowthAutonomySettingsSnapshot
  status: GrowthAutonomyStatusSummary
  masterModes: Array<{
    id: (typeof GROWTH_AUTONOMY_MASTER_MODES)[number]
    label: string
    description: string
    active: boolean
  }>
  capabilities: Array<{
    id: GrowthAutonomyCapability
    label: string
    enabled: boolean
    editable: boolean
    locked: boolean
    lockReason: string | null
    approvalPolicy: (typeof GROWTH_AUTONOMY_APPROVAL_POLICIES)[number]
    approvalPolicyLabel: string
  }>
  budgets: Array<{
    id: (typeof GROWTH_AUTONOMY_BUDGET_KEYS)[number]
    label: string
    dailyLimit: number
    remaining: number
    editable: boolean
    locked: boolean
  }>
  killSwitches: Array<{
    id: keyof GrowthAutonomySettingsSnapshot["killSwitches"]
    label: string
    enabled: boolean
    editable: boolean
    locked: boolean
  }>
  channels: Array<{
    id: "email" | "sms" | "voice"
    label: string
    prepareEnabled: boolean
    sendEnabled: boolean
    maxPreparedPerDay: number
    maxSendsPerDay: number
    minimumConfidenceScore: number
    minimumSendConfidence: number
    quietHoursEnabled: boolean
    quietHoursStartUtc: number
    quietHoursEndUtc: number
    allowedSenderProfiles: string
    allowedSequences: string
    allowedAudiences: string
    sendingLocked: boolean
  }>
  outboundControls: {
    shadowModeEnabled: boolean
  }
  notice: string
  aiOsIntegration: GrowthAiOsAutonomyPolicyIntegrationSummary
}

async function buildStatusSummary(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: GrowthAutonomySettingsSnapshot,
): Promise<GrowthAutonomyStatusSummary> {
  const enabledCapabilities = GROWTH_AUTONOMY_EDITABLE_CAPABILITIES.filter(
    (capability) => snapshot.capabilityToggles[capability],
  ).map((capability) => GROWTH_AUTONOMY_CAPABILITY_LABELS[capability])

  const remainingBudgets = []
  for (const key of GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS) {
    const cap = snapshot.dailyBudgetLimits[key] ?? 0
    const budgetSnapshot = await getAutonomyBudgetSnapshot(admin, {
      organizationId,
      capability:
        key === "autonomous_research_runs" ? "research"
        : key === "autonomous_page_generations" ? "page_generation"
        : key === "autonomous_video_generations" ? "video_generation"
        : "campaign_launch",
    })
    remainingBudgets.push({
      id: key,
      label: GROWTH_AUTONOMY_BUDGET_LABELS[key],
      cap,
      remaining: budgetSnapshot?.remaining ?? 0,
      exceeded: budgetSnapshot?.exceeded ?? cap <= 0,
    })
  }

  return {
    masterMode: snapshot.masterMode,
    masterModeLabel: GROWTH_AUTONOMY_MASTER_MODE_LABELS[snapshot.masterMode],
    autonomyPaused: !snapshot.killSwitches.autonomyEnabled,
    outboundLocked: !snapshot.killSwitches.autonomyOutboundEnabled,
    shadowModeEnabled: snapshot.outboundControls.shadowModeEnabled,
    prepareEnabled: GROWTH_AUTONOMY_CHANNEL_KEYS.some(
      (channel) => snapshot.channelPermissions[channel]?.enabled_for_prepare,
    ),
    sendEnabled: GROWTH_AUTONOMY_CHANNEL_KEYS.some(
      (channel) => snapshot.channelPermissions[channel]?.enabled_for_send,
    ),
    emergencyStopAvailable: true,
    enabledCapabilities,
    remainingBudgets,
  }
}

async function syncAutonomousPlanningPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = getAutonomousPlanningPilotOrgState(organizationId, generatedAt)
  const nextControlState = derivePlanningPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    setAutonomousPlanningPilotControlState({
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

async function syncAutonomousExecutionPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = getAutonomousExecutionPilotOrgState(organizationId, generatedAt)
  const nextControlState = deriveExecutionPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    setAutonomousExecutionPilotControlState({
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

async function syncAutonomousOutreachPreparationPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = await getAutonomousOutreachPreparationPilotOrgState(admin, organizationId, generatedAt)
  const nextControlState = deriveOutreachPreparationPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    await setAutonomousOutreachPreparationPilotControlState({
      admin,
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

async function syncAutonomousMeetingPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = getAutonomousMeetingPilotOrgState(organizationId, generatedAt)
  const nextControlState = deriveMeetingPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    setAutonomousMeetingPilotControlState({
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

async function syncAutonomousQualificationPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = getAutonomousQualificationPilotOrgState(organizationId, generatedAt)
  const nextControlState = deriveQualificationPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    setAutonomousQualificationPilotControlState({
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

async function syncAutonomousResearchPilotFromPolicy(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const generatedAt = new Date().toISOString()
  const policy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId, generatedAt })
  const orgState = getAutonomousResearchPilotOrgState(organizationId, generatedAt)
  const nextControlState = deriveResearchPilotControlFromPolicy(policy, orgState.controlState)
  if (nextControlState !== orgState.controlState) {
    setAutonomousResearchPilotControlState({
      organizationId,
      controlState: nextControlState,
      now: generatedAt,
    })
  }
}

export async function loadGrowthAutonomySettingsViewModel(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAutonomySettingsViewModel> {
  const settings = await fetchGrowthAutonomySettings(admin, organizationId)
  const killSwitchStates = await getRuntimeKillSwitchStates(admin)

  const snapshot: GrowthAutonomySettingsSnapshot = {
    ...settings,
    killSwitches: {
      autonomyEnabled: Boolean(killSwitchStates.autonomy_enabled),
      autonomyOutboundEnabled: Boolean(killSwitchStates.autonomy_outbound_enabled),
      autonomyGenerationEnabled: Boolean(killSwitchStates.autonomy_generation_enabled),
      autonomyObjectiveModeEnabled: Boolean(killSwitchStates.autonomy_objective_mode_enabled),
    },
  }

  const status = await buildStatusSummary(admin, organizationId, snapshot)
  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, { organizationId })

  return {
    qaMarker: GROWTH_AUTONOMY_QA_MARKER,
    readOnly: false,
    settings: snapshot,
    status,
    masterModes: GROWTH_AUTONOMY_MASTER_MODES.map((mode) => ({
      id: mode,
      label: GROWTH_AUTONOMY_MASTER_MODE_LABELS[mode],
      description: GROWTH_AUTONOMY_MASTER_MODE_DESCRIPTIONS[mode],
      active: settings.masterMode === mode,
    })),
    capabilities: GROWTH_AUTONOMY_CAPABILITIES.map((capability) => {
      const locked = (GROWTH_AUTONOMY_LOCKED_OUTBOUND_CAPABILITIES as readonly string[]).includes(capability)
      return {
        id: capability,
        label: GROWTH_AUTONOMY_CAPABILITY_LABELS[capability],
        enabled: Boolean(settings.capabilityToggles[capability]),
        editable: (GROWTH_AUTONOMY_EDITABLE_CAPABILITIES as readonly string[]).includes(capability),
        locked,
        lockReason: locked ? null : null,
        approvalPolicy: settings.approvalPolicies[capability] ?? "always_require_approval",
        approvalPolicyLabel:
          GROWTH_AUTONOMY_APPROVAL_POLICY_LABELS[
            settings.approvalPolicies[capability] ?? "always_require_approval"
          ],
      }
    }),
    budgets: GROWTH_AUTONOMY_BUDGET_KEYS.map((key) => {
      const remaining = status.remainingBudgets.find((entry) => entry.id === key)
      const locked = false
      return {
        id: key,
        label: GROWTH_AUTONOMY_BUDGET_LABELS[key],
        dailyLimit: settings.dailyBudgetLimits[key] ?? 0,
        remaining: remaining?.remaining ?? 0,
        editable: (GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS as readonly string[]).includes(key),
        locked,
      }
    }),
    killSwitches: [
      {
        id: "autonomyEnabled",
        label: "Autonomy enabled",
        enabled: snapshot.killSwitches.autonomyEnabled,
        editable: true,
        locked: false,
      },
      {
        id: "autonomyOutboundEnabled",
        label: "Master outbound autonomy",
        enabled: snapshot.killSwitches.autonomyOutboundEnabled,
        editable: true,
        locked: false,
      },
      {
        id: "autonomyGenerationEnabled",
        label: "Autonomous generation enabled",
        enabled: snapshot.killSwitches.autonomyGenerationEnabled,
        editable: true,
        locked: false,
      },
      {
        id: "autonomyObjectiveModeEnabled",
        label: "Objective mode enabled",
        enabled: snapshot.killSwitches.autonomyObjectiveModeEnabled,
        editable: true,
        locked: false,
      },
    ],
    channels: GROWTH_AUTONOMY_CHANNEL_KEYS.map((channel) => {
      const config = settings.channelPermissions[channel]
      return {
        id: channel,
        label: GROWTH_AUTONOMY_CHANNEL_LABELS[channel],
        prepareEnabled: Boolean(config?.enabled_for_prepare),
        sendEnabled: Boolean(config?.enabled_for_send),
        maxPreparedPerDay: config?.max_prepared_per_day ?? 0,
        maxSendsPerDay: config?.max_sends_per_day ?? 0,
        minimumConfidenceScore: config?.minimum_confidence_score ?? 0,
        minimumSendConfidence: config?.minimum_send_confidence ?? 90,
        quietHoursEnabled: Boolean(config?.quiet_hours.enabled),
        quietHoursStartUtc: config?.quiet_hours.startHourUtc ?? 22,
        quietHoursEndUtc: config?.quiet_hours.endHourUtc ?? 13,
        allowedSenderProfiles: (config?.allowed_sender_profiles ?? []).join(", "),
        allowedSequences: (config?.allowed_sequences ?? []).join(", "),
        allowedAudiences: (config?.allowed_audiences ?? []).join(", "),
        sendingLocked: !snapshot.killSwitches.autonomyOutboundEnabled,
      }
    }),
    outboundControls: {
      shadowModeEnabled: settings.outboundControls.shadowModeEnabled,
    },
    notice:
      "GE-AUTO-1E: Outbound send is opt-in, confidence-gated, and instantly reversible. Autonomous approval remains disabled.",
    aiOsIntegration: buildAutonomyPolicyIntegrationSummary(autonomyPolicy),
  }
}

export async function patchGrowthAutonomySettings(
  admin: SupabaseClient,
  input: {
    organizationId: string
    actorUserId: string
    actorEmail: string
    patch: GrowthAutonomySettingsPatchInput
  },
): Promise<GrowthAutonomySettingsViewModel> {
  const current = await fetchGrowthAutonomySettings(admin, input.organizationId)

  if (input.patch.emergencyStop) {
    await setRuntimeKillSwitch(admin, { key: "autonomy_enabled", enabled: false })
    await logGrowthAutonomySettingsChange(admin, {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      patch: input.patch as Record<string, unknown>,
      emergencyStop: true,
    })
    await syncAutonomousResearchPilotFromPolicy(admin, input.organizationId)
    await syncAutonomousQualificationPilotFromPolicy(admin, input.organizationId)
    await syncAutonomousPlanningPilotFromPolicy(admin, input.organizationId)
    await syncAutonomousExecutionPilotFromPolicy(admin, input.organizationId)
    await syncAutonomousOutreachPreparationPilotFromPolicy(admin, input.organizationId)
    await syncAutonomousMeetingPilotFromPolicy(admin, input.organizationId)
    return loadGrowthAutonomySettingsViewModel(admin, input.organizationId)
  }

  if (input.patch.killSwitches?.autonomyEnabled !== undefined) {
    await setRuntimeKillSwitch(admin, {
      key: "autonomy_enabled",
      enabled: input.patch.killSwitches.autonomyEnabled,
    })
  }

  if (input.patch.killSwitches?.autonomyGenerationEnabled !== undefined) {
    await setRuntimeKillSwitch(admin, {
      key: "autonomy_generation_enabled",
      enabled: input.patch.killSwitches.autonomyGenerationEnabled,
    })
  }

  if (input.patch.killSwitches?.autonomyOutboundEnabled !== undefined) {
    await setRuntimeKillSwitch(admin, {
      key: "autonomy_outbound_enabled",
      enabled: input.patch.killSwitches.autonomyOutboundEnabled,
    })
  }

  if (input.patch.killSwitches?.autonomyObjectiveModeEnabled !== undefined) {
    await setRuntimeKillSwitch(admin, {
      key: "autonomy_objective_mode_enabled",
      enabled: input.patch.killSwitches.autonomyObjectiveModeEnabled,
    })
  }

  if (
    input.patch.masterMode !== undefined ||
    input.patch.capabilityToggles !== undefined ||
    input.patch.channelPermissions !== undefined ||
    input.patch.dailyBudgetLimits !== undefined ||
    input.patch.outboundControls !== undefined
  ) {
    await upsertGrowthAutonomySettings(admin, input.organizationId, {
      masterMode: input.patch.masterMode,
      capabilityToggles: mergeGrowthAutonomyCapabilityToggles(
        current.capabilityToggles,
        input.patch.capabilityToggles,
      ),
      channelPermissions: mergeGrowthAutonomyChannelPermissions(
        current.channelPermissions,
        input.patch.channelPermissions,
      ),
      dailyBudgetLimits: mergeGrowthAutonomyDailyBudgetLimits(
        current.dailyBudgetLimits,
        input.patch.dailyBudgetLimits,
      ),
      outboundControls: {
        ...current.outboundControls,
        ...input.patch.outboundControls,
      },
    })
  }

  await logGrowthAutonomySettingsChange(admin, {
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
    patch: input.patch as Record<string, unknown>,
  })

  await syncAutonomousResearchPilotFromPolicy(admin, input.organizationId)
  await syncAutonomousQualificationPilotFromPolicy(admin, input.organizationId)
  await syncAutonomousPlanningPilotFromPolicy(admin, input.organizationId)
  await syncAutonomousExecutionPilotFromPolicy(admin, input.organizationId)
  await syncAutonomousOutreachPreparationPilotFromPolicy(admin, input.organizationId)
  await syncAutonomousMeetingPilotFromPolicy(admin, input.organizationId)

  return loadGrowthAutonomySettingsViewModel(admin, input.organizationId)
}
