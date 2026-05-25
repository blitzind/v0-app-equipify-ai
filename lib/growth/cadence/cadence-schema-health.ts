import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

let cachedReady: boolean | null = null
let cachedAt = 0
const CACHE_MS = 60_000

export async function isGrowthCadenceSchemaReady(admin: SupabaseClient): Promise<boolean> {
  if (cachedReady != null && Date.now() - cachedAt < CACHE_MS) return cachedReady
  const { error } = await admin.schema("growth").from("cadence_tasks").select("id").limit(1)
  cachedReady = !error
  cachedAt = Date.now()
  return cachedReady
}

export const GROWTH_CADENCE_SCHEMA_SETUP_MESSAGE =
  "Multi-channel cadence tables are not ready yet. Apply the latest Growth Engine migrations."
