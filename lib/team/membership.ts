import type { SupabaseClient } from "@supabase/supabase-js"

export const MEMBERSHIP_ROLES = ["owner", "admin", "manager", "tech", "viewer"] as const
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number]

export const MEMBERSHIP_STATUSES = ["invited", "active", "suspended"] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

export function isMembershipRole(v: string): v is MembershipRole {
  return (MEMBERSHIP_ROLES as readonly string[]).includes(v)
}

export function isMembershipStatus(v: string): v is MembershipStatus {
  return (MEMBERSHIP_STATUSES as readonly string[]).includes(v)
}

export async function countActiveOwners(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await admin
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .eq("status", "active")
  if (error) return 0
  return count ?? 0
}
