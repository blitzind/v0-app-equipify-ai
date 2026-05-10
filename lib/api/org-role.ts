import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrgPermissionsForRole,
  normalizeOrgMemberRole,
} from "@/lib/permissions/model"

export type OrganizationMemberRecord = {
  role: string | null
  permission_profile: string | null
  permissions_json: unknown
}

/**
 * Active membership row fields used for effective capability resolution
 * (`getEffectiveOrgPermissions`). Prefer this when server checks must honor
 * commercial profiles and `permissions_json` overlays — not DB role alone.
 */
export async function getOrganizationMemberRecord(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<OrganizationMemberRecord | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()
  if (!data) return null
  const row = data as {
    role?: string | null
    permission_profile?: string | null
    permissions_json?: unknown
  }
  const r = row.role?.trim() ? row.role.trim() : null
  return {
    role: r,
    permission_profile: row.permission_profile ?? null,
    permissions_json: row.permissions_json ?? null,
  }
}

/** Active membership role for the user in the organization, or null. */
export async function getOrganizationMemberRole(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
): Promise<string | null> {
  const rec = await getOrganizationMemberRecord(supabase, userId, organizationId)
  return rec?.role ?? null
}

/** Org default certificate release mode (settings page). */
export function roleCanEditOrgPortalCertificateDefault(role: string | null): boolean {
  return getOrgPermissionsForRole(normalizeOrgMemberRole(role)).canManagePortalSettings
}

/** Customer override, invoice override, manual certificate release. */
export function roleCanManageOperationalCertificateRules(role: string | null): boolean {
  return getOrgPermissionsForRole(normalizeOrgMemberRole(role)).canReleaseCertificatesToPortal
}
