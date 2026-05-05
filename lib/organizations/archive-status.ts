import type { SupabaseClient } from "@supabase/supabase-js"

/** Uses caller's Supabase client (RLS applies). Members can still SELECT `organizations` when archived. */
export async function isOrganizationArchived(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", organizationId)
    .maybeSingle()

  if (error || !data) return false
  return data.status === "archived"
}
