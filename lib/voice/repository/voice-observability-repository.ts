import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  VoiceObservabilityAlertPublicView,
  VoiceObservabilityAlertStatus,
  VoiceObservabilityEventCategory,
  VoiceObservabilityEventPublicView,
  VoiceObservabilitySeverity,
} from "@/lib/voice/observability/types"
import { stripTranscriptPayload } from "@/lib/voice/observability/retention-controls"

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  return error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"))
}

type EventRow = {
  id: string
  organization_id: string
  event_category: VoiceObservabilityEventCategory
  event_type: string
  severity: VoiceObservabilitySeverity
  source_system: string
  source_session_id: string | null
  source_call_id: string | null
  source_campaign_id: string | null
  source_provider: string | null
  relationship_memory_profile_id: string | null
  related_customer_id: string | null
  related_prospect_id: string | null
  latency_ms: number | null
  duration_ms: number | null
  evidence_json: Record<string, unknown> | unknown
  metadata_json: Record<string, unknown> | unknown
  created_at: string
}

type AlertRow = {
  id: string
  organization_id: string
  alert_key: string
  alert_type: string
  severity: VoiceObservabilitySeverity
  status: VoiceObservabilityAlertStatus
  evidence_json: Record<string, unknown> | unknown
  metadata_json: Record<string, unknown> | unknown
  triggered_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

function mapEvent(row: EventRow): VoiceObservabilityEventPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventCategory: row.event_category,
    eventType: row.event_type,
    severity: row.severity,
    sourceSystem: row.source_system,
    sourceSessionId: row.source_session_id,
    sourceCallId: row.source_call_id,
    sourceCampaignId: row.source_campaign_id,
    sourceProvider: row.source_provider,
    relationshipMemoryProfileId: row.relationship_memory_profile_id,
    relatedCustomerId: row.related_customer_id,
    relatedProspectId: row.related_prospect_id,
    latencyMs: row.latency_ms,
    durationMs: row.duration_ms,
    evidence:
      row.evidence_json && typeof row.evidence_json === "object"
        ? (row.evidence_json as Record<string, unknown>)
        : {},
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    createdAt: row.created_at,
  }
}

function mapAlert(row: AlertRow): VoiceObservabilityAlertPublicView {
  return {
    id: row.id,
    organizationId: row.organization_id,
    alertKey: row.alert_key,
    alertType: row.alert_type,
    severity: row.severity,
    status: row.status,
    evidence:
      row.evidence_json && typeof row.evidence_json === "object"
        ? (row.evidence_json as Record<string, unknown>)
        : {},
    metadata:
      row.metadata_json && typeof row.metadata_json === "object"
        ? (row.metadata_json as Record<string, unknown>)
        : {},
    triggeredAt: row.triggered_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function insertObservabilityEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventCategory: VoiceObservabilityEventCategory
    eventType: string
    severity?: VoiceObservabilitySeverity
    sourceSystem?: string
    sourceSessionId?: string | null
    sourceCallId?: string | null
    sourceCampaignId?: string | null
    sourceProvider?: string | null
    relationshipMemoryProfileId?: string | null
    relatedCustomerId?: string | null
    relatedProspectId?: string | null
    latencyMs?: number | null
    durationMs?: number | null
    evidence?: Record<string, unknown>
    metadata?: Record<string, unknown>
  },
): Promise<VoiceObservabilityEventPublicView | null> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_observability_events")
    .insert({
      organization_id: input.organizationId,
      event_category: input.eventCategory,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      source_system: input.sourceSystem ?? "",
      source_session_id: input.sourceSessionId ?? null,
      source_call_id: input.sourceCallId ?? null,
      source_campaign_id: input.sourceCampaignId ?? null,
      source_provider: input.sourceProvider ?? null,
      relationship_memory_profile_id: input.relationshipMemoryProfileId ?? null,
      related_customer_id: input.relatedCustomerId ?? null,
      related_prospect_id: input.relatedProspectId ?? null,
      latency_ms: input.latencyMs ?? null,
      duration_ms: input.durationMs ?? null,
      evidence_json: input.evidence ?? {},
      metadata_json: stripTranscriptPayload(input.metadata ?? {}),
    })
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapEvent(data as EventRow) : null
}

