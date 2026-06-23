/** GE-v1-5 — Action execution (prepare-only, server-side). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertGrowthCadenceTaskRow } from "@/lib/growth/cadence/cadence-task-repository"
import { emitGrowthNotification } from "@/lib/growth/notifications/emit-growth-notification"
import type { GeV15PlaybookActionSpec } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-playbooks"
import { resolveGeV15InitialApprovalStatus } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval"
import {
  GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS,
  isGeV15OutboundCapableAction,
  type GeV15AutomationRecommendation,
  type GeV15AutomationRuntimeLeadState,
  type GeV15AutomationRuntimeTrigger,
  type GeV15PreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"
import { prepareGeV15OutboundAction } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-prepare"
import { enforceGrowthAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-enforcement"

export type GeV15ActionExecutionResult = {
  recommendationsCreated: number
  actionsPrepared: number
  notificationsEmitted: number
  tasksCreated: number
  state: GeV15AutomationRuntimeLeadState
}

function channelForAction(action: GeV15PlaybookActionSpec["action"]) {
  if (action === "prepare_email") return "email"
  if (action === "prepare_sms") return "sms"
  if (action === "prepare_voice_drop") return "voice_drop"
  if (action === "create_task" || action === "assign_task") return "task"
  if (
    action === "operator_notification" ||
    action === "inbox_notification" ||
    action === "dashboard_card"
  ) {
    return "notification"
  }
  return null
}

function buildRecommendation(
  spec: GeV15PlaybookActionSpec,
  playbookId: string,
  trigger: GeV15AutomationRuntimeTrigger,
): GeV15AutomationRecommendation {
  return {
    id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: spec.title,
    reason: spec.summary,
    priority: spec.priority ?? 5,
    actionKind: spec.actionKind ?? "review",
    playbookId,
    trigger,
    createdAt: new Date().toISOString(),
  }
}

function buildPreparedAction(
  spec: GeV15PlaybookActionSpec,
  playbookId: string,
  trigger: GeV15AutomationRuntimeTrigger,
): GeV15PreparedAction {
  const now = new Date().toISOString()
  const action = spec.action
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    action,
    channel: channelForAction(action),
    title: spec.title,
    summary: spec.summary,
    draftContent: spec.draftContent ?? null,
    status: resolveGeV15InitialApprovalStatus(action),
    playbookId,
    trigger,
    createdAt: now,
    updatedAt: now,
  }
}

export async function executeGeV15PlaybookActions(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    ownerUserId?: string | null
    playbookId: string
    trigger: GeV15AutomationRuntimeTrigger
    triggerPayload?: Record<string, unknown>
    actions: GeV15PlaybookActionSpec[]
    state: GeV15AutomationRuntimeLeadState
    dryRun?: boolean
    leadScore?: number | null
    intentScore?: number | null
    senderProfileId?: string | null
    recipientEmail?: string | null
    sequenceId?: string | null
    audienceId?: string | null
  },
): Promise<GeV15ActionExecutionResult> {
  const recommendationsGate = await enforceGrowthAutonomyCapability(admin, {
    organizationId: input.organizationId,
    capability: "recommendations",
    runtimeContext: "ge_v1_5_automation_runtime_actions",
    triggerSource: "autonomous",
  })
  const tasksGate = await enforceGrowthAutonomyCapability(admin, {
    organizationId: input.organizationId,
    capability: "task_creation",
    runtimeContext: "ge_v1_5_automation_runtime_actions",
    triggerSource: "autonomous",
  })

  let state = { ...input.state }
  let recommendationsCreated = 0
  let actionsPrepared = 0
  let notificationsEmitted = 0
  let tasksCreated = 0

  for (const spec of input.actions) {
    switch (spec.action) {
      case "create_recommendation":
      case "request_follow_up": {
        if (!recommendationsGate.allowed) break
        const rec = buildRecommendation(spec, input.playbookId, input.trigger)
        state = {
          ...state,
          recommendations: [rec, ...state.recommendations].slice(0, 20),
        }
        recommendationsCreated += 1
        break
      }

      case "elevate_recommendation": {
        if (!recommendationsGate.allowed) break
        const elevated = state.recommendations.map((rec, index) =>
          index === 0 ? { ...rec, elevated: true, priority: 1 } : rec,
        )
        if (elevated.length === 0) {
          const rec = buildRecommendation(spec, input.playbookId, input.trigger)
          state = {
            ...state,
            recommendations: [{ ...rec, elevated: true, priority: 1 }, ...state.recommendations].slice(
              0,
              20,
            ),
          }
        } else {
          state = { ...state, recommendations: elevated }
        }
        recommendationsCreated += 1
        break
      }

      case "prepare_email":
      case "prepare_sms":
      case "prepare_voice_drop": {
        const result = await prepareGeV15OutboundAction(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          ownerUserId: input.ownerUserId,
          playbookId: input.playbookId,
          trigger: input.trigger,
          triggerPayload: input.triggerPayload,
          spec,
          existingPreparedActions: state.preparedActions,
          leadScore: input.leadScore,
          intentScore: input.intentScore,
          senderProfileId: input.senderProfileId,
          recipientEmail: input.recipientEmail,
          sequenceId: input.sequenceId,
          audienceId: input.audienceId,
          dryRun: input.dryRun,
        })
        if (result.prepared) {
          let storedAction = result.prepared
          if (!input.dryRun) {
            const { maybeAutonomousSendGeV15PreparedAction } = await import(
              "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-autonomous-send"
            )
            const autonomous = await maybeAutonomousSendGeV15PreparedAction(admin, {
              organizationId: input.organizationId,
              leadId: input.leadId,
              preparedAction: result.prepared,
              existingPreparedActions: state.preparedActions,
              dryRun: input.dryRun,
            })
            storedAction = autonomous.action
          }
          state = {
            ...state,
            preparedActions: [storedAction, ...state.preparedActions].slice(0, 30),
          }
          actionsPrepared += 1
          if (result.notificationEmitted) notificationsEmitted += 1
        }
        break
      }

      case "queue_approval_item": {
        const prepared = buildPreparedAction(spec, input.playbookId, input.trigger)
        prepared.autonomyPrepared = true
        prepared.approvalRequired = true
        prepared.triggerReason = spec.summary
        state = {
          ...state,
          preparedActions: [prepared, ...state.preparedActions].slice(0, 30),
        }
        actionsPrepared += 1
        break
      }

      case "create_task":
      case "assign_task": {
        if (!tasksGate.allowed) break
        if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.task_actions_enabled || input.dryRun) break
        const prepared = buildPreparedAction(spec, input.playbookId, input.trigger)
        try {
          const task = await insertGrowthCadenceTaskRow(admin, {
            owner_user_id: input.ownerUserId ?? null,
            lead_id: input.leadId,
            channel: "manual",
            title: spec.title,
            instructions: spec.summary,
            template_draft: spec.draftContent ?? null,
            status: "open",
            priority: "normal",
            qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
            idempotency_key: `ge-v1-5:${input.playbookId}:${input.trigger}:${input.leadId}`,
          })
          prepared.taskId = task.id
          prepared.status = "executed"
          prepared.executedAt = new Date().toISOString()
          tasksCreated += 1
        } catch {
          prepared.status = "failed"
        }
        state = {
          ...state,
          preparedActions: [prepared, ...state.preparedActions].slice(0, 30),
        }
        actionsPrepared += 1
        break
      }

      case "operator_notification":
      case "inbox_notification":
      case "dashboard_card": {
        if (!GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.notification_actions_enabled || input.dryRun) {
          break
        }
        const notificationType =
          spec.action === "inbox_notification"
            ? "reply_waiting"
            : spec.action === "dashboard_card"
              ? "engagement_spike"
              : "strong_buying_signal"

        try {
          const result = await emitGrowthNotification(admin, {
            notificationType,
            sourceSystem: "intelligence",
            sourceId: `${input.playbookId}:${input.trigger}:${input.leadId}`,
            orgId: input.organizationId,
            leadId: input.leadId,
            ownerUserId: input.ownerUserId ?? null,
            title: spec.title,
            body: spec.summary,
            metadata: {
              playbook_id: input.playbookId,
              trigger: input.trigger,
              qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
            },
          })
          if (result.created || result.collapsed) {
            notificationsEmitted += 1
          }
        } catch {
          // notifications are best-effort
        }
        break
      }

      default:
        break
    }
  }

  // Outbound sends remain blocked — prepared actions stay in pending_approval
  for (const action of state.preparedActions) {
    if (isGeV15OutboundCapableAction(action.action)) {
      if (GE_V1_5_AUTOMATION_RUNTIME_SAFETY_FLAGS.outbound_send_execution_enabled) {
        continue
      }
      if (action.status === "executed") {
        action.status = "pending_approval"
        action.executedAt = undefined
      }
    }
  }

  return {
    recommendationsCreated,
    actionsPrepared,
    notificationsEmitted,
    tasksCreated,
    state,
  }
}
