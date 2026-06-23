import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE,
  GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL,
  isAudienceAllowed,
  isGrowthAutonomyPrepareCapability,
  isSenderProfileAllowed,
  isSequenceAllowed,
  isWithinChannelQuietHours,
  normalizeGrowthAutonomyChannelPrepareConfig,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET,
  GROWTH_AUTONOMY_CAPABILITY_TO_CHANNEL,
  GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY,
  isCapabilityPermittedByMasterMode,
  isGrowthAutonomyGenerationCapability,
  isGrowthAutonomyOutboundCapability,
  isPrepareCapabilityPermittedByMasterMode,
  resolveEffectiveAutonomyApprovalPolicy,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import { getAutonomyBudgetSnapshot, getChannelPrepareBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyChannelKey,
  GrowthAutonomyChannelPolicyMetadata,
  GrowthAutonomyChannelPrepareConfig,
  GrowthAutonomyPolicyMetadata,
  GrowthAutonomyPolicyResult,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyPrepareContext,
  GrowthAutonomySettings,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_PHASE } from "@/lib/growth/autonomy/growth-autonomy-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

type AutonomyKillSwitchState = GrowthAutonomyPolicyMetadata["killSwitchState"]

type EvaluateInput = {
  organizationId: string
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
  triggerSource?: GrowthAutonomyTriggerSource
  enforcementRequested?: boolean
  prepareContext?: GrowthAutonomyPrepareContext
}

async function loadAutonomyKillSwitchState(admin: SupabaseClient): Promise<AutonomyKillSwitchState> {
  const states = await getRuntimeKillSwitchStates(admin)
  return {
    autonomyEnabled: Boolean(states.autonomy_enabled),
    autonomyOutboundEnabled: Boolean(states.autonomy_outbound_enabled),
    autonomyGenerationEnabled: Boolean(states.autonomy_generation_enabled),
    autonomyObjectiveModeEnabled: Boolean(states.autonomy_objective_mode_enabled),
  }
}

function resolveChannelPrepareConfig(
  settings: GrowthAutonomySettings,
  channel: GrowthAutonomyChannelKey,
): GrowthAutonomyChannelPrepareConfig {
  return normalizeGrowthAutonomyChannelPrepareConfig(settings.channelPermissions[channel])
}

async function evaluateAutonomyBudgetState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    settings: GrowthAutonomySettings
  },
): Promise<GrowthAutonomyPolicyMetadata["budgetState"]> {
  const budgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[input.capability]
  if (!budgetKey) {
    return { resourceType: null, cap: 0, remaining: 0, exceeded: false }
  }

  const configuredCap = input.settings.dailyBudgetLimits[budgetKey] ?? 0
  if (configuredCap <= 0) {
    return {
      resourceType: budgetKey,
      cap: configuredCap,
      remaining: 0,
      exceeded: true,
    }
  }

  const snapshot = await getAutonomyBudgetSnapshot(admin, {
    organizationId: input.organizationId,
    capability: input.capability,
  })

  if (!snapshot) {
    return { resourceType: budgetKey, cap: configuredCap, remaining: configuredCap, exceeded: false }
  }

  return {
    resourceType: budgetKey,
    cap: snapshot.cap,
    remaining: snapshot.remaining,
    exceeded: snapshot.exceeded,
  }
}

function buildResult(input: {
  settings: GrowthAutonomySettings
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
  killSwitchState: AutonomyKillSwitchState
  budgetState: GrowthAutonomyPolicyMetadata["budgetState"]
  channelPermission: GrowthAutonomyChannelPrepareConfig | null
  channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata | null
  allowed: boolean
  blocked: boolean
  requiresApproval: boolean
  reason: string | null
  triggerSource: GrowthAutonomyTriggerSource
  enforcementActive: boolean
}): GrowthAutonomyPolicyResult {
  const approvalPolicy =
    isGrowthAutonomyPrepareCapability(input.capability)
      ? GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
      : resolveEffectiveAutonomyApprovalPolicy(
          input.capability as GrowthAutonomyCapability,
          input.settings.approvalPolicies[input.capability as GrowthAutonomyCapability],
        )

  return {
    allowed: input.allowed,
    blocked: input.blocked,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    policyMetadata: {
      masterMode: input.settings.masterMode,
      capability: input.capability,
      capabilityEnabled: isGrowthAutonomyPrepareCapability(input.capability)
        ? Boolean(input.channelPermission?.enabled_for_prepare)
        : Boolean(input.settings.capabilityToggles[input.capability as GrowthAutonomyCapability]),
      approvalPolicy,
      killSwitchState: input.killSwitchState,
      budgetState: input.budgetState,
      channelPermission: input.channelPermission,
      channelPolicyMetadata: input.channelPolicyMetadata,
      phase: GROWTH_AUTONOMY_PHASE,
      enforcementActive: input.enforcementActive,
      triggerSource: input.triggerSource,
    },
  }
}

