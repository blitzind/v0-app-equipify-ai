import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import {
  getOrgPermissionsForRole,
  hasOrgPermission,
  normalizeOrgMemberRole,
  type OrgPermissionKey,
} from "@/lib/permissions/model"

/**
 * Phase 2 (Permissions): the catalog/inventory write gate is now driven by
 * the central `OrgPermissions` capability map instead of a hardcoded role
 * array. The default capability is `canManageInventory` (true for owner /
 * admin / manager — identical to the previous behaviour); callers may pass
 * a different key (e.g. `canManageCertificateTemplates`) to gate alternate
 * surfaces while still benefiting from the shared service-role wiring.
 */
export async function requireOrgCatalogWrite(
  organizationId: string,
  options: { capability?: OrgPermissionKey; forbiddenMessage?: string } = {},
): Promise<
  | {
      userId: string
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
      svc: ReturnType<typeof createServiceRoleSupabaseClient>
    }
  | { error: NextResponse }
> {
  const capability: OrgPermissionKey = options.capability ?? "canManageInventory"
  const forbiddenMessage =
    options.forbiddenMessage ??
    "Only owners, admins, and managers can manage catalog and inventory."

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 }) }
  }

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))

  if (!platformAdmin) {
    const { data: mem, error: memErr } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (memErr) {
      return {
        error: NextResponse.json(
          { error: "query_failed", message: memErr.message },
          { status: 500 },
        ),
      }
    }

    const rawRole = (mem as { role?: string } | null)?.role ?? null
    const role = normalizeOrgMemberRole(rawRole)
    if (!role) {
      return {
        error: NextResponse.json(
          { error: "forbidden", message: "You are not a member of this organization." },
          { status: 403 },
        ),
      }
    }
    const perms = getOrgPermissionsForRole(role)
    if (!hasOrgPermission(perms, capability)) {
      return {
        error: NextResponse.json(
          { error: "insufficient_permissions", message: forbiddenMessage },
          { status: 403 },
        ),
      }
    }
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return {
      error: NextResponse.json(
        { error: "service_unavailable", message: "Server configuration error." },
        { status: 503 },
      ),
    }
  }

  return { userId: user.id, supabase, svc }
}

export async function requireOrgMemberRead(organizationId: string): Promise<
  | {
      userId: string
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
      svc: ReturnType<typeof createServiceRoleSupabaseClient>
    }
  | { error: NextResponse }
> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return { error: NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 }) }
  }

  const platformAdmin = Boolean(user.email && isPlatformAdminEmail(user.email))

  if (!platformAdmin) {
    const { data: mem, error: memErr } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (memErr) {
      return {
        error: NextResponse.json(
          { error: "query_failed", message: memErr.message },
          { status: 500 },
        ),
      }
    }

    if (!mem) {
      return {
        error: NextResponse.json(
          { error: "forbidden", message: "You are not a member of this organization." },
          { status: 403 },
        ),
      }
    }
  }

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return {
      error: NextResponse.json(
        { error: "service_unavailable", message: "Server configuration error." },
        { status: 503 },
      ),
    }
  }

  return { userId: user.id, supabase, svc }
}
