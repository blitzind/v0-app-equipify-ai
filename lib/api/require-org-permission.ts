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
import {
  createServerSupabaseClient,
  createSupabaseClientWithAccessToken,
  getBearerAccessToken,
} from "@/lib/supabase/server"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { hasActiveOrganizationSupportSession } from "@/lib/server/organization-support-session"
import {
  getEffectiveOrgPermissions,
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
  /** True when the authenticated user is on the platform-admin allowlist (email). */
  isPlatformAdmin: boolean
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
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  let effectiveRawRole = rawRole
  if (!effectiveRawRole && (await hasActiveOrganizationSupportSession(supabase, user.id, organizationId))) {
    effectiveRawRole = "owner"
  }
  const role = normalizeOrgMemberRole(effectiveRawRole)
  const permissions = getEffectiveOrgPermissions({
    role,
    permissionProfile: mem
      ? ((mem as { permission_profile?: string | null }).permission_profile ?? null)
      : null,
    permissionsJson: mem ? ((mem as { permissions_json?: unknown }).permissions_json ?? null) : null,
  })

  if (!platformAdmin) {
    if (!effectiveRawRole) {
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
    role: effectiveRawRole,
    permissions: platformAdmin
      ? // Platform admins see effective owner permissions regardless of org role.
        getOrgPermissionsForRole("owner")
      : permissions,
    isPlatformAdmin: platformAdmin,
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
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  let effectiveRawRole = rawRole
  if (!effectiveRawRole && (await hasActiveOrganizationSupportSession(supabase, user.id, organizationId))) {
    effectiveRawRole = "owner"
  }
  const role = normalizeOrgMemberRole(effectiveRawRole)
  const permissions = getEffectiveOrgPermissions({
    role,
    permissionProfile: mem
      ? ((mem as { permission_profile?: string | null }).permission_profile ?? null)
      : null,
    permissionsJson: mem ? ((mem as { permissions_json?: unknown }).permissions_json ?? null) : null,
  })

  if (!platformAdmin) {
    if (!effectiveRawRole) {
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
    role: effectiveRawRole,
    permissions: platformAdmin ? getOrgPermissionsForRole("owner") : permissions,
    isPlatformAdmin: platformAdmin,
  }
}

/**
 * Active org membership + effective permissions, without requiring a specific capability.
 * Use for tenant-scoped utilities (e.g. header search) that apply their own per-entity gates.
 */
export async function requireOrgMemberSession(
  organizationId: string,
): Promise<Success | { error: NextResponse }> {
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "bad_request") }
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
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  let effectiveRawRole = rawRole
  if (!effectiveRawRole && (await hasActiveOrganizationSupportSession(supabase, user.id, organizationId))) {
    effectiveRawRole = "owner"
  }
  const role = normalizeOrgMemberRole(effectiveRawRole)
  const permissions = getEffectiveOrgPermissions({
    role,
    permissionProfile: mem
      ? ((mem as { permission_profile?: string | null }).permission_profile ?? null)
      : null,
    permissionsJson: mem ? ((mem as { permissions_json?: unknown }).permissions_json ?? null) : null,
  })

  if (!platformAdmin) {
    if (!effectiveRawRole) {
      return {
        error: jsonError("You are not a member of this organization.", 403),
      }
    }
  }

  return {
    userId: user.id,
    supabase,
    role: effectiveRawRole,
    permissions: platformAdmin ? getOrgPermissionsForRole("owner") : permissions,
    isPlatformAdmin: platformAdmin,
  }
}

export type OrgPermissionServerActionGate =
  | { ok: true; userId: string; supabase: SupabaseClient }
  | { ok: false; error: string }

/**
 * Same checks as {@link requireOrgPermission}, but returns a plain `{ ok, error }`
 * for server actions (instead of a `NextResponse`).
 */
export async function requireOrgPermissionForServerAction(
  organizationId: string,
  requiredCapabilities: OrgPermissionKey | OrgPermissionKey[],
): Promise<OrgPermissionServerActionGate> {
  const res = await requireOrgPermission(organizationId, requiredCapabilities)
  if ("error" in res) {
    let message = "You don't have permission for this action."
    try {
      const body = (await res.error.json()) as { message?: unknown }
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim()
      }
    } catch {
      /* keep default */
    }
    return { ok: false, error: message }
  }
  return { ok: true, userId: res.userId, supabase: res.supabase }
}

type ResolvedRequestAuth =
  | { ok: true; supabase: SupabaseClient; userId: string; userEmail: string | null }
  | { ok: false; error: NextResponse }