async function evaluatePrepareCapability(
  admin: SupabaseClient,
  input: EvaluateInput & { capability: GrowthAutonomyPrepareCapability },
): Promise<GrowthAutonomyPolicyResult> {
  const triggerSource = input.triggerSource ?? "autonomous"
  const enforcementActive = Boolean(input.enforcementRequested && triggerSource === "autonomous")
  const now = input.prepareContext?.now ?? new Date()
  const channel = GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL[input.capability]
  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const killSwitchState = await loadAutonomyKillSwitchState(admin)
  const channelPermission = resolveChannelPrepareConfig(settings, channel)
  const prepareBudget = await getChannelPrepareBudgetSnapshot(admin, {
    organizationId: input.organizationId,
    channel,
    maxPreparedPerDay: channelPermission.max_prepared_per_day,
  })

  const confidenceScore = input.prepareContext?.confidenceScore ?? null
  const confidenceMet =
    confidenceScore === null
      ? channelPermission.minimum_confidence_score <= 0
      : confidenceScore >= channelPermission.minimum_confidence_score

  const channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata = {
    channel,
    prepareEnabled: channelPermission.enabled_for_prepare,
    sendEnabled: channelPermission.enabled_for_send,
    quietHoursActive: isWithinChannelQuietHours(channelPermission.quiet_hours, now),
    confidenceMet,
    sendConfidenceMet: confidenceMet,
    senderAllowed: isSenderProfileAllowed(channelPermission, input.prepareContext?.senderProfileId),
    sequenceAllowed: isSequenceAllowed(channelPermission, input.prepareContext?.sequenceId),
    audienceAllowed: isAudienceAllowed(channelPermission, input.prepareContext?.audienceId),
    outboundSendBlocked: !killSwitchState.autonomyOutboundEnabled,
    shadowModeActive: settings.outboundControls.shadowModeEnabled,
    maxPreparedPerDay: channelPermission.max_prepared_per_day,
    preparedToday: prepareBudget.consumed,
    maxSendsPerDay: channelPermission.max_sends_per_day,
    sentToday: 0,
    minimumConfidenceScore: channelPermission.minimum_confidence_score,
    minimumSendConfidence: channelPermission.minimum_send_confidence,
    confidenceScore,
  }

  const budgetState = {
    resourceType: GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE[channel],
    cap: prepareBudget.cap,
    remaining: prepareBudget.remaining,
    exceeded: prepareBudget.exceeded,
  }

  const baseBlocked = (reason: string) =>
    buildResult({
      settings,
      capability: input.capability,
      killSwitchState,
      budgetState,
      channelPermission,
      channelPolicyMetadata,
      allowed: false,
      blocked: true,
      requiresApproval: true,
      reason,
      triggerSource,
      enforcementActive,
    })

  if (triggerSource === "operator") {
    return buildResult({
      settings,
      capability: input.capability,
      killSwitchState,
      budgetState,
      channelPermission,
      channelPolicyMetadata,
      allowed: true,
      blocked: false,
      requiresApproval: true,
      reason: null,
      triggerSource,
      enforcementActive: false,
    })
  }

  if (!killSwitchState.autonomyEnabled) {
    return baseBlocked("Autonomy disabled by platform kill switch.")
  }

  if (settings.masterMode === "objective" && !killSwitchState.autonomyObjectiveModeEnabled) {
    return baseBlocked("Objective mode requires autonomy_objective_mode_enabled kill switch.")
  }

  if (settings.masterMode === "manual") {
    return baseBlocked("Manual mode — channel prepare requires a higher autonomy level.")
  }

  if (!isPrepareCapabilityPermittedByMasterMode(settings.masterMode)) {
    return baseBlocked(`Channel prepare not permitted at ${settings.masterMode} autonomy level.`)
  }

  if (!channelPermission.enabled_for_prepare) {
    return baseBlocked(`${channel} prepare is disabled for this organization.`)
  }

  if (channelPermission.max_prepared_per_day <= 0) {
    return baseBlocked(`${channel} daily prepare limit is zero.`)
  }

  if (prepareBudget.exceeded) {
    return baseBlocked(`${channel} daily prepare budget exceeded.`)
  }

  if (channelPolicyMetadata.quietHoursActive) {
    return baseBlocked(`${channel} prepare blocked during quiet hours.`)
  }

  if (!confidenceMet) {
    return baseBlocked(
      `Confidence score ${confidenceScore ?? 0} below minimum ${channelPermission.minimum_confidence_score}.`,
    )
  }

  if (!channelPolicyMetadata.senderAllowed) {
    return baseBlocked("Sender profile not allowed for channel prepare.")
  }

  if (!channelPolicyMetadata.sequenceAllowed) {
    return baseBlocked("Sequence not allowed for channel prepare.")
  }

  if (!channelPolicyMetadata.audienceAllowed) {
    return baseBlocked("Audience not allowed for channel prepare.")
  }

  return buildResult({
    settings,
    capability: input.capability,
    killSwitchState,
    budgetState,
    channelPermission,
    channelPolicyMetadata,
    allowed: true,
    blocked: false,
    requiresApproval: true,
    reason: null,
    triggerSource,
    enforcementActive,
  })
}

