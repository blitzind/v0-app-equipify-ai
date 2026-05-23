import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthEmailProviderConnection,
  GrowthOutboundProviderFamily,
  GrowthOutboundConnectionStatus,
} from "@/lib/growth/outbound/types"
import { GROWTH_OUTBOUND_DEFAULT_CONNECTION_LABEL, GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"

type ConnectionDbRow = {
  id: string
  provider: string
  provider_family: string
  label: string
  status: string
  api_base_url: string | null
  credentials_encrypted: string | null
  webhook_secret: string | null
  config: Record<string, unknown> | null
  last_webhook_at: string | null
  last_error: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, provider, provider_family, label, status, api_base_url, webhook_secret, config, last_webhook_at, last_error, created_by, created_at, updated_at"

function connectionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("email_provider_connections")
}

function mapRow(row: ConnectionDbRow): GrowthEmailProviderConnection {
  return {
    id: row.id,
    provider: row.provider,
    providerFamily: row.provider_family as GrowthOutboundProviderFamily,
    label: row.label,
    status: row.status as GrowthOutboundConnectionStatus,
    apiBaseUrl: row.api_base_url,
    webhookSecret: row.webhook_secret,
    config: row.config ?? {},
    lastWebhookAt: row.last_webhook_at,
    lastError: row.last_error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthOutboundConnectionById(
  admin: SupabaseClient,
  connectionId: string,
): Promise<GrowthEmailProviderConnection | null> {
  const { data, error } = await connectionsTable(admin).select(SELECT).eq("id", connectionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as ConnectionDbRow) : null
}

export async function fetchGrowthOutboundConnectionByProvider(
  admin: SupabaseClient,
  provider: string,
): Promise<GrowthEmailProviderConnection | null> {
  const { data, error } = await connectionsTable(admin)
    .select(SELECT)
    .eq("provider", provider)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as ConnectionDbRow) : null
}

export async function listGrowthOutboundConnections(
  admin: SupabaseClient,
): Promise<GrowthEmailProviderConnection[]> {
  const { data, error } = await connectionsTable(admin).select(SELECT).order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ConnectionDbRow[]).map(mapRow)
}

export async function ensureGrowthStubOutboundConnection(
  admin: SupabaseClient,
  createdBy?: string | null,
): Promise<GrowthEmailProviderConnection> {
  const existing = await fetchGrowthOutboundConnectionByProvider(admin, GROWTH_OUTBOUND_STUB_PROVIDER)
  if (existing) return existing

  const { data, error } = await connectionsTable(admin)
    .insert({
      provider: GROWTH_OUTBOUND_STUB_PROVIDER,
      provider_family: "custom",
      label: GROWTH_OUTBOUND_DEFAULT_CONNECTION_LABEL,
      status: "active",
      created_by: createdBy ?? null,
    })
    .select(SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as ConnectionDbRow)
}
