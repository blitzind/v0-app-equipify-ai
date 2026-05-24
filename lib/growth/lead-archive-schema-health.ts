import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

export type GrowthLeadArchiveSchemaProbe = {
  archiveColumns: boolean
}

let cachedProbe: { value: GrowthLeadArchiveSchemaProbe; checkedAt: number } | null = null
const CACHE_MS = 60_000

function isMissingColumnError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return looksLikePostgrestMissingSchemaError(error.message, error.code)
}

export async function probeGrowthLeadArchiveSchema(
  admin: SupabaseClient,
): Promise<GrowthLeadArchiveSchemaProbe> {
  if (cachedProbe && Date.now() - cachedProbe.checkedAt < CACHE_MS) {
    return cachedProbe.value
  }

  const probe: GrowthLeadArchiveSchemaProbe = {
    archiveColumns: true,
  }

  const archivedAt = await admin.schema("growth").from("leads").select("archived_at").limit(1)
  if (isMissingColumnError(archivedAt.error)) {
    probe.archiveColumns = false
  }

  cachedProbe = { value: probe, checkedAt: Date.now() }
  return probe
}

export function resetGrowthLeadArchiveSchemaProbeCacheForTests(): void {
  cachedProbe = null
}

export function invalidateGrowthLeadArchiveSchemaProbeCache(): void {
  cachedProbe = null
}
