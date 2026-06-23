/** GE-AUTO-1C — Channel prepare orchestration for GE-v1-5 runtime (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUTONOMY_CHANNEL_TO_PREPARE_CAPABILITY } from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  scoreAutonomyOutboundConfidence,
  type GrowthAutonomyConfidenceInput,
} from "@/lib/growth/autonomy/growth-autonomy-confidence-scorer"
import { enforceGrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-enforcement"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import type { GeV15PlaybookActionSpec } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks"
import { resolveGeV15InitialApprovalStatus } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import {
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  type GeV15AutomationRuntimeTrigger,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

function prepareCapabilityForAction(action: GeV15PlaybookActionSpec["action"]) {
  if (action === "prepare_email") return GROWTH_AUTONOMY_CHANNEL_TO_PREPARE_CAPABILITY.email
  if (action === "prepare_sms") return GROWTH_AUTONOMY_CHANNEL_TO_PREPARE_CAPABILITY.sms
  if (action === "prepare_voice_drop") return GROWTH_AUTONOMY_CHANNEL_TO_PREPARE_CAPABILITY.voice
  return null
}

function channelForAction(action: GeV15PlaybookActionSpec["action"]) {
  if (action === "prepare_email") return "email"
  if (action === "prepare_sms") return "sms"
  if (action === "prepare_voice_drop") return "voice_drop"
  return null
}

function buildPrepareDedupeKey(input: {
  playbookId: string
  trigger: GeV15AutomationRuntimeTrigger
  leadId: string
  action: GeV15PlaybookActionSpec["action"]
}): string {
  return `ge-v1-5-prepare:${input.playbookId}:${input.trigger}:${input.leadId}:${input.action}`
}

export function buildGeV15PrepareConfidenceInput(input: {
  trigger: GeV15AutomationRuntimeTrigger
  triggerPayload?: Record<string, unknown>
  leadScore?: number | null
  intentScore?: number | null
}): GrowthAutonomyConfidenceInput {
  const payload = input.triggerPayload ?? {}
  const intentType =
    typeof payload.intent === "string"
      ? payload.intent
      : input.trigger === "booking_started"
        ? "booking"
        : input.trigger === "question_asked"
          ? "pricing"
          : input.trigger

  return {
    intentType,
    eventIntensity: typeof payload.intensity === "number" ? payload.intensity : 60,
    leadScore: input.leadScore ?? null,
    engagementScore: input.intentScore ?? null,
    recencyHours: typeof payload.recency_hours === "number" ? payload.recency_hours : 1,
    priorReplyStatus:
      payload.prior_reply === true ? "replied" : payload.prior_reply === false ? "none" : "none",
    bookingStatus:
      input.trigger === "booking_completed"
        ? "completed"
        : input.trigger === "booking_started"
          ? "started"
          : "none",
  }
}

export async function prepareGeV15OutboundAction(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    ownerUserId?: string | null
    playbookId: string
    trigger: GeV15AutomationRuntimeTrigger
    triggerPayload?: Record<string, unknown>
    spec: GeV15PlaybookActionSpec
    existingPreparedActions: GeV15PreparedAction[]
    leadScore?: number | null
    intentScore?: number | null
    senderProfileId?: string | null
    recipientEmail?: string | null
    sequenceId?: string | null
    audienceId?: string | null
    dryRun?: boolean
  },
): Promise<{ prepared: GeV15PreparedAction | null; notificationEmitted: boolean; blockedReason?: string }> {
  if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.prepare_outbound_enabled) {
    return { prepared: null, notificationEmitted: false, blockedReason: "prepare_outbound_disabled" }
  }

  const prepareCapability = prepareCapabilityForAction(input.spec.action)
  if (!prepareCapability) {
    return { prepared: null, notificationEmitted: false, blockedReason: "not_prepare_action" }
  }

  const dedupeKey = buildPrepareDedupeKey({
    playbookId: input.playbookId,
    trigger: input.trigger,
    leadId: input.leadId,
    action: input.spec.action,
  })
  if (input.existingPreparedActions.some((action) => action.dedupeKey === dedupeKey && action.status !== "rejected")) {
    return { prepared: null, notificationEmitted: false, blockedReason: "duplicate_prepare" }
  }

  const confidenceScore = scoreAutonomyOutboundConfidence(
    buildGeV15PrepareConfidenceInput({
      trigger: input.trigger,
      triggerPayload: input.triggerPayload,
      leadScore: input.leadScore,
      intentScore: input.intentScore,
    }),
  )

  const gate = await enforceGrowthAutonomyCapability(admin, {
    organizationId: input.organizationId,
    capability: prepareCapability,
    runtimeContext: "ge_v1_5_automation_runtime_prepare",
    triggerSource: "autonomous",
    prepareContext: {
      senderProfileId: input.senderProfileId,
      sequenceId: input.sequenceId,
      audienceId: input.audienceId,
      confidenceScore,
    },
  })

  if (!gate.allowed) {
    return {
      prepared: null,
      notificationEmitted: false,
      blockedReason: gate.reason ?? "autonomy_blocked",
    }
  }

  const now = new Date().toISOString()
  const prepared: GeV15PreparedAction = {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action: input.spec.action,
    channel: channelForAction(input.spec.action),
    title: input.spec.title,
    summary: input.spec.summary,
    draftContent: input.spec.draftContent ?? null,
    status: resolveGeV15InitialApprovalStatus(input.spec.action),
    playbookId: input.playbookId,
    trigger: input.trigger,
    ownerUserId: input.ownerUserId ?? null,
    createdAt: now,
    updatedAt: now,
    autonomyPrepared: true,
    approvalRequired: true,
    confidenceScore,
    triggerReason: input.spec.summary,
    senderProfileId: input.senderProfileId ?? null,
    recipientEmail: input.recipientEmail ?? null,
    sequenceId: input.sequenceId ?? null,
    audienceId: input.audienceId ?? null,
    channelPolicyMetadata: gate.result?.policyMetadata.channelPolicyMetadata
      ? { ...gate.result.policyMetadata.channelPolicyMetadata }
      : null,
    dedupeKey,
  }

  let notificationEmitted = false
  if (!input.dryRun && GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.notification_actions_enabled) {
    try {
      const result = await emitGrowthNotification(admin, {
        notificationType: "strong_buying_signal",
        sourceSystem: "intelligence",
        sourceId: dedupeKey,
        orgId: input.organizationId,
        leadId: input.leadId,
        ownerUserId: input.ownerUserId ?? null,
        title: `Prepared ${prepared.channel ?? "outbound"} for review`,
        body: `Growth Engine prepared ${input.spec.title.toLowerCase()}. Review before sending.`,
        metadata: {
          playbook_id: input.playbookId,
          trigger: input.trigger,
          confidence_score: confidenceScore,
          qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
          autonomy_prepared: true,
        },
      })
      notificationEmitted = result.created || result.collapsed
      if (result.notification?.id) {
        prepared.notificationId = result.notification.id
      }
    } catch {
      // best-effort
    }
  }

  return { prepared, notificationEmitted }
}