export async function listObservabilityEvents(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    sinceIso?: string
    category?: VoiceObservabilityEventCategory
    limit?: number
  } = {},
): Promise<VoiceObservabilityEventPublicView[]> {
  let query = admin
    .schema("voice")
    .from("voice_observability_events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200)

  if (input.sinceIso) query = query.gte("created_at", input.sinceIso)
  if (input.category) query = query.eq("event_category", input.category)

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function upsertObservabilityAlert(
  admin: SupabaseClient,
  input: {
    organizationId: string
    alertKey: string
    alertType: string
    severity: VoiceObservabilitySeverity
    evidence?: Record<string, unknown>
    metadata?: Record<string, unknown>
  },
): Promise<VoiceObservabilityAlertPublicView | null> {
  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("voice")
    .from("voice_observability_alert_states")
    .upsert(
      {
        organization_id: input.organizationId,
        alert_key: input.alertKey,
        alert_type: input.alertType,
        severity: input.severity,
        status: "active",
        evidence_json: input.evidence ?? {},
        metadata_json: input.metadata ?? {},
        triggered_at: now,
        resolved_at: null,
        updated_at: now,
      },
      { onConflict: "organization_id,alert_key" },
    )
    .select("*")
    .maybeSingle()

  if (error) {
    if (isMissingTableError(error)) return null
    throw new Error(error.message)
  }
  return data ? mapAlert(data as AlertRow) : null
}

export async function listObservabilityAlerts(
  admin: SupabaseClient,
  organizationId: string,
  input: { status?: VoiceObservabilityAlertStatus; limit?: number } = {},
): Promise<VoiceObservabilityAlertPublicView[]> {
  let query = admin
    .schema("voice")
    .from("voice_observability_alert_states")
    .select("*")
    .eq("organization_id", organizationId)
    .order("triggered_at", { ascending: false })
    .limit(input.limit ?? 50)

  if (input.status) query = query.eq("status", input.status)

  const { data, error } = await query
  if (error) {
    if (isMissingTableError(error)) return []
    throw new Error(error.message)
  }
  return (data ?? []).map((row) => mapAlert(row as AlertRow))
}

export async function storeObservabilityMetricSnapshot(
  admin: SupabaseClient,
  input: {
    organizationId: string
    snapshotType: string
    windowStart: string
    windowEnd: string
    payload: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await admin.schema("voice").from("voice_observability_metric_snapshots").insert({
    organization_id: input.organizationId,
    snapshot_type: input.snapshotType,
    window_start: input.windowStart,
    window_end: input.windowEnd,
    payload_json: input.payload,
  })
  if (error && !isMissingTableError(error)) throw new Error(error.message)
}

export async function cleanupObservabilityEventsBefore(
  admin: SupabaseClient,
  organizationId: string,
  beforeIso: string,
): Promise<number> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_observability_events")
    .delete()
    .eq("organization_id", organizationId)
    .lt("created_at", beforeIso)
    .select("id")

  if (error) {
    if (isMissingTableError(error)) return 0
    throw new Error(error.message)
  }
  return data?.length ?? 0
}

export async function countActiveOutboundSessionsObs(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("outbound_session_status", ["active", "initiating", "escalation_pending", "operator_joined", "voicemail_mode"])
    .is("ended_at", null)

  if (error) return 0
  return count ?? 0
}

export async function countActiveReceptionistSessionsObs(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("ended_at", null)

  if (error) return 0
  return count ?? 0
}

export async function countActiveVoiceCallsObs(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_calls")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["ringing", "in_progress", "on_hold"])

  if (error) return 0
  return count ?? 0
}

export async function loadComplianceAuditEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ action: string; channel: string | null; decision: string | null; createdAt: string }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_compliance_audit_events")
    .select("action, channel, decision, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return []
  return (data ?? []).map((row) => ({
    action: String(row.action),
    channel: (row.channel as string | null) ?? null,
    decision: (row.decision as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

export async function loadOutboundEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ eventType: string; providerSource: string | null; createdAt: string }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_events")
    .select("event_type, provider_source, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return []
  return (data ?? []).map((row) => ({
    eventType: String(row.event_type),
    providerSource: (row.provider_source as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

export async function loadReceptionistEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ eventType: string; providerSource: string | null; createdAt: string }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_receptionist_events")
    .select("event_type, provider_source, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(500)

  if (error) return []
  return (data ?? []).map((row) => ({
    eventType: String(row.event_type),
    providerSource: (row.provider_source as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

export async function loadCopilotSuggestionsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ status: string; createdAt: string }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_copilot_suggestions")
    .select("status, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .limit(500)

  if (error) return []
  return (data ?? []).map((row) => ({
    status: String(row.status),
    createdAt: row.created_at as string,
  }))
}

export async function loadVoiceDropStats(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ recipients: number; approved: number; delivered: number; suppressed: number }> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_drop_recipients")
    .select("status, manual_review_required, compliance_decision")
    .eq("organization_id", organizationId)
    .limit(1000)

  if (error || !data) return { recipients: 0, approved: 0, delivered: 0, suppressed: 0 }

  let approved = 0
  let delivered = 0
  let suppressed = 0
  for (const row of data) {
    const status = String(row.status)
    if (status === "delivered") delivered += 1
    if (status === "suppressed" || row.compliance_decision === "blocked") suppressed += 1
    if (!row.manual_review_required && status !== "suppressed") approved += 1
  }
  return { recipients: data.length, approved, delivered, suppressed }
}

export async function loadOutboundSessionStats(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ queued: number; approved: number; completed: number }> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_ai_outbound_sessions")
    .select("outbound_session_status, approved_by")
    .eq("organization_id", organizationId)
    .limit(1000)

  if (error || !data) return { queued: 0, approved: 0, completed: 0 }

  let queued = 0
  let approved = 0
  let completed = 0
  for (const row of data) {
    const status = String(row.outbound_session_status)
    if (status === "queued" || status === "pending_operator_approval") queued += 1
    if (row.approved_by) approved += 1
    if (status === "completed") completed += 1
  }
  return { queued, approved, completed }
}

export async function loadMissedCallRecoveryCountSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("voice")
    .from("voice_missed_call_recovery_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)

  if (error) return 0
  return count ?? 0
}

export async function loadRetentionEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ eventType: string; status: string; healthDirection: string | null }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_retention_intelligence_events")
    .select("event_type, status, health_direction")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .limit(300)

  if (error) return []
  return (data ?? []).map((row) => ({
    eventType: String(row.event_type),
    status: String(row.status),
    healthDirection: (row.health_direction as string | null) ?? null,
  }))
}

export async function loadRevenueEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ eventType: string; status: string }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_revenue_intelligence_events")
    .select("event_type, status")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .limit(300)

  if (error) return []
  return (data ?? []).map((row) => ({
    eventType: String(row.event_type),
    status: String(row.status),
  }))
}

export async function loadObjectionEventsSince(
  admin: SupabaseClient,
  organizationId: string,
  sinceIso: string,
): Promise<Array<{ objectionType: string; resolved: boolean }>> {
  const { data, error } = await admin
    .schema("voice")
    .from("voice_objection_events")
    .select("objection_type, resolved")
    .eq("organization_id", organizationId)
    .gte("created_at", sinceIso)
    .limit(300)

  if (error) return []
  return (data ?? []).map((row) => ({
    objectionType: String(row.objection_type),
    resolved: Boolean(row.resolved),
  }))
}
