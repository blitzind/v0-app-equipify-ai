import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function isGrowthSenderProfilesSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("sender_profiles").select("id").limit(1)
  if (!error) return true
  const msg = error.message.toLowerCase()
  return !msg.includes("sender_profiles") && !msg.includes("does not exist")
}
