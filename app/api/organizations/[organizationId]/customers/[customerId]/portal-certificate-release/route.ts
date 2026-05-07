import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  getOrganizationMemberRole,
  roleCanManageOperationalCertificateRules,
} from "@/lib/api/org-role"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED = new Set(["immediate_release", "release_on_payment", "manual_release"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid id.", 400)
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) return jsonError("Unauthorized.", 401)

  const role = await getOrganizationMemberRole(supabase, user.id, organizationId)
  if (!roleCanManageOperationalCertificateRules(role)) {
    return jsonError("Insufficient permissions.", 403)
  }

  let body: { portal_certificate_release_mode?: unknown }
  try {
    body = (await request.json()) as { portal_certificate_release_mode?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const raw = body.portal_certificate_release_mode
  let mode: string | null = null
  if (raw === null || raw === "") {
    mode = null
  } else if (typeof raw === "string" && ALLOWED.has(raw.trim())) {
    mode = raw.trim()
  } else {
    return jsonError("Invalid portal_certificate_release_mode.", 400)
  }

  const { error } = await supabase
    .from("customers")
    .update({ portal_certificate_release_mode: mode })
    .eq("id", customerId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_certificate_release_mode: mode })
}
