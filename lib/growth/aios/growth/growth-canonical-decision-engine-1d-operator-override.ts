/**
 * GE-AIOS-DECISION-ENGINE-1D — Operator override event recording (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import type { CanonicalDecisionOperatorOverrideRecord } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"
import { recordTransportAuditEvent } from "@/lib/growth/providers/transport/transport-events"
import { recordSequenceExecutionJobAuditEvent } from "@/lib/growth/sequences/execution/sequence-execution-events"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

const recordedOverrideFingerprints = new Set<string>()

export function resetCanonicalDecisionOperatorOverrideIdempotencyForTests(): void {
  recordedOverrideFingerprints.clear()
}

function buildOverrideIdempotencyKey(
  override: CanonicalDecisionOperatorOverrideRecord,
): string {
  return [
    override.enforcementFingerprint,
    override.operatorId,
    override.suppressionCode,
    override.scope,
    override.decisionFingerprint,
  ].join(":")
}

export async function recordCanonicalDecisionOperatorOverride(
  admin: SupabaseClient,
  input: {
    leadId: string
    override: CanonicalDecisionOperatorOverrideRecord
    jobId?: string | null
    packageId?: string | null
    channel?: string | null
    action?: string | null
  },
): Promise<{ ok: true; idempotent: boolean }> {
  const idempotencyKey = buildOverrideIdempotencyKey(input.override)
  const idempotent = recordedOverrideFingerprints.has(idempotencyKey)
  if (!idempotent) {
    recordedOverrideFingerprints.add(idempotencyKey)
  }

  invalidateCanonicalDecisionCacheForLead(input.leadId, "operator_override")

  if (!idempotent) {
    const scopeLabel =
      input.override.scope === "transport"
        ? "Transport override"
        : input.override.scope === "sequence"
          ? "Sequence override"
          : "Canonical override"

    await appendGrowthLeadTimelineEvent(admin, {
      leadId: input.leadId,
      eventType: "canonical_decision_operator_override",
      title: `${scopeLabel} recorded`,
      summary: input.override.reason,
      actorUserId: input.override.operatorId,
      actorEmail: input.override.operatorEmail,
      occurredAt: input.override.recordedAt,
      payload: {
        qa_marker: input.override.qaMarker,
        scope: input.override.scope,
        operator_id: input.override.operatorId,
        operator_email: input.override.operatorEmail,
        reason: input.override.reason,
        decision_fingerprint: input.override.decisionFingerprint,
        suppression_code: input.override.suppressionCode,
        enforcement_fingerprint: input.override.enforcementFingerprint,
        package_id: input.packageId ?? null,
        job_id: input.jobId ?? null,
        channel: input.channel ?? null,
        action: input.action ?? null,
        recorded_at: input.override.recordedAt,
      },
    }).catch(() => undefined)
  }

  if (input.jobId && !idempotent) {
    await recordSequenceExecutionJobAuditEvent(admin, {
      jobId: input.jobId,
      eventType: "canonical_decision_operator_override",
      title: "Operator override of canonical suppression",
      description: input.override.reason,
      severity: "medium",
      metadata: {
        qa_marker: input.override.qaMarker,
        operator_id: input.override.operatorId,
        operator_email: input.override.operatorEmail,
        reason: input.override.reason,
        decision_fingerprint: input.override.decisionFingerprint,
        suppression_code: input.override.suppressionCode,
        enforcement_fingerprint: input.override.enforcementFingerprint,
        scope: input.override.scope,
        package_id: input.packageId ?? null,
        channel: input.channel ?? null,
        action: input.action ?? null,
        recorded_at: input.override.recordedAt,
        idempotent_replay: false,
      },
    })
  }

  if (input.override.scope === "transport" && !idempotent) {
    await recordTransportAuditEvent(admin, {
      provider_id: "growth_engine",
      event_type: "delivery_failed",
      title: "Transport override of canonical suppression",
      description: input.override.reason,
      severity: "medium",
      metadata: {
        qa_marker: input.override.qaMarker,
        lead_id: input.leadId,
        operator_id: input.override.operatorId,
        operator_email: input.override.operatorEmail,
        reason: input.override.reason,
        decision_fingerprint: input.override.decisionFingerprint,
        suppression_code: input.override.suppressionCode,
        enforcement_fingerprint: input.override.enforcementFingerprint,
        scope: input.override.scope,
        package_id: input.packageId ?? null,
        job_id: input.jobId ?? null,
        channel: input.channel ?? null,
        action: input.action ?? "transport_send",
        recorded_at: input.override.recordedAt,
        override_applied: true,
      },
      actorUserId: input.override.operatorId,
      actorEmail: input.override.operatorEmail ?? undefined,
    }).catch(() => undefined)
  }

  return { ok: true, idempotent }
}