/**
 * Pure autonomy policy evaluation — no side effects, no execution.
 * GE-AUTO-1E: channel prepare allowed when configured; outbound send via evaluateAutonomyOutboundSendPolicy.
 */
export async function evaluateAutonomyCapability(
  admin: SupabaseClient,
  input: EvaluateInput,
): Promise<GrowthAutonomyPolicyResult> {
  if (isGrowthAutonomyPrepareCapability(input.capability)) {
    return evaluatePrepareCapability(admin, {
      ...input,
      capability: input.capability,
    })
  }

  const triggerSource = input.triggerSource ?? "autonomous"
  const enforcementActive = Boolean(input.enforcementRequested && triggerSource === "autonomous")

  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const killSwitchState = await loadAutonomyKillSwitchState(admin)
  const budgetState = await evaluateAutonomyBudgetState(admin, {
    organizationId: input.organizationId,
    capability: input.capability,
    settings,
  })
  const channelKey = GROWTH_AUTONOMY_CAPABILITY_TO_CHANNEL[input.capability]
  const channelPermission = channelKey ? resolveChannelPrepareConfig(settings, channelKey) : null

  const baseBlocked = (reason: string, requiresApproval = true) =>
    buildResult({
      settings,
      capability: input.capability,
      killSwitchState,
      budgetState,
      channelPermission,
      channelPolicyMetadata: null,
      allowed: false,
      blocked: true,
      requiresApproval,
      reason,
      triggerSource,
      enforcementActive,
    })

  if (triggerSource === "operator") {
    return buildResult({
      settings,
      capability: input.capability,
      killSwitchState,
      budgetState,
      channelPermission,
      channelPolicyMetadata: null,
      allowed: true,
      blocked: false,
      requiresApproval: true,
      reason: null,
      triggerSource,
      enforcementActive: false,
    })
  }

  if (!killSwitchState.autonomyEnabled) {
    return baseBlocked("Autonomy disabled by platform kill switch.")
  }

  if (settings.masterMode === "objective" && !killSwitchState.autonomyObjectiveModeEnabled) {
    return baseBlocked("Objective mode requires autonomy_objective_mode_enabled kill switch.")
  }

  if (input.capability === "campaign_launch") {
    if (settings.masterMode !== "objective") {
      return baseBlocked("Campaign launch autonomy requires objective mode.", true)
    }
  } else if (isGrowthAutonomyOutboundCapability(input.capability)) {
    return baseBlocked(
      "Outbound send requires send context — use evaluateAutonomyOutboundSendPolicy.",
      true,
    )
  }

  if (input.capability === "strategy_adaptation") {
    if (!killSwitchState.autonomyObjectiveModeEnabled) {
      return baseBlocked("Strategy adaptation requires objective mode kill switch.", true)
    }
    if (settings.masterMode !== "objective") {
      return baseBlocked("Strategy adaptation requires objective autonomy level.", true)
    }
  }

  if (isGrowthAutonomyGenerationCapability(input.capability) && !killSwitchState.autonomyGenerationEnabled) {
    return baseBlocked("Autonomous generation disabled by platform kill switch.")
  }

  if (settings.masterMode === "manual") {
    return baseBlocked("Manual mode — autonomous execution requires a higher autonomy level.")
  }

  if (!isCapabilityPermittedByMasterMode(settings.masterMode, input.capability)) {
    return baseBlocked(`Capability not permitted at ${settings.masterMode} autonomy level.`)
  }

  if (!Boolean(settings.capabilityToggles[input.capability])) {
    return baseBlocked("Capability toggle is off.")
  }

  if (budgetState.exceeded) {
    return baseBlocked("Autonomy daily budget exceeded or disabled.")
  }

  if (settings.masterMode === "channel" && isGrowthAutonomyOutboundCapability(input.capability)) {
    if (!channelPermission?.enabled_for_prepare) {
      return baseBlocked(`Channel ${channelKey ?? "unknown"} prepare not enabled.`)
    }
  }

  return buildResult({
    settings,
    capability: input.capability,
    killSwitchState,
    budgetState,
    channelPermission,
    channelPolicyMetadata: null,
    allowed: true,
    blocked: false,
    requiresApproval: true,
    reason: null,
    triggerSource,
    enforcementActive,
  })
}

export const GrowthAutonomyPolicyService = {
  evaluateAutonomyCapability,
} as const
