import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseGrowthProviderCapabilitySnapshot } from "@/lib/growth/outbound/capability-snapshot"
import type {
  GrowthProviderCapabilityHistoryEntry,
  GrowthProviderCapabilitySnapshot,
  GrowthProviderLifecycleStatus,
  GrowthProviderValidationWarning,
} from "@/lib/growth/outbound/provider-types"

type CapabilityHistoryRow = {
  id: string
  connection_id: string
  validated_at: string
  healthy: boolean
  duration_ms: number
  lifecycle_status: string
  capability_snapshot: Record<string, unknown> | null
  warnings: unknown
  account_metadata: Record<string, unknown> | null
  created_at: string
}

function table(admin: SupabaseClient) {
  return admin.schema("growth").from("provider_capability_history")
}

function mapRow(row: CapabilityHistoryRow): GrowthProviderCapabilityHistoryEntry {
  return {
    id: row.id,
    connectionId: row.connection_id,
    validatedAt: row.validated_at,
    healthy: row.healthy,
    durationMs: row.duration_ms,
    lifecycleStatus: row.lifecycle_status as GrowthProviderLifecycleStatus,
    capabilitySnapshot: parseGrowthProviderCapabilitySnapshot(row.capability_snapshot),
    warnings: Array.isArray(row.warnings) ? (row.warnings as GrowthProviderValidationWarning[]) : [],
    accountMetadata: row.account_metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function countGrowthProviderCapabilityHistory(
  admin: SupabaseClient,
  connectionId: string,
): Promise<number> {
  const { count, error } = await table(admin)
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function appendGrowthProviderCapabilityHistory(
  admin: SupabaseClient,
  input: {
    connectionId: string
    healthy: boolean
    durationMs: number
    lifecycleStatus: GrowthProviderLifecycleStatus
    capabilitySnapshot: GrowthProviderCapabilitySnapshot
    warnings: GrowthProviderValidationWarning[]
    accountMetadata: Record<string, unknown>
  },
): Promise<GrowthProviderCapabilityHistoryEntry> {
  const { data, error } = await table(admin)
    .insert({
      connection_id: input.connectionId,
      healthy: input.healthy,
      duration_ms: input.durationMs,
      lifecycle_status: input.lifecycleStatus,
      capability_snapshot: input.capabilitySnapshot,
      warnings: input.warnings,
      account_metadata: input.accountMetadata,
    })
    .select(
      "id, connection_id, validated_at, healthy, duration_ms, lifecycle_status, capability_snapshot, warnings, account_metadata, created_at",
    )
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as CapabilityHistoryRow)
}

export async function listGrowthProviderCapabilityHistory(
  admin: SupabaseClient,
  connectionId: string,
  limit = 20,
): Promise<GrowthProviderCapabilityHistoryEntry[]> {
  const { data, error } = await table(admin)
    .select(
      "id, connection_id, validated_at, healthy, duration_ms, lifecycle_status, capability_snapshot, warnings, account_metadata, created_at",
    )
    .eq("connection_id", connectionId)
    .order("validated_at", { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return ((data ?? []) as CapabilityHistoryRow[]).map(mapRow)
}
