/** GE-AI-2I-PROD-1 — Safe autonomous outbound scope activation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiOsAutonomyPolicy } from "@/lib/growth/autonomy/growth-ai-os-autonomy-policy-engine-service"
import {
  isScopeExpired,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-engine"
import {
  fetchAutonomousOutboundScopeById,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import type { GrowthAutonomousOutboundScope } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import { activateAutonomousOutboundScope } from "@/lib/growth/aios/outbound/growth-bounded-autonomous-outbound-orchestrator"

export type AutonomousOutboundActivationValidation = {
  ok: boolean
  reason: string | null
  checks: Array<{ check: string; passed: boolean; reason: string | null }>
}

function hasConfiguredAudience(scope: GrowthAutonomousOutboundScope): boolean {
  const audience = scope.audience
  if ((audience.leadIds?.length ?? 0) > 0) return true
  if ((audience.companyIds?.length ?? 0) > 0) return true
  if ((audience.personIds?.length ?? 0) > 0) return true
  if (audience.savedSearchId) return true
  return false
}

function hasValidLimits(scope: GrowthAutonomousOutboundScope): boolean {
  return (
    scope.limits.maxActionsTotal > 0 &&
    scope.limits.maxActionsPerDay > 0 &&
    scope.limits.maxActionsPerLead > 0
  )
}

export async function validateAutonomousOutboundScopeActivation(
  admin: SupabaseClient,
  input: { organizationId: string; scopeId: string; nowIso?: string },
): Promise<AutonomousOutboundActivationValidation> {
  const nowIso = input.nowIso ?? new Date().toISOString()
  const checks: AutonomousOutboundActivationValidation["checks"] = []

  const scope = await fetchAutonomousOutboundScopeById(admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })

  if (!scope) {
    return { ok: false, reason: "scope_not_found", checks: [{ check: "scope_exists", passed: false, reason: "Scope not found." }] }
  }

  const humanApprovalPassed =
    scope.status === "approved" &&
    Boolean(scope.approvedByUserId) &&
    Boolean(scope.approvedAt) &&
    scope.requiredChecks.humanApproval === true
  checks.push({
    check: "human_approval",
    passed: humanApprovalPassed,
    reason: humanApprovalPassed ? null : "Scope must be approved with valid approver metadata.",
  })

  const expired = isScopeExpired(scope, nowIso)
  checks.push({
    check: "expiration",
    passed: !expired,
    reason: expired ? "Scope has expired." : null,
  })

  const audiencePassed = hasConfiguredAudience(scope)
  checks.push({
    check: "audience",
    passed: audiencePassed,
    reason: audiencePassed ? null : "Scope audience must include leads, companies, persons, or a saved search.",
  })

  const limitsPassed = hasValidLimits(scope)
  checks.push({
    check: "limits",
    passed: limitsPassed,
    reason: limitsPassed ? null : "Scope limits must define positive action budgets.",
  })

  const channelsPassed = scope.allowedChannels.length > 0
  checks.push({
    check: "channel_allow_list",
    passed: channelsPassed,
    reason: channelsPassed ? null : "Scope must allow at least one outbound channel.",
  })

  const autonomyPolicy = await fetchGrowthAiOsAutonomyPolicy(admin, {
    organizationId: input.organizationId,
  })
  const growthAutonomyPassed =
    autonomyPolicy.autonomyEnabled &&
    autonomyPolicy.killSwitches.autonomyOutboundEnabled &&
    !autonomyPolicy.emergencyStopActive
  checks.push({
    check: "growth_autonomy",
    passed: growthAutonomyPassed,
    reason: growthAutonomyPassed
      ? null
      : "Growth Autonomy outbound capability is disabled or emergency stop is active.",
  })

  const failed = checks.find((row) => !row.passed)
  return {
    ok: !failed,
    reason: failed?.reason ?? null,
    checks,
  }
}

export async function activateAutonomousOutboundScopeWithValidation(
  admin: SupabaseClient,
  input: { organizationId: string; scopeId: string; nowIso?: string },
): Promise<{ scope: GrowthAutonomousOutboundScope | null; validation: AutonomousOutboundActivationValidation }> {
  const validation = await validateAutonomousOutboundScopeActivation(admin, input)
  if (!validation.ok) {
    return { scope: null, validation }
  }

  const scope = await activateAutonomousOutboundScope({
    admin,
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })

  return { scope, validation }
}
