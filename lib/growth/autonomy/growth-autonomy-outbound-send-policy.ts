/** GE-AUTO-1E — Confidence-gated autonomous outbound send policy (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTONOMY_CHANNEL_SEND_BUDGET_RESOURCE,
  GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY,
  isAudienceAllowed,
  isSenderProfileAllowed,
  isSequenceAllowed,
  isWithinChannelQuietHours,
  normalizeGrowthAutonomyChannelPrepareConfig,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET,
  GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY,
  isCapabilityPermittedByMasterMode,
  isGrowthAutonomyOutboundCapability,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import { getAutonomyBudgetSnapshot, getChannelSendBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import type {
  GrowthAutonomyChannelKey,
  GrowthAutonomyChannelPolicyMetadata,
  GrowthAutonomyOutboundCapability,
  GrowthAutonomyPolicyResult,
  GrowthAutonomySendContext,
  GrowthAutonomySendDecision,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_PHASE } from "@/lib/growth/autonomy/growth-autonomy-types"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export const GROWTH_AUTONOMY_OUTBOUND_SEND_QA_MARKER = "growth-autonomy-ge-auto-1f-v1" as const

export type GrowthAutonomyOutboundSendEvaluation = {
  decision: GrowthAutonomySendDecision
  allowed: boolean
  requiresApproval: boolean
  reason: string | null
  humanReadableSummary: string | null
  policyResult: GrowthAutonomyPolicyResult
}

function buildSendPolicyResult(input: {
  settings: Awaited<ReturnType<typeof fetchGrowthAutonomySettings>>
  capability: GrowthAutonomyOutboundCapability
  channel: GrowthAutonomyChannelKey
  killSwitchState: {
    autonomyEnabled: boolean
    autonomyOutboundEnabled: boolean
    autonomyGenerationEnabled: boolean
    autonomyObjectiveModeEnabled: boolean
  }
  channelPolicyMetadata: GrowthAutonomyChannelPolicyMetadata
  budgetState: GrowthAutonomyPolicyResult["policyMetadata"]["budgetState"]
  channelPermission: ReturnType<typeof normalizeGrowthAutonomyChannelPrepareConfig>
  allowed: boolean
  blocked: boolean
  requiresApproval: boolean
  reason: string | null
  triggerSource: GrowthAutonomyTriggerSource
}): GrowthAutonomyPolicyResult {
  return {
    allowed: input.allowed,
    blocked: input.blocked,
    requiresApproval: input.requiresApproval,
    reason: input.reason,
    policyMetadata: {
      masterMode: input.settings.masterMode,
      capability: input.capability,
      capabilityEnabled: Boolean(input.settings.capabilityToggles[input.capability]),
      approvalPolicy: GROWTH_AUTONOMY_DEFAULT_APPROVAL_POLICY,
      killSwitchState: input.killSwitchState,
      budgetState: input.budgetState,
      channelPermission: input.channelPermission,
      channelPolicyMetadata: input.channelPolicyMetadata,
      phase: GROWTH_AUTONOMY_PHASE,
      enforcementActive: true,
      triggerSource: input.triggerSource,
    },
  }
}

export async function evaluateAutonomyOutboundSendPolicy(
  admin: SupabaseClient,
  input: {
    organizationId: string
    channel: GrowthAutonomyChannelKey
    sendContext: GrowthAutonomySendContext
    triggerSource?: GrowthAutonomyTriggerSource
  },
): Promise<GrowthAutonomyOutboundSendEvaluation> {
  const capability = GROWTH_AUTONOMY_CHANNEL_TO_EXECUTION_CAPABILITY[input.channel]
  const triggerSource = input.triggerSource ?? "autonomous"
  const now = input.sendContext.now ?? new Date()
  const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
  const killStates = await getRuntimeKillSwitchStates(admin)
  const killSwitchState = {
    autonomyEnabled: Boolean(killStates.autonomy_enabled),
    autonomyOutboundEnabled: Boolean(killStates.autonomy_outbound_enabled),
    autonomyGenerationEnabled: Boolean(killStates.autonomy_generation_enabled),
    autonomyObjectiveModeEnabled: Boolean(killStates.autonomy_objective_mode_enabled),
  }
  const channelPermission = normalizeGrowthAutonomyChannelPrepareConfig(settings.channelPermissions[input.channel])
  const sendBudget = await getChannelSendBudgetSnapshot(admin, {
    organizationId: input.organizationId,
    channel: input.channel,
    maxSendsPerDay: channelPermission.max_sends_per_day,
  })
  const outboundBudgetKey = GROWTH_AUTONOMY_CAPABILITY_TO_BUDGET[capability]
  const orgOutboundBudget = outboundBudgetKey
    ? await getAutonomyBudgetSnapshot(admin, {
        organizationId: input.organizationId,
        capability,
      })
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
    shadowModeActive: settings.outboundControls.shadowModeEnabled,
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
    const shadowDecision: GrowthAutonomySendDecision = settings.outboundControls.shadowModeEnabled
      ? "shadow_would_queue"
      : "approval_queue"
    const policyResult = buildSendPolicyResult({
      settings,
      capability,
      channel: input.channel,
      killSwitchState,
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
      settings,
      capability,
      channel: input.channel,
      killSwitchState,
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

  if (!killSwitchState.autonomyEnabled) {
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

  if (settings.outboundControls.shadowModeEnabled) {
    const policyResult = buildSendPolicyResult({
      settings,
      capability,
      channel: input.channel,
      killSwitchState,
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
    settings,
    capability,
    channel: input.channel,
    killSwitchState,
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
