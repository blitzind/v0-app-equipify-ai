/** GE-AI-2I-PROD-3 — Gated operator autonomous outbound scope activation (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  activateAutonomousOutboundScopeWithValidation,
  type AutonomousOutboundActivationValidation,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-activation-service"
import { fetchAutonomousOutboundScopeById } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-repository"
import {
  formatGrowthAutonomousOutboundScopeSchemaNotReadyMessage,
  isGrowthAutonomousOutboundScopeSchemaReady,
  probeGrowthAutonomousOutboundScopeSchema,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-schema-health"
import type { GrowthAutonomousOutboundScope } from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING,
  GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

export type OperatorAutonomousOutboundScopeActivationResult = {
  ok: boolean
  qaMarker: typeof GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER
  rule: typeof GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE
  scope: GrowthAutonomousOutboundScope | null
  validation: AutonomousOutboundActivationValidation | null
  dualApprovalWarning: typeof GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING
  sequenceJobApprovalRequired: true
  sendOccurred: false
  error: string | null
  message: string | null
}

export async function submitOperatorAutonomousOutboundScopeActivation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    scopeId: string
    operatorUserId: string
    nowIso?: string
  },
): Promise<OperatorAutonomousOutboundScopeActivationResult> {
  const base = {
    qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
    rule: GROWTH_AUTONOMOUS_OUTBOUND_OPERATOR_ACTIVATION_RULE,
    dualApprovalWarning: GROWTH_AUTONOMOUS_OUTBOUND_DUAL_APPROVAL_WARNING,
    sequenceJobApprovalRequired: true as const,
    sendOccurred: false as const,
  }

  const schemaReady = await isGrowthAutonomousOutboundScopeSchemaReady(admin)
  if (!schemaReady) {
    const health = await probeGrowthAutonomousOutboundScopeSchema(admin)
    return {
      ...base,
      ok: false,
      scope: null,
      validation: null,
      error: "schema_not_ready",
      message: formatGrowthAutonomousOutboundScopeSchemaNotReadyMessage(health),
    }
  }

  const existing = await fetchAutonomousOutboundScopeById(admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
  })
  if (!existing) {
    return {
      ...base,
      ok: false,
      scope: null,
      validation: null,
      error: "scope_not_found",
      message: "Autonomous outbound scope not found for this organization.",
    }
  }

  if (existing.organizationId !== input.organizationId) {
    return {
      ...base,
      ok: false,
      scope: null,
      validation: null,
      error: "organization_scope_mismatch",
      message: "Scope does not belong to the active organization.",
    }
  }

  const activation = await activateAutonomousOutboundScopeWithValidation(admin, {
    organizationId: input.organizationId,
    scopeId: input.scopeId,
    nowIso: input.nowIso,
  })

  if (!activation.scope) {
    return {
      ...base,
      ok: false,
      scope: null,
      validation: activation.validation,
      error: activation.validation.reason ?? "activation_validation_failed",
      message: activation.validation.reason ?? "Scope activation validation failed.",
    }
  }

  return {
    ...base,
    ok: true,
    scope: activation.scope,
    validation: activation.validation,
    error: null,
    message: "Scope activated.",
  }
}
