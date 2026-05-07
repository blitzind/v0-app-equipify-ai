import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getOrganizationMemberRole } from "@/lib/api/org-role"
import {
  getOrgPermissionsForRole,
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
  const rawRole = await getOrganizationMemberRole(supabase, userId, organizationId)
  const mapped = normalizeOrgMemberRole(rawRole)
  const permissions = getOrgPermissionsForRole(mapped)
  if (!permissions[key]) {
    return {
      ok: false,
      response: jsonError("Insufficient permissions for this action.", 403),
    }
  }
  return { ok: true, role: rawRole, permissions }
}
