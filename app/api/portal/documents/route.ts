import { NextResponse } from "next/server"
import { buildPortalDocuments } from "@/lib/portal/portal-documents"
import { requirePortalSession } from "@/lib/portal/require-portal-session"

export const runtime = "nodejs"

/**
 * Customer Portal Document Library — Phase 1
 *
 * Aggregator endpoint backing `/portal/documents`. Reuses the existing
 * portal session/cookie auth and the existing per-domain release rules
 * (invoices, certificates, work orders, certificate attachments).
 *
 * Phase 1 always scopes to the current portal user's customer. The
 * underlying `buildPortalDocuments` helper accepts an array of customer
 * ids so a future parent/child rollup phase can wire the parent
 * customer's children in without changing the contract here. We
 * deliberately do not enable that today.
 */
export async function GET() {
  const ctx = await requirePortalSession()
  if (ctx instanceof NextResponse) return ctx

  const { svc, portalUser } = ctx

  try {
    const result = await buildPortalDocuments(svc, {
      organizationId: portalUser.organization_id,
      customerIds: [portalUser.customer_id],
    })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load documents."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
