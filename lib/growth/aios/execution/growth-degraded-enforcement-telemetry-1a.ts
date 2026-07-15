/**
 * GE-AIOS-DEGRADED-ENFORCEMENT-CLOSURE-1A — Degraded enforcement telemetry (server-only).
 */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthDegradedEnforcementResult } from "@/lib/growth/aios/execution/growth-degraded-enforcement-policy-1a"

export function recordDegradedEnforcementTelemetry(input: {
  organizationId?: string | null
  leadId?: string | null
  actionKind: string
  result: GrowthDegradedEnforcementResult
  scope?: string | null
}): void {
  logGrowthEngine("canonical_decision_degraded_enforcement", {
    organization_id: input.organizationId ?? null,
    lead_id: input.leadId ?? null,
    action_kind: input.actionKind,
    scope: input.scope ?? "runtime",
    disposition: input.result.disposition,
    reason_code: input.result.reasonCode,
    decision_resolution_failed: true,
    lifecycle_evidence_available: input.result.lifecycleEvidenceAvailable,
    terminal: input.result.terminal,
    retry_appropriate: input.result.retryAppropriate,
    next_safe_retry_at: input.result.nextSafeRetryAt,
    transport_blocked: input.result.transportBlocked,
    enforcement_fingerprint: input.result.enforcementFingerprint,
  })
}
