import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_CANONICAL_PERSON_MIGRATION } from "@/lib/growth/canonical-persons/canonical-person-types"

export { GROWTH_CANONICAL_PERSON_MIGRATION }

export async function isGrowthCanonicalPersonSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("persons").select("id").limit(1)
  return !error
}
