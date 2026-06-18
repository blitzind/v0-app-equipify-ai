import type { SupabaseClient } from "@supabase/supabase-js"
import { memoizeGrowthSchemaProbe } from "@/lib/growth/runtime/growth-schema-probe-cache"

export const GROWTH_UNIFIED_INBOX_SCHEMA_MIGRATION = "20270129120000_growth_unified_inbox.sql" as const

const INBOX_SCHEMA_PROBE_KEY = "growth_unified_inbox_schema" as const

export async function isGrowthUnifiedInboxSchemaReady(admin: SupabaseClient): Promise<boolean> {
  return memoizeGrowthSchemaProbe(INBOX_SCHEMA_PROBE_KEY, async () => {
    const { error } = await admin.schema("growth").from("inbox_threads").select("id").limit(1)
    return !error
  })
}
