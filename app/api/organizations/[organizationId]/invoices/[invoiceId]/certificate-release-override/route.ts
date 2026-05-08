import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const ALLOWED = new Set(["immediate_release", "release_on_payment", "manual_release", "internal_only"])

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Phase 2 (Permissions): per-invoice certificate release override is now
 * gated by the central `canReleaseCertificatesToPortal` capability so that
 * UI gating and API enforcement share a single source of truth.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(
    organizationId,
    "canReleaseCertificatesToPortal",
  )
  if ("error" in gate) return gate.error
  const { supabase } = gate

  let body: { portal_certificate_release_override?: unknown }
  try {
    body = (await request.json()) as { portal_certificate_release_override?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const raw = body.portal_certificate_release_override
  let override: string | null = null
  if (raw === null || raw === "") {
    override = null
  } else if (typeof raw === "string" && ALLOWED.has(raw.trim())) {
    override = raw.trim()
  } else {
    return jsonError("Invalid portal_certificate_release_override.", 400)
  }

  const { error } = await supabase
    .from("org_invoices")
    .update({
      portal_certificate_release_override: override,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_certificate_release_override: override })
}
