import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function upsertExternalMapping(params: {
  svc: SupabaseClient
  organizationId: string
  entityType: "customer" | "invoice" | "payment" | "catalog_item"
  internalId: string
  externalId: string
  syncStatus: "pending" | "synced" | "error" | "stale"
  lastError?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  const now = new Date().toISOString()
  await params.svc.from("external_sync_mappings").upsert(
    {
      organization_id: params.organizationId,
      provider: "quickbooks_online",
      entity_type: params.entityType,
      internal_id: params.internalId,
      external_id: params.externalId,
      sync_status: params.syncStatus,
      last_synced_at: params.syncStatus === "synced" ? now : null,
      last_error: params.lastError?.slice(0, 2000) ?? null,
      metadata: params.metadata ?? {},
      updated_at: now,
    },
    { onConflict: "organization_id,provider,entity_type,internal_id" },
  )
}

export async function markMappingStaleIfUpdatedSinceSync(params: {
  svc: SupabaseClient
  organizationId: string
  entityType: "customer" | "invoice" | "catalog_item"
  internalId: string
  sourceUpdatedAt: string | null
}): Promise<void> {
  if (!params.sourceUpdatedAt) return
  const { data: row } = await params.svc
    .from("external_sync_mappings")
    .select("last_synced_at")
    .eq("organization_id", params.organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", params.entityType)
    .eq("internal_id", params.internalId)
    .maybeSingle()

  const last = row?.last_synced_at as string | undefined
  if (!last) return
  if (new Date(params.sourceUpdatedAt).getTime() > new Date(last).getTime()) {
    await params.svc
      .from("external_sync_mappings")
      .update({
        sync_status: "stale",
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", params.organizationId)
      .eq("provider", "quickbooks_online")
      .eq("entity_type", params.entityType)
      .eq("internal_id", params.internalId)
  }
}
