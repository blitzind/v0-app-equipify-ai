import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_SIGNAL_WATCHLIST_SCHEMA_MIGRATION =
  "20270528120000_growth_engine_signal_watchlists.sql" as const

export const GROWTH_SIGNAL_WATCHLIST_SCHEMA_SETUP_MESSAGE = `Signal watchlist tables are not ready. Apply migration ${GROWTH_SIGNAL_WATCHLIST_SCHEMA_MIGRATION}.`

export async function isGrowthSignalWatchlistSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("signal_watchlists").select("id").limit(1)
  return !error
}
