import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const MANAGER_ROLES = new Set(["owner", "admin", "manager"])

export function isValidUuid(id: string): boolean {
  return UUID_RE.test(id)
}

export type ArchivedCenterGate =
  | {
      ok: true
      organizationId: string
      platformAdmin: boolean
      userId: string
      userEmail: string | null
    }
  | { ok: false; status: number; message: string }

/**
 * Active workspace only; members see their org. Platform admins may access any active org (impersonation).
 */
export async function gateArchivedCenterAccess(
  supabase: SupabaseClient,
  user: User | null,
  organizationIdRaw: string | null,
): Promise<ArchivedCenterGate> {
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" }
  }

  const organizationId = organizationIdRaw?.trim() ?? ""
  if (!isValidUuid(organizationId)) {
    return { ok: false, status: 400, message: "organizationId required" }
  }

  const platformAdmin = isPlatformAdminEmail(user.email ?? null)

  let orgRow: { id?: string; status?: string } | null = null

  if (platformAdmin) {
    let admin: ReturnType<typeof createServiceRoleSupabaseClient>
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return { ok: false, status: 503, message: "Server is not configured." }
    }
    const { data, error: orgErr } = await admin
      .from("organizations")
      .select("id, status")
      .eq("id", organizationId)
      .maybeSingle()
    if (orgErr || !data) {
      return { ok: false, status: 404, message: "Organization not found." }
    }
    orgRow = data as { id?: string; status?: string }
  } else {
    const { data, error: orgErr } = await supabase
      .from("organizations")
      .select("id, status")
      .eq("id", organizationId)
      .maybeSingle()

    if (orgErr || !data) {
      return { ok: false, status: 404, message: "Organization not found." }
    }
    orgRow = data as { id?: string; status?: string }
  }

  if (!orgRow) {
    return { ok: false, status: 404, message: "Organization not found." }
  }

  if ((orgRow as { status?: string }).status !== "active") {
    return { ok: false, status: 403, message: "Workspace is not active." }
  }

  if (!platformAdmin) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle()

    if (!membership) {
      return { ok: false, status: 403, message: "Forbidden" }
    }
  }

  return {
    ok: true,
    organizationId,
    platformAdmin,
    userId: user.id,
    userEmail: user.email ?? null,
  }
}

export async function assertCanRestoreArchivedRecord(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string,
  platformAdmin: boolean,
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  if (platformAdmin) {
    return { ok: true }
  }

  const { data: row } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  const role = (row as { role?: string } | null)?.role ?? ""
  if (!MANAGER_ROLES.has(role)) {
    return {
      ok: false,
      status: 403,
      message: "Only workspace owners, admins, and managers can restore archived records.",
    }
  }

  return { ok: true }
}
