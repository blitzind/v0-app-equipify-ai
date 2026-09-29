import { NextResponse } from "next/server"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isValidEmail } from "@/lib/email/format"
import { mintPortalAccessLink } from "@/lib/portal/mint-portal-access-link"
import { portalInvoicePath } from "@/lib/portal/safe-portal-next"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Staff: mint a magic_login URL that lands on this invoice after exchange.
 * Gated by canEditInvoices (same capability as sending the invoice email).
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ organizationId: string; invoiceId: string }> },
) {
  const { organizationId, invoiceId } = await context.params
  if (!UUID_RE.test(organizationId) || !UUID_RE.test(invoiceId)) {
    return jsonError("Invalid organization or invoice.", 400)
  }

  const gate = await requireOrgPermission(organizationId, "canEditInvoices")
  if ("error" in gate) return gate.error

  let svc: ReturnType<typeof createServiceRoleSupabaseClient>
  try {
    svc = createServiceRoleSupabaseClient()
  } catch {
    return jsonError("Server misconfigured.", 503)
  }

  const { data: inv, error: invErr } = await svc
    .from("org_invoices")
    .select("id, customer_id, billing_contact_email, status, archived_at")
    .eq("organization_id", organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr || !inv) {
    return jsonError("Invoice not found.", 404)
  }

  const invoice = inv as {
    customer_id: string
    billing_contact_email: string | null
    status: string
    archived_at: string | null
  }

  if (invoice.archived_at) {
    return jsonError("Invoice not found.", 404)
  }
  const st = String(invoice.status ?? "").toLowerCase()
  if (st === "draft" || st === "void") {
    return jsonError("Customer invoice links are available after the invoice is issued.", 409)
  }

  const { data: cust } = await svc
    .from("customers")
    .select("billing_email, company_name")
    .eq("organization_id", organizationId)
    .eq("id", invoice.customer_id)
    .maybeSingle()

  const billing =
    (invoice.billing_contact_email ?? "").trim() ||
    ((cust as { billing_email?: string | null } | null)?.billing_email ?? "").trim()
  const email = billing.toLowerCase()
  if (!isValidEmail(email)) {
    return jsonError("Add a billing email on the invoice or customer before copying a portal link.", 409)
  }

  const minted = await mintPortalAccessLink({
    supabase: svc,
    organizationId,
    customerId: invoice.customer_id,
    email,
    displayName: ((cust as { company_name?: string } | null)?.company_name ?? "").trim() || null,
    kind: "magic_login",
    next: portalInvoicePath(invoiceId),
  })

  if (!minted.ok) {
    const status =
      minted.code === "revoked" ? 409 : minted.code === "customer_not_found" ? 404 : minted.code === "invalid_email" ? 400 : 500
    return jsonError(minted.message, status)
  }

  return NextResponse.json({
    accessUrl: minted.accessUrl,
    expiresAt: minted.expiresAt,
    portalUserId: minted.portalUserId,
  })
}
