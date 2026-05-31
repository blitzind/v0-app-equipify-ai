import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildAiOrchestrationSnapshot,
  emptyAiOrchestrationCounts,
} from "@/lib/voice/observability/ai-orchestration-analytics"
import {
  buildProviderDegradationAlerts,
  buildSpikeAlert,
  countActiveAlerts,
} from "@/lib/voice/observability/alert-foundations"
import {
  buildCampaignAnalyticsSnapshot,
  emptyCampaignSourceCounts,
} from "@/lib/voice/observability/campaign-analytics"
import {
  buildComplianceAnalyticsSnapshot,
  emptyComplianceSourceCounts,
  incrementChannelRisk,
} from "@/lib/voice/observability/compliance-analytics"
import { buildEscalationAnalyticsSnapshot } from "@/lib/voice/observability/escalation-analytics"
import { detectDegradationSignals } from "@/lib/voice/observability/provider-health/degradation-detector"
import { aggregateProviderHealthMetrics } from "@/lib/voice/observability/provider-health/provider-health-aggregator"
import {
  buildRelationshipRevenueSnapshot,
  emptyRelationshipRevenueCounts,
  incrementMapCount,
} from "@/lib/voice/observability/relationship-revenue-analytics"
import {
  capRealtimePayload,
  observabilityRetentionCutoffIso,
  rollingWindowStartIso,
} from "@/lib/voice/observability/retention-controls"
import {
  buildOverviewSnapshot,
  buildProviderHealthSnapshot,
  buildRealtimeSnapshot,
} from "@/lib/voice/observability/snapshot-builder"
import type {
  VoiceObservabilityComplianceSnapshot,
  VoiceObservabilityEscalationSnapshot,
  VoiceObservabilityOverviewSnapshot,
  VoiceObservabilityProviderSnapshot,
  VoiceObservabilityReadinessSnapshot,
  VoiceObservabilityRealtimeSnapshot,
} from "@/lib/voice/observability/types"
import {
  VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED,
  VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
  VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS,
  VOICE_OBSERVABILITY_QA_MARKER,
  VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
} from "@/lib/voice/observability/types"
import {
  cleanupObservabilityEventsBefore,
  countActiveOutboundSessionsObs,
  countActiveReceptionistSessionsObs,
  countActiveVoiceCallsObs,
  listObservabilityAlerts,
  listObservabilityEvents,
  loadComplianceAuditEventsSince,
  loadCopilotSuggestionsSince,
  loadMissedCallRecoveryCountSince,
  loadObjectionEventsSince,
  loadOutboundEventsSince,
  loadOutboundSessionStats,
  loadReceptionistEventsSince,
  loadRetentionEventsSince,
  loadRevenueEventsSince,
  loadVoiceDropStats,
  storeObservabilityMetricSnapshot,
  upsertObservabilityAlert,
  insertObservabilityEvent,
} from "@/lib/voice/repository/voice-observability-repository"
import { probeVoiceSchemaHealth } from "@/lib/voice/schema-health"

export function isVoiceObservabilityEnabled(): boolean {
  return process.env.VOICE_OBSERVABILITY_ENABLED === "true"
}

async function loadSourceAggregates(admin: SupabaseClient, organizationId: string) {
  const sinceIso = rollingWindowStartIso(VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS)

  const [
    observabilityEvents,
    complianceAudit,
    outboundEvents,
    receptionistEvents,
    copilotSuggestions,
    voiceDropStats,
    outboundSessionStats,
    missedCallRecoveryCount,
    retentionEvents,
    revenueEvents,
    objectionEvents,
  ] = await Promise.all([
    listObservabilityEvents(admin, organizationId, { sinceIso, limit: 500 }),
    loadComplianceAuditEventsSince(admin, organizationId, sinceIso),
    loadOutboundEventsSince(admin, organizationId, sinceIso),
    loadReceptionistEventsSince(admin, organizationId, sinceIso),
    loadCopilotSuggestionsSince(admin, organizationId, sinceIso),
    loadVoiceDropStats(admin, organizationId),
    loadOutboundSessionStats(admin, organizationId),
    loadMissedCallRecoveryCountSince(admin, organizationId, sinceIso),
    loadRetentionEventsSince(admin, organizationId, sinceIso),
    loadRevenueEventsSince(admin, organizationId, sinceIso),
    loadObjectionEventsSince(admin, organizationId, sinceIso),
  ])

  return {
    sinceIso,
    observabilityEvents,
    complianceAudit,
    outboundEvents,
    receptionistEvents,
    copilotSuggestions,
    voiceDropStats,
    outboundSessionStats,
    missedCallRecoveryCount,
    retentionEvents,
    revenueEvents,
    objectionEvents,
  }
}

