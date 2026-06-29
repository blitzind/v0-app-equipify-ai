/**
 * GE-AIOS-SAFETY-1 — Guardrail audit logging via existing runtime guardrail audit store.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import type { AutonomousExecutionGuardrailDecision } from "@/lib/growth/autonomous-execution-guardrails/autonomous-execution-guardrail-types"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"

export async function auditAutonomousExecutionGuardrailDecision(
  admin: SupabaseClient,
  input: {
    decision: AutonomousExecutionGuardrailDecision
    leadId: string
    companyId?: string | null
    action: string
    channel: string
    correlationId?: string
  },
): Promise<void> {
  if (!input.decision.enabled) return

  const organizationId = getGrowthEngineAiOrgId()
  await recordRuntimeGuardrailAudit(admin, {
    organizationId,
    resourceType: "autonomous_execution_guardrail",
    severity: input.decision.blocked ? "error" : input.decision.requiresApproval ? "warning" : "info",
    message: input.decision.blocked
      ? `Autonomous execution blocked for ${input.action}`
      : input.decision.requiresApproval
        ? `Autonomous execution requires approval for ${input.action}`
        : `Autonomous execution guardrails passed preview for ${input.action}`,
    context: {
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      action: input.action,
      channel: input.channel,
      correlation_id: input.correlationId ?? null,
      decision: input.decision.auditMetadata.decision ?? null,
      risk_level: input.decision.riskLevel,
      blockers: input.decision.blockers,
      limits_applied: input.decision.limitsApplied,
      audit_metadata: input.decision.auditMetadata,
    },
  }).catch(() => undefined)
}
