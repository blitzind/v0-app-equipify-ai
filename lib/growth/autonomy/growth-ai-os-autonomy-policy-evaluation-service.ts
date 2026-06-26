/** GE-AIOS-CONSOLIDATION-1E — Canonical capability evaluation via Autonomy Policy Engine (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTONOMY_CHANNEL_PREPARE_BUDGET_RESOURCE,
  GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE,
  GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY,
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
import { getChannelPrepareBudgetSnapshot, getChannelSendBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import { fetchGrowthAiOsAutonomyPolicyEvaluationContext } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import type { GrowthAiOsAutonomyPolicyEvaluationContext, GrowthAiOsAutonomyPolicyReadModel } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-types"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyChannelKey,
  GrowthAutonomyChannelPolicyMetadata,
  GrowthAutonomyChannelPrepareConfig,
  GrowthAutonomyOutboundCapability,
  GrowthAutonomyPolicyMetadata,
  GrowthAutonomyPolicyResult,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyPrepareContext,
  GrowthAutonomySendContext,
  GrowthAutonomySendDecision,
  GrowthAutonomySettings,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_PHASE } from "@/lib/growth/autonomy/growth-autonomy-types"

export const GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER = "growth-autonomy-ge-auto-1f-v1" as const

export type GrowthAutonomyOutboundSendEvaluation = {
  decision: GrowthAutonomySendDecision
  allowed: boolean
  requiresApproval: boolean
  reason: string | null
  humanReadableSummary: string | null
  policyResult: GrowthAutonomyPolicyResult
}

type EvaluateCapabilityInput = {
  organizationId: string
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
  triggerSource?: GrowthAutonomyTriggerSource
  enforcementRequested?: boolean
  prepareContext?: GrowthAutonomyPrepareContext
}

type AutonomyKillSwitchState = GrowthAutonomyPolicyMetadata["killSwitchState"]

function killSwitchStateFromContext(context: GrowthAiOsAutonomyPolicyEvaluationContext): AutonomyKillSwitchState {
  const kill = context.settings.killSwitches
  return {
    autonomyEnabled: kill.autonomyEnabled,
    autonomyOutboundEnabled: kill.autonomyOutboundEnabled,
    autonomyGenerationEnabled: kill.autonomyGenerationEnabled,
    autonomyObjectiveModeEnabled: kill.autonomyObjectiveModeEnabled,
  }
}

function settingsFromContext(context: GrowthAiOsAutonomyPolicyEvaluationContext): GrowthAutonomySettings {
  const { settings } = context
  return settings
}

function resolveChannelPrepareConfig(
  settings: GrowthAutonomySettings,
  channel: GrowthAutonomyChannelKey,
): GrowthAutonomyChannelPrepareConfig {
  return normalizeGrowthAutonomyChannelPrepareConfig(settings.channelPermissions[channel])
}

function budgetStateFromPolicy(
  policy: GrowthAiOsAutonomyPolicyReadModel,
  capability: GrowthAutonomyCapability,
  settings: GrowthAutonomySettings,
): GrowthAutonomyPolicyMetadata["budgetState"] {
  const budgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[capability]
  if (!budgetKey) {
    return { resourceType: null, cap: 0, remaining: 0, exceeded: false }
  }

  const snapshot = policy.dailyBudgets.find((row) => row.resourceKey === budgetKey)
  const configuredCap = settings.dailyBudgetLimits[budgetKey] ?? 0

  if (!snapshot) {
    if (configuredCap <= 0) {
      return { resourceType: budgetKey, cap: configuredCap, remaining: 0, exceeded: true }
    }
    return { resourceType: budgetKey, cap: configuredCap, remaining: configuredCap, exceeded: false }
  }

  return {
    resourceType: budgetKey,
    cap: snapshot.dailyCap,
    remaining: snapshot.remaining,
    exceeded: snapshot.exceeded,
  }
}

function buildResult(input: {
  context: GrowthAiOsAutonomyPolicyEvaluationContext
  capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
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
  const settings = settingsFromContext(input.context)
  const killSwitchState = killSwitchStateFromContext(input.context)
  const approvalPolicy =
    isGrowthAutonomyPrepareCapability(input.capability)
      ? GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY
      : resolveEffectiveAutonomyApprovalPolicy(
          input.capability as GrowthAutonomyCapability,
          settings.approvalPolicies[input.capability as GrowthAutonomyCapability],
        )

  return {
    allowed: input.allowed,
    blocked: input.blocked,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    policyMetadata: {
      masterMode: settings.masterMode,
      capability: input.capability,
      capabilityEnabled: isGrowthAutonomyPrepareCapability(input.capability)
        ? Boolean(input.channelPermission?.enabled_for_prepare)
        : Boolean(settings.capabilityToggles[input.capability as GrowthAutonomyCapability]),
      approvalPolicy,
      killSwitchState,
      budgetState: input.budgetState,
      channelPermission: input.channelPermission,
      channelPolicyMetadata: input.channelPolicyMetadata,
      phase: GROWTH_AUTONOMY_PHASE,
      enforcementActive: input.enforcementActive,
      triggerSource: input.triggerSource,
    },
  }
}

async function evaluatePrepareCapabilityFromContext(
  admin: SupabaseClient,
  context: GrowthAiOsAutonomyPolicyEvaluationContext,
  input: EvaluateCapabilityInput & { capability: GrowthAutonomyPrepareCapability },
): Promise<GrowthAutonomyPolicyResult> {
  const { policy } = context
  const settings = settingsFromContext(context)
  const killSwitchState = killSwitchStateFromContext(context)
  const triggerSource = input.triggerSource ?? "autonomous"
  const enforcementActive = Boolean(input.enforcementRequested && triggerSource === "autonomous")
  const now = input.prepareContext?.now ?? new Date()
  const channel = GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL[input.capability]
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
    shadowModeActive: policy.shadowModeEnabled,
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
      context,
      capability: input.capability,
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
      context,
      capability: input.capability,
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

  if (!policy.autonomyEnabled) {
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
    context,
    capability: input.capability,
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

export async function evaluateAutonomyCapabilityFromPolicyEngine(
  admin: SupabaseClient,
  input: EvaluateCapabilityInput,
): Promise<GrowthAutonomyPolicyResult> {
  const context = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
  })

  if (isGrowthAutonomyPrepareCapability(input.capability)) {
    return evaluatePrepareCapabilityFromContext(admin, context, {
      ...input,
      capability: input.capability,
    })
  }

  const { policy } = context
  const settings = settingsFromContext(context)
  const killSwitchState = killSwitchStateFromContext(context)
  const capability = input.capability as GrowthAutonomyCapability
  const triggerSource = input.triggerSource ?? "autonomous"
  const enforcementActive = Boolean(input.enforcementRequested && triggerSource === "autonomous")
  const budgetState = budgetStateFromPolicy(policy, capability, settings)
  const channelKey = GROWTH_AUTONOMY_CAPABILITY_TO_CHANNEL[capability]
  const channelPermission = channelKey ? resolveChannelPrepareConfig(settings, channelKey) : null

  const baseBlocked = (reason: string, requiresApproval = true) =>
    buildResult({
      context,
      capability,
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
      context,
      capability,
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

  if (!policy.autonomyEnabled) {
    return baseBlocked("Autonomy disabled by platform kill switch.")
  }

  if (settings.masterMode === "objective" && !killSwitchState.autonomyObjectiveModeEnabled) {
    return baseBlocked("Objective mode requires autonomy_objective_mode_enabled kill switch.")
  }

  if (capability === "campaign_launch") {
    if (settings.masterMode !== "objective") {
      return baseBlocked("Campaign launch autonomy requires objective mode.", true)
    }
  } else if (isGrowthAutonomyOutboundCapability(capability)) {
    return baseBlocked(
      "Outbound send requires send context — use evaluateAutonomyOutboundSendPolicy.",
      true,
    )
  }

  if (capability === "strategy_adaptation") {
    if (!killSwitchState.autonomyObjectiveModeEnabled) {
      return baseBlocked("Strategy adaptation requires objective mode kill switch.", true)
    }
    if (settings.masterMode !== "objective") {
      return baseBlocked("Strategy adaptation requires objective autonomy level.", true)
    }
  }

  if (isGrowthAutonomyGenerationCapability(capability) && !killSwitchState.autonomyGenerationEnabled) {
    return baseBlocked("Autonomous generation disabled by platform kill switch.")
  }

  if (settings.masterMode === "manual") {
    return baseBlocked("Manual mode — autonomous execution requires a higher autonomy level.")
  }

  if (!isCapabilityPermittedByMasterMode(settings.masterMode, capability)) {
    return baseBlocked(`Capability not permitted at ${settings.masterMode} autonomy level.`)
  }

  if (!Boolean(settings.capabilityToggles[capability])) {
    return baseBlocked("Capability toggle is off.")
  }

  if (budgetState.exceeded) {
    return baseBlocked("Autonomy daily budget exceeded or disabled.")
  }

  if (settings.masterMode === "channel" && isGrowthAutonomyOutboundCapability(capability)) {
    if (!channelPermission?.enabled_for_prepare) {
      return baseBlocked(`Channel ${channelKey ?? "unknown"} prepare not enabled.`)
    }
  }

  return buildResult({
    context,
    capability,
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

function buildSendPolicyResult(input: {
  context: GrowthAiOsAutonomyPolicyEvaluationContext
  capability: GrowthAutonomyOutboundCapability
  channel: GrowthAutonomyChannelKey
  channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata
  budgetState: GrowthAutonomyPolicyResult["policyMetadata"]["budgetState"]
  channelPermission: ReturnType<typeof normalizeGrowthAutonomyChannelPrepareConfig>
  allowed: boolean
  blocked: boolean
  requiresApproval: boolean
  reason: string | null
  triggerSource: GrowthAutonomyTriggerSource
}): GrowthAutonomyPolicyResult {
  const settings = settingsFromContext(input.context)
  const killSwitchState = killSwitchStateFromContext(input.context)
  return {
    allowed: input.allowed,
    blocked: input.blocked,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    policyMetadata: {
      masterMode: settings.masterMode,
      capability: input.capability,
      capabilityEnabled: Boolean(settings.capabilityToggles[input.capability]),
      approvalPolicy: GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY,
      killSwitchState,
      budgetState: input.budgetState,
      channelPermission: input.channelPermission,
      channelPolicyMetadata: input.channelPolicyMetadata,
      phase: GROWTH_AUTONOMY_PHASE,
      enforcementActive: true,
      triggerSource: input.triggerSource,
    },
  }
}

export async function evaluateAutonomyOutboundSendPolicyFromPolicyEngine(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    sendContext: GrowthAutonomySendContext
    triggerSource?: GrowthAutonomyTriggerSource
  },
): Promise<GrowthAutonomyOutboundSendEvaluation> {
  const context = await fetchGrowthAiOsAutonomyPolicyEvaluationContext(admin, {
    organizationId: input.organizationId,
  })
  const { policy } = context
  const settings = settingsFromContext(context)
  const killSwitchState = killSwitchStateFromContext(context)
  const capability = GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY[input.channel]
  const triggerSource = input.triggerSource ?? "autonomous"
  const now = input.sendContext.now ?? new Date()
  const channelPermission = normalizeGrowthAutonomyChannelPrepareConfig(settings.channelPermissions[input.channel])
  const sendBudget = await getChannelSendBudgetSnapshot(admin, {
    organizationId: input.organizationId,
    channel: input.channel,
    maxSendsPerDay: channelPermission.max_sends_per_day,
  })
  const outboundBudgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[capability]
  const orgOutboundBudget = outboundBudgetKey
    ? budgetStateFromPolicy(policy, capability, settings)
    : null

  const confidenceScore = input.sendContext.confidenceScore ?? null
  const sendConfidenceMet =
    confidenceScore !== null && confidenceScore >= channelPermission.minimum_send_confidence

  const channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata = {
    channel: input.channel,
    prepareEnabled: channelPermission.enabled_for_prepare,
    sendEnabled: channelPermission.enabled_for_send,
    quietHoursActive: isWithinChannelQuietHours(channelPermission.quiet_hours, now),
    confidenceMet: sendConfidenceMet,
    sendConfidenceMet,
    senderAllowed: isSenderProfileAllowed(channelPermission, input.sendContext.senderProfileId),
    sequenceAllowed: isSequenceAllowed(channelPermission, input.sendContext.sequenceId),
    audienceAllowed: isAudienceAllowed(channelPermission, input.sendContext.audienceId),
    outboundSendBlocked: !killSwitchState.autonomyOutboundEnabled,
    shadowModeActive: policy.shadowModeEnabled,
    maxPreparedPerDay: channelPermission.max_prepared_per_day,
    preparedToday: 0,
    maxSendsPerDay: channelPermission.max_sends_per_day,
    sentToday: sendBudget.consumed,
    minimumConfidenceScore: channelPermission.minimum_confidence_score,
    minimumSendConfidence: channelPermission.minimum_send_confidence,
    confidenceScore,
  }

  const budgetState = {
    resourceType: GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE[input.channel],
    cap: sendBudget.cap,
    remaining: sendBudget.remaining,
    exceeded: sendBudget.exceeded || Boolean(orgOutboundBudget?.exceeded),
  }

  const queue = (reason: string, summary: string): GrowthAutonomyOutboundSendEvaluation => {
    const shadowDecision: GrowthAutonomySendDecision = policy.shadowModeEnabled
      ? "shadow_would_queue"
      : "approval_queue"
    const policyResult = buildSendPolicyResult({
      context,
      capability,
      channel: input.channel,
      channelPolicyMetadata,
      budgetState,
      channelPermission,
      allowed: false,
      blocked: true,
      requiresApproval: true,
      reason,
      triggerSource,
    })
    return {
      decision: shadowDecision,
      allowed: false,
      requiresApproval: true,
      reason,
      humanReadableSummary: summary,
      policyResult,
    }
  }

  if (triggerSource === "operator") {
    const policyResult = buildSendPolicyResult({
      context,
      capability,
      channel: input.channel,
      channelPolicyMetadata,
      budgetState,
      channelPermission,
      allowed: true,
      blocked: false,
      requiresApproval: true,
      reason: null,
      triggerSource,
    })
    return {
      decision: "approval_queue",
      allowed: false,
      requiresApproval: true,
      reason: null,
      humanReadableSummary: "Operator path requires explicit approval.",
      policyResult,
    }
  }

  if (!policy.autonomyEnabled) {
    return queue("Autonomy disabled by emergency stop.", "Would queue — autonomy emergency stop is active.")
  }

  if (!killSwitchState.autonomyOutboundEnabled) {
    return queue("Autonomous outbound is disabled.", "Would queue — master outbound autonomy is off.")
  }

  if (!isGrowthAutonomyOutboundCapability(capability)) {
    return queue("Unsupported outbound capability.", "Would queue — unsupported channel.")
  }

  if (!Boolean(settings.capabilityToggles[capability])) {
    return queue(`${capability} toggle is off.`, `Would queue — ${input.channel} execution toggle is off.`)
  }

  if (settings.masterMode === "manual") {
    return queue("Manual mode blocks autonomous send.", "Would queue — manual autonomy mode.")
  }

  if (!isCapabilityPermittedByMasterMode(settings.masterMode, capability)) {
    return queue(
      `Capability not permitted at ${settings.masterMode} level.`,
      "Would queue — autonomy level too low for outbound send.",
    )
  }

  if (!channelPermission.enabled_for_send) {
    return queue(`${input.channel} send is disabled.`, `Would queue — ${input.channel} send not enabled.`)
  }

  if (channelPermission.max_sends_per_day <= 0) {
    return queue(`${input.channel} daily send limit is zero.`, "Would queue — daily send limit is zero.")
  }

  if (sendBudget.exceeded) {
    return queue(`${input.channel} daily send budget exceeded.`, "Would queue — channel daily send cap reached.")
  }

  if (orgOutboundBudget?.exceeded) {
    return queue("Organization outbound budget exceeded.", "Would queue — org outbound budget exhausted.")
  }

  if (channelPolicyMetadata.quietHoursActive) {
    return queue(`${input.channel} send blocked during quiet hours.`, "Would queue — quiet hours active.")
  }

  if (!sendConfidenceMet) {
    return queue(
      `Confidence ${confidenceScore ?? 0} below minimum ${channelPermission.minimum_send_confidence}.`,
      "Would queue — confidence below autonomous send threshold.",
    )
  }

  if (!channelPolicyMetadata.senderAllowed) {
    return queue("Sender profile not allowed.", "Would queue — sender not on allowlist.")
  }

  if (!channelPolicyMetadata.sequenceAllowed) {
    return queue("Sequence not allowed.", "Would queue — sequence not on allowlist.")
  }

  if (!channelPolicyMetadata.audienceAllowed) {
    return queue("Audience not allowed.", "Would queue — audience not on allowlist.")
  }

  if (input.sendContext.hasPendingApprovalItem) {
    return queue("Active approval item exists.", "Would queue — pending approval item for lead.")
  }

  if (input.sendContext.duplicateSend) {
    return queue("Duplicate send blocked.", "Would queue — duplicate event detected.")
  }

  const humanReadableSummary = `${input.channel} autonomous send qualified at confidence ${confidenceScore}.`

  if (policy.shadowModeEnabled) {
    const policyResult = buildSendPolicyResult({
      context,
      capability,
      channel: input.channel,
      channelPolicyMetadata: { ...channelPolicyMetadata, shadowModeActive: true },
      budgetState,
      channelPermission,
      allowed: true,
      blocked: false,
      requiresApproval: false,
      reason: null,
      triggerSource,
    })
    return {
      decision: "shadow_would_send",
      allowed: true,
      requiresApproval: false,
      reason: null,
      humanReadableSummary: `Shadow: would send — ${humanReadableSummary}`,
      policyResult,
    }
  }

  const policyResult = buildSendPolicyResult({
    context,
    capability,
    channel: input.channel,
    channelPolicyMetadata,
    budgetState,
    channelPermission,
    allowed: true,
    blocked: false,
    requiresApproval: false,
    reason: null,
    triggerSource,
  })

  return {
    decision: "autonomous_send",
    allowed: true,
    requiresApproval: false,
    reason: null,
    humanReadableSummary,
    policyResult,
  }
}
