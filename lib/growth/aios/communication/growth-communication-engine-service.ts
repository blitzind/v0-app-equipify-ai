/** GE-AI-2K — Communication Engine read service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-types"
import {
  buildCommunicationContextFromOutboundScope,
  summarizeGrowthCommunicationPlan,
  synthesizeGrowthCommunicationEngineReadModel,
  synthesizeGrowthCommunicationPlan,
  type GrowthCommunicationEngineBatchInput,
} from "@/lib/growth/aios/communication/growth-communication-engine-engine"
import type {
  GrowthCommunicationEngineContext,
  GrowthCommunicationEngineReadModel,
  GrowthCommunicationGoal,
  GrowthCommunicationPlan,
  GrowthCommunicationPlanSubject,
} from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES } from "@/lib/growth/aios/communication/growth-communication-engine-types"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import { isWithinScopeQuietHours } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import type { GrowthBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import type { GrowthCalibrationActiveConfig } from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"
import { resolveCommunicationEngineWeights } from "@/lib/growth/aios/learning/growth-adaptive-calibration-config-resolver"

export function buildGrowthCommunicationEngineReadModel(input: {
  organizationId: string
  generatedAt: string
  boundedAutonomousOutbound?: GrowthBoundedAutonomousOutboundReadModel
  autonomyPolicy?: GrowthAiOsAutonomyPolicyReadModel
  outreachLeadIds?: string[]
  limit?: number
  calibrationActiveConfigs?: GrowthCalibrationActiveConfig[]
}): GrowthCommunicationEngineReadModel {
  const limit = input.limit ?? 12
  const commConfig = input.calibrationActiveConfigs?.find((row) => row.targetSystem === "communication_engine")
  const rankingWeights = resolveCommunicationEngineWeights({
    organizationId: input.organizationId,
    activeConfig: commConfig?.config,
  })
  const subjects: GrowthCommunicationEngineBatchInput["subjects"] = []

  const killSwitch = input.boundedAutonomousOutbound?.killSwitchStatus
  const autonomyEnabled = killSwitch?.autonomyEnabled ?? input.autonomyPolicy?.autonomyEnabled
  const autonomyOutboundEnabled =
    killSwitch?.autonomyOutboundEnabled ?? input.autonomyPolicy?.killSwitches.autonomyOutboundEnabled
  const emergencyStopActive =
    killSwitch?.emergencyStopActive ?? input.autonomyPolicy?.emergencyStopActive

  const scopeRows = [
    ...(input.boundedAutonomousOutbound?.activeScopes ?? []),
    ...(input.boundedAutonomousOutbound?.approvedScopes ?? []),
  ].slice(0, limit)

  for (const row of scopeRows) {
    const quietHoursActive = isWithinScopeQuietHours(row.scope, new Date(input.generatedAt))
    const leadId = row.scope.audience.leadIds?.[0]
    subjects.push({
      subject: {
        type: row.scope.source === "objective" ? "objective" : "campaign",
        id: row.scope.sourceId,
      },
      goal: "qualify",
      context: buildCommunicationContextFromOutboundScope({
        scopeAllowedChannels: row.scope.allowedChannels,
        voiceDropCertified: row.scope.voiceDropCertified,
        aiVoiceExplicitlyAllowed: row.scope.aiVoiceExplicitlyApproved,
        quietHoursActive,
        autonomyEnabled,
        autonomyOutboundEnabled,
        emergencyStopActive,
      }),
    })
    if (leadId && subjects.length < limit) {
      subjects.push({
        subject: { type: "lead", id: leadId },
        goal: "follow_up",
        context: buildCommunicationContextFromOutboundScope({
          scopeAllowedChannels: row.scope.allowedChannels,
          voiceDropCertified: row.scope.voiceDropCertified,
          aiVoiceExplicitlyAllowed: row.scope.aiVoiceExplicitlyApproved,
          quietHoursActive,
          autonomyEnabled,
          autonomyOutboundEnabled,
          emergencyStopActive,
        }),
      })
    }
  }

  for (const leadId of (input.outreachLeadIds ?? []).slice(0, limit)) {
    if (subjects.some((s) => s.subject.type === "lead" && s.subject.id === leadId)) continue
    subjects.push({
      subject: { type: "lead", id: leadId },
      goal: "qualify",
      context: {
        emailReady: true,
        smsReady: true,
        senderReady: true,
        autonomyEnabled,
        autonomyOutboundEnabled,
        emergencyStopActive,
      },
    })
  }

  if (subjects.length === 0) {
    subjects.push({
      subject: { type: "objective", id: input.organizationId },
      goal: "qualify",
      context: {
        emailReady: true,
        smsReady: true,
        senderReady: true,
        autonomyEnabled,
        autonomyOutboundEnabled,
        emergencyStopActive,
      },
    })
  }

  return synthesizeGrowthCommunicationEngineReadModel({
    organizationId: input.organizationId,
    generatedAt: input.generatedAt,
    subjects: subjects.slice(0, limit).map((row) => ({
      ...row,
      context: { ...row.context, rankingWeights },
    })),
  })
}

export function requestGrowthCommunicationPlan(input: {
  organizationId: string
  subject: GrowthCommunicationPlanSubject
  goal?: GrowthCommunicationGoal
  context?: GrowthCommunicationEngineContext
  generatedAt?: string
}): GrowthCommunicationPlan {
  return synthesizeGrowthCommunicationPlan({
    organizationId: input.organizationId,
    subject: input.subject,
    goal: input.goal,
    context: input.context,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  })
}

export function resolveCommunicationPlanRecommendedChannel(plan: GrowthCommunicationPlan): string {
  const primary = plan.steps.find(
    (step) => step.actionType !== "wait" && step.actionType !== "request_human_review",
  )
  return primary?.channel ?? "email"
}

export async function publishCommunicationPlanGeneratedEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    plan: GrowthCommunicationPlan
    generatedAt: string
  },
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: GROWTH_COMMUNICATION_ENGINE_EVENT_TYPES.planGenerated,
      category: "agent",
      source: "growth_communication_engine",
      producer: "growth_communication_engine_service",
      subjectType: input.plan.subject.type,
      subjectId: input.plan.subject.id,
      payload: {
        planId: input.plan.id,
        recommendedStrategy: input.plan.recommendedStrategy,
        confidence: input.plan.confidence,
        summary: summarizeGrowthCommunicationPlan(input.plan),
        readOnly: true,
      },
      metadata: {
        qaMarker: "growth-ge-ai-2k-communication-engine-v1",
        nonMutating: true,
      },
      occurredAt: input.generatedAt,
    })
  } catch {
    // Planning event publish must not block read model.
  }
}

export function buildGrowthCommunicationEngineFromCommandCenter(input: {
  commandCenter: Omit<AiOsCommandCenterReadModel, "communicationEngine">
  limit?: number
}): GrowthCommunicationEngineReadModel {
  const outreachLeadIds =
    input.commandCenter.autonomousOutreachPreparationPilot?.recentRuns
      ?.map((run) => run.leadId)
      .filter(Boolean) ?? []

  return buildGrowthCommunicationEngineReadModel({
    organizationId: input.commandCenter.organizationId,
    generatedAt: input.commandCenter.generatedAt,
    boundedAutonomousOutbound: input.commandCenter.boundedAutonomousOutbound,
    autonomyPolicy: input.commandCenter.autonomyPolicy,
    outreachLeadIds,
    limit: input.limit,
  })
}
