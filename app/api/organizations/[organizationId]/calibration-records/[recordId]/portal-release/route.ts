import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Phase 2 (Permissions): manual portal release is now gated by the central
 * `canReleaseCertificatesToPortal` capability. RLS still enforces the
 * organization scope; this guard returns a consistent 403 shape before
 * touching the row.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; recordId: string }> },
) {
  const { organizationId, recordId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(recordId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(
    organizationId,
    "canReleaseCertificatesToPortal",
  )
  if ("error" in gate) return gate.error
  const { supabase } = gate

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
    .update({
      portal_released_at: now,
      portal_released_by: gate.userId,
      portal_revoked_at: null,
      portal_revoked_by: null,
      portal_withheld_reason: null,
    })
    .eq("id", recordId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_released_at: now })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ organizationId: string; recordId: string }> },
) {
  const { organizationId, recordId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(recordId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(
    organizationId,
    "canReleaseCertificatesToPortal",
  )
  if ("error" in gate) return gate.error
  const { supabase } = gate

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("calibration_records")
    .update({
      portal_released_at: null,
      portal_released_by: null,
      portal_revoked_at: now,
      portal_revoked_by: gate.userId,
      portal_withheld_reason: "Revoked by staff",
    })
    .eq("id", recordId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_revoked_at: now })
}
