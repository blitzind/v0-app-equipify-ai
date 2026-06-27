/** GE-AI-2I-PROD-1 — Persistent autonomous outbound scope repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthAutonomousOutboundActionRecord,
  GrowthAutonomousOutboundActionStatus,
  GrowthAutonomousOutboundActionType,
  GrowthAutonomousOutboundChannel,
  GrowthAutonomousOutboundGateId,
  GrowthAutonomousOutboundScope,
  GrowthAutonomousOutboundScopeSource,
  GrowthAutonomousOutboundScopeStatus,
  GrowthAutonomousOutboundStopCondition,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"
import {
  GROWTH_AUTONOMOUS_OUTBOUND_CHANNELS,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SOURCES,
  GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_STATUSES,
} from "@/lib/growth/aios/outbound/growth-autonomous-outbound-scope-types"

type ScopeRow = {
  id: string
  organization_id: string
  source: string
  source_id: string
  status: string
  approved_by_user_id: string | null
  approved_at: string | null
  activated_at: string | null
  paused_at: string | null
  completed_at: string | null
  expires_at: string
  title: string
  summary: string
  allowed_channels: string[] | null
  audience: Record<string, unknown> | null
  limits: Record<string, unknown> | null
  required_checks: Record<string, unknown> | null
  stop_conditions: Record<string, unknown> | null
  policy: Record<string, unknown> | null
  voice_drop_certified: boolean
  ai_voice_explicitly_approved: boolean
  blocked_reason: string | null
  audit_metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type ActionRow = {
  id: string
  organization_id: string
  scope_id: string
  lead_id: string | null
  channel: string
  action_type: string
  status: string
  sequence_job_id: string | null
  transport_path: string
  transport_reference: string | null
  blocked_gate: string | null
  blocked_reason: string | null
  correlation_id: string
  idempotency_key: string | null
  selected_at: string | null
  queued_at: string | null
  completed_at: string | null
  failed_at: string | null
  audit_metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  organization_id: string
  scope_id: string
  action_id: string | null
  event_type: string
  payload: Record<string, unknown> | null
  qa_marker: string
  created_at: string
}

const SCOPE_SELECT =
  "id, organization_id, source, source_id, status, approved_by_user_id, approved_at, activated_at, paused_at, completed_at, expires_at, title, summary, allowed_channels, audience, limits, required_checks, stop_conditions, policy, voice_drop_certified, ai_voice_explicitly_approved, blocked_reason, audit_metadata, qa_marker, created_at, updated_at"

const ACTION_SELECT =
  "id, organization_id, scope_id, lead_id, channel, action_type, status, sequence_job_id, transport_path, transport_reference, blocked_gate, blocked_reason, correlation_id, idempotency_key, selected_at, queued_at, completed_at, failed_at, audit_metadata, qa_marker, created_at, updated_at"

function scopesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("autonomous_outbound_scopes")
}

function actionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("autonomous_outbound_scope_actions")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("autonomous_outbound_scope_events")
}

function isScopeSource(value: string): value is GrowthAutonomousOutboundScopeSource {
  return (GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_SOURCES as readonly string[]).includes(value)
}

function isScopeStatus(value: string): value is GrowthAutonomousOutboundScopeStatus {
  return (GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_STATUSES as readonly string[]).includes(value)
}

function isChannel(value: string): value is GrowthAutonomousOutboundChannel {
  return (GROWTH_AUTONOMOUS_OUTBOUND_CHANNELS as readonly string[]).includes(value)
}

export function mapAutonomousOutboundScopeRow(row: ScopeRow): GrowthAutonomousOutboundScope {
  const audience = row.audience ?? {}
  const limits = row.limits ?? {}
  const requiredChecks = row.required_checks ?? {}
  const stopConditions = row.stop_conditions ?? {}
  const policy = row.policy ?? {}

  return {
    id: row.id,
    organizationId: row.organization_id,
    source: isScopeSource(row.source) ? row.source : "human_approval_center",
    sourceId: row.source_id,
    status: isScopeStatus(row.status) ? row.status : "draft",
    approvedByUserId: row.approved_by_user_id ?? "",
    approvedAt: row.approved_at ?? row.created_at,
    expiresAt: row.expires_at,
    allowedChannels: (row.allowed_channels ?? []).filter(isChannel),
    audience: {
      leadIds: Array.isArray(audience.leadIds) ? audience.leadIds.map(String) : undefined,
      companyIds: Array.isArray(audience.companyIds) ? audience.companyIds.map(String) : undefined,
      personIds: Array.isArray(audience.personIds) ? audience.personIds.map(String) : undefined,
      savedSearchId: typeof audience.savedSearchId === "string" ? audience.savedSearchId : undefined,
      maxAudienceSize:
        typeof audience.maxAudienceSize === "number" ? audience.maxAudienceSize : undefined,
    },
    limits: {
      maxActionsTotal: Number(limits.maxActionsTotal ?? 0),
      maxActionsPerDay: Number(limits.maxActionsPerDay ?? 0),
      maxActionsPerLead: Number(limits.maxActionsPerLead ?? 0),
      maxSmsPerDay: typeof limits.maxSmsPerDay === "number" ? limits.maxSmsPerDay : undefined,
      maxEmailsPerDay: typeof limits.maxEmailsPerDay === "number" ? limits.maxEmailsPerDay : undefined,
      maxVoiceDropsPerDay:
        typeof limits.maxVoiceDropsPerDay === "number" ? limits.maxVoiceDropsPerDay : undefined,
      quietHours:
        limits.quietHours && typeof limits.quietHours === "object"
          ? (limits.quietHours as GrowthAutonomousOutboundScope["limits"]["quietHours"])
          : undefined,
    },
    requiredChecks: {
      growthAutonomy: true,
      humanApproval: true,
      suppression: true,
      senderReadiness: true,
      compliance: true,
      optOut: true,
      budget: true,
      ...(requiredChecks as GrowthAutonomousOutboundScope["requiredChecks"]),
    },
    stopConditions: {
      onReply: Boolean(stopConditions.onReply),
      onPositiveIntent:
        stopConditions.onPositiveIntent === undefined
          ? undefined
          : Boolean(stopConditions.onPositiveIntent),
      onNegativeIntent:
        stopConditions.onNegativeIntent === undefined
          ? undefined
          : Boolean(stopConditions.onNegativeIntent),
      onBounce:
        stopConditions.onBounce === undefined ? undefined : Boolean(stopConditions.onBounce),
      onUnsubscribe:
        stopConditions.onUnsubscribe === undefined
          ? undefined
          : Boolean(stopConditions.onUnsubscribe),
      onMeetingBooked:
        stopConditions.onMeetingBooked === undefined
          ? undefined
          : Boolean(stopConditions.onMeetingBooked),
      onManualPause:
        stopConditions.onManualPause === undefined
          ? undefined
          : Boolean(stopConditions.onManualPause),
    },
    policy: {
      autonomyCapability: String(policy.autonomyCapability ?? "autonomous_outbound_actions"),
      requiresHumanApproval: true,
      enforcementSource: String(policy.enforcementSource ?? "growth_ai_os_autonomy_policy_engine"),
    },
    title: row.title,
    summary: row.summary,
    voiceDropCertified: row.voice_drop_certified,
    aiVoiceExplicitlyApproved: row.ai_voice_explicitly_approved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    activatedAt: row.activated_at,
    pausedAt: row.paused_at,
    completedAt: row.completed_at,
    blockedReason: row.blocked_reason,
  }
}

export function mapAutonomousOutboundActionRow(row: ActionRow): GrowthAutonomousOutboundActionRecord {
  return {
    id: row.id,
    scopeId: row.scope_id,
    organizationId: row.organization_id,
    actionType: row.action_type as GrowthAutonomousOutboundActionType,
    channel: isChannel(row.channel) ? row.channel : "email",
    status: row.status as GrowthAutonomousOutboundActionStatus,
    leadId: row.lead_id,
    sequenceJobId: row.sequence_job_id,
    transportPath: row.transport_path,
    transportReference: row.transport_reference,
    blockedGate: (row.blocked_gate as GrowthAutonomousOutboundGateId | null) ?? null,
    blockedReason: row.blocked_reason,
    correlationId: row.correlation_id,
    idempotencyKey: row.idempotency_key,
    selectedAt: row.selected_at,
    queuedAt: row.queued_at,
    failedAt: row.failed_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  }
}

function scopeToInsertRow(scope: GrowthAutonomousOutboundScope): Record<string, unknown> {
  return {
    id: scope.id,
    organization_id: scope.organizationId,
    source: scope.source,
    source_id: scope.sourceId,
    status: scope.status,
    approved_by_user_id: scope.approvedByUserId || null,
    approved_at: scope.approvedAt,
    activated_at: scope.activatedAt ?? null,
    paused_at: scope.pausedAt ?? null,
    completed_at: scope.completedAt ?? null,
    expires_at: scope.expiresAt,
    title: scope.title,
    summary: scope.summary,
    allowed_channels: scope.allowedChannels,
    audience: scope.audience,
    limits: scope.limits,
    required_checks: scope.requiredChecks,
    stop_conditions: scope.stopConditions,
    policy: scope.policy,
    voice_drop_certified: scope.voiceDropCertified ?? false,
    ai_voice_explicitly_approved: scope.aiVoiceExplicitlyApproved ?? false,
    blocked_reason: scope.blockedReason ?? null,
    qa_marker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  }
}

function actionToInsertRow(action: GrowthAutonomousOutboundActionRecord): Record<string, unknown> {
  const now = action.createdAt
  return {
    id: action.id,
    organization_id: action.organizationId,
    scope_id: action.scopeId,
    lead_id: action.leadId,
    channel: action.channel,
    action_type: action.actionType,
    status: action.status,
    sequence_job_id: action.sequenceJobId ?? null,
    transport_path: action.transportPath,
    transport_reference: action.transportReference ?? null,
    blocked_gate: action.blockedGate ?? null,
    blocked_reason: action.blockedReason ?? null,
    correlation_id: action.correlationId,
    idempotency_key: action.idempotencyKey ?? null,
    selected_at: action.selectedAt ?? (action.status === "selected" ? now : null),
    queued_at: action.queuedAt ?? (action.status === "queued" ? now : null),
    completed_at: action.completedAt ?? (action.status === "completed" ? now : null),
    failed_at: action.failedAt ?? (action.status === "failed" ? now : null),
    qa_marker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
  }
}

export function autonomousOutboundScopeSchemaCatalog() {
  return {
    qaMarker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
    tables: [
      "autonomous_outbound_scopes",
      "autonomous_outbound_scope_actions",
      "autonomous_outbound_scope_events",
    ],
  }
}

export async function insertAutonomousOutboundScope(
  admin: SupabaseClient,
  scope: GrowthAutonomousOutboundScope,
): Promise<GrowthAutonomousOutboundScope> {
  const { data, error } = await scopesTable(admin)
    .insert(scopeToInsertRow(scope))
    .select(SCOPE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapAutonomousOutboundScopeRow(data as ScopeRow)
}

export async function updateAutonomousOutboundScope(
  admin: SupabaseClient,
  scope: GrowthAutonomousOutboundScope,
): Promise<GrowthAutonomousOutboundScope> {
  const { data, error } = await scopesTable(admin)
    .update({
      status: scope.status,
      approved_by_user_id: scope.approvedByUserId || null,
      approved_at: scope.approvedAt,
      activated_at: scope.activatedAt ?? null,
      paused_at: scope.pausedAt ?? null,
      completed_at: scope.completedAt ?? null,
      expires_at: scope.expiresAt,
      allowed_channels: scope.allowedChannels,
      audience: scope.audience,
      limits: scope.limits,
      stop_conditions: scope.stopConditions,
      blocked_reason: scope.blockedReason ?? null,
      voice_drop_certified: scope.voiceDropCertified ?? false,
      ai_voice_explicitly_approved: scope.aiVoiceExplicitlyApproved ?? false,
    })
    .eq("organization_id", scope.organizationId)
    .eq("id", scope.id)
    .select(SCOPE_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapAutonomousOutboundScopeRow(data as ScopeRow)
}

export async function fetchAutonomousOutboundScopeById(
  admin: SupabaseClient,
  input: { organizationId: string; scopeId: string },
): Promise<GrowthAutonomousOutboundScope | null> {
  const { data, error } = await scopesTable(admin)
    .select(SCOPE_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.scopeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAutonomousOutboundScopeRow(data as ScopeRow) : null
}

export async function fetchAutonomousOutboundScopeBySource(
  admin: SupabaseClient,
  input: { organizationId: string; source: GrowthAutonomousOutboundScopeSource; sourceId: string },
): Promise<GrowthAutonomousOutboundScope | null> {
  const { data, error } = await scopesTable(admin)
    .select(SCOPE_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("source", input.source)
    .eq("source_id", input.sourceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAutonomousOutboundScopeRow(data as ScopeRow) : null
}

export async function listAutonomousOutboundScopesForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthAutonomousOutboundScopeStatus | GrowthAutonomousOutboundScopeStatus[]
    limit?: number
  },
): Promise<GrowthAutonomousOutboundScope[]> {
  let query = scopesTable(admin)
    .select(SCOPE_SELECT)
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })

  if (input.status) {
    const statuses = Array.isArray(input.status) ? input.status : [input.status]
    query = query.in("status", statuses)
  }

  const limit = Math.min(Math.max(input.limit ?? 200, 1), 500)
  const { data, error } = await query.limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAutonomousOutboundScopeRow(row as ScopeRow))
}

export async function insertAutonomousOutboundScopeAction(
  admin: SupabaseClient,
  action: GrowthAutonomousOutboundActionRecord,
): Promise<GrowthAutonomousOutboundActionRecord> {
  if (action.idempotencyKey) {
    const existing = await fetchAutonomousOutboundActionByIdempotencyKey(admin, {
      organizationId: action.organizationId,
      idempotencyKey: action.idempotencyKey,
    })
    if (existing) return existing
  }

  const { data, error } = await actionsTable(admin)
    .insert(actionToInsertRow(action))
    .select(ACTION_SELECT)
    .single()

  if (error) {
    if (action.idempotencyKey && error.message.includes("duplicate")) {
      const existing = await fetchAutonomousOutboundActionByIdempotencyKey(admin, {
        organizationId: action.organizationId,
        idempotencyKey: action.idempotencyKey,
      })
      if (existing) return existing
    }
    throw new Error(error.message)
  }
  return mapAutonomousOutboundActionRow(data as ActionRow)
}

export async function updateAutonomousOutboundScopeAction(
  admin: SupabaseClient,
  action: GrowthAutonomousOutboundActionRecord,
): Promise<GrowthAutonomousOutboundActionRecord> {
  const { data, error } = await actionsTable(admin)
    .update({
      status: action.status,
      transport_path: action.transportPath,
      transport_reference: action.transportReference ?? null,
      blocked_gate: action.blockedGate ?? null,
      blocked_reason: action.blockedReason ?? null,
      selected_at: action.selectedAt ?? null,
      queued_at: action.queuedAt ?? null,
      completed_at: action.completedAt ?? null,
      failed_at: action.failedAt ?? null,
    })
    .eq("organization_id", action.organizationId)
    .eq("id", action.id)
    .select(ACTION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapAutonomousOutboundActionRow(data as ActionRow)
}

export async function fetchAutonomousOutboundActionByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthAutonomousOutboundActionRecord | null> {
  const { data, error } = await actionsTable(admin)
    .select(ACTION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapAutonomousOutboundActionRow(data as ActionRow) : null
}

export async function listAutonomousOutboundActionsForOrganization(
  admin: SupabaseClient,
  input: { organizationId: string; scopeId?: string; limit?: number },
): Promise<GrowthAutonomousOutboundActionRecord[]> {
  let query = actionsTable(admin)
    .select(ACTION_SELECT)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })

  if (input.scopeId) query = query.eq("scope_id", input.scopeId)

  const limit = Math.min(Math.max(input.limit ?? 500, 1), 2000)
  const { data, error } = await query.limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAutonomousOutboundActionRow(row as ActionRow))
}

export async function appendAutonomousOutboundScopeEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    scopeId: string
    actionId?: string | null
    eventType: string
    payload?: Record<string, unknown>
  },
): Promise<{ id: string; createdAt: string }> {
  const { data, error } = await eventsTable(admin)
    .insert({
      organization_id: input.organizationId,
      scope_id: input.scopeId,
      action_id: input.actionId ?? null,
      event_type: input.eventType,
      payload: input.payload ?? {},
      qa_marker: GROWTH_AUTONOMOUS_OUTBOUND_SCOPE_QA_MARKER,
    })
    .select("id, created_at")
    .single()
  if (error) throw new Error(error.message)
  return { id: data.id as string, createdAt: data.created_at as string }
}

export async function listAutonomousOutboundScopeEvents(
  admin: SupabaseClient,
  input: { organizationId: string; scopeId?: string; limit?: number },
): Promise<
  Array<{
    id: string
    scopeId: string
    actionId: string | null
    eventType: string
    payload: Record<string, unknown>
    createdAt: string
  }>
> {
  let query = eventsTable(admin)
    .select("id, scope_id, action_id, event_type, payload, created_at")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })

  if (input.scopeId) query = query.eq("scope_id", input.scopeId)

  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const { data, error } = await query.limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const event = row as EventRow
    return {
      id: event.id,
      scopeId: event.scope_id,
      actionId: event.action_id,
      eventType: event.event_type,
      payload: event.payload ?? {},
      createdAt: event.created_at,
    }
  })
}

export async function listAutonomousOutboundStopConditionTriggers(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<
  Array<{ scopeId: string; condition: GrowthAutonomousOutboundStopCondition; triggeredAt: string; label: string }>
> {
  const events = await listAutonomousOutboundScopeEvents(admin, {
    organizationId: input.organizationId,
    limit: input.limit ?? 200,
  })

  return events
    .filter((row) => row.eventType === "stop_condition_triggered")
    .map((row) => ({
      scopeId: row.scopeId,
      condition: (row.payload.condition as GrowthAutonomousOutboundStopCondition) ?? "on_manual_pause",
      triggeredAt: row.createdAt,
      label: String(row.payload.label ?? "Stop condition triggered"),
    }))
}

export async function fetchLatestAutonomousOutboundScopeEvent(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<{ eventType: string; createdAt: string } | null> {
  const { data, error } = await eventsTable(admin)
    .select("event_type, created_at")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { eventType: data.event_type as string, createdAt: data.created_at as string }
}

export async function summarizeAutonomousOutboundScopes(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<{ approved: number; active: number; blocked: number; paused: number }> {
  const scopes = await listAutonomousOutboundScopesForOrganization(admin, {
    organizationId: input.organizationId,
    limit: 500,
  })
  return {
    approved: scopes.filter((row) => row.status === "approved").length,
    active: scopes.filter((row) => row.status === "active").length,
    blocked: scopes.filter((row) => row.status === "blocked").length,
    paused: scopes.filter((row) => row.status === "paused").length,
  }
}

export async function upsertAutonomousOutboundScopeRecord(
  admin: SupabaseClient,
  scope: GrowthAutonomousOutboundScope,
): Promise<GrowthAutonomousOutboundScope> {
  const existing = await fetchAutonomousOutboundScopeById(admin, {
    organizationId: scope.organizationId,
    scopeId: scope.id,
  })
  if (existing) return updateAutonomousOutboundScope(admin, scope)
  return insertAutonomousOutboundScope(admin, scope)
}
