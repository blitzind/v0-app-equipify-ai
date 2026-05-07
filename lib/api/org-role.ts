import type { SupabaseClient } from "@supabase/supabase-js"

/** Active membership role for the user in the organization, or null. */
export async function getOrganizationMemberRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  const r = (data as { role?: string } | null)?.role
  return r?.trim() ? r : null
}

/** Org default certificate release mode (settings page). */
export function roleCanEditOrgPortalCertificateDefault(role: string | null): boolean {
  return role === "owner" || role === "admin"
}

/** Customer override, invoice override, manual certificate release. */
export function roleCanManageOperationalCertificateRules(role: string | null): boolean {
  return role === "owner" || role === "admin" || role === "manager"
}
