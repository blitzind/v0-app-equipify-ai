import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export type AidenActionAuditDetails = Record<string, unknown>

/**
 * Well-known audit `event_type` values. Callers may use other strings for forward compatibility.
 */
export const AIDEN_ACTION_AUDIT_EVENT_TYPES = [
  "prepared_action_created",
  "prepared_action_updated",
  "preview_updated",
  "prepared_action_status_changed",
  "prepared_action_needs_clarification",
  "prepared_action_ready_for_confirmation",
  "prepared_action_confirmed",
  "prepared_action_execution_started",
  "prepared_action_execution_completed",
  "prepared_action_execution_failed",
  "prepared_action_canceled",
  "prepared_action_approval_passed",
  "prepared_action_approval_denied",
  "aiden_org_approval_settings_updated",
] as const

export type AidenActionAuditEventType = (typeof AIDEN_ACTION_AUDIT_EVENT_TYPES)[number]

export type AidenActionAuditLogRow = {
  id: string
  organization_id: string
  prepared_action_id: string | null
  actor_user_id: string | null
  event_type: string
  action_id: string | null
  details: AidenActionAuditDetails
  created_at: string
}

export type InsertActionAuditLogInput = {
  organization_id: string
  /** Use values from {@link AIDEN_ACTION_AUDIT_EVENT_TYPES} when possible. */
  event_type: string
  details?: AidenActionAuditDetails
  prepared_action_id?: string | null
  actor_user_id?: string | null
  action_id?: string | null
}

function asRow(data: unknown): AidenActionAuditLogRow {
  return data as AidenActionAuditLogRow
}

/**
 * Append-only audit row. Use **service-role** client from trusted server code; authenticated users have SELECT only via RLS.
 */
export async function insertActionAuditLog(
  client: SupabaseClient,
  input: InsertActionAuditLogInput,
): Promise<{ data: AidenActionAuditLogRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("aiden_action_audit_log")
    .insert({
      organization_id: input.organization_id,
      event_type: input.event_type,
      details: input.details ?? {},
      prepared_action_id: input.prepared_action_id ?? null,
      actor_user_id: input.actor_user_id ?? null,
      action_id: input.action_id ?? null,
    })
    .select("*")
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: asRow(data), error: null }
}

/** Read path for org-scoped audit history (RLS). */
export async function listActionAuditLogForOrg(
  client: SupabaseClient,
  organizationId: string,
  options: { preparedActionId?: string; limit?: number } = {},
): Promise<{ data: AidenActionAuditLogRow[]; error: Error | null }> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500)
  let q = client
    .from("aiden_action_audit_log")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (options.preparedActionId) {
    q = q.eq("prepared_action_id", options.preparedActionId)
  }

  const { data, error } = await q
  if (error) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []).map(asRow), error: null }
}
