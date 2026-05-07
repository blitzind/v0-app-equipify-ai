import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Dispatch + Scheduling Phase 2: lightweight foundation for operator-facing
 * scheduling notes / actions on work orders.
 *
 * Server-only because RLS depends on the caller's Supabase session
 * (`is_org_member` / `has_org_role`). This module never uses the service role
 * — operator notes are always attributed to the calling staff member.
 *
 * Additive: nothing in dispatch / service-schedule / quick-add reads from this
 * table today. The audit foundation is ready for future timeline UIs.
 */

export type SchedulingEventActorKind = "operator" | "system" | "system_cron"

export type SchedulingEventType =
  | "note"
  | "reschedule"
  | "reassign"
  | "unassign"
  | "quick_add"
  | "conflict_acknowledged"
  | "system_observation"

export type SchedulingEventSeverity = "info" | "warning" | "critical"

export type SchedulingEventInput = {
  organizationId: string
  workOrderId: string
  actorUserId?: string | null
  actorEmail?: string | null
  actorKind?: SchedulingEventActorKind
  eventType: SchedulingEventType
  severity?: SchedulingEventSeverity
  message: string
  metadata?: Record<string, unknown>
}

export type SchedulingEvent = {
  id: string
  organizationId: string
  workOrderId: string
  actorUserId: string | null
  actorEmail: string | null
  actorKind: SchedulingEventActorKind
  eventType: SchedulingEventType
  severity: SchedulingEventSeverity
  message: string
  metadata: Record<string, unknown>
  createdAt: string
}

const MAX_MESSAGE = 2000
const SELECT_COLS =
  "id, organization_id, work_order_id, actor_user_id, actor_email, actor_kind, event_type, severity, message, metadata, created_at"

function clampMessage(message: string): string {
  const trimmed = (message ?? "").toString().trim()
  if (trimmed.length === 0) return "(no message)"
  return trimmed.length > MAX_MESSAGE ? trimmed.slice(0, MAX_MESSAGE) : trimmed
}

function mapRow(row: Record<string, unknown>): SchedulingEvent {
  return {
    id: String(row.id ?? ""),
    organizationId: String(row.organization_id ?? ""),
    workOrderId: String(row.work_order_id ?? ""),
    actorUserId: (row.actor_user_id as string | null) ?? null,
    actorEmail: (row.actor_email as string | null) ?? null,
    actorKind: ((row.actor_kind as string | null) ?? "operator") as SchedulingEventActorKind,
    eventType: ((row.event_type as string | null) ?? "note") as SchedulingEventType,
    severity: ((row.severity as string | null) ?? "info") as SchedulingEventSeverity,
    message: String(row.message ?? ""),
    metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    createdAt: String(row.created_at ?? ""),
  }
}

/**
 * Insert a scheduling event using the caller's Supabase session. RLS enforces
 * org membership + role; never bypass via service role.
 */
export async function recordSchedulingEvent(
  supabase: SupabaseClient,
  input: SchedulingEventInput,
): Promise<SchedulingEvent | null> {
  if (!input.organizationId || !input.workOrderId) return null
  const payload = {
    organization_id: input.organizationId,
    work_order_id: input.workOrderId,
    actor_user_id: input.actorUserId ?? null,
    actor_email: input.actorEmail ?? null,
    actor_kind: input.actorKind ?? "operator",
    event_type: input.eventType,
    severity: input.severity ?? "info",
    message: clampMessage(input.message),
    metadata: input.metadata ?? {},
  }
  const { data, error } = await supabase
    .from("work_order_scheduling_events")
    .insert(payload)
    .select(SELECT_COLS)
    .single()
  if (error || !data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function listSchedulingEventsForWorkOrder(
  supabase: SupabaseClient,
  workOrderId: string,
  limit = 25,
): Promise<SchedulingEvent[]> {
  if (!workOrderId) return []
  const { data } = await supabase
    .from("work_order_scheduling_events")
    .select(SELECT_COLS)
    .eq("work_order_id", workOrderId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)))
  return (data ?? []).map((r: Record<string, unknown>) => mapRow(r))
}
