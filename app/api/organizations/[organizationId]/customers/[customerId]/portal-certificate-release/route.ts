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
 * Phase 2 (Permissions): per-customer certificate release override is gated
 * by the central `canReleaseCertificatesToPortal` capability.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireOrgPermission(
    organizationId,
    "canReleaseCertificatesToPortal",
  )
  if ("error" in gate) return gate.error
  const { supabase } = gate

  let body: {
    portal_certificate_release_mode?: unknown
    certificate_release_notes?: unknown
    certificate_release_override_reason?: unknown
  }
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
    .update({
      portal_certificate_release_mode: mode,
      certificate_release_requires_paid_invoice: mode === "release_on_payment",
      certificate_release_notes:
        typeof body.certificate_release_notes === "string" ? body.certificate_release_notes.trim() || null : undefined,
      certificate_release_override_reason:
        typeof body.certificate_release_override_reason === "string"
          ? body.certificate_release_override_reason.trim() || null
          : undefined,
    })
    .eq("id", customerId)
    .eq("organization_id", organizationId)

  if (error) return jsonError(error.message, 500)
  return NextResponse.json({ ok: true, portal_certificate_release_mode: mode })
}
