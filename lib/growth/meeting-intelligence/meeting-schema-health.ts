import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

let cachedReady: boolean | null = null
let cachedAt = 0
const CACHE_MS = 60_000

export async function isGrowthMeetingSchemaReady(admin: SupabaseClient): Promise<boolean> {
  if (cachedReady != null && Date.now() - cachedAt < CACHE_MS) return cachedReady
  const { error } = await admin.schema("growth").from("meetings").select("id").limit(1)
  cachedReady = !error
  cachedAt = Date.now()
  return cachedReady
}

export const GROWTH_MEETING_SCHEMA_SETUP_MESSAGE =
  "Meeting intelligence tables are not ready yet. Apply the latest Growth Engine migrations to enable meeting tracking."
