import "server-only"

import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"

/**
 * Operator + system events log for async import runs (Phase 4).
 *
 * Additive ops-tooling table: never used by the async runner itself, only by
 * operator-facing API routes (Migration Center / Platform Admin Import
 * Operations). Writes always go through the service role so that platform
 * admins can record cross-org actions that wouldn't otherwise satisfy RLS.
 */

export type ImportOperatorActorKind =
  | "operator"
  | "platform_admin"
  | "system_cron"
  | "system"

export type ImportOperatorEventType =
  | "note"
  | "bulk_retry"
  | "bulk_recover_stale"
  | "manual_resume"
  | "manual_cancel"
  | "manual_lease_recover"
  | "system_observation"

export type ImportOperatorEventSeverity = "info" | "warning" | "critical"

export type ImportOperatorEventInput = {
  importJobId: string
  importRunId?: string | null
  organizationId: string
  actorUserId?: string | null
  actorEmail?: string | null
  actorKind?: ImportOperatorActorKind
  eventType: ImportOperatorEventType
  severity?: ImportOperatorEventSeverity
  message: string
  metadata?: Record<string, unknown>
}

export type ImportOperatorEvent = {
  id: string
  importJobId: string
  importRunId: string | null
  organizationId: string
  actorUserId: string | null
  actorEmail: string | null
  actorKind: ImportOperatorActorKind
  eventType: ImportOperatorEventType
  severity: ImportOperatorEventSeverity
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

const MAX_MESSAGE = 2000

function clampMessage(message: string): string {
  const trimmed = (message ?? "").toString().trim()
  if (trimmed.length === 0) return "(no message)"
  return trimmed.length > MAX_MESSAGE ? trimmed.slice(0, MAX_MESSAGE) : trimmed
}

function mapRow(row: Record<string, unknown>): ImportOperatorEvent {
  return {
    id: String(row.id ?? ""),
    importJobId: String(row.import_job_id ?? ""),
    importRunId: (row.import_run_id as string | null) ?? null,
    organizationId: String(row.organization_id ?? ""),
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorEmail: (row.actor_email as string | null) ?? null,
    actorKind: ((row.actor_kind as string | null) ?? "system") as ImportOperatorActorKind,
    eventType: ((row.event_type as string | null) ?? "system_observation") as ImportOperatorEventType,
    severity: ((row.severity as string | null) ?? "info") as ImportOperatorEventSeverity,
    message: String(row.message ?? ""),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at ?? ""),
  }
}

export async function recordOperatorEvent(
  input: ImportOperatorEventInput,
): Promise<ImportOperatorEvent | null> {
  if (!input.importJobId || !input.organizationId) return null
  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return null
  }

  const payload = {
    import_job_id: input.importJobId,
    import_run_id: input.importRunId ?? null,
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    actor_kind: input.actorKind ?? "operator",
    event_type: input.eventType,
    severity: input.severity ?? "info",
    message: clampMessage(input.message),
    metadata: input.metadata ?? {},
  }

  const { data, error } = await svc
    .from("organization_import_run_operator_events")
    .insert(payload)
    .select(
      "id, import_job_id, import_run_id, organization_id, actor_user_id, actor_email, actor_kind, event_type, severity, message, metadata, created_at",
    )
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listOperatorEventsForJob(
  importJobId: string,
  limit = 25,
): Promise<ImportOperatorEvent[]> {
  if (!importJobId) return []
  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return []
  }
  const { data } = await svc
    .from("organization_import_run_operator_events")
    .select(
      "id, import_job_id, import_run_id, organization_id, actor_user_id, actor_email, actor_kind, event_type, severity, message, metadata, created_at",
    )
    .eq("import_job_id", importJobId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)))
  return (data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}

export async function listOperatorEventsForRun(
  importRunId: string,
  limit = 25,
): Promise<ImportOperatorEvent[]> {
  if (!importRunId) return []
  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return []
  }
  const { data } = await svc
    .from("organization_import_run_operator_events")
    .select(
      "id, import_job_id, import_run_id, organization_id, actor_user_id, actor_email, actor_kind, event_type, severity, message, metadata, created_at",
    )
    .eq("import_run_id", importRunId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)))
  return (data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}

export async function listOperatorEventsForPlatform(opts: {
  organizationId?: string
  eventType?: ImportOperatorEventType
  limit?: number
}): Promise<ImportOperatorEvent[]> {
  let svc
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return []
  }
  let q = svc
    .from("organization_import_run_operator_events")
    .select(
      "id, import_job_id, import_run_id, organization_id, actor_user_id, actor_email, actor_kind, event_type, severity, message, metadata, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(opts.limit ?? 50, 200)))
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId)
  if (opts.eventType) q = q.eq("event_type", opts.eventType)
  const { data } = await q
  return (data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}