function buildComplianceFromAudit(
  audit: Awaited<ReturnType<typeof loadComplianceAuditEventsSince>>,
): VoiceObservabilityComplianceSnapshot {
  const counts = emptyComplianceSourceCounts()

  for (const row of audit) {
    counts.auditTrend.set(row.action, (counts.auditTrend.get(row.action) ?? 0) + 1)
    const channel = row.channel ?? "unknown"

    if (row.decision === "blocked") {
      counts.blocked24h += 1
      incrementChannelRisk(counts.channelRisk, channel, "blocked")
    }
    if (row.decision === "manual_review_required") {
      counts.manualReview24h += 1
      incrementChannelRisk(counts.channelRisk, channel, "manualReview")
    }
    if (row.action.includes("opt_out")) counts.optOut24h += 1
    if (row.action.includes("suppression")) counts.suppression24h += 1
    if (row.action.includes("outside_call_hours") || row.action.includes("call_hour")) {
      counts.callHourViolation24h += 1
    }
    if (row.action.includes("consent") && row.decision === "manual_review_required") {
      counts.consentUnknown24h += 1
    }
  }

  return buildComplianceAnalyticsSnapshot(counts)
}

function buildAiOrchestrationFromSources(input: Awaited<ReturnType<typeof loadSourceAggregates>>) {
  const counts = emptyAiOrchestrationCounts()

  counts.suggestionVolume = input.copilotSuggestions.length
  for (const s of input.copilotSuggestions) {
    if (s.status === "copied" || s.status === "copy") counts.suggestionsCopied += 1
    if (s.status === "adopted" || s.status === "accepted") counts.suggestionsAdopted += 1
  }

  for (const event of [...input.outboundEvents, ...input.receptionistEvents]) {
    if (event.eventType.includes("escalation")) counts.escalationCount += 1
    if (event.eventType === "operator_joined" || event.eventType.includes("takeover")) {
      counts.operatorTakeoverCount += 1
    }
    if (event.eventType.includes("fallback") || event.eventType === "provider_fallback") {
      counts.aiFallbackCount += 1
    }
    if (event.eventType === "voicemail_detected") counts.voicemailAttempted += 1
    if (event.eventType === "qualification_completed") counts.qualificationCompleted += 1
    if (event.eventType.includes("qualification")) counts.qualificationStarted += 1
    if (event.eventType === "scheduling_requested") counts.schedulingRequests += 1
    if (event.eventType === "opt_out_detected") counts.optOutTerminations += 1
    if (event.eventType === "conversation_terminated" && event.eventType.includes("voicemail")) {
      counts.voicemailCompleted += 1
    }
  }

  for (const event of input.observabilityEvents) {
    if (event.eventCategory === "ai_orchestration" || event.eventCategory === "escalation") {
      const phase = String(event.metadata.phase ?? event.eventType)
      counts.phaseCounts.set(phase, (counts.phaseCounts.get(phase) ?? 0) + 1)
    }
  }

  return buildAiOrchestrationSnapshot(counts)
}

