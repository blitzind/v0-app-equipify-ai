import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthEmailProviderConnection,
  GrowthOutboundProviderFamily,
  GrowthOutboundConnectionStatus,
} from "@/lib/growth/outbound/types"
import { GROWTH_OUTBOUND_DEFAULT_CONNECTION_LABEL, GROWTH_OUTBOUND_STUB_PROVIDER } from "@/lib/growth/outbound/constants"
import {
  growthEmailProviderConnectionsTable,
  withActiveProviderConnectionScope,
} from "@/lib/growth/outbound/provider-connection-query"
import { probeGrowthProviderConnectionSchema } from "@/lib/growth/outbound/provider-schema-health"

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
  monthly_cost_estimate: number | null
  seat_count: number | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const SELECT =
  "id, provider, provider_family, label, status, api_base_url, webhook_secret, config, last_webhook_at, last_error, monthly_cost_estimate, seat_count, notes, created_by, created_at, updated_at"

function connectionsTable(admin: SupabaseClient) {
  return growthEmailProviderConnectionsTable(admin)
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
    monthlyCostEstimate: row.monthly_cost_estimate != null ? Number(row.monthly_cost_estimate) : null,
    seatCount: row.seat_count,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthOutboundConnectionById(
  admin: SupabaseClient,
  connectionId: string,
): Promise<GrowthEmailProviderConnection | null> {
  const { softDelete } = await probeGrowthProviderConnectionSchema(admin)
  const selectQuery = withActiveProviderConnectionScope(connectionsTable(admin).select(SELECT), softDelete)
  const { data, error } = await selectQuery.eq("id", connectionId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRow(data as ConnectionDbRow) : null
}

export async function fetchGrowthOutboundConnectionByProvider(
  admin: SupabaseClient,
  provider: string,
): Promise<GrowthEmailProviderConnection | null> {
  const { softDelete } = await probeGrowthProviderConnectionSchema(admin)
  const selectQuery = withActiveProviderConnectionScope(connectionsTable(admin).select(SELECT), softDelete)
  const { data, error } = await selectQuery
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
  const { softDelete } = await probeGrowthProviderConnectionSchema(admin)
  const selectQuery = withActiveProviderConnectionScope(connectionsTable(admin).select(SELECT), softDelete)
  const { data, error } = await selectQuery.order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as ConnectionDbRow[]).map(mapRow)
}

export async function ensureGrowthStubOutboundConnection(
  admin: SupabaseClient,
  createdBy?: string | null,
): Promise<GrowthEmailProviderConnection> {
  const existing = await fetchGrowthOutboundConnectionByProvider(admin, GROWTH_OUTBOUND_STUB_PROVIDER)
  if (existing) return existing

  const schema = await probeGrowthProviderConnectionSchema(admin)
  const insert: Record<string, unknown> = {
    provider: GROWTH_OUTBOUND_STUB_PROVIDER,
    provider_family: "custom",
    label: GROWTH_OUTBOUND_DEFAULT_CONNECTION_LABEL,
    status: "active",
    created_by: createdBy ?? null,
  }
  if (schema.providerConnector) {
    insert.lifecycle_status = "connected"
    insert.health_reason = null
  }

  const { data, error } = await connectionsTable(admin).insert(insert).select(SELECT).single()

  if (error) throw new Error(error.message)
  return mapRow(data as ConnectionDbRow)
}

export async function updateGrowthOutboundConnection(
  admin: SupabaseClient,
  connectionId: string,
  input: {
    monthlyCostEstimate?: number | null
    seatCount?: number | null
    notes?: string | null
  },
): Promise<GrowthEmailProviderConnection> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.monthlyCostEstimate !== undefined) {
    patch.monthly_cost_estimate = input.monthlyCostEstimate
  }
  if (input.seatCount !== undefined) {
    patch.seat_count = input.seatCount
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() ? input.notes.trim() : null
  }

  const { softDelete } = await probeGrowthProviderConnectionSchema(admin)
  const updateQuery = withActiveProviderConnectionScope(connectionsTable(admin).update(patch), softDelete)
  const { data, error } = await updateQuery.eq("id", connectionId).select(SELECT).single()

  if (error) throw new Error(error.message)
  return mapRow(data as ConnectionDbRow)
}
