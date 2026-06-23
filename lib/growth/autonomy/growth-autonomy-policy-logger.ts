import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthAutonomyBudgetSnapshot } from "@/lib/growth/autonomy/growth-autonomy-budget-service"
import type {
  GrowthAutonomyCapability,
  GrowthAutonomyPolicyResult,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { GROWTH_AUTONOMY_QA_MARKER } from "@/lib/growth/autonomy/growth-autonomy-types"
import { evaluateAutonomyCapability } from "@/lib/growth/autonomy/growth-autonomy-policy-service"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"

export async function logGrowthAutonomyPolicyDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    runtimeContext: string
    result: GrowthAutonomyPolicyResult
  },
): Promise<void> {
  const payload = {
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    capability: input.capability,
    runtime_context: input.runtimeContext,
    allowed: input.result.allowed,
    blocked: input.result.blocked,
    requires_approval: input.result.requiresApproval,
    reason: input.result.reason,
    master_mode: input.result.policyMetadata.masterMode,
    capability_enabled: input.result.policyMetadata.capabilityEnabled,
    approval_policy: input.result.policyMetadata.approvalPolicy,
    kill_switch_state: input.result.policyMetadata.killSwitchState,
    budget_state: input.result.policyMetadata.budgetState,
    channel_permission: input.result.policyMetadata.channelPermission,
    enforcement_active: input.result.policyMetadata.enforcementActive,
    trigger_source: input.result.policyMetadata.triggerSource,
  }

  logGrowthEngine("autonomy_policy_evaluated", payload)

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: `autonomy:${input.capability}`,
      severity: input.result.blocked ? "warning" : "info",
      message: `Autonomy policy evaluated (${input.runtimeContext})`,
      context: payload,
    })
  } catch {
    // Observability must never fail callers.
  }
}

export async function logGrowthAutonomyBlockedAttempt(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    runtimeContext: string
    reason: string
  },
): Promise<void> {
  const payload = {
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    ...input,
    event: "autonomy_blocked",
  }

  logGrowthEngine("autonomy_execution_blocked", payload)

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: `autonomy:${input.capability}`,
      severity: "warning",
      message: `Autonomy blocked (${input.runtimeContext})`,
      context: payload,
    })
  } catch {
    // Best effort.
  }
}

export async function logGrowthAutonomyBudgetConsumed(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    runtimeContext: string
    snapshot: GrowthAutonomyBudgetSnapshot
  },
): Promise<void> {
  const payload = {
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    capability: input.capability,
    runtime_context: input.runtimeContext,
    resource_type: input.snapshot.resourceType,
    cap: input.snapshot.cap,
    consumed: input.snapshot.consumed,
    remaining: input.snapshot.remaining,
  }

  logGrowthEngine("autonomy_budget_consumed", payload)

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: input.snapshot.resourceType,
      severity: "info",
      message: `Autonomy budget consumed (${input.runtimeContext})`,
      context: payload,
    })
  } catch {
    // Best effort.
  }
}

export async function logGrowthAutonomySettingsChange(
  admin: SupabaseClient,
  input: {
    organizationId: string
    actorUserId: string
    actorEmail: string
    patch: Record<string, unknown>
    emergencyStop?: boolean
  },
): Promise<void> {
  const payload = {
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    actor_user_id: input.actorUserId,
    actor_email: input.actorEmail,
    patch: input.patch,
    emergency_stop: Boolean(input.emergencyStop),
  }

  logGrowthEngine("autonomy_settings_changed", payload)

  try {
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: "autonomy:settings",
      severity: input.emergencyStop ? "warning" : "info",
      message: input.emergencyStop ? "Autonomy emergency stop activated" : "Autonomy settings updated",
      context: payload,
    })
  } catch {
    // Best effort.
  }
}

/** GE-AUTO-1A compatibility — log-only probe (no enforcement). */
export async function probeGrowthAutonomyCapabilityForRuntime(
  admin: SupabaseClient,
  input: {
    organizationId: string
    capability: GrowthAutonomyCapability
    runtimeContext: string
  },
): Promise<GrowthAutonomyPolicyResult | null> {
  try {
    const result = await evaluateAutonomyCapability(admin, {
      organizationId: input.organizationId,
      capability: input.capability,
      triggerSource: "autonomous",
      enforcementRequested: false,
    })
    await logGrowthAutonomyPolicyDecision(admin, { ...input, result })
    return result
  } catch (error) {
    logGrowthEngine("autonomy_policy_probe_failed", {
      qa_marker: GROWTH_AUTONOMY_QA_MARKER,
      capability: input.capability,
      runtime_context: input.runtimeContext,
      detail: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
