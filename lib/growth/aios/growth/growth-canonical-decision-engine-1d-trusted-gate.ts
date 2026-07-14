/**
 * GE-AIOS-DECISION-ENGINE-1D — Trusted sequence enforcement gate (client-safe).
 */

import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
  type CanonicalSequenceEnforcementTrustedGate,
} from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"

const TRUSTED_GATE_MAX_AGE_MS = 120_000

export function buildCanonicalSequenceEnforcementTrustedGate(input: {
  jobId: string
  leadId: string
  decisionFingerprint: string
  enforcementFingerprint: string
  channelLabel?: string | null
  issuedAt?: string
}): CanonicalSequenceEnforcementTrustedGate {
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
    jobId: input.jobId,
    leadId: input.leadId,
    decisionFingerprint: input.decisionFingerprint,
    enforcementFingerprint: input.enforcementFingerprint,
    channelLabel: input.channelLabel ?? null,
    issuedAt: input.issuedAt ?? new Date().toISOString(),
  }
}

export function isCanonicalSequenceEnforcementTrustedGateValid(
  gate: CanonicalSequenceEnforcementTrustedGate | null | undefined,
  input: {
    jobId: string
    leadId: string
    channelLabel?: string | null
  },
  maxAgeMs: number = TRUSTED_GATE_MAX_AGE_MS,
): boolean {
  if (!gate || gate.qaMarker !== GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER) return false
  if (gate.jobId !== input.jobId || gate.leadId !== input.leadId) return false
  if (!gate.decisionFingerprint || !gate.enforcementFingerprint) return false
  if (gate.channelLabel && input.channelLabel && gate.channelLabel !== input.channelLabel) {
    return false
  }
  const issuedAtMs = Date.parse(gate.issuedAt)
  if (!Number.isFinite(issuedAtMs) || Date.now() - issuedAtMs > maxAgeMs) return false
  return true
}
