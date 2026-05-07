/**
 * Role-based Permissions — Phase 1
 *
 * Thin wrapper around the existing membership lookup that adds an explicit
 * capability check from the central `OrgPermissions` map. Use this on any
 * mutation API route that should be gated by a Phase 1 capability.
 *
 * Returns `{ userId, supabase, role, permissions }` on success or
 * `{ error: NextResponse }` on failure (mirroring the existing inventory /
 * catalog gate shape so call sites remain familiar).
 */

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import {
  getOrgPermissionsForRole,
  hasOrgPermission,
  normalizeOrgMemberRole,
  type OrgPermissionKey,
  type OrgPermissions,
} from "@/lib/permissions/model"

type Success = {
  userId: string
  supabase: SupabaseClient
  role: string | null
  permissions: OrgPermissions
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number, code = "forbidden") {
  return NextResponse.json({ error: code, message }, { status })
}

/**
 * Require that the caller is an active member of the organization AND that
 * their derived `OrgPermissions` includes *every* capability in
 * `requiredCapabilities`. Platform admins (resolved by email) bypass the
 * capability check but still need a valid auth session.
 */
export async function requireOrgPermission(
  organizationId: string,
  requiredCapabilities: OrgPermissionKey | OrgPermissionKey[],
): Promise<Success | { error: NextResponse }> {
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "bad_request") }
  }

  const required = Array.isArray(requiredCapabilities)
    ? requiredCapabilities
    : [requiredCapabilities]

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: jsonError("Sign in required.", 401, "unauthorized") }
  }

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))

  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  const role = normalizeOrgMemberRole(rawRole)
  const permissions = getOrgPermissionsForRole(role)

  if (!platformAdmin) {
    if (!rawRole) {
      return {
        error: jsonError("You are not a member of this organization.", 403),
      }
    }
    const missing = required.find((cap) => !hasOrgPermission(permissions, cap))
    if (missing) {
      return {
        error: jsonError(
          `Your role does not have permission for "${missing}".`,
          403,
          "insufficient_permissions",
        ),
      }
    }
  }

  return {
    userId: user.id,
    supabase,
    role: rawRole,
    permissions: platformAdmin
      ? // Platform admins see effective owner permissions regardless of org role.
        getOrgPermissionsForRole("owner")
      : permissions,
  }
}

/**
 * Convenience helper for "any of" checks (e.g. either canEditInvoices or
 * canApproveInvoices is sufficient).
 */
export async function requireAnyOrgPermission(
  organizationId: string,
  capabilities: OrgPermissionKey[],
): Promise<Success | { error: NextResponse }> {
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "bad_request") }
  }
  if (capabilities.length === 0) {
    return { error: jsonError("No capabilities requested.", 400, "bad_request") }
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: jsonError("Sign in required.", 401, "unauthorized") }
  }

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))

  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  const role = normalizeOrgMemberRole(rawRole)
  const permissions = getOrgPermissionsForRole(role)

  if (!platformAdmin) {
    if (!rawRole) {
      return {
        error: jsonError("You are not a member of this organization.", 403),
      }
    }
    const allowed = capabilities.some((cap) => hasOrgPermission(permissions, cap))
    if (!allowed) {
      return {
        error: jsonError(
          "Your role does not have permission for this action.",
          403,
          "insufficient_permissions",
        ),
      }
    }
  }

  return {
    userId: user.id,
    supabase,
    role: rawRole,
    permissions: platformAdmin ? getOrgPermissionsForRole("owner") : permissions,
  }
}
