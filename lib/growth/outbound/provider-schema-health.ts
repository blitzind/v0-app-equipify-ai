import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { looksLikePostgrestMissingSchemaError } from "@/lib/blitzpay/blitzpay-schema-health-detect"

export type GrowthProviderSchemaProbe = {
  providerConnector: boolean
  softDelete: boolean
}

let cachedProbe: { value: GrowthProviderSchemaProbe; checkedAt: number } | null = null
const CACHE_MS = 60_000

function isMissingColumnError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false
  return looksLikePostgrestMissingSchemaError(error.message, error.code)
}

export async function probeGrowthProviderConnectionSchema(
  admin: SupabaseClient,
): Promise<GrowthProviderSchemaProbe> {
  if (cachedProbe && Date.now() - cachedProbe.checkedAt < CACHE_MS) {
    return cachedProbe.value
  }

  const probe: GrowthProviderSchemaProbe = {
    providerConnector: true,
    softDelete: true,
  }

  const lifecycle = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("lifecycle_status")
    .limit(1)

  if (isMissingColumnError(lifecycle.error)) {
    probe.providerConnector = false
  }

  const softDelete = await admin
    .schema("growth")
    .from("email_provider_connections")
    .select("deleted_at")
    .limit(1)

  if (isMissingColumnError(softDelete.error)) {
    probe.softDelete = false
  }

  cachedProbe = { value: probe, checkedAt: Date.now() }
  return probe
}

export function resetGrowthProviderSchemaProbeCacheForTests(): void {
  cachedProbe = null
}
