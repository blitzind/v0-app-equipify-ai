/**
 * GE-AIOS-DECISION-ENGINE-1D — Parse operator override records from runtime metadata (client-safe).
 */

import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
  type CanonicalDecisionOperatorOverrideRecord,
  type CanonicalDecisionOperatorOverrideScope,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"

const VALID_OVERRIDE_SCOPES = new Set<CanonicalDecisionOperatorOverrideScope>([
  "sequence",
  "transport",
  "growth5f",
])

export function parseCanonicalDecisionOperatorOverrideMetadata(
  metadata: Record<string, unknown> | null | undefined,
): CanonicalDecisionOperatorOverrideRecord | null {
  if (!metadata || metadata.qa_marker !== GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER) {
    return null
  }

  const scope = metadata.scope
  if (typeof scope !== "string" || !VALID_OVERRIDE_SCOPES.has(scope as CanonicalDecisionOperatorOverrideScope)) {
    return null
  }

  const operatorId = typeof metadata.operator_id === "string" ? metadata.operator_id.trim() : ""
  const reason = typeof metadata.reason === "string" ? metadata.reason.trim() : ""
  const decisionFingerprint =
    typeof metadata.decision_fingerprint === "string" ? metadata.decision_fingerprint.trim() : ""
  const suppressionCode =
    typeof metadata.suppression_code === "string" ? metadata.suppression_code.trim() : ""
  const enforcementFingerprint =
    typeof metadata.enforcement_fingerprint === "string" ? metadata.enforcement_fingerprint.trim() : ""
  const recordedAt = typeof metadata.recorded_at === "string" ? metadata.recorded_at : ""

  if (!operatorId || !reason || !decisionFingerprint || !suppressionCode || !enforcementFingerprint) {
    return null
  }

  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
    operatorId,
    operatorEmail:
      typeof metadata.operator_email === "string" && metadata.operator_email.trim()
        ? metadata.operator_email.trim()
        : null,
    reason,
    decisionFingerprint,
    suppressionCode,
    enforcementFingerprint,
    scope: scope as CanonicalDecisionOperatorOverrideScope,
    recordedAt: recordedAt || new Date(0).toISOString(),
  }
}

export function selectLatestCanonicalDecisionOperatorOverride(
  records: CanonicalDecisionOperatorOverrideRecord[],
  input: {
    decisionFingerprint: string | null
    packageId?: string | null
  },
): CanonicalDecisionOperatorOverrideRecord | null {
  if (!input.decisionFingerprint) return null

  const matching = records.filter((record) => {
    if (record.decisionFingerprint !== input.decisionFingerprint) return false
    if (!input.packageId) return true
    return true
  })

  if (matching.length === 0) return null

  return matching.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0] ?? null
}
