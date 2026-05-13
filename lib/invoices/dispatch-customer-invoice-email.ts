import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin } from "@/lib/email/config"
import { sendEmail, type SendEmailResult } from "@/lib/email/resend"
import { buildInvoiceCustomerEmailFromTemplate } from "@/lib/email/invoice-customer-email-html"
import { formatUsdFromCents } from "@/lib/billing/invoice-financial-display"
import { loadInvoiceDocumentContext } from "@/lib/invoices/load-invoice-document-context"
import { generateInvoicePdfBuffer } from "@/lib/invoices/generate-invoice-pdf"
import { buildInvoicePdfFilename } from "@/lib/invoices/invoice-pdf-filename"
import { isBlitzPayInvoicePayEnabledEnv } from "@/lib/blitzpay/phase2-feature-flag"
import { prepareBlitzpayInvoiceHostedCheckout } from "@/lib/blitzpay/blitzpay-prepare-invoice-pay"

export type DispatchCustomerInvoiceEmailArgs = {
  supabase: SupabaseClient
  organizationId: string
  invoiceId: string
  to: string
  subjectOverride?: string
  messagePlain?: string
  variant: "send" | "resend" | "reminder"
  /** When set, attempt BlitzPay hosted checkout for staff-initiated sends. */
  blitzpayStaffUserId?: string | null
  /** Overrides BlitzPay prepare (e.g. automated portal payment link). */
  paymentUrlOverride?: string | null
  /** Skip DB load when the caller already hydrated document context (e.g. certificate enrichment). */
  documentContext?: import("@/lib/invoices/invoice-document-context").InvoiceDocumentContext
  certificatesList?: { equipmentLabel: string; templateName: string | null }[]
  certificate?: { included: boolean; templateName?: string | null }
  /** Overrides Resend observability category (e.g. legacy route, BlitzPay reminders). */
  resendCategory?: string
}

export type DispatchCustomerInvoiceEmailResult =
  | { ok: true; send: SendEmailResult & { ok: true }; pdfAttached: boolean }
  | { ok: false; code: string; message: string }

/**
 * Loads invoice document context, builds the redesigned customer email, optionally generates a PDF attachment,
 * resolves payment CTA, and sends via Resend.
 */
export async function dispatchCustomerInvoiceEmail(
  args: DispatchCustomerInvoiceEmailArgs,
): Promise<DispatchCustomerInvoiceEmailResult> {
  const ctx =
    args.documentContext ??
    (await loadInvoiceDocumentContext(args.supabase, args.organizationId, args.invoiceId))
  if (!ctx) {
    return { ok: false, code: "not_found", message: "Invoice not found." }
  }

  let pdfAttached = false
  let attachments: Array<{ filename: string; content: Buffer; contentType: string }> | undefined
  try {
    const bytes = await generateInvoicePdfBuffer(ctx)
    const buf = Buffer.from(bytes)
    if (buf.byteLength > 0) {
      pdfAttached = true
      attachments = [
        {
          filename: buildInvoicePdfFilename(ctx.invoiceNumberLabel),
          content: buf,
          contentType: "application/pdf",
        },
      ]
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        source: "invoice-pdf-generation",
        ok: false,
        organizationId: args.organizationId,
        invoiceId: args.invoiceId,
        error: msg.slice(0, 500),
      }),
    )
  }

  let paymentUrl: string | null = args.paymentUrlOverride?.trim() || null
  if (
    !paymentUrl &&
    args.blitzpayStaffUserId &&
    isBlitzPayInvoicePayEnabledEnv() &&
    ctx.balanceDueCents > 0
  ) {
    try {
      const prep = await prepareBlitzpayInvoiceHostedCheckout({
        admin: args.supabase,
        organizationId: args.organizationId,
        invoiceId: args.invoiceId,
        initiatedBy: "staff_dashboard",
        userId: args.blitzpayStaffUserId,
      })
      if (prep.ok) paymentUrl = prep.data.url
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.info(
        JSON.stringify({
          source: "invoice-email-blitzpay-prepare",
          ok: false,
          organizationId: args.organizationId,
          invoiceId: args.invoiceId,
          error: msg.slice(0, 240),
        }),
      )
    }
  }

  const origin = getPublicAppOrigin()
  const viewInvoiceUrl = `${origin}/portal/invoices/${encodeURIComponent(args.invoiceId)}`

  const { subject, html, text } = buildInvoiceCustomerEmailFromTemplate({
    organizationName: ctx.organizationName,
    customerName: ctx.customerCompanyName,
    invoiceLabel: ctx.invoiceNumberLabel,
    amountDueLabel: formatUsdFromCents(Math.max(0, ctx.balanceDueCents)),
    grandTotalLabel: formatUsdFromCents(ctx.grandTotalCents),
    dueDateLabel: ctx.dueDateLabel,
    issuedDateLabel: ctx.issuedDateLabel,
    statusDisplay: ctx.statusDisplay,
    workOrderLabel: ctx.workOrderLabel,
    equipmentName: ctx.equipmentName,
    messagePlain: args.messagePlain,
    subjectOverride: args.subjectOverride,
    viewInvoiceUrl,
    paymentUrl,
    pdfAttached,
    balanceDueCents: ctx.balanceDueCents,
    certificatesList: args.certificatesList,
    certificate: args.certificate,
    variant: args.variant,
  })

  const send = await sendEmail({
    to: args.to,
    subject,
    html,
    text,
    attachments,
    category:
      args.resendCategory ??
      (args.variant === "reminder" ? "invoice_payment_reminder" : "invoice_customer"),
    organizationId: args.organizationId,
  })

  if (!send.ok) {
    return {
      ok: false,
      code: send.code ?? "send_failed",
      message: send.error,
    }
  }

  return { ok: true, send: send as SendEmailResult & { ok: true }, pdfAttached }
}
