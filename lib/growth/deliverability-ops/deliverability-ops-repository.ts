import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthDeliverabilityDomainReputationRow,
  GrowthDeliverabilityEntityType,
  GrowthDeliverabilityEvidenceSnippet,
  GrowthDeliverabilityOpsSnapshot,
  GrowthDeliverabilityOpsStatus,
  GrowthDeliverabilityRecommendation,
  GrowthDeliverabilityRecommendationType,
  GrowthDeliverabilityRemediationChecklistItem,
  GrowthDeliverabilityRemediationTask,
  GrowthDeliverabilityRiskEvent,
  GrowthDeliverabilityRiskType,
  GrowthDeliverabilitySeverity,
} from "@/lib/growth/deliverability-ops/deliverability-ops-types"

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_ops_snapshots")
}

function recommendationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_recommendations")
}

function riskEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_risk_events")
}

function remediationTasksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_remediation_tasks")
}

function domainReputationTable(admin: SupabaseClient) {
  return admin.schema("growth").from("deliverability_domain_reputation_history")
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function mapSnapshot(row: Record<string, unknown>): GrowthDeliverabilityOpsSnapshot {
  return {
    id: asString(row.id),
    overallScore: asNumber(row.overall_score),
    senderReputationScore: asNumber(row.sender_reputation_score),
    domainHealthScore: asNumber(row.domain_health_score),
    providerHealthScore: asNumber(row.provider_health_score),
    complianceRiskScore: asNumber(row.compliance_risk_score),
    warmupHealthScore: asNumber(row.warmup_health_score),
    volumePressureScore: asNumber(row.volume_pressure_score),
    openRiskAlerts: asNumber(row.open_risk_alerts),
    recordedAt: asString(row.recorded_at),
  }
}

function mapRecommendation(row: Record<string, unknown>): GrowthDeliverabilityRecommendation {
  const evidence = Array.isArray(row.evidence)
    ? (row.evidence as GrowthDeliverabilityEvidenceSnippet[])
    : []
  return {
    id: asString(row.id),
    recommendationType: asString(row.recommendation_type) as GrowthDeliverabilityRecommendationType,
    status: asString(row.status) as GrowthDeliverabilityOpsStatus,
    title: asString(row.title),
    description: asString(row.description),
    evidence,
    severity: asString(row.severity) as GrowthDeliverabilitySeverity,
    entityType: asString(row.entity_type) as GrowthDeliverabilityEntityType,
    entityLabel: asString(row.entity_label),
    acknowledgedAt: asString(row.acknowledged_at) || null,
    completedAt: asString(row.completed_at) || null,
    dismissedAt: asString(row.dismissed_at) || null,
    dismissReason: asString(row.dismiss_reason) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapRiskEvent(row: Record<string, unknown>): GrowthDeliverabilityRiskEvent {
  return {
    id: asString(row.id),
    riskType: asString(row.risk_type) as GrowthDeliverabilityRiskType,
    severity: asString(row.severity) as GrowthDeliverabilitySeverity,
    title: asString(row.title),
    description: asString(row.description),
    entityType: asString(row.entity_type) as GrowthDeliverabilityEntityType,
    entityLabel: asString(row.entity_label),
    resolved: Boolean(row.resolved),
    createdAt: asString(row.created_at),
  }
}

function mapRemediationTask(row: Record<string, unknown>): GrowthDeliverabilityRemediationTask {
  const checklist = Array.isArray(row.checklist)
    ? (row.checklist as GrowthDeliverabilityRemediationChecklistItem[])
    : []
  return {
    id: asString(row.id),
    recommendationId: asString(row.recommendation_id) || null,
    riskEventId: asString(row.risk_event_id) || null,
    taskType: asString(row.task_type),
    status: asString(row.status) as GrowthDeliverabilityOpsStatus,
    title: asString(row.title),
    description: asString(row.description),
    checklist,
    entityType: asString(row.entity_type) as GrowthDeliverabilityEntityType,
    entityLabel: asString(row.entity_label),
    completedAt: asString(row.completed_at) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

function mapDomainReputation(row: Record<string, unknown>): GrowthDeliverabilityDomainReputationRow {
  return {
    id: asString(row.id),
    domainLabel: asString(row.domain_label),
    reputationScore: asNumber(row.reputation_score),
    bounceRate: asNumber(row.bounce_rate),
    complaintRate: asNumber(row.complaint_rate),
    authenticationScore: asNumber(row.authentication_score),
    trend: asString(row.trend) as GrowthDeliverabilityDomainReputationRow["trend"],
    recordedAt: asString(row.recorded_at),
  }
}

export async function recordDeliverabilityOpsSnapshot(
  admin: SupabaseClient,
  input: Omit<GrowthDeliverabilityOpsSnapshot, "id" | "recordedAt"> & { recordedAt?: string },
): Promise<GrowthDeliverabilityOpsSnapshot> {
  const { data, error } = await snapshotsTable(admin)
    .insert({
      overall_score: input.overallScore,
      sender_reputation_score: input.senderReputationScore,
      domain_health_score: input.domainHealthScore,
      provider_health_score: input.providerHealthScore,
      compliance_risk_score: input.complianceRiskScore,
      warmup_health_score: input.warmupHealthScore,
      volume_pressure_score: input.volumePressureScore,
      open_risk_alerts: input.openRiskAlerts,
      recorded_at: input.recordedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapSnapshot(data as Record<string, unknown>)
}

export async function getLatestDeliverabilityOpsSnapshot(
  admin: SupabaseClient,
): Promise<GrowthDeliverabilityOpsSnapshot | null> {
  const { data, error } = await snapshotsTable(admin)
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSnapshot(data as Record<string, unknown>)
}

export async function listDeliverabilityRecommendations(
  admin: SupabaseClient,
  input?: { status?: GrowthDeliverabilityOpsStatus; limit?: number },
): Promise<GrowthDeliverabilityRecommendation[]> {
  let query = recommendationsTable(admin).select("*").order("created_at", { ascending: false })
  if (input?.status) query = query.eq("status", input.status)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRecommendation)
}

export async function createDeliverabilityRecommendation(
  admin: SupabaseClient,
  input: {
    recommendationType: GrowthDeliverabilityRecommendationType
    title: string
    description: string
    evidence: GrowthDeliverabilityEvidenceSnippet[]
    severity: GrowthDeliverabilitySeverity
    entityType: GrowthDeliverabilityEntityType
    entityId?: string | null
    entityLabel: string
  },
): Promise<GrowthDeliverabilityRecommendation> {
  const now = new Date().toISOString()
  const { data, error } = await recommendationsTable(admin)
    .insert({
      recommendation_type: input.recommendationType,
      status: "open",
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 2000),
      evidence: input.evidence,
      severity: input.severity,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel.slice(0, 120),
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRecommendation(data as Record<string, unknown>)
}

export async function getDeliverabilityRecommendation(
  admin: SupabaseClient,
  id: string,
): Promise<GrowthDeliverabilityRecommendation | null> {
  const { data, error } = await recommendationsTable(admin).select("*").eq("id", id).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRecommendation(data as Record<string, unknown>)
}

export async function updateDeliverabilityRecommendationStatus(
  admin: SupabaseClient,
  input: {
    id: string
    status: GrowthDeliverabilityOpsStatus
    actorUserId: string
    dismissReason?: string
  },
): Promise<GrowthDeliverabilityRecommendation> {
  const existing = await getDeliverabilityRecommendation(admin, input.id)
  if (!existing) throw new Error("recommendation_not_found")

  const now = new Date().toISOString()
  const patch: Record<string, unknown> = { status: input.status, updated_at: now }

  if (input.status === "acknowledged") {
    if (!["open"].includes(existing.status)) throw new Error("invalid_status")
    patch.acknowledged_by = input.actorUserId
    patch.acknowledged_at = now
  } else if (input.status === "in_progress") {
    if (!["open", "acknowledged"].includes(existing.status)) throw new Error("invalid_status")
  } else if (input.status === "completed") {
    if (!["open", "acknowledged", "in_progress"].includes(existing.status)) throw new Error("invalid_status")
    patch.completed_by = input.actorUserId
    patch.completed_at = now
  } else if (input.status === "dismissed") {
    if (!["open", "acknowledged", "in_progress"].includes(existing.status)) throw new Error("invalid_status")
    patch.dismissed_by = input.actorUserId
    patch.dismissed_at = now
    patch.dismiss_reason = input.dismissReason?.slice(0, 500) ?? null
  }

  const { data, error } = await recommendationsTable(admin)
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRecommendation(data as Record<string, unknown>)
}

export async function listDeliverabilityRiskEvents(
  admin: SupabaseClient,
  input?: { resolved?: boolean; limit?: number },
): Promise<GrowthDeliverabilityRiskEvent[]> {
  let query = riskEventsTable(admin).select("*").order("created_at", { ascending: false })
  if (input?.resolved != null) query = query.eq("resolved", input.resolved)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRiskEvent)
}

export async function createDeliverabilityRiskEvent(
  admin: SupabaseClient,
  input: {
    riskType: GrowthDeliverabilityRiskType
    severity: GrowthDeliverabilitySeverity
    title: string
    description: string
    entityType: GrowthDeliverabilityEntityType
    entityId?: string | null
    entityLabel: string
    signals?: Record<string, unknown>
  },
): Promise<GrowthDeliverabilityRiskEvent> {
  const { data, error } = await riskEventsTable(admin)
    .insert({
      risk_type: input.riskType,
      severity: input.severity,
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 2000),
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel.slice(0, 120),
      signals: input.signals ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRiskEvent(data as Record<string, unknown>)
}

export async function listDeliverabilityRemediationTasks(
  admin: SupabaseClient,
  input?: { status?: GrowthDeliverabilityOpsStatus; limit?: number },
): Promise<GrowthDeliverabilityRemediationTask[]> {
  let query = remediationTasksTable(admin).select("*").order("created_at", { ascending: false })
  if (input?.status) query = query.eq("status", input.status)
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRemediationTask)
}

export async function createDeliverabilityRemediationTask(
  admin: SupabaseClient,
  input: {
    recommendationId?: string | null
    riskEventId?: string | null
    taskType: string
    title: string
    description: string
    checklist: GrowthDeliverabilityRemediationChecklistItem[]
    entityType: GrowthDeliverabilityEntityType
    entityLabel: string
  },
): Promise<GrowthDeliverabilityRemediationTask> {
  const now = new Date().toISOString()
  const { data, error } = await remediationTasksTable(admin)
    .insert({
      recommendation_id: input.recommendationId ?? null,
      risk_event_id: input.riskEventId ?? null,
      task_type: input.taskType,
      status: "open",
      title: input.title.slice(0, 200),
      description: input.description.slice(0, 2000),
      checklist: input.checklist,
      entity_type: input.entityType,
      entity_label: input.entityLabel.slice(0, 120),
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRemediationTask(data as Record<string, unknown>)
}

export async function recordDomainReputationHistory(
  admin: SupabaseClient,
  input: {
    domainId: string
    domainLabel: string
    reputationScore: number
    bounceRate: number
    complaintRate: number
    authenticationScore: number
    trend: GrowthDeliverabilityDomainReputationRow["trend"]
  },
): Promise<GrowthDeliverabilityDomainReputationRow> {
  const { data, error } = await domainReputationTable(admin)
    .insert({
      domain_id: input.domainId,
      domain_label: input.domainLabel.slice(0, 120),
      reputation_score: input.reputationScore,
      bounce_rate: input.bounceRate,
      complaint_rate: input.complaintRate,
      authentication_score: input.authenticationScore,
      trend: input.trend,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDomainReputation(data as Record<string, unknown>)
}

export async function listDomainReputationHistory(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthDeliverabilityDomainReputationRow[]> {
  let query = domainReputationTable(admin).select("*").order("recorded_at", { ascending: false })
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapDomainReputation)
}

export async function findOpenRecommendationByFingerprint(
  admin: SupabaseClient,
  input: {
    recommendationType: GrowthDeliverabilityRecommendationType
    entityLabel: string
  },
): Promise<GrowthDeliverabilityRecommendation | null> {
  const { data, error } = await recommendationsTable(admin)
    .select("*")
    .eq("recommendation_type", input.recommendationType)
    .eq("entity_label", input.entityLabel)
    .in("status", ["open", "acknowledged", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRecommendation(data as Record<string, unknown>)
}

export async function findOpenRiskByFingerprint(
  admin: SupabaseClient,
  input: { riskType: GrowthDeliverabilityRiskType; entityLabel: string },
): Promise<GrowthDeliverabilityRiskEvent | null> {
  const { data, error } = await riskEventsTable(admin)
    .select("*")
    .eq("risk_type", input.riskType)
    .eq("entity_label", input.entityLabel)
    .eq("resolved", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRiskEvent(data as Record<string, unknown>)
}
