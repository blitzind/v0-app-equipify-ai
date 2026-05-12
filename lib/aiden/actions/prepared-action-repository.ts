import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import type { AidenPreparedWorkspaceActionRiskLevel } from "@/lib/aiden/actions/action-risk"
import type { AidenPreparedActionStatus } from "@/lib/aiden/actions/prepared-action-status"

/** JSON payloads stored in jsonb columns (validated at application boundaries). */
export type AidenPreparedActionJsonPayload = Record<string, unknown>

export type AidenPreparedActionRow = {
  id: string
  organization_id: string
  requested_by: string
  action_id: string
  status: AidenPreparedActionStatus
  risk_level: AidenPreparedWorkspaceActionRiskLevel
  input_payload: AidenPreparedActionJsonPayload
  resolved_payload: AidenPreparedActionJsonPayload
  preview_payload: AidenPreparedActionJsonPayload
  execution_payload: AidenPreparedActionJsonPayload
  source_record_type: string | null
  source_record_id: string | null
  target_record_type: string | null
  target_record_id: string | null
  confidence_score: number | null
  requires_confirmation: boolean
  confirmed_by: string | null
  confirmed_at: string | null
  executed_by: string | null
  executed_at: string | null
  canceled_by: string | null
  canceled_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type InsertPreparedActionInput = {
  organization_id: string
  requested_by: string
  action_id: AidenPreparedWorkspaceActionId | string
  risk_level: AidenPreparedWorkspaceActionRiskLevel
  status?: AidenPreparedActionStatus
  input_payload?: AidenPreparedActionJsonPayload
  resolved_payload?: AidenPreparedActionJsonPayload
  preview_payload?: AidenPreparedActionJsonPayload
  execution_payload?: AidenPreparedActionJsonPayload
  source_record_type?: string | null
  source_record_id?: string | null
  target_record_type?: string | null
  target_record_id?: string | null
  confidence_score?: number | null
  requires_confirmation?: boolean
}

export type UpdatePreparedActionPatch = Partial<
  Pick<
    AidenPreparedActionRow,
    | "status"
    | "input_payload"
    | "resolved_payload"
    | "preview_payload"
    | "execution_payload"
    | "source_record_type"
    | "source_record_id"
    | "target_record_type"
    | "target_record_id"
    | "confidence_score"
    | "requires_confirmation"
    | "confirmed_by"
    | "confirmed_at"
    | "executed_by"
    | "executed_at"
    | "canceled_by"
    | "canceled_at"
    | "error_message"
  >
>

function asRow(data: unknown): AidenPreparedActionRow {
  return data as AidenPreparedActionRow
}

/**
 * Inserts a prepared action. Use **service-role** Supabase client from Route Handlers / server jobs so RLS does not block writes.
 */
export async function insertPreparedAction(
  client: SupabaseClient,
  input: InsertPreparedActionInput,
): Promise<{ data: AidenPreparedActionRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("aiden_prepared_actions")
    .insert({
      organization_id: input.organization_id,
      requested_by: input.requested_by,
      action_id: input.action_id,
      risk_level: input.risk_level,
      status: input.status ?? "prepared",
      input_payload: input.input_payload ?? {},
      resolved_payload: input.resolved_payload ?? {},
      preview_payload: input.preview_payload ?? {},
      execution_payload: input.execution_payload ?? {},
      source_record_type: input.source_record_type ?? null,
      source_record_id: input.source_record_id ?? null,
      target_record_type: input.target_record_type ?? null,
      target_record_id: input.target_record_id ?? null,
      confidence_score: input.confidence_score ?? null,
      requires_confirmation: input.requires_confirmation ?? true,
    })
    .select("*")
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: asRow(data), error: null }
}

/**
 * Updates a row scoped to `organization_id`. Prefer service-role client; user JWT updates would require future RLS policies.
 */
export async function updatePreparedActionById(
  client: SupabaseClient,
  organizationId: string,
  preparedActionId: string,
  patch: UpdatePreparedActionPatch,
): Promise<{ data: AidenPreparedActionRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("aiden_prepared_actions")
    .update(patch)
    .eq("id", preparedActionId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: asRow(data), error: null }
}

/** Single row; works with user JWT (RLS) or service role. */
export async function getPreparedActionById(
  client: SupabaseClient,
  organizationId: string,
  preparedActionId: string,
): Promise<{ data: AidenPreparedActionRow | null; error: Error | null }> {
  const { data, error } = await client
    .from("aiden_prepared_actions")
    .select("*")
    .eq("id", preparedActionId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error) return { data: null, error: new Error(error.message) }
  return { data: data ? asRow(data) : null, error: null }
}

export type ListPreparedActionsOptions = {
  status?: AidenPreparedActionStatus
  /** When set, filters to any of these statuses (takes precedence over `status`). */
  statuses?: readonly AidenPreparedActionStatus[]
  actionId?: string
  riskLevel?: string
  requestedBy?: string
  createdAfterIso?: string
  createdBeforeIso?: string
  limit?: number
  offset?: number
}

/** Lists recent prepared actions for an org (RLS limits to member orgs). */
export async function listPreparedActionsForOrg(
  client: SupabaseClient,
  organizationId: string,
  options: ListPreparedActionsOptions = {},
): Promise<{ data: AidenPreparedActionRow[]; error: Error | null }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const offset = Math.min(Math.max(options.offset ?? 0, 0), 10_000)
  let q = client
    .from("aiden_prepared_actions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.statuses && options.statuses.length > 0) {
    q = q.in("status", [...options.statuses])
  } else if (options.status) {
    q = q.eq("status", options.status)
  }

  if (options.actionId) {
    q = q.eq("action_id", options.actionId)
  }
  if (options.riskLevel) {
    q = q.eq("risk_level", options.riskLevel)
  }
  if (options.requestedBy) {
    q = q.eq("requested_by", options.requestedBy)
  }
  if (options.createdAfterIso) {
    q = q.gte("created_at", options.createdAfterIso)
  }
  if (options.createdBeforeIso) {
    q = q.lte("created_at", options.createdBeforeIso)
  }

  const { data, error } = await q
  if (error) return { data: [], error: new Error(error.message) }
  return { data: (data ?? []).map(asRow), error: null }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Recent distinct `requested_by` values for filter dropdowns (best-effort cap). */
export async function listRecentPreparedActionRequesterIds(
  client: SupabaseClient,
  organizationId: string,
  cap = 400,
): Promise<{ data: string[]; error: Error | null }> {
  const take = Math.min(Math.max(cap, 1), 2000)
  const { data, error } = await client
    .from("aiden_prepared_actions")
    .select("requested_by")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(take)

  if (error) return { data: [], error: new Error(error.message) }
  const seen = new Set<string>()
  const out: string[] = []
  for (const row of data ?? []) {
    const id = (row as { requested_by?: string }).requested_by?.trim() ?? ""
    if (!UUID_RE.test(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return { data: out, error: null }
}
