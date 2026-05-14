import type { SupabaseClient } from "@supabase/supabase-js"

/** Active platform support session row for this user + org (RLS: user reads own rows). */
export async function hasActiveOrganizationSupportSession(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("organization_support_sessions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle()

    if (error) return false
    return Boolean(data)
  } catch {
    return false
  }
}
