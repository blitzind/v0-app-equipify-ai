/** GE-AI-3D-PROD-3 — Calibration version + snapshot repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS,
  GROWTH_CALIBRATION_APPLY_QA_MARKER,
  type GrowthCalibrationActiveConfig,
  type GrowthCalibrationApplyTargetSystem,
  type GrowthCalibrationAppliedVersion,
  type GrowthCalibrationConfigSnapshot,
  type GrowthCalibrationVersionKind,
  type GrowthCalibrationVersionStatus,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-apply-types"

type VersionRow = {
  id: string
  organization_id: string
  proposal_id: string | null
  target_system: string
  version_number: number
  version_kind: string
  status: string
  config_snapshot_before: Record<string, unknown> | null
  config_snapshot_after: Record<string, unknown> | null
  rollback_token: string
  previous_version_id: string | null
  applied_by_user_id: string | null
  applied_at: string
  confidence: number
  impact: number
  idempotency_key: string
  event_correlation_id: string | null
  created_at: string
}

type ActiveConfigRow = {
  id: string
  organization_id: string
  target_system: string
  config: Record<string, unknown> | null
  active_version_id: string | null
  updated_at: string
}

const VERSION_SELECT =
  "id, organization_id, proposal_id, target_system, version_number, version_kind, status, config_snapshot_before, config_snapshot_after, rollback_token, previous_version_id, applied_by_user_id, applied_at, confidence, impact, idempotency_key, event_correlation_id, created_at"

function versionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calibration_config_versions")
}

function activeConfigTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calibration_active_config")
}

function configEventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("calibration_config_events")
}

function isApplyTarget(value: string): value is GrowthCalibrationApplyTargetSystem {
  return (GROWTH_CALIBRATION_APPLY_ALLOWED_TARGETS as readonly string[]).includes(value)
}

function asSnapshot(value: Record<string, unknown> | null | undefined): GrowthCalibrationConfigSnapshot {
  if (!value || typeof value !== "object") return {}
  const out: GrowthCalibrationConfigSnapshot = {}
  for (const [key, val] of Object.entries(value)) {
    if (typeof val === "number" || typeof val === "string" || typeof val === "boolean") {
      out[key] = val
    }
  }
  return out
}

export function mapCalibrationVersionRow(row: VersionRow): GrowthCalibrationAppliedVersion {
  return {
    id: row.id,
    organizationId: row.organization_id,
    proposalId: row.proposal_id,
    targetSystem: isApplyTarget(row.target_system) ? row.target_system : "communication_engine",
    versionNumber: row.version_number,
    versionKind: row.version_kind as GrowthCalibrationVersionKind,
    status: row.status as GrowthCalibrationVersionStatus,
    configSnapshotBefore: asSnapshot(row.config_snapshot_before),
    configSnapshotAfter: asSnapshot(row.config_snapshot_after),
    rollbackToken: row.rollback_token,
    previousVersionId: row.previous_version_id,
    appliedByUserId: row.applied_by_user_id,
    appliedAt: row.applied_at,
    confidence: Number(row.confidence),
    impact: Number(row.impact),
    eventCorrelationId: row.event_correlation_id,
    createdAt: row.created_at,
  }
}

export function mapCalibrationActiveConfigRow(row: ActiveConfigRow): GrowthCalibrationActiveConfig {
  return {
    organizationId: row.organization_id,
    targetSystem: isApplyTarget(row.target_system) ? row.target_system : "communication_engine",
    config: asSnapshot(row.config),
    activeVersionId: row.active_version_id,
    updatedAt: row.updated_at,
  }
}

export async function fetchCalibrationVersionByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthCalibrationAppliedVersion | null> {
  const { data, error } = await versionsTable(admin)
    .select(VERSION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCalibrationVersionRow(data as VersionRow) : null
}

export async function fetchCalibrationVersionByRollbackToken(
  admin: SupabaseClient,
  input: { organizationId: string; rollbackToken: string },
): Promise<GrowthCalibrationAppliedVersion | null> {
  const { data, error } = await versionsTable(admin)
    .select(VERSION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("rollback_token", input.rollbackToken)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCalibrationVersionRow(data as VersionRow) : null
}

export async function fetchCalibrationActiveConfig(
  admin: SupabaseClient,
  input: { organizationId: string; targetSystem: GrowthCalibrationApplyTargetSystem },
): Promise<GrowthCalibrationActiveConfig | null> {
  const { data, error } = await activeConfigTable(admin)
    .select("id, organization_id, target_system, config, active_version_id, updated_at")
    .eq("organization_id", input.organizationId)
    .eq("target_system", input.targetSystem)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapCalibrationActiveConfigRow(data as ActiveConfigRow) : null
}

export async function listCalibrationActiveConfigs(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<GrowthCalibrationActiveConfig[]> {
  const { data, error } = await activeConfigTable(admin)
    .select("id, organization_id, target_system, config, active_version_id, updated_at")
    .eq("organization_id", input.organizationId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapCalibrationActiveConfigRow(row as ActiveConfigRow))
}

export async function listCalibrationVersions(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthCalibrationAppliedVersion[]> {
  const { data, error } = await versionsTable(admin)
    .select(VERSION_SELECT)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 20)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapCalibrationVersionRow(row as VersionRow))
}

export async function getNextCalibrationVersionNumber(
  admin: SupabaseClient,
  input: { organizationId: string; targetSystem: GrowthCalibrationApplyTargetSystem },
): Promise<number> {
  const { data, error } = await versionsTable(admin)
    .select("version_number")
    .eq("organization_id", input.organizationId)
    .eq("target_system", input.targetSystem)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? Number((data as { version_number: number }).version_number) + 1 : 1
}

export async function insertCalibrationVersion(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId: string | null
    targetSystem: GrowthCalibrationApplyTargetSystem
    versionNumber: number
    versionKind: GrowthCalibrationVersionKind
    status: GrowthCalibrationVersionStatus
    configSnapshotBefore: GrowthCalibrationConfigSnapshot
    configSnapshotAfter: GrowthCalibrationConfigSnapshot
    rollbackToken: string
    previousVersionId: string | null
    appliedByUserId: string
    appliedAt: string
    confidence: number
    impact: number
    idempotencyKey: string
    eventCorrelationId: string
  },
): Promise<GrowthCalibrationAppliedVersion> {
  const { data, error } = await versionsTable(admin)
    .insert({
      organization_id: input.organizationId,
      proposal_id: input.proposalId,
      target_system: input.targetSystem,
      version_number: input.versionNumber,
      version_kind: input.versionKind,
      status: input.status,
      config_snapshot_before: input.configSnapshotBefore,
      config_snapshot_after: input.configSnapshotAfter,
      rollback_token: input.rollbackToken,
      previous_version_id: input.previousVersionId,
      applied_by_user_id: input.appliedByUserId,
      applied_at: input.appliedAt,
      confidence: input.confidence,
      impact: input.impact,
      idempotency_key: input.idempotencyKey,
      event_correlation_id: input.eventCorrelationId,
      qa_marker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
    })
    .select(VERSION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapCalibrationVersionRow(data as VersionRow)
}

export async function upsertCalibrationActiveConfig(
  admin: SupabaseClient,
  input: {
    organizationId: string
    targetSystem: GrowthCalibrationApplyTargetSystem
    config: GrowthCalibrationConfigSnapshot
    activeVersionId: string
  },
): Promise<GrowthCalibrationActiveConfig> {
  const existing = await fetchCalibrationActiveConfig(admin, {
    organizationId: input.organizationId,
    targetSystem: input.targetSystem,
  })

  if (existing) {
    const { data, error } = await activeConfigTable(admin)
      .update({
        config: input.config,
        active_version_id: input.activeVersionId,
      })
      .eq("organization_id", input.organizationId)
      .eq("target_system", input.targetSystem)
      .select("id, organization_id, target_system, config, active_version_id, updated_at")
      .single()
    if (error) throw new Error(error.message)
    return mapCalibrationActiveConfigRow(data as ActiveConfigRow)
  }

  const { data, error } = await activeConfigTable(admin)
    .insert({
      organization_id: input.organizationId,
      target_system: input.targetSystem,
      config: input.config,
      active_version_id: input.activeVersionId,
      qa_marker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
    })
    .select("id, organization_id, target_system, config, active_version_id, updated_at")
    .single()
  if (error) throw new Error(error.message)
  return mapCalibrationActiveConfigRow(data as ActiveConfigRow)
}

export async function updateCalibrationVersionStatus(
  admin: SupabaseClient,
  input: { organizationId: string; versionId: string; status: GrowthCalibrationVersionStatus },
): Promise<void> {
  const { error } = await versionsTable(admin)
    .update({ status: input.status })
    .eq("organization_id", input.organizationId)
    .eq("id", input.versionId)
  if (error) throw new Error(error.message)
}

export async function appendCalibrationConfigEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    versionId?: string | null
    proposalId?: string | null
    eventType: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await configEventsTable(admin).insert({
    organization_id: input.organizationId,
    version_id: input.versionId ?? null,
    proposal_id: input.proposalId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
    qa_marker: GROWTH_CALIBRATION_APPLY_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export function calibrationApplySchemaCatalog(): { tables: string[] } {
  return {
    tables: ["calibration_config_versions", "calibration_active_config", "calibration_config_events"],
  }
}
