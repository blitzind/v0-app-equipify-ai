import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { consumeAutonomyBudget, consumeChannelPrepareBudget } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import {
  GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL,
  isGrowthAutonomyPrepareCapability,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  isGrowthAutonomyEnforceableCapability,
  isGrowthAutonomyOutboundCapability,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import { evaluateAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-policy-service"
import { fetchGrowthAutonomySettings } from "@/lib/growth/autonomy/growth-autonomy-settings-repository"
import {
  logGrowthAutonomyBlockedAttempt,
  logGrowthAutonomyBudgetConsumed,
  logGrowthAutonomyPolicyDecision,
} from "@/lib/growth/autonomy/growth-autonomy-policy-logger"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyPolicyResult,
  GrowthAutonomyPrepareCapability,
  GrowthAutonomyPrepareContext,
  GrowthAutonomyTriggerSource,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export type GrowthAutonomyEnforcementResult = {
  allowed: boolean
  blocked: boolean
  reason: string | null
  result: GrowthAutonomyPolicyResult | null
  skipped: boolean
}

function buildOperatorBypassResult(
  capability: GrowthAutonomyCapability,
  triggerSource: GrowthAutonomyTriggerSource,
): GrowthAutonomyPolicyResult {
  return {
    allowed: true,
    blocked: false,
    requiresApproval: true,
    reason: null,
    policyMetadata: {
      masterMode: "manual",
      capability,
      capabilityEnabled: false,
      approvalPolicy: "always_require_approval",
      killSwitchState: {
        autonomyEnabled: false,
        autonomyOutboundEnabled: false,
        autonomyGenerationEnabled: false,
        autonomyObjectiveModeEnabled: false,
      },
      budgetState: { resourceType: null, cap: 0, remaining: 0, exceeded: false },
      channelPermission: null,
      channelPolicyMetadata: null,
      phase: "GE-AUTO-1C",
      enforcementActive: false,
      triggerSource,
    },
  }
}

/**
 * GE-AUTO-1C — gate autonomous safe internal actions and channel prepare; operator triggers bypass.
 */
export async function enforceGrowthAutonomyCapability(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability | GrowthAutonomyPrepareCapability
    runtimeContext: string
    triggerSource: GrowthAutonomyTriggerSource
    prepareContext?: GrowthAutonomyPrepareContext
  },
): Promise<GrowthAutonomyEnforcementResult> {
  if (input.triggerSource === "operator") {
    const result = buildOperatorBypassResult(input.capability as GrowthAutonomyCapability, input.triggerSource)
    return { allowed: true, blocked: false, reason: null, result, skipped: true }
  }

  if (isGrowthAutonomyPrepareCapability(input.capability)) {
    const result = await evaluateAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      triggerSource: input.triggerSource,
      enforcementRequested: true,
      prepareContext: input.prepareContext,
    })

    await logGrowthAutonomyPolicyDecision(admin, { ...input, result })

    if (!result.allowed || result.blocked) {
      await logGrowthAutonomyBlockedAttempt(admin, {
        organizationId: input.organizationId,
        capability: input.capability as GrowthAutonomyCapability,
        runtimeContext: input.runtimeContext,
        reason: result.reason ?? "Channel prepare blocked by autonomy policy.",
      })
      return {
        allowed: false,
        blocked: true,
        reason: result.reason,
        result,
        skipped: false,
      }
    }

    const channel = GROWTH_AUTONOMY_PREPARE_CAPABILITY_TO_CHANNEL[input.capability]
    const settings = await fetchGrowthAutonomySettings(admin, input.organizationId)
    const channelConfig = settings.channelPermissions[channel]
    const budget = await consumeChannelPrepareBudget(admin, {
      organizationId: input.organizationId,
      channel,
      maxPreparedPerDay: channelConfig?.max_prepared_per_day ?? 0,
    })

    if (!budget.allowed) {
      await logGrowthAutonomyBlockedAttempt(admin, {
        organizationId: input.organizationId,
        capability: input.capability as GrowthAutonomyCapability,
        runtimeContext: input.runtimeContext,
        reason: budget.reason ?? "Channel prepare budget exceeded.",
      })
      return {
        allowed: false,
        blocked: true,
        reason: budget.reason,
        result,
        skipped: false,
      }
    }

    if (budget.snapshot) {
      await logGrowthAutonomyBudgetConsumed(admin, {
        organizationId: input.organizationId,
        capability: input.capability as GrowthAutonomyCapability,
        runtimeContext: input.runtimeContext,
        snapshot: budget.snapshot,
      })
    }

    return { allowed: true, blocked: false, reason: null, result, skipped: false }
  }

  if (isGrowthAutonomyOutboundCapability(input.capability as GrowthAutonomyCapability)) {
    const result = await evaluateAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      triggerSource: input.triggerSource,
      enforcementRequested: true,
    })
    await logGrowthAutonomyPolicyDecision(admin, { ...input, result })
    await logGrowthAutonomyBlockedAttempt(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      reason: result.reason ?? "Outbound autonomy is locked.",
    })
    return {
      allowed: false,
      blocked: true,
      reason: result.reason ?? "Outbound autonomy is locked.",
      result,
      skipped: false,
    }
  }

  if (input.capability === "campaign_launch") {
    const result = await evaluateAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      triggerSource: input.triggerSource,
      enforcementRequested: true,
    })
    await logGrowthAutonomyPolicyDecision(admin, { ...input, result })
    if (result.allowed && !result.blocked) {
      return {
        allowed: true,
        blocked: false,
        reason: null,
        result,
        skipped: false,
      }
    }
    await logGrowthAutonomyBlockedAttempt(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      reason: result.reason ?? "Campaign launch autonomy requires human review.",
    })
    return {
      allowed: false,
      blocked: true,
      reason: result.reason ?? "Campaign launch autonomy requires human review.",
      result,
      skipped: false,
    }
  }

  if (!isGrowthAutonomyEnforceableCapability(input.capability)) {
    const result = await evaluateAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      triggerSource: input.triggerSource,
      enforcementRequested: true,
    })
    await logGrowthAutonomyPolicyDecision(admin, { ...input, result })
    if (result.allowed && !result.blocked) {
      return {
        allowed: true,
        blocked: false,
        reason: null,
        result,
        skipped: false,
      }
    }
    await logGrowthAutonomyBlockedAttempt(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      reason: result.reason ?? "Capability blocked by autonomy policy.",
    })
    return {
      allowed: false,
      blocked: true,
      reason: result.reason ?? "Capability blocked by autonomy policy.",
      result,
      skipped: false,
    }
  }

  const result = await evaluateAutonomyCapability(admin, {
    organizationId: input.organizationId,
    capability: input.capability,
    triggerSource: input.triggerSource,
    enforcementRequested: true,
  })

  await logGrowthAutonomyPolicyDecision(admin, { ...input, result })

  if (!result.allowed || result.blocked) {
    await logGrowthAutonomyBlockedAttempt(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      reason: result.reason ?? "Autonomy policy blocked execution.",
    })
    return {
      allowed: false,
      blocked: true,
      reason: result.reason,
      result,
      skipped: false,
    }
  }

  const budget = await consumeAutonomyBudget(admin, {
    organizationId: input.organizationId,
    capability: input.capability,
  })

  if (!budget.allowed) {
    await logGrowthAutonomyBlockedAttempt(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      reason: budget.reason ?? "Autonomy budget exceeded.",
    })
    return {
      allowed: false,
      blocked: true,
      reason: budget.reason,
      result,
      skipped: false,
    }
  }

  if (budget.snapshot) {
    await logGrowthAutonomyBudgetConsumed(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      runtimeContext: input.runtimeContext,
      snapshot: budget.snapshot,
    })
  }

  return { allowed: true, blocked: false, reason: null, result, skipped: false }
}
