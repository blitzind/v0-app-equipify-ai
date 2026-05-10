import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getOrganizationMemberRecord } from "@/lib/api/org-role"
import {
  getEffectiveOrgPermissions,
  normalizeOrgMemberRole,
  type OrgPermissionKey,
  type OrgPermissions,
} from "@/lib/permissions/model"

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Returns 403 when the active member lacks the required operational permission.
 * RLS remains authoritative; this blocks obviously-invalid API calls early.
 */
export async function requireOrgMemberPermission(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  key: OrgPermissionKey,
): Promise<{ ok: true; role: string | null; permissions: OrgPermissions } | { ok: false; response: NextResponse }> {
  const rec = await getOrganizationMemberRecord(supabase, userId, organizationId)
  const rawRole = rec?.role ?? null
  const permissions = getEffectiveOrgPermissions({
    role: normalizeOrgMemberRole(rawRole),
    permissionProfile: rec?.permission_profile,
    permissionsJson: rec?.permissions_json,
  })
  if (!permissions[key]) {
    return {
      ok: false,
      response: jsonError("Insufficient permissions for this action.", 403),
    }
  }
  return { ok: true, role: rawRole, permissions }
}
