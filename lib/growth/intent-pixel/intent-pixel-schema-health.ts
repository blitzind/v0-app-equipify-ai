import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_INTENT_PIXEL_SCHEMA_SETUP_MESSAGE =
  "Intent Pixel tables are not ready. Apply migration 20270316120000_growth_engine_intent_pixel_foundation.sql."

export async function isGrowthIntentPixelSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("intent_pixel_sites").select("id").limit(1)
  return !error
}