function buildCampaignFromSources(input: Awaited<ReturnType<typeof loadSourceAggregates>>) {
  const counts = emptyCampaignSourceCounts()
  counts.voiceDropRecipients = input.voiceDropStats.recipients
  counts.voiceDropApproved = input.voiceDropStats.approved
  counts.voiceDropDelivered = input.voiceDropStats.delivered
  counts.voiceDropSuppressed = input.voiceDropStats.suppressed
  counts.missedCallRecovery24h = input.missedCallRecoveryCount
  counts.outboundAiQueued = input.outboundSessionStats.queued
  counts.outboundAiApproved = input.outboundSessionStats.approved
  counts.outboundAiCompleted = input.outboundSessionStats.completed

  for (const event of input.outboundEvents) {
    if (event.eventType === "callback_requested") counts.callbackAttempted += 1
    if (event.eventType === "conversation_terminated") counts.callbackCompleted += 1
    if (event.eventType === "opt_out_detected") counts.optOutTerminations24h += 1
    if (event.eventType === "outbound_failed") counts.retryAttempts += 1
    counts.totalAttempts += 1
  }

  return buildCampaignAnalyticsSnapshot(counts)
}

function buildRelationshipRevenueFromSources(input: Awaited<ReturnType<typeof loadSourceAggregates>>) {
  const counts = emptyRelationshipRevenueCounts()

  for (const row of input.objectionEvents) {
    if (!row.resolved) incrementMapCount(counts.unresolvedObjections, row.objectionType)
  }

  for (const row of input.retentionEvents) {
    if (row.eventType.includes("churn") || row.healthDirection === "at_risk" || row.healthDirection === "declining") {
      incrementMapCount(counts.retentionRisk, row.eventType)
    }
    if (row.eventType.includes("expansion") || row.eventType.includes("upsell") || row.eventType.includes("cross_sell")) {
      incrementMapCount(counts.expansionOpportunities, row.eventType)
    }
    if (row.eventType.includes("escalation")) counts.escalationRiskCount += 1
    if (row.eventType === "follow_up_needed") counts.followUpNeeded += 1
    if (row.status === "resolved") counts.followUpResolved += 1
    if (row.healthDirection) incrementMapCount(counts.momentum, row.healthDirection)
  }

  for (const row of input.revenueEvents) {
    incrementMapCount(counts.buyingStage, row.eventType)
  }

  return buildRelationshipRevenueSnapshot(counts)
}

function buildProviderHealthFromSources(
  events: Awaited<ReturnType<typeof listObservabilityEvents>>,
  outboundEvents: Awaited<ReturnType<typeof loadOutboundEventsSince>>,
  receptionistEvents: Awaited<ReturnType<typeof loadReceptionistEventsSince>>,
): VoiceObservabilityProviderSnapshot {
  const providerRows = [
    ...events
      .filter((e) => e.eventCategory === "provider")
      .map((e) => ({
        sourceProvider: e.sourceProvider,
        eventType: e.eventType,
        latencyMs: e.latencyMs,
        metadata: e.metadata,
      })),
    ...outboundEvents.map((e) => ({
      sourceProvider: e.providerSource,
      eventType: e.eventType,
      latencyMs: null,
      metadata: {},
    })),
    ...receptionistEvents.map((e) => ({
      sourceProvider: e.providerSource,
      eventType: e.eventType,
      latencyMs: null,
      metadata: {},
    })),
  ]

  const metrics = aggregateProviderHealthMetrics(providerRows, VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS)
  return buildProviderHealthSnapshot(metrics)
}

function buildEscalationFromSources(input: Awaited<ReturnType<typeof loadSourceAggregates>>): VoiceObservabilityEscalationSnapshot {
  const rows = [
    ...input.observabilityEvents
      .filter((e) => e.eventCategory === "escalation" || e.eventCategory === "operator" || e.eventCategory === "transfer")
      .map((e) => ({
        sourceSystem: e.sourceSystem,
        eventType: e.eventType,
        createdAt: e.createdAt,
      })),
    ...input.outboundEvents.map((e) => ({
      sourceSystem: "outbound_ai",
      eventType: e.eventType,
      createdAt: e.createdAt,
    })),
    ...input.receptionistEvents.map((e) => ({
      sourceSystem: "receptionist",
      eventType: e.eventType,
      createdAt: e.createdAt,
    })),
  ]

  return buildEscalationAnalyticsSnapshot({ events: rows, windowHours: VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS })
}

