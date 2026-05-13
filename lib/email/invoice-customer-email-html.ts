import { escapeHtml, plainTextToHtml } from "@/lib/email/format"
import { wrapEquipifyEmail } from "@/lib/email/wrap-equipify-email"

export type InvoiceCustomerEmailTemplateArgs = {
  organizationName: string
  customerName: string
  invoiceLabel: string
  /** Balance due (may be $0.00 when paid). */
  amountDueLabel: string
  /** Invoice grand total including tax. */
  grandTotalLabel: string
  dueDateLabel: string
  issuedDateLabel: string
  statusDisplay: string
  workOrderLabel?: string | null
  equipmentName?: string | null
  messagePlain?: string
  subjectOverride?: string
  viewInvoiceUrl?: string | null
  paymentUrl?: string | null
  /** True when a PDF is attached to the outbound message. */
  pdfAttached: boolean
  /** Used for concise subject line when fully paid. */
  balanceDueCents: number
  certificatesList?: { equipmentLabel: string; templateName: string | null }[]
  certificate?: { included: boolean; templateName?: string | null }
  /** Initial send vs payment reminder framing. */
  variant: "send" | "reminder"
}

function ctaButton(label: string, href: string, bg: string): string {
  const safe = escapeHtml(label)
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 10px 0;">
<tr><td align="left">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 22px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;line-height:1.25;color:#ffffff;text-decoration:none;border-radius:8px;background-color:${bg};word-break:break-word;">
${safe}
</a>
</td></tr></table>`
}

function equipmentServiceRef(args: InvoiceCustomerEmailTemplateArgs): string | null {
  const parts: string[] = []
  if (args.equipmentName?.trim()) parts.push(args.equipmentName.trim())
  if (args.workOrderLabel?.trim()) parts.push(`WO ${args.workOrderLabel.trim()}`)
  if (!parts.length) return null
  return parts.join(" · ")
}

export function buildInvoiceCustomerEmailFromTemplate(args: InvoiceCustomerEmailTemplateArgs): {
  subject: string
  html: string
  text: string
} {
  const due = args.dueDateLabel.trim() || "—"
  const issued = args.issuedDateLabel.trim() || "—"
  const dueLine = escapeHtml(due)
  const issuedLine = escapeHtml(issued)
  const inv = escapeHtml(args.invoiceLabel)
  const org = escapeHtml(args.organizationName)
  const cust = escapeHtml(args.customerName)
  const status = escapeHtml(args.statusDisplay)
  const amountDue = escapeHtml(args.amountDueLabel)
  const grandTotal = escapeHtml(args.grandTotalLabel)
  const eqRefRaw = equipmentServiceRef(args)
  const eqRef = eqRefRaw ? escapeHtml(eqRefRaw) : ""

  const defaultSubject =
    args.balanceDueCents != null && args.balanceDueCents > 0
      ? `Invoice ${args.invoiceLabel} — ${args.amountDueLabel} due ${due} · ${args.organizationName}`
      : `Invoice ${args.invoiceLabel} from ${args.organizationName}`
  const subject = args.subjectOverride?.trim() || defaultSubject

  const greeting = `<p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">Hello ${cust},</p>`

  const lead =
    args.variant === "reminder"
      ? `<p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#334155;">This is a brief reminder about the invoice below. If you have already paid, you can disregard this message.</p>`
      : `<p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#334155;">${org} has shared an invoice for your records. Key details are summarized in the card below.</p>`

  const cardRows = [
    { k: "Invoice #", v: inv },
    { k: "Amount due", v: amountDue },
    { k: "Total", v: grandTotal },
    { k: "Due date", v: dueLine },
    { k: "Issue date", v: issuedLine },
    { k: "Status", v: status },
  ]

  const cardInner = cardRows
    .map(
      (r) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#64748b;vertical-align:top;width:38%;word-break:break-word;">${r.k}</td>
<td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0f172a;text-align:right;vertical-align:top;word-break:break-word;overflow-wrap:anywhere;">${r.v}</td>
</tr>`,
    )
    .join("")

  const eqBlock =
    eqRef ?
      `<tr><td colspan="2" style="padding:10px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#475569;word-break:break-word;overflow-wrap:anywhere;"><strong style="color:#334155;">Service / equipment:</strong> ${eqRef}</td></tr>`
    : ""

  const summaryCard = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;">
<tr><td style="padding:16px 18px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td colspan="2" style="padding:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;font-weight:700;">Invoice summary</td></tr>
${cardInner}
${eqBlock}
</table>
</td></tr></table>`

  const messageBlock =
    args.messagePlain?.trim() ?
      `<div style="margin:0 0 20px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#334155;">${plainTextToHtml(args.messagePlain)}</div>`
    : ""

  const ctaParts: string[] = []
  if (args.viewInvoiceUrl?.trim()) {
    ctaParts.push(ctaButton("View invoice", args.viewInvoiceUrl.trim(), "#1e293b"))
  }
  if (args.paymentUrl?.trim()) {
    ctaParts.push(ctaButton("Pay invoice", args.paymentUrl.trim(), "#0f766e"))
  }
  if (args.pdfAttached) {
    ctaParts.push(
      `<p style="margin:0 0 10px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#334155;"><strong>PDF copy:</strong> The detailed invoice is attached as a PDF to this email.</p>`,
    )
  }

  const ctaSection =
    ctaParts.length > 0 ?
      `<div style="margin:8px 0 24px;padding:18px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#ffffff;">
<p style="margin:0 0 12px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;font-weight:700;">Next steps</p>
${ctaParts.join("\n")}
</div>`
    : ""

  const certBlock =
    args.certificatesList && args.certificatesList.length > 0 ?
      `<div style="margin:0 0 20px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
<p style="margin:0 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0f172a;">Completed certificates</p>
<ul style="padding-left:18px;margin:8px 0;font-size:13px;color:#334155;word-break:break-word;">
${args.certificatesList
  .map(
    (c) =>
      `<li style="margin:0 0 6px;"><strong>${escapeHtml(c.equipmentLabel)}</strong>${
        c.templateName?.trim() ? ` — ${escapeHtml(c.templateName.trim())}` : ""
      }</li>`,
  )
  .join("\n")}
</ul>
<p style="margin:8px 0 0;font-size:13px;color:#334155;">Certificates are on file for this job. Reply to this email if you need copies.</p>
</div>`
    : args.certificate?.included ?
      `<div style="margin:0 0 20px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
<p style="margin:0 0 8px;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;color:#0f172a;">Certificate on file</p>
<p style="margin:0;font-size:13px;color:#334155;">Your service certificate${
        args.certificate.templateName?.trim() ?
          ` (<strong>${escapeHtml(args.certificate.templateName.trim())}</strong>)`
        : ""
      } is on file for this work. Reply to this email if you need a copy.</p>
</div>`
    : ""

  const header = `<div style="padding:0 0 18px;border-bottom:2px solid #0f172a;margin:0 0 22px;">
<p style="margin:0;font-family:system-ui,-apple-system,sans-serif;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#0f172a;word-break:break-word;">${org}</p>
<p style="margin:6px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;color:#64748b;">Invoice notification</p>
</div>`

  const footerInner = `<div style="margin-top:28px;padding-top:18px;border-top:1px solid #e2e8f0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.55;color:#64748b;">
<p style="margin:0 0 8px;"><strong style="color:#475569;">${org}</strong></p>
<p style="margin:0;">Questions about this invoice? Reply to this email and the team will help.</p>
</div>`

  const inner = `${header}${greeting}${lead}${summaryCard}${messageBlock}${ctaSection}${certBlock}${footerInner}`

  const html = wrapEquipifyEmail(args.organizationName, inner, undefined)

  const textLines: string[] = [
    `${args.organizationName} — invoice`,
    "",
    `Invoice #: ${args.invoiceLabel}`,
    `Amount due: ${args.amountDueLabel}`,
    `Total: ${args.grandTotalLabel}`,
    `Due: ${due}`,
    `Issued: ${issued}`,
    `Status: ${args.statusDisplay}`,
  ]
  if (eqRefRaw) textLines.push(`Service / equipment: ${eqRefRaw}`)
  textLines.push("")
  if (args.variant === "reminder") {
    textLines.push("Reminder: if you have already paid, you can disregard this message.", "")
  }
  if (args.messagePlain?.trim()) textLines.push(args.messagePlain.trim(), "")
  if (args.viewInvoiceUrl?.trim()) textLines.push(`View: ${args.viewInvoiceUrl.trim()}`)
  if (args.paymentUrl?.trim()) textLines.push(`Pay: ${args.paymentUrl.trim()}`)
  if (args.pdfAttached) textLines.push("", "A PDF copy of this invoice is attached.")
  if (args.certificatesList && args.certificatesList.length > 0) {
    textLines.push("", "Certificates on file for this work order:")
    for (const c of args.certificatesList) {
      textLines.push(
        `- ${c.equipmentLabel}${c.templateName?.trim() ? ` (${c.templateName.trim()})` : ""}`,
      )
    }
    textLines.push("", "Reply to request certificate copies.")
  } else if (args.certificate?.included) {
    textLines.push("", "Certificate on file — reply if you need a copy.")
  }
  textLines.push(
    "",
    `Questions? Reply to this email. Sent on behalf of ${args.organizationName}.`,
  )

  const text = textLines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n")

  return { subject, html, text }
}
