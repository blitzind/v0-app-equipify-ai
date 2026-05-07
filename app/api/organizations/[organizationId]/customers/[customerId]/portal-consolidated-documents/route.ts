import { NextResponse } from "next/server"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function missingColumn(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false
  const m = (err.message ?? "").toLowerCase()
  if (!m.includes("portal_consolidated_documents_enabled")) return false
  if (err.code === "42703") return true
  return m.includes("does not exist") || m.includes("could not find")
}

/**
 * Per-customer consolidated portal document visibility override.
 * PATCH: owners/admins (`canManagePortalSettings`) or managers with
 * `canReleaseCertificatesToPortal` — mirrors certificate-release customer
 * PATCH eligibility so ops staff can manage customer-level portal policy.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string; customerId: string }> },
) {
  const { organizationId, customerId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(customerId)) {
    return jsonError("Invalid id.", 400)
  }

  const gate = await requireAnyOrgPermission(organizationId, [
    "canManagePortalSettings",
    "canReleaseCertificatesToPortal",
  ])
  if ("error" in gate) return gate.error
  const { supabase } = gate

  let body: { portal_consolidated_documents_enabled?: unknown }
  try {
    body = (await request.json()) as { portal_consolidated_documents_enabled?: unknown }
  } catch {
    return jsonError("Invalid JSON body.", 400)
  }

  const raw = body.portal_consolidated_documents_enabled
  let value: boolean | null = null
  if (raw === null || raw === "") {
    value = null
  } else if (typeof raw === "boolean") {
    value = raw
  } else {
    return jsonError("portal_consolidated_documents_enabled must be boolean or null.", 400)
  }

  const { error } = await supabase
    .from("customers")
    .update({ portal_consolidated_documents_enabled: value })
    .eq("id", customerId)
    .eq("organization_id", organizationId)

  if (error) {
    if (missingColumn(error)) {
      return NextResponse.json(
        {
          error:
            "Customer consolidated documents column is not available. Apply the latest migrations.",
        },
        { status: 503 },
      )
    }
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ ok: true, portal_consolidated_documents_enabled: value })
}
