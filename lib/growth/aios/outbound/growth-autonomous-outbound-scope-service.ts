/** GE-AI-2I — Bounded Autonomous Outbound service (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import { synthesizeBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  fetchLatestAutonomousOutboundScopeEvent,
  insertAutonomousOutboundScope,
  listAutonomousOutboundActionsForOrganization,
  listAutonomousOutboundScopesForOrganization,
  listAutonomousOutboundStopConditionTriggers,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import { isGrowthAutonomousOutboundScopeSchemaReady } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health"
import {
  activateAutonomousOutboundScopeWithValidation,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-activation-service"
import type {
  GrowthAutonomousOutboundScope,
  GrowthAutonomousOutboundScopeSource,
  GrowthBoundedAutonomousOutboundReadModel,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  approveAutonomousOutboundScope,
} from "@/lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator"

export {
  approveAutonomousOutboundScope,
  activateAutonomousOutboundScope,
  executeBoundedAutonomousOutboundAction,
  executeBoundedAutonomousOutboundTick,
  pauseAutonomousOutboundScope,
  triggerAutonomousOutboundStopCondition,
} from "@/lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator"

function nowIso(): string {
  return new Date().toISOString()
}

export function buildDefaultAutonomousOutboundScope(input: {
  organizationId: string
  source: GrowthAutonomousOutboundScopeSource
  sourceId: string
  approvedByUserId: string
  title: string
  summary: string
  allowedChannels?: GrowthAutonomousOutboundScope["allowedChannels"]
  audience?: GrowthAutonomousOutboundScope["audience"]
  limits?: Partial<GrowthAutonomousOutboundScope["limits"]>
  expiresInDays?: number
}): GrowthAutonomousOutboundScope {
  const now = nowIso()
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 30) * 24 * 60 * 60 * 1000).toISOString()

  return {
    id: randomUUID(),
    organizationId: input.organizationId,
    source: input.source,
    sourceId: input.sourceId,
    status: "draft",
    approvedByUserId: input.approvedByUserId,
    approvedAt: now,
    expiresAt,
    allowedChannels: input.allowedChannels ?? ["email", "sms"],
    audience: input.audience ?? { leadIds: [] },
    limits: {
      maxActionsTotal: input.limits?.maxActionsTotal ?? 500,
      maxActionsPerDay: input.limits?.maxActionsPerDay ?? 50,
      maxActionsPerLead: input.limits?.maxActionsPerLead ?? 3,
      maxSmsPerDay: input.limits?.maxSmsPerDay ?? 20,
      maxEmailsPerDay: input.limits?.maxEmailsPerDay ?? 30,
      maxVoiceDropsPerDay: input.limits?.maxVoiceDropsPerDay ?? 5,
      quietHours: input.limits?.quietHours,
    },
    requiredChecks: {
      growthAutonomy: true,
      humanApproval: true,
      suppression: true,
      senderReadiness: true,
      compliance: true,
      optOut: true,
      budget: true,
    },
    stopConditions: {
      onReply: true,
      onPositiveIntent: true,
      onNegativeIntent: true,
      onBounce: true,
      onUnsubscribe: true,
      onMeetingBooked: true,
      onManualPause: true,
    },
    policy: {
      autonomyCapability: "autonomous_outbound_actions",
      requiresHumanApproval: true,
      enforcementSource: "growth_ai_os_autonomy_policy_engine",
    },
    title: input.title,
    summary: input.summary,
    voiceDropCertified: false,
    aiVoiceExplicitlyApproved: false,
    createdAt: now,
    updatedAt: now,
    activatedAt: null,
    pausedAt: null,
    completedAt: null,
    blockedReason: null,
  }
}

export {
  activateAutonomousOutboundScopeWithValidation,
  validateAutonomousOutboundScopeActivation,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-activation-service"

export { submitOperatorAutonomousOutboundScopeActivation } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-operator-activation-service"

export async function createDraftAutonomousOutboundScope(input: {
  admin: SupabaseClient
  scope: GrowthAutonomousOutboundScope
}): Promise<GrowthAutonomousOutboundScope> {
  return insertAutonomousOutboundScope(input.admin, { ...input.scope, status: "draft" })
}

export async function fetchBoundedAutonomousOutboundReadModel(
  admin: SupabaseClient,
  input: { organizationId: string; generatedAt?: string },
): Promise<GrowthBoundedAutonomousOutboundReadModel> {
  const generatedAt = input.generatedAt ?? nowIso()
  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
  })

  const schemaReady = await isGrowthAutonomousOutboundScopeSchemaReady(admin)
  if (!schemaReady) {
    return synthesizeBoundedAutonomousOutboundReadModel({
      organizationId: input.organizationId,
      generatedAt,
      scopes: [],
      actions: [],
      stopConditionTriggers: [],
      killSwitchStatus: {
        autonomyEnabled: autonomyPolicy.autonomyEnabled,
        autonomyOutboundEnabled: autonomyPolicy.killSwitches.autonomyOutboundEnabled,
        emergencyStopActive: autonomyPolicy.emergencyStopActive,
      },
      lastEventAt: null,
      lastEventType: null,
    })
  }

  const [scopes, actions, stopConditionTriggers, latestEvent] = await Promise.all([
    listAutonomousOutboundScopesForOrganization(admin, {
      organizationId: input.organizationId,
    }),
    listAutonomousOutboundActionsForOrganization(admin, {
      organizationId: input.organizationId,
    }),
    listAutonomousOutboundStopConditionTriggers(admin, {
      organizationId: input.organizationId,
    }),
    fetchLatestAutonomousOutboundScopeEvent(admin, {
      organizationId: input.organizationId,
    }),
  ])

  return synthesizeBoundedAutonomousOutboundReadModel({
    organizationId: input.organizationId,
    generatedAt,
    scopes,
    actions,
    stopConditionTriggers,
    killSwitchStatus: {
      autonomyEnabled: autonomyPolicy.autonomyEnabled,
      autonomyOutboundEnabled: autonomyPolicy.killSwitches.autonomyOutboundEnabled,
      emergencyStopActive: autonomyPolicy.emergencyStopActive,
    },
    lastEventAt: latestEvent?.createdAt ?? null,
    lastEventType: latestEvent?.eventType ?? null,
  })
}

export async function approveAndActivateAutonomousOutboundScope(input: {
  admin: SupabaseClient
  scope: GrowthAutonomousOutboundScope
}): Promise<GrowthAutonomousOutboundScope | null> {
  const approved = await approveAutonomousOutboundScope({
    admin: input.admin,
    scope: input.scope,
  })
  const activation = await activateAutonomousOutboundScopeWithValidation({
    admin: input.admin,
    organizationId: approved.organizationId,
    scopeId: approved.id,
  })
  return activation.scope
}

export { synthesizeBoundedAutonomousOutboundReadModel } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
