import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { getOrganizationMemberRole } from "@/lib/api/org-role"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED = new Set(["immediate_release", "release_on_payment", "manual_release"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Unauthorized.", 401)

  const role = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!role) return jsonError("Forbidden.", 403)

  const { data: row, error } = await supabase
    .from("organizations")
    .select("portal_certificate_release_mode")
    .eq("id", organizationId)
    .maybeSingle()

  if (error) return jsonError(error.message, 500)
  const mode = (row as { portal_certificate_release_mode?: string | null } | null)?.portal_certificate_release_mode
  return NextResponse.json({ portal_certificate_release_mode: mode ?? "immediate_release" })
}

/**
 * Phase 2 (Permissions): editing the workspace default release mode is gated
 * by `canManagePortalSettings` (owner / admin only). Manager+ certificate
 * release operations remain on `canReleaseCertificatesToPortal` elsewhere.
 */
export async function PATCH(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400)

  const gate = await requireOrgPermission(organizationId, "canManagePortalSettings")
  if ("error" in gate) return gate.error
  const { supabase } = gate

  let body: { portal_certificate_release_mode?: unknown }
  try {
    body = (await request.json()) as { portal_certificate_release_mode?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const mode = typeof body.portal_certificate_release_mode === "string" ? body.portal_certificate_release_mode.trim() : ""
  if (!ALLOWED.has(mode)) {
    return jsonError("Invalid portal_certificate_release_mode.", 400)
  }

  const { error } = await supabase
    .from("organizations")
    .update({ portal_certificate_release_mode: mode, updated_at: new Date().toISOString() })
    .eq("id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_certificate_release_mode: mode })
}
