import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { blitzpaySchemaDriftIfUnhealthy } from "@/lib/blitzpay/blitzpay-schema-health"
import { previewBlitzpayInvoiceHostedCheckout } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import type { BlitzpayCheckoutDisclosurePreview } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"
import { invoiceStatusDbToUi } from "@/lib/org-quotes-invoices/map"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type PrepareInvoicePaymentLinkPreviewPayload = {
  invoiceId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    statusUi: string
    amountCents: number
  }
  customer: {
    id: string
    companyName: string
  }
  /** Balance due toward hosted pay (cents), when preview succeeded. */
  amountDueCents: number | null
  /** BlitzPay pricing / disclosure preview when checkout can be prepared. */
  checkoutPreview: BlitzpayCheckoutDisclosurePreview | null
  /** ready = BlitzPay preview succeeded; blocked = cannot host pay; degraded = pay may work with caveats. */
  readiness: "ready" | "blocked" | "degraded"
  warnings: string[]
  blitzpayErrorCode?: string
}

export type ResolvePrepareInvoicePaymentLinkPreviewInput = {
  organizationId: string
  userId: string
  invoiceId: string
}

export type ResolvePrepareInvoicePaymentLinkResult =
  | { status: "prepared"; preview: PrepareInvoicePaymentLinkPreviewPayload }
  | { status: "failed"; reason: string }

function asWarnings(preview: BlitzpayCheckoutDisclosurePreview | null, previewOk: boolean): string[] {
  const w: string[] = []
  if (!previewOk) return w
  if (!preview) return w
  if (!preview.connectPayoutsEnabled) {
    w.push("Stripe Connect payouts are not fully enabled — settlement timing may be delayed.")
  }
  if (preview.connectStatus && !["enabled", "active"].includes(String(preview.connectStatus).toLowerCase())) {
    w.push(`Stripe Connect account status: ${preview.connectStatus}`)
  }
  return w
}

/**
 * Builds a staff-facing preview for preparing a BlitzPay hosted checkout link for an invoice.
 * Does not create a checkout session, charge cards, or contact the customer.
 */
export async function resolvePrepareInvoicePaymentLinkPreview(
  userSupabase: SupabaseClient,
  input: ResolvePrepareInvoicePaymentLinkPreviewInput,
): Promise<ResolvePrepareInvoicePaymentLinkResult> {
  const invoiceId = input.invoiceId.trim()
  if (!UUID_RE.test(invoiceId) || !UUID_RE.test(input.organizationId)) {
    return { status: "failed", reason: "Invalid invoice or organization id." }
  }

  const { data: inv, error: invErr } = await userSupabase
    .from("org_invoices")
    .select("id, organization_id, customer_id, invoice_number, title, status, amount_cents, archived_at")
    .eq("organization_id", input.organizationId)
    .eq("id", invoiceId)
    .maybeSingle()

  if (invErr) {
    return { status: "failed", reason: invErr.message }
  }
  const row = inv as {
    id: string
    organization_id: string
    customer_id: string
    invoice_number: string
    title: string
    status: string
    amount_cents: number
    archived_at: string | null
  } | null

  if (!row || row.archived_at) {
    return { status: "failed", reason: "Invoice was not found or is archived." }
  }

  const { data: cust, error: custErr } = await userSupabase
    .from("customers")
    .select("id, company_name")
    .eq("organization_id", input.organizationId)
    .eq("id", row.customer_id)
    .maybeSingle()

  if (custErr || !cust) {
    return { status: "failed", reason: "Customer for this invoice could not be loaded." }
  }

  const companyName = String((cust as { company_name?: string }).company_name ?? "").trim() || "Customer"

  let admin: SupabaseClient
  try {
    admin = createServiceRoleSupabaseClient()
  } catch {
    return { status: "failed", reason: "Server is not configured for payment operations." }
  }

  const drift = await blitzpaySchemaDriftIfUnhealthy(admin, "aiden_prepare_invoice_payment_link_preview")
  if (drift != null) {
    return { status: "failed", reason: "BlitzPay is not ready (database migrations may be pending)." }
  }

  const previewResult = await previewBlitzpayInvoiceHostedCheckout({
    admin,
    organizationId: input.organizationId,
    invoiceId,
    initiatedBy: "staff_dashboard",
    userId: input.userId,
  })

  const warnings: string[] = []
  let readiness: PrepareInvoicePaymentLinkPreviewPayload["readiness"] = "ready"
  let checkoutPreview: BlitzpayCheckoutDisclosurePreview | null = null
  let amountDueCents: number | null = null
  let blitzpayErrorCode: string | undefined

  if (!previewResult.ok) {
    readiness = "blocked"
    blitzpayErrorCode = previewResult.code
    warnings.push(previewResult.message)
  } else {
    checkoutPreview = previewResult.data
    amountDueCents = previewResult.data.invoiceBalanceCents
    warnings.push(...asWarnings(checkoutPreview, true))
    if (warnings.length > 0) readiness = "degraded"
  }

  const statusUi = String(invoiceStatusDbToUi(row.status))

  return {
    status: "prepared",
    preview: {
      invoiceId: row.id,
      invoice: {
        id: row.id,
        invoiceNumber: row.invoice_number,
        title: row.title,
        statusUi,
        amountCents: Math.round(Number(row.amount_cents) || 0),
      },
      customer: {
        id: row.customer_id,
        companyName,
      },
      amountDueCents,
      checkoutPreview,
      readiness,
      warnings,
      blitzpayErrorCode,
    },
  }
}