async function resolveAuthedSupabaseFromRequest(request: Request): Promise<ResolvedRequestAuth> {
  const bearer = getBearerAccessToken(request)
  const cookieClient = await createServerSupabaseClient()

  if (bearer) {
    const { data, error } = await cookieClient.auth.getUser(bearer)
    if (error || !data.user?.id) {
      return { ok: false, error: jsonError("Sign in required.", 401, "unauthorized") }
    }
    return {
      ok: true,
      supabase: createSupabaseClientWithAccessToken(bearer),
      userId: data.user.id,
      userEmail: data.user.email ?? null,
    }
  }

  const {
    data: { user },
  } = await cookieClient.auth.getUser()
  if (!user?.id) {
    return { ok: false, error: jsonError("Sign in required.", 401, "unauthorized") }
  }
  return {
    ok: true,
    supabase: cookieClient,
    userId: user.id,
    userEmail: user.email ?? null,
  }
}

/**
 * Same as {@link requireOrgPermission}, but accepts cookie or Bearer auth (mobile).
 */
export async function requireOrgPermissionFromRequest(
  request: Request,
  organizationId: string,
  requiredCapabilities: OrgPermissionKey | OrgPermissionKey[],
): Promise<Success | { error: NextResponse }> {
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "bad_request") }
  }

  const required = Array.isArray(requiredCapabilities)
    ? requiredCapabilities
    : [requiredCapabilities]

  const auth = await resolveAuthedSupabaseFromRequest(request)
  if (!auth.ok) return { error: auth.error }

  const { supabase, userId, userEmail } = auth
  const platformAdmin = Boolean(userEmail && isPlatformAdminEmail(userEmail))

  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  let effectiveRawRole = rawRole
  if (!effectiveRawRole && (await hasActiveOrganizationSupportSession(supabase, userId, organizationId))) {
    effectiveRawRole = "owner"
  }
  const role = normalizeOrgMemberRole(effectiveRawRole)
  const permissions = getEffectiveOrgPermissions({
    role,
    permissionProfile: mem
      ? ((mem as { permission_profile?: string | null }).permission_profile ?? null)
      : null,
    permissionsJson: mem ? ((mem as { permissions_json?: unknown }).permissions_json ?? null) : null,
  })

  if (!platformAdmin) {
    if (!effectiveRawRole) {
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
    userId,
    supabase,
    role: effectiveRawRole,
    permissions: platformAdmin ? getOrgPermissionsForRole("owner") : permissions,
    isPlatformAdmin: platformAdmin,
  }
}

/**
 * Same as {@link requireOrgMemberSession}, but accepts cookie or Bearer auth (mobile).
 */
export async function requireOrgMemberSessionFromRequest(
  request: Request,
  organizationId: string,
): Promise<Success | { error: NextResponse }> {
  if (!UUID_RE.test(organizationId)) {
    return { error: jsonError("Invalid organization.", 400, "bad_request") }
  }

  const auth = await resolveAuthedSupabaseFromRequest(request)
  if (!auth.ok) return { error: auth.error }

  const { supabase, userId, userEmail } = auth
  const platformAdmin = Boolean(userEmail && isPlatformAdminEmail(userEmail))

  const { data: mem, error: memErr } = await supabase
    .from("organization_members")
    .select("role, permission_profile, permissions_json")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (memErr) {
    return { error: jsonError(memErr.message, 500, "query_failed") }
  }

  const rawRole = (mem as { role?: string } | null)?.role?.trim() ?? null
  let effectiveRawRole = rawRole
  if (!effectiveRawRole && (await hasActiveOrganizationSupportSession(supabase, userId, organizationId))) {
    effectiveRawRole = "owner"
  }
  const role = normalizeOrgMemberRole(effectiveRawRole)
  const permissions = getEffectiveOrgPermissions({
    role,
    permissionProfile: mem
      ? ((mem as { permission_profile?: string | null }).permission_profile ?? null)
      : null,
    permissionsJson: mem ? ((mem as { permissions_json?: unknown }).permissions_json ?? null) : null,
  })

  if (!platformAdmin) {
    if (!effectiveRawRole) {
      return {
        error: jsonError("You are not a member of this organization.", 403),
      }
    }
  }

  return {
    userId,
    supabase,
    role: effectiveRawRole,
    permissions: platformAdmin ? getOrgPermissionsForRole("owner") : permissions,
    isPlatformAdmin: platformAdmin,
  }
}
