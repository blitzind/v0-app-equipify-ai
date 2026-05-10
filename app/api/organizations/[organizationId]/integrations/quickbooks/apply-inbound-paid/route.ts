import { NextResponse } from "next/server"
import { requireOrgIntegrationAdmin } from "@/lib/integrations/require-org-integration-admin"
import { requireAnyOrgPermission } from "@/lib/api/require-org-permission"
import { getQuickBooksConnection } from "@/lib/integrations/quickbooks/connection"
import {
  inboundSnapshotAllowsApplyPaid,
  readInvoiceInboundSnapshot,
  reconcileQuickBooksInvoiceInboundStatuses,
} from "@/lib/integrations/quickbooks/invoice-inbound-reconcile"
import { markOrgInvoicePaidFromQuickBooksInbound } from "@/lib/org-quotes-invoices/repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization" }, { status: 400 })
  }

  const gate = await requireOrgIntegrationAdmin(organizationId)
  if ("error" in gate) return gate.error

  const fin = await requireAnyOrgPermission(organizationId, ["canViewBilling", "canViewFinancials"])
  if ("error" in fin) return fin.error

  const body = (await request.json().catch(() => ({}))) as { invoiceId?: string }
  const invoiceId = typeof body.invoiceId === "string" ? body.invoiceId.trim() : ""
  if (!UUID_RE.test(invoiceId)) {
    return NextResponse.json({ error: "invalid_invoice" }, { status: 400 })
  }

  const conn = await getQuickBooksConnection(gate.svc, organizationId)
  if ("error" in conn) {
    return NextResponse.json({ error: conn.error, code: conn.code }, { status: 409 })
  }

  const onUnauthorized = async (): Promise<string | null> => {
    const again = await getQuickBooksConnection(gate.svc, organizationId)
    return "error" in again ? null : again.accessToken
  }

  await reconcileQuickBooksInvoiceInboundStatuses({
    svc: gate.svc,
    organizationId,
    realmId: conn.realmId,
    accessToken: conn.accessToken,
    onUnauthorized,
    onlyInvoiceIds: [invoiceId],
  })

  const { data: mapRow } = await gate.svc
    .from("external_sync_mappings")
    .select("metadata")
    .eq("organization_id", organizationId)
    .eq("provider", "quickbooks_online")
    .eq("entity_type", "invoice")
    .eq("internal_id", invoiceId)
    .maybeSingle()

  const snap = readInvoiceInboundSnapshot(mapRow?.metadata)
  if (!inboundSnapshotAllowsApplyPaid(snap)) {
    return NextResponse.json(
      {
        error: "not_applicable",
        message: "QuickBooks does not show a safe “mark paid” path for this invoice, or data changed.",
      },
      { status: 409 },
    )
  }

  const paidOn = snap?.suggestApplyPaidOn?.trim() ?? ""
  const applied = await markOrgInvoicePaidFromQuickBooksInbound(gate.svc, organizationId, invoiceId, paidOn)
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 409 })
  }

  await reconcileQuickBooksInvoiceInboundStatuses({
    svc: gate.svc,
    organizationId,
    realmId: conn.realmId,
    accessToken: conn.accessToken,
    onUnauthorized,
    onlyInvoiceIds: [invoiceId],
  })

  return NextResponse.json({ ok: true })
}
