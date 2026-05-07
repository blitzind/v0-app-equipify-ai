import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  getOrganizationMemberRole,
  roleCanManageOperationalCertificateRules,
} from "@/lib/api/org-role"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; recordId: string }> },
) {
  const { organizationId, recordId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(recordId)) {
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

  const now = new Date().toISOString()

  const { data: existing, error: loadErr } = await supabase
    .from("calibration_records")
    .select("id")
    .eq("id", recordId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr) return jsonError(loadErr.message, 500)
  if (!existing) return jsonError("Certificate record not found.", 404)

  const { error } = await supabase
    .from("calibration_records")
    .update({ portal_released_at: now })
    .eq("id", recordId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_released_at: now })
}
