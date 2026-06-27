/** GE-AI-2I — Bounded Autonomous Outbound orchestrator (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateAutonomyOutboundSendPolicyFromPolicyEngine } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-evaluation-service"
import type { GrowthAutonomyChannelKey } from "@/lib/growth/autonomy/growth-autonomy-types"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import {
  computeOutboundConsumption,
  evaluateBoundedOutboundGateMatrix,
  mapActionTypeToChannel,
  mapOutboundChannelToAutonomyCapability,
  resolveActiveStopConditions,
  resolveTransportPath,
  selectEligibleOutboundAction,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  appendAutonomousOutboundScopeEvent,
  fetchAutonomousOutboundScopeById,
  insertAutonomousOutboundScopeAction,
  listAutonomousOutboundActionsForOrganization,
  listAutonomousOutboundStopConditionTriggers,
  upsertAutonomousOutboundScopeRecord,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import type {
  GrowthAutonomousOutboundActionRecord,
  GrowthAutonomousOutboundActionType,
  GrowthAutonomousOutboundChannel,
  GrowthAutonomousOutboundScope,
  GrowthAutonomousOutboundStopCondition,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { isEmailSuppressed } from "@/lib/growth/outbound/suppression-repository"
import { evaluateGrowthOutboundTransportReadiness } from "@/lib/growth/runtime/outbound-transport-readiness"
import { runSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-runner"

function nowIso(): string {
  return new Date().toISOString()
}

function mapChannelToAutonomyKey(channel: GrowthAutonomousOutboundChannel): GrowthAutonomyChannelKey | null {
  switch (channel) {
    case "email":
      return "email"
    case "sms":
      return "sms"
    case "voice_drop":
    case "ai_voice":
      return "voice"
    default:
      return null
  }
}

async function publishOutboundLifecycleEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    scope: GrowthAutonomousOutboundScope
    payload?: Record<string, unknown>
    correlationId?: string
    actionId?: string | null
  },
): Promise<void> {
  try {
    await appendAutonomousOutboundScopeEvent(admin, {
      organizationId: input.organizationId,
      scopeId: input.scope.id,
      actionId: input.actionId ?? null,
      eventType: input.eventType,
      payload: input.payload ?? {},
    })
  } catch {
    // Persistent audit failure must not block orchestration bookkeeping.
  }
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: "workflow",
      producer: "growth_bounded_autonomous_outbound_orchestrator",
      source: "growth_bounded_autonomous_outbound_orchestrator",
      entityType: "system",
      entityId: input.scope.id,
      correlationId: input.correlationId ?? input.scope.id,
      payload: {
        scope_id: input.scope.id,
        source: input.scope.source,
        source_id: input.scope.sourceId,
        ...(input.payload ?? {}),
      },
      metadata: {
        workflowAgent: "bounded_autonomous_outbound_executor",
        correlationId: input.correlationId ?? input.scope.id,
        traceId: input.correlationId ?? input.scope.id,
      },
    })
  } catch {
    // Event bus failure must not block orchestration bookkeeping.
  }
}

export async function approveAutonomousOutboundScope(input: {
  admin: SupabaseClient
  scope: GrowthAutonomousOutboundScope
}): Promise<GrowthAutonomousOutboundScope> {
  const now = nowIso()
  const approved: GrowthAutonomousOutboundScope = {
    ...input.scope,
    status: "approved",
    updatedAt: now,
  }
  await upsertAutonomousOutboundScopeRecord(input.admin, approved)
  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.scope.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopeApproved,
    scope: approved,
  })
  return approved
}

export async function activateAutonomousOutboundScope(input: {
  admin: SupabaseClient
  organizationId: string
  scopeId: string
}): Promise<GrowthAutonomousOutboundScope | null> {
  const now = nowIso()
  const scope = await fetchAutonomousOutboundScopeById(input.admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!scope || scope.status !== "approved") return null

  const active: GrowthAutonomousOutboundScope = {
    ...scope,
    status: "active",
    activatedAt: now,
    updatedAt: now,
  }
  await upsertAutonomousOutboundScopeRecord(input.admin, active)
  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopeActivated,
    scope: active,
  })
  return active
}

export async function pauseAutonomousOutboundScope(input: {
  admin: SupabaseClient
  organizationId: string
  scopeId: string
  reason?: string
}): Promise<GrowthAutonomousOutboundScope | null> {
  const now = nowIso()
  const scope = await fetchAutonomousOutboundScopeById(input.admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!scope) return null

  const paused: GrowthAutonomousOutboundScope = {
    ...scope,
    status: "paused",
    pausedAt: now,
    updatedAt: now,
    blockedReason: input.reason ?? "Manual pause.",
  }
  await upsertAutonomousOutboundScopeRecord(input.admin, paused)
  if (scope.stopConditions.onManualPause) {
    await appendAutonomousOutboundScopeEvent(input.admin, {
      organizationId: input.organizationId,
      scopeId: scope.id,
      eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
      payload: {
        condition: "on_manual_pause",
        label: input.reason ?? "Scope manually paused.",
      },
    })
  }
  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopePaused,
    scope: paused,
    payload: { reason: input.reason ?? null },
  })
  return paused
}

export async function triggerAutonomousOutboundStopCondition(input: {
  admin: SupabaseClient
  organizationId: string
  scopeId: string
  condition: GrowthAutonomousOutboundStopCondition
  label: string
}): Promise<GrowthAutonomousOutboundScope | null> {
  const scope = await fetchAutonomousOutboundScopeById(input.admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!scope) return null

  await appendAutonomousOutboundScopeEvent(input.admin, {
    organizationId: input.organizationId,
    scopeId: scope.id,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    payload: {
      condition: input.condition,
      label: input.label,
    },
  })

  const activeStops = resolveActiveStopConditions({
    scope,
    triggered: [input.condition],
  })
  if (activeStops.length === 0) return scope

  const paused = await pauseAutonomousOutboundScope({
    admin: input.admin,
    organizationId: input.organizationId,
    scopeId: scope.id,
    reason: input.label,
  })

  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.stopConditionTriggered,
    scope: paused ?? scope,
    payload: { condition: input.condition, label: input.label },
  })
  return paused
}

async function dispatchThroughExistingTransport(
  admin: SupabaseClient,
  input: {
    scope: GrowthAutonomousOutboundScope
    actionType: GrowthAutonomousOutboundActionType
    leadId: string
    sequenceJobId?: string | null
    actingUserId: string
  },
): Promise<{ ok: boolean; message: string; transportPath: string }> {
  const channel = mapActionTypeToChannel(input.actionType)
  const transportPath = resolveTransportPath(channel)

  if (channel === "linkedin_manual") {
    return {
      ok: true,
      message: "manual_linkedin_task_created",
      transportPath,
    }
  }

  if (channel === "video") {
    return {
      ok: true,
      message: "video_sendr_task_queued",
      transportPath,
    }
  }

  if (channel === "ai_voice") {
    return {
      ok: false,
      message: "ai_voice_blocked_without_explicit_dispatch",
      transportPath,
    }
  }

  if (!input.sequenceJobId) {
    return {
      ok: false,
      message: "sequence_job_required_for_transport",
      transportPath,
    }
  }

  const result = await runSequenceExecutionJob(admin, {
    jobId: input.sequenceJobId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserId,
    humanApproved: true,
    humanApprovalConfirmed: true,
    approvedBy: input.scope.approvedByUserId,
    cronMode: true,
  })

  return {
    ok: result.ok,
    message: result.message ?? (result.ok ? "sent" : "failed"),
    transportPath,
  }
}

export async function executeBoundedAutonomousOutboundAction(input: {
  admin: SupabaseClient
  organizationId: string
  scopeId: string
  actionType: GrowthAutonomousOutboundActionType
  leadId: string
  sequenceJobId?: string | null
  leadEmail?: string | null
  actingUserId?: string
  voiceDropLiveCertified?: boolean
}): Promise<GrowthAutonomousOutboundActionRecord> {
  const now = nowIso()
  const actingUserId = input.actingUserId ?? "bounded-autonomous-outbound-executor"
  const scope = await fetchAutonomousOutboundScopeById(input.admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!scope) {
    throw new Error("autonomous_outbound_scope_not_found")
  }

  const channel = mapActionTypeToChannel(input.actionType)
  const actions = await listAutonomousOutboundActionsForOrganization(input.admin, {
    organizationId: input.organizationId,
    scopeId: scope.id,
  })
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  const consumption = computeOutboundConsumption({
    scopeId: scope.id,
    actions,
    dayStartIso: dayStart.toISOString(),
  })

  const stopTriggers = await listAutonomousOutboundStopConditionTriggers(input.admin, {
    organizationId: input.organizationId,
  })
  const triggered = stopTriggers
    .filter((row) => row.scopeId === scope.id)
    .map((row) => row.condition)
  const activeStopConditions = resolveActiveStopConditions({ scope, triggered })

  let autonomyAllowed = false
  let autonomyReason: string | null = "Autonomy evaluation pending."
  const autonomyChannel = mapChannelToAutonomyKey(channel)
  if (autonomyChannel) {
    const autonomy = await evaluateAutonomyOutboundSendPolicyFromPolicyEngine(input.admin, {
      organizationId: input.organizationId,
      channel: autonomyChannel,
      triggerSource: "autonomous",
      sendContext: {
        leadId: input.leadId,
        sequenceId: input.sequenceJobId ?? null,
        audienceId: scope.sourceId,
        confidenceScore: 0.9,
        now: new Date(now),
      },
    })
    autonomyAllowed = autonomy.allowed
    autonomyReason = autonomy.reason
  } else if (channel === "linkedin_manual" || channel === "video") {
    autonomyAllowed = true
    autonomyReason = null
  }

  let suppressionBlocked = false
  let optOutBlocked = false
  if (input.leadEmail && channel === "email") {
    suppressionBlocked = await isEmailSuppressed(input.admin, input.leadEmail)
    optOutBlocked = suppressionBlocked
  }

  let senderReady = true
  if (channel === "email" || channel === "sms") {
    const readiness = await evaluateGrowthOutboundTransportReadiness(input.admin)
    senderReady = readiness.ready
  }

  const gateEvaluation = evaluateBoundedOutboundGateMatrix({
    scope,
    channel,
    leadId: input.leadId,
    nowIso: now,
    consumption,
    autonomyAllowed,
    autonomyReason,
    suppressionBlocked,
    optOutBlocked,
    complianceBlocked: false,
    senderReady,
    activeStopConditions,
    voiceDropLiveCertified: input.voiceDropLiveCertified,
  })

  const correlationId = randomUUID()
  const idempotencyKey = `${scope.id}:${input.leadId}:${input.actionType}:${input.sequenceJobId ?? "none"}`
  const baseAction: GrowthAutonomousOutboundActionRecord = {
    id: randomUUID(),
    scopeId: scope.id,
    organizationId: input.organizationId,
    actionType: input.actionType,
    channel,
    leadId: input.leadId,
    sequenceJobId: input.sequenceJobId ?? null,
    transportPath: resolveTransportPath(channel),
    correlationId,
    idempotencyKey,
    selectedAt: now,
    createdAt: now,
    updatedAt: now,
    status: "selected",
  }

  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionSelected,
    scope,
    correlationId,
    payload: {
      action_type: input.actionType,
      lead_id: input.leadId,
      channel,
    },
  })

  if (!gateEvaluation.allowed) {
    const blockedGate = gateEvaluation.blockedGates[0]?.gateId ?? null
    const blocked: GrowthAutonomousOutboundActionRecord = {
      ...baseAction,
      status: "blocked",
      blockedGate,
      blockedReason: gateEvaluation.summary,
    }
    const persistedBlocked = await insertAutonomousOutboundScopeAction(input.admin, blocked)
    await publishOutboundLifecycleEvent(input.admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionBlocked,
      scope,
      correlationId,
      actionId: persistedBlocked.id,
      payload: {
        blocked_gate: blockedGate,
        reason: gateEvaluation.summary,
      },
    })
    return persistedBlocked
  }

  const dispatch = await dispatchThroughExistingTransport(input.admin, {
    scope,
    actionType: input.actionType,
    leadId: input.leadId,
    sequenceJobId: input.sequenceJobId,
    actingUserId,
  })

  if (!dispatch.ok) {
    const failed: GrowthAutonomousOutboundActionRecord = {
      ...baseAction,
      status: "failed",
      transportPath: dispatch.transportPath,
      blockedReason: dispatch.message,
      failedAt: now,
      updatedAt: now,
    }
    const persistedFailed = await insertAutonomousOutboundScopeAction(input.admin, failed)
    await publishOutboundLifecycleEvent(input.admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionFailed,
      scope,
      correlationId,
      actionId: persistedFailed.id,
      payload: { message: dispatch.message },
    })
    return persistedFailed
  }

  const queued: GrowthAutonomousOutboundActionRecord = {
    ...baseAction,
    status: dispatch.message.includes("manual") || dispatch.message.includes("task") ? "queued" : "completed",
    transportPath: dispatch.transportPath,
    transportReference: dispatch.message,
    queuedAt: dispatch.message.includes("manual") || dispatch.message.includes("task") ? now : null,
    completedAt: now,
    updatedAt: now,
  }
  const persistedQueued = await insertAutonomousOutboundScopeAction(input.admin, queued)

  await publishOutboundLifecycleEvent(input.admin, {
    organizationId: input.organizationId,
    eventType:
      queued.status === "completed"
        ? GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionCompleted
        : GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.actionQueued,
    scope,
    correlationId,
    actionId: persistedQueued.id,
    payload: {
      transport_path: dispatch.transportPath,
      message: dispatch.message,
    },
  })

  if (consumption.actionsTotal + 1 >= scope.limits.maxActionsTotal) {
    const completedScope: GrowthAutonomousOutboundScope = {
      ...scope,
      status: "completed",
      completedAt: now,
      updatedAt: now,
    }
    await upsertAutonomousOutboundScopeRecord(input.admin, completedScope)
    await publishOutboundLifecycleEvent(input.admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_AUTONOMOUS_OUTBOUND_EVENT_TYPES.scopeCompleted,
      scope: completedScope,
      correlationId,
    })
  }

  return persistedQueued
}

export async function executeBoundedAutonomousOutboundTick(input: {
  admin: SupabaseClient
  organizationId: string
  scopeId: string
  pendingActions: Array<{
    actionType: GrowthAutonomousOutboundActionType
    leadId: string
    sequenceJobId?: string | null
    leadEmail?: string | null
  }>
  actingUserId?: string
  voiceDropLiveCertified?: boolean
}): Promise<{
  executed: GrowthAutonomousOutboundActionRecord | null
  evaluationSummary: string | null
}> {
  const now = nowIso()
  const scope = await fetchAutonomousOutboundScopeById(input.admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!scope) return { executed: null, evaluationSummary: "scope_not_found" }

  const stopTriggers = await listAutonomousOutboundStopConditionTriggers(input.admin, {
    organizationId: input.organizationId,
  })
  const triggered = stopTriggers
    .filter((row) => row.scopeId === scope.id)
    .map((row) => row.condition)
  const actions = await listAutonomousOutboundActionsForOrganization(input.admin, {
    organizationId: input.organizationId,
    scopeId: scope.id,
  })
  const dayStart = new Date(now)
  dayStart.setUTCHours(0, 0, 0, 0)
  const consumption = computeOutboundConsumption({
    scopeId: scope.id,
    actions,
    dayStartIso: dayStart.toISOString(),
  })

  const selection = selectEligibleOutboundAction({
    scope,
    pendingActions: input.pendingActions,
    gateEvaluator: ({ channel, leadId }) =>
      evaluateBoundedOutboundGateMatrix({
        scope,
        channel,
        leadId,
        nowIso: now,
        consumption,
        autonomyAllowed: mapOutboundChannelToAutonomyCapability(channel) !== "manual_execution",
        autonomyReason: null,
        suppressionBlocked: false,
        optOutBlocked: false,
        complianceBlocked: false,
        senderReady: true,
        activeStopConditions: resolveActiveStopConditions({
          scope,
          triggered,
        }),
        voiceDropLiveCertified: input.voiceDropLiveCertified,
      }),
  })

  if (!selection.selected) {
    return {
      executed: null,
      evaluationSummary: selection.evaluation?.summary ?? "no_eligible_action",
    }
  }

  const pending = input.pendingActions.find(
    (row) =>
      row.actionType === selection.selected!.actionType && row.leadId === selection.selected!.leadId,
  )

  const executed = await executeBoundedAutonomousOutboundAction({
    admin: input.admin,
    organizationId: input.organizationId,
    scopeId: input.scopeId,
    actionType: selection.selected.actionType,
    leadId: selection.selected.leadId,
    sequenceJobId: selection.selected.sequenceJobId,
    leadEmail: pending?.leadEmail ?? null,
    actingUserId: input.actingUserId,
    voiceDropLiveCertified: input.voiceDropLiveCertified,
  })

  return { executed, evaluationSummary: selection.evaluation?.summary ?? null }
}
