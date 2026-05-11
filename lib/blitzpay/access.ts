import "server-only"

import type { SupabaseClient, User } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Owners and admins may configure BlitzPay; platform admins when operating on a workspace. */
export const BLITZPAY_ADMIN_ROLES = new Set(["owner", "admin"])

export function isValidBlitzPayOrganizationId(id: string): boolean {
  return UUID_RE.test(id.trim())
}

export type BlitzPayGate =
  | { ok: true; organizationId: string; platformAdmin: boolean; userId: string }
  | { ok: false; status: number; message: string }

export async function gateBlitzPayManagement(
  supabase: SupabaseClient,
  user: User | null,
  organizationIdRaw: string | null,
): Promise<BlitzPayGate> {
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" }
  }

  const organizationId = organizationIdRaw?.trim() ?? ""
  if (!isValidBlitzPayOrganizationId(organizationId)) {
    return { ok: false, status: 400, message: "organizationId is required." }
  }

  const platformAdmin = isPlatformAdminEmail(user.email ?? null)

  if (platformAdmin) {
    let admin: ReturnType<typeof createServiceRoleSupabaseClient>
    try {
      admin = createServiceRoleSupabaseClient()
    } catch {
      return { ok: false, status: 503, message: "Server is not configured." }
    }
    const { data: orgRow, error } = await admin
      .from("organizations")
      .select("id, status")
      .eq("id", organizationId)
      .maybeSingle()
    if (error || !orgRow) {
      return { ok: false, status: 404, message: "Organization not found." }
    }
    if ((orgRow as { status?: string }).status !== "active") {
      return { ok: false, status: 403, message: "Workspace is not active." }
    }
    return { ok: true, organizationId, platformAdmin: true, userId: user.id }
  }

  const { data: orgRow, error: orgErr } = await supabase
    .from("organizations")
    .select("id, status")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    return { ok: false, status: 404, message: "Organization not found." }
  }
  if ((orgRow as { status?: string }).status !== "active") {
    return { ok: false, status: 403, message: "Workspace is not active." }
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  const role = (membership as { role?: string } | null)?.role ?? ""
  if (!BLITZPAY_ADMIN_ROLES.has(role)) {
    return {
      ok: false,
      status: 403,
      message: "Only workspace owners and admins can manage BlitzPay.",
    }
  }

  return { ok: true, organizationId, platformAdmin: false, userId: user.id }
}
