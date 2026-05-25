import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE =
  "Post-close revenue tables are not ready. Apply migration 20270301120000_growth_engine_post_close_revenue.sql."

export async function isGrowthCustomerLifecycleSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("customer_profiles").select("id").limit(1)
  return !error
}
