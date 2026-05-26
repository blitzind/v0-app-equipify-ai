import type { SupabaseClient } from "@supabase/supabase-js"

export async function isGrowthBuyingStageSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("buying_stage_assessments")
    .select("id")
    .limit(1)

  return !error
}

export const GROWTH_BUYING_STAGE_SCHEMA_SETUP_MESSAGE =
  "Apply migration supabase/migrations/20270320120000_growth_engine_buying_stage_assessments.sql"
