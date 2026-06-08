import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

export async function profileLabelById(
  supabase: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId?.trim()) return null
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId.trim())
    .maybeSingle()
  const row = data as { full_name?: string | null; email?: string | null } | null
  if (!row) return null
  return (row.full_name && row.full_name.trim()) || (row.email && row.email.trim()) || null
}
