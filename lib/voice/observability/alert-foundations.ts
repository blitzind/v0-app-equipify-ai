/** Passive alert foundations — Phase 5B. No external dispatch or auto-remediation. */

import type {
  VoiceObservabilityAlertPublicView,
  VoiceObservabilitySeverity,
} from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED } from "@/lib/voice/observability/types"
import type { DegradationSignal } from "@/lib/voice/observability/provider-health/degradation-detector"

export type AlertTriggerInput = {
  alertKey: string
  alertType: string
  severity: VoiceObservabilitySeverity
  evidence: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export const VOICE_OBSERVABILITY_ALERT_TYPES = [
  "provider_degradation",
  "escalation_spike",
  "transcript_latency_spike",
  "campaign_failure_spike",
  "compliance_anomaly_spike",
  "operator_takeover_spike",
] as const

export type VoiceObservabilityAlertType = (typeof VOICE_OBSERVABILITY_ALERT_TYPES)[number]

export function buildProviderDegradationAlerts(signals: DegradationSignal[]): AlertTriggerInput[] {
  return signals.map((signal) => ({
    alertKey: `provider_degradation:${signal.providerId}:${signal.signal}`,
    alertType: "provider_degradation" satisfies VoiceObservabilityAlertType,
    severity: signal.severity,
    evidence: { signal: signal.signal, evidence: signal.evidence, providerId: signal.providerId },
    metadata: { autonomousRemediationDisabled: VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED },
  }))
}

export function buildSpikeAlert(input: {
  alertType: VoiceObservabilityAlertType
  count: number
  threshold: number
  windowLabel: string
}): AlertTriggerInput | null {
  if (input.count < input.threshold) return null
  return {
    alertKey: `${input.alertType}:${input.windowLabel}`,
    alertType: input.alertType,
    severity: input.count >= input.threshold * 2 ? "critical" : "warning",
    evidence: {
      count: input.count,
      threshold: input.threshold,
      window: input.windowLabel,
    },
    metadata: { autonomousRemediationDisabled: VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED },
  }
}

export function countActiveAlerts(alerts: VoiceObservabilityAlertPublicView[]): number {
  return alerts.filter((a) => a.status === "active").length
}
