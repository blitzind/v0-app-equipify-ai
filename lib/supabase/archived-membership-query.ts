import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * True when the user has at least one active membership and every joined organization is archived.
 * Used by middleware and `/api/session/archive-access` so behavior stays aligned.
 */
export async function userHasOnlyArchivedOrganizationMemberships(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("organization_members")
    .select("organizations(status)")
    .eq("user_id", userId)
    .eq("status", "active")

  const list = rows ?? []
  if (list.length === 0) return false

  for (const row of list) {
    const o = row.organizations as { status?: string } | { status?: string }[] | null
    const org = Array.isArray(o) ? o[0] : o
    const st = org?.status ?? "active"
    if (st !== "archived") return false
  }
  return true
}