async function syncPassiveAlerts(
  admin: SupabaseClient,
  organizationId: string,
  providerHealth: VoiceObservabilityProviderSnapshot,
  escalations: VoiceObservabilityEscalationSnapshot,
  compliance: VoiceObservabilityComplianceSnapshot,
): Promise<void> {
  const degradationSignals = detectDegradationSignals(providerHealth.providers)
  for (const alert of buildProviderDegradationAlerts(degradationSignals)) {
    await upsertObservabilityAlert(admin, { organizationId, ...alert })
  }

  const spikeAlerts = [
    buildSpikeAlert({
      alertType: "escalation_spike",
      count: escalations.escalationCount24h,
      threshold: 10,
      windowLabel: "24h",
    }),
    buildSpikeAlert({
      alertType: "compliance_anomaly_spike",
      count: compliance.blockedCount24h + compliance.manualReviewCount24h,
      threshold: 20,
      windowLabel: "24h",
    }),
    buildSpikeAlert({
      alertType: "operator_takeover_spike",
      count: escalations.operatorTakeoverCount24h,
      threshold: 8,
      windowLabel: "24h",
    }),
  ]

  for (const alert of spikeAlerts) {
    if (alert) await upsertObservabilityAlert(admin, { organizationId, ...alert })
  }
}

export async function fetchVoiceObservabilityReadiness(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityReadinessSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const enabled = isVoiceObservabilityEnabled()

  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    schemaReady: schema.ready,
    observabilityEnabled: enabled,
    providerHealthVisibility: schema.ready,
    orchestrationAnalyticsReady: schema.ready,
    complianceAnalyticsReady: schema.ready,
    campaignAnalyticsReady: schema.ready,
    realtimeMonitoringReady: schema.ready && enabled,
    alertFoundationReady: schema.ready,
    transcriptObservabilityReady: schema.ready,
    eventRetentionDays: VOICE_OBSERVABILITY_EVENT_RETENTION_DAYS,
    rollingWindowHours: VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
    autonomousRemediationDisabled: VOICE_OBSERVABILITY_AUTONOMOUS_REMEDIATION_DISABLED,
    autoProviderSwitchDisabled: VOICE_OBSERVABILITY_AUTO_PROVIDER_SWITCH_DISABLED,
    message: enabled
      ? "Voice observability enabled — operator-visible analytics, no autonomous remediation."
      : "Set VOICE_OBSERVABILITY_ENABLED=true to activate voice observability analytics.",
  }
}

