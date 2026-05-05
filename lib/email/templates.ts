import { escapeHtml, plainTextToHtml } from "@/lib/email/format"

export function wrapEquipifyEmail(organizationName: string, innerHtml: string, footerNote?: string): string {
  const foot =
    footerNote != null && footerNote.trim()
      ? `<p style="margin-top:24px;font-size:12px;color:#64748b;">${escapeHtml(footerNote)}</p>`
      : ""
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;max-width:560px;">
${innerHtml}
${foot}
<p style="margin-top:24px;font-size:12px;color:#94a3b8;">This message was sent by Equipify on behalf of ${escapeHtml(
    organizationName,
  )}. Reply to this email if you have questions.</p>
</body></html>`
}

export type InvoiceEmailArgs = {
  organizationName: string
  customerName: string
  invoiceLabel: string
  amountLabel: string
  dueDateLabel: string
  issuedDateLabel: string
  equipmentSummary?: string
  portalPlaceholder?: string
  /** User-authored plain body (optional). */
  messagePlain?: string
  /** From compose modal — overrides default subject when set. */
  subjectOverride?: string
}

export function buildInvoiceEmailContent(args: InvoiceEmailArgs): { subject: string; html: string; text: string } {
  const portal =
    args.portalPlaceholder?.trim() ||
    "A secure payment link will be included here once your workspace connects billing links."
  const defaultSubject = `Invoice ${args.invoiceLabel} — ${args.amountLabel} due ${args.dueDateLabel}`
  const subject = args.subjectOverride?.trim() || defaultSubject
  const intro = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>Your invoice <strong>${escapeHtml(args.invoiceLabel)}</strong> from <strong>${escapeHtml(args.organizationName)}</strong> is ready.</p>
<ul style="padding-left:18px;margin:12px 0;">
<li>Amount: <strong>${escapeHtml(args.amountLabel)}</strong></li>
<li>Due: ${escapeHtml(args.dueDateLabel)}</li>
<li>Issued: ${escapeHtml(args.issuedDateLabel)}</li>
${args.equipmentSummary ? `<li>${escapeHtml(args.equipmentSummary)}</li>` : ""}
</ul>`
  const bodyBlock =
    args.messagePlain?.trim() ?
      plainTextToHtml(args.messagePlain)
    : `<p>Thank you for choosing ${escapeHtml(args.organizationName)}. Please review the amounts above and arrange payment by the due date.</p>`
  const pdfNote =
    "<p style=\"font-size:13px;color:#475569;\"><strong>PDF attachment:</strong> A downloadable PDF copy will be attached automatically when document generation is enabled. For now, please retain this email as your record.</p>"
  const linkPara = `<p style="font-size:13px;color:#475569;">${escapeHtml(portal)}</p>`
  const html = wrapEquipifyEmail(
    args.organizationName,
    `${intro}${bodyBlock}${pdfNote}${linkPara}`,
    undefined,
  )
  const text = [
    `Dear ${args.customerName},`,
    "",
    `Invoice ${args.invoiceLabel} from ${args.organizationName}`,
    `Amount: ${args.amountLabel}`,
    `Due: ${args.dueDateLabel}`,
    args.equipmentSummary ?? "",
    "",
    args.messagePlain?.trim() ||
      "Thank you for your business. Please arrange payment by the due date.",
    "",
    portal,
    "",
    "(PDF attachments will be included when document generation is enabled.)",
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, html, text }
}

/** Customer-facing invoice email: Equipify-branded subject, optional WO/equipment/certificate lines. */
export type InvoiceCustomerEmailArgs = {
  organizationName: string
  customerName: string
  invoiceLabel: string
  amountLabel: string
  dueDateLabel: string
  issuedDateLabel: string
  workOrderLabel?: string | null
  equipmentName?: string | null
  messagePlain?: string
  subjectOverride?: string
  paymentPlaceholder?: string
  /** When a calibration record exists for this invoice / work order. */
  certificate?: {
    included: boolean
    templateName?: string | null
  }
  /** All completed certificate rows for a multi-asset work order (takes precedence over `certificate` when set). */
  certificatesList?: { equipmentLabel: string; templateName: string | null }[]
}

