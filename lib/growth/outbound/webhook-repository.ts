import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthProviderWebhook,
  GrowthProviderWebhookResolutionStatus,
  GrowthProviderWebhookStatus,
} from "@/lib/growth/outbound/types"

type WebhookDbRow = {
  id: string
  connection_id: string
  provider: string
  headers: Record<string, unknown> | null
  payload: Record<string, unknown> | null
  signature_valid: boolean | null
  status: string
  resolution_status: string
  resolved_lead_id: string | null
  error_message: string | null
  processed_at: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, connection_id, provider, headers, payload, signature_valid, status, resolution_status, resolved_lead_id, error_message, processed_at, created_at, updated_at"

function webhooksTable(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_webhooks")
}

function mapRow(row: WebhookDbRow): GrowthProviderWebhook {
  return {
    id: row.id,
    connectionId: row.connection_id,
    provider: row.provider,
    headers: row.headers ?? {},
    payload: row.payload ?? {},
    signatureValid: row.signature_valid,
    status: row.status as GrowthProviderWebhookStatus,
    resolutionStatus: row.resolution_status as GrowthProviderWebhookResolutionStatus,
    resolvedLeadId: row.resolved_lead_id,
    errorMessage: row.error_message,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function insertGrowthProviderWebhook(
  admin: SupabaseClient,
  input: {
    connectionId: string
    provider: string
    headers?: Record<string, unknown>
    payload: Record<string, unknown>
    signatureValid?: boolean | null
    resolutionStatus?: GrowthProviderWebhookResolutionStatus
  },
): Promise<GrowthProviderWebhook> {
  const { data, error } = await webhooksTable(admin)
    .insert({
      connection_id: input.connectionId,
      provider: input.provider,
      headers: input.headers ?? {},
      payload: input.payload,
      signature_valid: input.signatureValid ?? null,
      status: "received",
      resolution_status: input.resolutionStatus ?? "resolved",
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as WebhookDbRow)
}

export async function updateGrowthProviderWebhook(
  admin: SupabaseClient,
  webhookId: string,
  patch: {
    status?: GrowthProviderWebhookStatus
    resolutionStatus?: GrowthProviderWebhookResolutionStatus
    resolvedLeadId?: string | null
    errorMessage?: string | null
    processedAt?: string | null
  },
): Promise<GrowthProviderWebhook | null> {
  const row: Record<string, unknown> = {}
  if (patch.status) row.status = patch.status
  if (patch.resolutionStatus) row.resolution_status = patch.resolutionStatus
  if (patch.resolvedLeadId !== undefined) row.resolved_lead_id = patch.resolvedLeadId
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage
  if (patch.processedAt !== undefined) row.processed_at = patch.processedAt

  const { data, error } = await webhooksTable(admin)
    .update(row)
    .eq("id", webhookId)
    .select(SELECT)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapRow(data as WebhookDbRow) : null
}

export async function listUnresolvedGrowthProviderWebhooks(
  admin: SupabaseClient,
  limit = 50,
): Promise<GrowthProviderWebhook[]> {
  const { data, error } = await webhooksTable(admin)
    .select(SELECT)
    .eq("resolution_status", "unresolved")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as WebhookDbRow[]).map(mapRow)
}

export async function fetchGrowthProviderWebhookById(
  admin: SupabaseClient,
  webhookId: string,
): Promise<GrowthProviderWebhook | null> {
  const { data, error } = await webhooksTable(admin).select(SELECT).eq("id", webhookId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as WebhookDbRow) : null
}

export function extractEmailFromWebhookPayload(payload: Record<string, unknown>): string | null {
  const contact = payload.contact as Record<string, unknown> | undefined
  const email = contact?.email ?? payload.email
  return typeof email === "string" ? email : null
}
