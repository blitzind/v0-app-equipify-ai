import type { SupabaseClient } from "@supabase/supabase-js"
import { memoizeGrowthSchemaProbe } from "@/lib/growth/runtime/growth-schema-probe-cache"

export const GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION =
  "20270527120000_growth_engine_signal_foundation.sql" as const

export const GROWTH_SIGNAL_FOUNDATION_SCHEMA_SETUP_MESSAGE = `Intent signal foundation tables are not ready. Apply migration ${GROWTH_SIGNAL_FOUNDATION_SCHEMA_MIGRATION}.`

const SIGNAL_SCHEMA_PROBE_KEY = "growth_signal_foundation_schema" as const

export async function isGrowthSignalFoundationSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  return memoizeGrowthSchemaProbe(SIGNAL_SCHEMA_PROBE_KEY, async () => {
    const { error } = await admin.schema("growth").from("signals").select("id").limit(1)
    return !error
  })
}
