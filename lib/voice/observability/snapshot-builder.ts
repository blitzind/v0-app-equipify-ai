/** Observability snapshot assembly — Phase 5B. */

import type {
  VoiceObservabilityOverviewSnapshot,
  VoiceObservabilityProviderSnapshot,
  VoiceObservabilityRealtimeSnapshot,
} from "@/lib/voice/observability/types"
import {
  VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
  VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED,
  VOICE_OBSERVABILITY_QA_MARKER,
  VOICE_OBSERVABILITY_REALTIME_POLL_MS,
  VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
} from "@/lib/voice/observability/types"
import type { VoiceObservabilityAiOrchestrationSnapshot } from "@/lib/voice/observability/types"
import type { VoiceObservabilityCampaignSnapshot } from "@/lib/voice/observability/types"
import type { VoiceObservabilityComplianceSnapshot } from "@/lib/voice/observability/types"
import type { VoiceObservabilityEscalationSnapshot } from "@/lib/voice/observability/types"
import type { VoiceObservabilityRelationshipRevenueSnapshot } from "@/lib/voice/observability/types"
import type { ProviderHealthMetric } from "@/lib/voice/observability/types"
import type {
  VoiceObservabilityAlertPublicView,
  VoiceObservabilityEventPublicView,
} from "@/lib/voice/observability/types"

export function buildProviderHealthSnapshot(
  providers: ProviderHealthMetric[],
  windowHours: number = VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
): VoiceObservabilityProviderSnapshot {
  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    windowHours,
    providers,
    autoProviderSwitchDisabled: true,
    message: "Provider health — degradation visibility only. Auto-switch disabled.",
  }
}

export function buildRealtimeSnapshot(input: {
  activeSessionsCount: number
  activeOutboundSessionsCount: number
  activeReceptionistSessionsCount: number
  providerHealthSummary: ProviderHealthMetric[]
  recentEvents: VoiceObservabilityEventPublicView[]
  activeAlerts: VoiceObservabilityAlertPublicView[]
}): VoiceObservabilityRealtimeSnapshot {
  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    activeSessionsCount: input.activeSessionsCount,
    activeOutboundSessionsCount: input.activeOutboundSessionsCount,
    activeReceptionistSessionsCount: input.activeReceptionistSessionsCount,
    providerHealthSummary: input.providerHealthSummary.slice(0, 6),
    recentEvents: input.recentEvents,
    activeAlerts: input.activeAlerts,
    pollIntervalMs: VOICE_OBSERVABILITY_REALTIME_POLL_MS,
    message: "Realtime operational snapshot — safe polling, capped payloads.",
  }
}

export function buildOverviewSnapshot(input: {
  schemaReady: boolean
  observabilityEnabled: boolean
  providerHealth: VoiceObservabilityProviderSnapshot
  aiOrchestration: VoiceObservabilityAiOrchestrationSnapshot
  campaigns: VoiceObservabilityCampaignSnapshot
  compliance: VoiceObservabilityComplianceSnapshot
  escalations: VoiceObservabilityEscalationSnapshot
  relationshipRevenue: VoiceObservabilityRelationshipRevenueSnapshot
  realtime: VoiceObservabilityRealtimeSnapshot
  activeAlertCount: number
}): VoiceObservabilityOverviewSnapshot {
  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    schemaReady: input.schemaReady,
    observabilityEnabled: input.observabilityEnabled,
    providerHealth: input.providerHealth,
    aiOrchestration: input.aiOrchestration,
    campaigns: input.campaigns,
    compliance: input.compliance,
    escalations: input.escalations,
    relationshipRevenue: input.relationshipRevenue,
    realtime: input.realtime,
    activeAlertCount: input.activeAlertCount,
    autonomousRemediationDisabled: VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED,
    autoProviderSwitchDisabled: VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
    message: "Voice observability overview — operator-visible, auditable, bounded.",
  }
}