export function buildInvoiceCustomerEmailContent(args: InvoiceCustomerEmailArgs): {
  subject: string
  html: string
  text: string
} {
  const pay =
    args.paymentPlaceholder?.trim() ||
    "A secure online payment link will appear here once your organization connects payment processing."
  const defaultSubject = `Invoice ${args.invoiceLabel} from Equipify`
  const subject = args.subjectOverride?.trim() || defaultSubject

  const listItems = [
    `<li>Amount due: <strong>${escapeHtml(args.amountLabel)}</strong></li>`,
    `<li>Due date: ${escapeHtml(args.dueDateLabel)}</li>`,
    `<li>Issued: ${escapeHtml(args.issuedDateLabel)}</li>`,
  ]
  if (args.workOrderLabel?.trim()) {
    listItems.push(`<li>Work order: <strong>${escapeHtml(args.workOrderLabel.trim())}</strong></li>`)
  }
  if (args.equipmentName?.trim()) {
    listItems.push(`<li>Equipment: ${escapeHtml(args.equipmentName.trim())}</li>`)
  }

  const intro = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>Here is invoice <strong>${escapeHtml(args.invoiceLabel)}</strong> from <strong>${escapeHtml(
    args.organizationName,
  )}</strong>.</p>
<ul style="padding-left:18px;margin:12px 0;">
${listItems.join("\n")}
</ul>`

  const bodyBlock =
    args.messagePlain?.trim() ?
      plainTextToHtml(args.messagePlain)
    : `<p>Thank you for your business. Please review the total and due date above and arrange payment by the due date. Reply to this email if you have questions.</p>`

  const paymentBlock = `<p style="font-size:13px;color:#475569;"><strong>Pay online:</strong> ${escapeHtml(pay)}</p>`

  const certBlock =
    args.certificatesList && args.certificatesList.length > 0 ?
      `<div style="margin-top:20px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Completed certificates (this work order)</p>
<ul style="padding-left:18px;margin:8px 0;font-size:13px;color:#334155;">
${args.certificatesList
  .map(
    (c) =>
      `<li><strong>${escapeHtml(c.equipmentLabel)}</strong>${
        c.templateName?.trim() ? ` — ${escapeHtml(c.templateName.trim())}` : ""
      }</li>`,
  )
  .join("\n")}
</ul>
<p style="margin:8px 0 0;font-size:13px;color:#334155;"><strong>Certificates are available in Equipify.</strong> Reply if you need copies.</p>
<p style="margin:10px 0 0;font-size:12px;color:#64748b;">PDF attachments may be included automatically when document delivery is enabled.</p>
</div>`
    : args.certificate?.included ?
      `<div style="margin-top:20px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Certificate included</p>
<p style="margin:0;font-size:13px;color:#334155;">Your service certificate${
        args.certificate.templateName?.trim() ?
          ` (<strong>${escapeHtml(args.certificate.templateName.trim())}</strong>)`
        : ""
      } is on file for this work. <strong>Certificate is available in Equipify.</strong> Reply to this email if you need a copy sent separately.</p>
<p style="margin:10px 0 0;font-size:12px;color:#64748b;">A downloadable certificate file may be attached automatically when document delivery is enabled.</p>
</div>`
    : ""

  // TODO: attach generated invoice PDF from server when PDF pipeline exists
  const invoicePdfTodo = `<!-- TODO(equipify-invoice-pdf): attach server-generated invoice PDF when billing docs ship -->
<p style="font-size:13px;color:#475569;"><strong>Invoice document:</strong> Details are included in this message. A PDF attachment will be added when automated invoice documents are enabled.</p>`

  const html = wrapEquipifyEmail(
    args.organizationName,
    `${intro}${bodyBlock}${paymentBlock}${certBlock}${invoicePdfTodo}`,
    undefined,
  )

  const textLines = [
    `Dear ${args.customerName},`,
    "",
    `Invoice ${args.invoiceLabel} from ${args.organizationName}`,
    `Amount due: ${args.amountLabel}`,
    `Due: ${args.dueDateLabel}`,
    `Issued: ${args.issuedDateLabel}`,
  ]
  if (args.workOrderLabel?.trim()) textLines.push(`Work order: ${args.workOrderLabel.trim()}`)
  if (args.equipmentName?.trim()) textLines.push(`Equipment: ${args.equipmentName.trim()}`)
  textLines.push(
    "",
    args.messagePlain?.trim() ||
      "Please arrange payment by the due date. Reply with any questions.",
    "",
    `Payment: ${pay}`,
  )
  if (args.certificatesList && args.certificatesList.length > 0) {
    textLines.push("", "Completed certificates (this work order):")
    for (const c of args.certificatesList) {
      textLines.push(
        `- ${c.equipmentLabel}${c.templateName?.trim() ? ` (${c.templateName.trim()})` : ""}`,
      )
    }
    textLines.push("", "Certificates are available in Equipify.")
  } else if (args.certificate?.included) {
    textLines.push(
      "",
      "Certificate included — available in Equipify.",
      args.certificate.templateName?.trim() ? `Template: ${args.certificate.templateName.trim()}` : "",
    )
  }
  textLines.push("", "Invoice PDF attachment will be included when document generation is enabled.")

  const text = textLines.filter(Boolean).join("\n")
  return { subject, html, text }
}

export type QuoteEmailArgs = {
  organizationName: string
  customerName: string
  quoteLabel: string
  amountLabel: string
  expiresLabel: string
  scopeSummary?: string
  messagePlain?: string
  subjectOverride?: string
}

export function buildQuoteEmailContent(args: QuoteEmailArgs): { subject: string; html: string; text: string } {
  const defaultSubject = `Quote ${args.quoteLabel} — ${args.amountLabel} (valid through ${args.expiresLabel})`
  const subject = args.subjectOverride?.trim() || defaultSubject
  const intro = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>Please find your service quote <strong>${escapeHtml(args.quoteLabel)}</strong> from <strong>${escapeHtml(args.organizationName)}</strong>.</p>
<ul style="padding-left:18px;margin:12px 0;">
<li>Total: <strong>${escapeHtml(args.amountLabel)}</strong></li>
<li>Valid through: ${escapeHtml(args.expiresLabel)}</li>
${args.scopeSummary ? `<li>${escapeHtml(args.scopeSummary)}</li>` : ""}
</ul>`
  const bodyBlock =
    args.messagePlain?.trim() ?
      plainTextToHtml(args.messagePlain)
    : `<p>We would be happy to schedule this work when you are ready. Reply to this email with any questions or to accept the quote.</p>`
  const attach =
    "<p style=\"font-size:13px;color:#475569;\"><strong>Detailed PDF:</strong> A formatted quote PDF will be attached when document generation is enabled.</p>"
  const html = wrapEquipifyEmail(args.organizationName, `${intro}${bodyBlock}${attach}`)
  const text = [
    `Dear ${args.customerName},`,
    "",
    `Quote ${args.quoteLabel} from ${args.organizationName}`,
    `Amount: ${args.amountLabel}`,
    `Expires: ${args.expiresLabel}`,
    args.scopeSummary ?? "",
    "",
    args.messagePlain?.trim() ||
      "Reply with questions or to proceed.",
  ].join("\n")
  return { subject, html, text }
}

