import "server-only"

import { escapeHtml } from "@/lib/email/format"
import type { BlitzPayPaymentReceiptViewModel } from "@/lib/blitzpay/blitzpay-payment-receipt-view-model"
import { formatUsdFromCents } from "@/lib/billing/invoice-financial-display"

export function buildBlitzpayCustomerReceiptEmailContent(vm: BlitzPayPaymentReceiptViewModel): {
  subject: string
  html: string
  text: string
} {
  const org = escapeHtml(vm.organizationName)
  const cust = escapeHtml(vm.customerName)
  const inv = escapeHtml(vm.invoiceNumber)
  const amt = escapeHtml(formatUsdFromCents(vm.amountPaidCents))
  const paid = escapeHtml(vm.paymentDate)
  const ref = vm.paymentReferenceDisplay ? escapeHtml(vm.paymentReferenceDisplay) : "—"
  const portal =
    vm.portalInvoiceAbsoluteUrl ?
      `<p style="margin:16px 0 0"><a href="${escapeHtml(vm.portalInvoiceAbsoluteUrl)}">View invoice in your customer portal</a></p>`
    : ""

  const subject = `Payment received — Invoice ${vm.invoiceNumber} from ${vm.organizationName}`

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>Hi ${cust},</p>
<p><strong>${org}</strong> has recorded an online card payment for your invoice.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#555">Invoice</td><td style="padding:4px 0"><strong>${inv}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Amount paid</td><td style="padding:4px 0"><strong>${amt}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Payment date</td><td style="padding:4px 0">${paid}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Reference</td><td style="padding:4px 0">${ref}</td></tr>
</table>
<p style="font-size:13px;color:#555">This message confirms payment only. It does not include card numbers or processor identifiers.</p>
${portal}
<p style="margin-top:20px;font-size:12px;color:#888">Thank you for your business.</p>
</body></html>`

  const textLines = [
    `Hi ${vm.customerName},`,
    "",
    `${vm.organizationName} has recorded an online card payment for your invoice.`,
    "",
    `Invoice: ${vm.invoiceNumber}`,
    `Amount paid: ${formatUsdFromCents(vm.amountPaidCents)}`,
    `Payment date: ${vm.paymentDate}`,
    `Reference: ${vm.paymentReferenceDisplay ?? "—"}`,
    "",
    "This message confirms payment only.",
  ]
  if (vm.portalInvoiceAbsoluteUrl) {
    textLines.push("", `View invoice: ${vm.portalInvoiceAbsoluteUrl}`)
  }

  return { subject, html, text: textLines.join("\n") }
}

export function buildBlitzpayStaffPaymentReceivedEmailContent(vm: BlitzPayPaymentReceiptViewModel): {
  subject: string
  html: string
  text: string
} {
  const org = escapeHtml(vm.organizationName)
  const cust = escapeHtml(vm.customerName)
  const inv = escapeHtml(vm.invoiceNumber)
  const amt = escapeHtml(formatUsdFromCents(vm.amountPaidCents))
  const paid = escapeHtml(vm.paymentDate)

  const subject = `[BlitzPay] Payment received — ${vm.invoiceNumber} (${vm.organizationName})`

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111">
<p>A BlitzPay card payment was received.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:14px">
<tr><td style="padding:4px 12px 4px 0;color:#555">Workspace</td><td style="padding:4px 0"><strong>${org}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Customer</td><td style="padding:4px 0">${cust}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Invoice</td><td style="padding:4px 0"><strong>${inv}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Amount</td><td style="padding:4px 0"><strong>${amt}</strong></td></tr>
<tr><td style="padding:4px 12px 4px 0;color:#555">Payment date</td><td style="padding:4px 0">${paid}</td></tr>
</table>
<p style="font-size:12px;color:#555">Internal notice — no Stripe object ids included.</p>
</body></html>`

  const text = [
    "A BlitzPay card payment was received.",
    "",
    `Workspace: ${vm.organizationName}`,
    `Customer: ${vm.customerName}`,
    `Invoice: ${vm.invoiceNumber}`,
    `Amount: ${formatUsdFromCents(vm.amountPaidCents)}`,
    `Payment date: ${vm.paymentDate}`,
  ].join("\n")

  return { subject, html, text }
}