export async function fetchVoiceObservabilityOverview(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityOverviewSnapshot> {
  const schema = await probeVoiceSchemaHealth(admin)
  const enabled = isVoiceObservabilityEnabled()
  const sources = await loadSourceAggregates(admin, organizationId)

  const providerHealth = buildProviderHealthFromSources(
    sources.observabilityEvents,
    sources.outboundEvents,
    sources.receptionistEvents,
  )
  const aiOrchestration = buildAiOrchestrationFromSources(sources)
  const campaigns = buildCampaignFromSources(sources)
  const compliance = buildComplianceFromAudit(sources.complianceAudit)
  const escalations = buildEscalationFromSources(sources)
  const relationshipRevenue = buildRelationshipRevenueFromSources(sources)
  const realtime = await fetchVoiceObservabilityRealtime(admin, organizationId)

  if (enabled && schema.ready) {
    await syncPassiveAlerts(admin, organizationId, providerHealth, escalations, compliance)
    await storeObservabilityMetricSnapshot(admin, {
      organizationId,
      snapshotType: "overview",
      windowStart: sources.sinceIso,
      windowEnd: new Date().toISOString(),
      payload: {
        activeAlertCount: realtime.activeAlerts.length,
        escalationCount: escalations.escalationCount24h,
      },
    })
    await cleanupObservabilityEventsBefore(admin, organizationId, observabilityRetentionCutoffIso())
  }

  const activeAlerts = await listObservabilityAlerts(admin, organizationId, { status: "active", limit: 20 })

  return buildOverviewSnapshot({
    schemaReady: schema.ready,
    observabilityEnabled: enabled,
    providerHealth,
    aiOrchestration,
    campaigns,
    compliance,
    escalations,
    relationshipRevenue,
    realtime,
    activeAlertCount: countActiveAlerts(activeAlerts),
  })
}

export async function fetchVoiceObservabilityProviders(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityProviderSnapshot> {
  const sinceIso = rollingWindowStartIso(VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS)
  const [events, outboundEvents, receptionistEvents] = await Promise.all([
    listObservabilityEvents(admin, organizationId, { sinceIso, category: "provider", limit: 500 }),
    loadOutboundEventsSince(admin, organizationId, sinceIso),
    loadReceptionistEventsSince(admin, organizationId, sinceIso),
  ])
  return buildProviderHealthFromSources(events, outboundEvents, receptionistEvents)
}

export async function fetchVoiceObservabilityEscalations(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityEscalationSnapshot> {
  const sources = await loadSourceAggregates(admin, organizationId)
  return buildEscalationFromSources(sources)
}

export async function fetchVoiceObservabilityCompliance(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityComplianceSnapshot> {
  const sinceIso = rollingWindowStartIso(VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS)
  const audit = await loadComplianceAuditEventsSince(admin, organizationId, sinceIso)
  return buildComplianceFromAudit(audit)
}

export async function fetchVoiceObservabilityCampaigns(
  admin: SupabaseClient,
  organizationId: string,
) {
  const sources = await loadSourceAggregates(admin, organizationId)
  return buildCampaignFromSources(sources)
}

export async function fetchVoiceObservabilityRealtime(
  admin: SupabaseClient,
  organizationId: string,
): Promise<VoiceObservabilityRealtimeSnapshot> {
  const sinceIso = rollingWindowStartIso(VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS)

  const [
    activeSessionsCount,
    activeOutboundSessionsCount,
    activeReceptionistSessionsCount,
    recentEvents,
    activeAlerts,
    outboundEvents,
    receptionistEvents,
    providerEvents,
  ] = await Promise.all([
    countActiveVoiceCallsObs(admin, organizationId),
    countActiveOutboundSessionsObs(admin, organizationId),
    countActiveReceptionistSessionsObs(admin, organizationId),
    listObservabilityEvents(admin, organizationId, { limit: 30 }),
    listObservabilityAlerts(admin, organizationId, { status: "active", limit: 20 }),
    loadOutboundEventsSince(admin, organizationId, sinceIso),
    loadReceptionistEventsSince(admin, organizationId, sinceIso),
    listObservabilityEvents(admin, organizationId, { sinceIso, category: "provider", limit: 200 }),
  ])

  const providerHealthSummary = aggregateProviderHealthMetrics(
    [
      ...providerEvents.map((e) => ({
        sourceProvider: e.sourceProvider,
        eventType: e.eventType,
        latencyMs: e.latencyMs,
        metadata: e.metadata,
      })),
      ...outboundEvents.map((e) => ({
        sourceProvider: e.providerSource,
        eventType: e.eventType,
        latencyMs: null,
        metadata: {},
      })),
      ...receptionistEvents.map((e) => ({
        sourceProvider: e.providerSource,
        eventType: e.eventType,
        latencyMs: null,
        metadata: {},
      })),
    ],
    VOICE_OBSERVABILITY_ROLLING_WINDOW_HOURS,
  )

  return buildRealtimeSnapshot({
    activeSessionsCount,
    activeOutboundSessionsCount,
    activeReceptionistSessionsCount,
    providerHealthSummary,
    recentEvents: capRealtimePayload(recentEvents),
    activeAlerts: capRealtimePayload(activeAlerts),
  })
}

export async function recordVoiceObservabilityEvent(
  admin: SupabaseClient,
  input: Parameters<typeof insertObservabilityEvent>[1],
) {
  return insertObservabilityEvent(admin, input)
}