export type CertificateEmailArgs = {
  organizationName: string
  customerName: string
  equipmentName: string
  workOrderLabel: string
  templateName?: string | null
  recordHint?: string | null
}

export function buildCertificateEmailContent(args: CertificateEmailArgs): { subject: string; html: string; text: string } {
  const subject = `Service certificate — ${args.workOrderLabel}`
  const tmpl = args.templateName?.trim() ? escapeHtml(args.templateName) : "your calibration / certificate"
  const inner = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>${escapeHtml(args.organizationName)} has completed documentation for <strong>${escapeHtml(args.equipmentName)}</strong> (job reference <strong>${escapeHtml(args.workOrderLabel)}</strong>).</p>
<p>Certificate template: ${tmpl}.</p>
<p style="font-size:13px;color:#475569;"><strong>PDF attachment:</strong> Signed PDF certificates will be attached here once automated document packaging is enabled. For now, please contact us if you need a copy immediately.</p>
${args.recordHint ? `<p style="font-size:12px;color:#64748b;">Reference: ${escapeHtml(args.recordHint)}</p>` : ""}`
  const html = wrapEquipifyEmail(args.organizationName, inner)
  const text = [
    `Dear ${args.customerName},`,
    "",
    `${args.organizationName} — certificate summary for ${args.equipmentName}`,
    `Work order: ${args.workOrderLabel}`,
    args.recordHint ?? "",
    "",
    "A PDF attachment will be included when automated sending is enabled.",
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, html, text }
}

export type WorkOrderSummaryEmailArgs = {
  organizationName: string
  customerName: string
  equipmentName: string
  workOrderLabel: string
  statusLabel: string
  locationLine?: string | null
  completedAtLabel?: string | null
  messagePlain?: string
}

export function buildWorkOrderSummaryEmailContent(
  args: WorkOrderSummaryEmailArgs,
): { subject: string; html: string; text: string } {
  const subject = `Service summary — ${args.workOrderLabel}`
  const inner = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>Here is a summary of field service from <strong>${escapeHtml(args.organizationName)}</strong>.</p>
<ul style="padding-left:18px;margin:12px 0;">
<li><strong>Job:</strong> ${escapeHtml(args.workOrderLabel)}</li>
<li><strong>Equipment:</strong> ${escapeHtml(args.equipmentName)}</li>
<li><strong>Status:</strong> ${escapeHtml(args.statusLabel)}</li>
${args.locationLine ? `<li><strong>Location:</strong> ${escapeHtml(args.locationLine)}</li>` : ""}
${args.completedAtLabel ? `<li><strong>Completed:</strong> ${escapeHtml(args.completedAtLabel)}</li>` : ""}
</ul>
${
  args.messagePlain?.trim() ?
    plainTextToHtml(args.messagePlain)
  : `<p>If anything looks incorrect or you need copies of photos or certificates, reply to this email.</p>`
}
<p style="font-size:13px;color:#475569;">Portal links and attachments will appear here when customer portal access is enabled.</p>`
  const html = wrapEquipifyEmail(args.organizationName, inner)
  const text = [
    `Dear ${args.customerName},`,
    "",
    `Work order ${args.workOrderLabel} — ${args.organizationName}`,
    `Equipment: ${args.equipmentName}`,
    `Status: ${args.statusLabel}`,
    args.locationLine ?? "",
    args.completedAtLabel ? `Completed: ${args.completedAtLabel}` : "",
    "",
    args.messagePlain?.trim() || "Contact us with any questions.",
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, html, text }
}
