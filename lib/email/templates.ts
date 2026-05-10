import { escapeHtml, plainTextToHtml } from "@/lib/email/format"

export function wrapEquipifyEmail(organizationName: string, innerHtml: string, footerNote?: string): string {
  const foot =
    footerNote != null && footerNote.trim()
      ? `<p style="margin-top:24px;font-size:12px;color:#64748b;">${escapeHtml(footerNote)}</p>`
      : ""
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;max-width:560px;">
${innerHtml}
${foot}
<p style="margin-top:24px;font-size:12px;color:#94a3b8;">Sent on behalf of ${escapeHtml(
    organizationName,
  )}. Reply to this email if you have questions.</p>
</body></html>`
}

export type InvoiceEmailArgs = {
  organizationName: string
  customerName: string
  invoiceLabel: string
  /** Primary currency line in the summary (typically invoice grand total). */
  amountLabel: string
  dueDateLabel: string
  issuedDateLabel: string
  equipmentSummary?: string
  portalPlaceholder?: string
  /** User-authored plain body (optional). */
  messagePlain?: string
  /** From compose modal — overrides default subject when set. */
  subjectOverride?: string
  /** Optional breakdown when tax is stored on the invoice row. */
  subtotalLabel?: string | null
  taxLineLabel?: string | null
  /** When set, emphasized as the invoice total (defaults to `amountLabel`). */
  totalLabel?: string | null
}

export function buildInvoiceEmailContent(args: InvoiceEmailArgs): { subject: string; html: string; text: string } {
  const portal =
    args.portalPlaceholder?.trim() ||
    "A secure payment link will be included here once your workspace connects billing links."
  const totalStr = (args.totalLabel?.trim() || args.amountLabel).trim()
  const defaultSubject = `Invoice ${args.invoiceLabel} — ${totalStr} due ${args.dueDateLabel}`
  const subject = args.subjectOverride?.trim() || defaultSubject
  const moneyLines: string[] = []
  if (args.subtotalLabel?.trim()) {
    moneyLines.push(`<li>Subtotal: ${escapeHtml(args.subtotalLabel.trim())}</li>`)
  }
  if (args.taxLineLabel?.trim()) {
    moneyLines.push(`<li>${escapeHtml(args.taxLineLabel.trim())}</li>`)
  }
  moneyLines.push(`<li>Invoice total: <strong>${escapeHtml(totalStr)}</strong></li>`)
  const intro = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>Your invoice <strong>${escapeHtml(args.invoiceLabel)}</strong> from <strong>${escapeHtml(args.organizationName)}</strong> is ready.</p>
<ul style="padding-left:18px;margin:12px 0;">
${moneyLines.join("\n")}
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
    ...(args.subtotalLabel?.trim() ? [`Subtotal: ${args.subtotalLabel.trim()}`] : []),
    ...(args.taxLineLabel?.trim() ? [args.taxLineLabel.trim()] : []),
    `Invoice total: ${totalStr}`,
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
  /** Shown in the summary; use grand total including tax. */
  amountLabel: string
  dueDateLabel: string
  issuedDateLabel: string
  workOrderLabel?: string | null
  equipmentName?: string | null
  messagePlain?: string
  subjectOverride?: string
  paymentPlaceholder?: string
  subtotalLabel?: string | null
  taxLineLabel?: string | null
  totalLabel?: string | null
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
  const defaultSubject = `Invoice ${args.invoiceLabel} from ${args.organizationName}`
  const subject = args.subjectOverride?.trim() || defaultSubject

  const totalStr = (args.totalLabel?.trim() || args.amountLabel).trim()
  const listItems: string[] = []
  if (args.subtotalLabel?.trim()) {
    listItems.push(`<li>Subtotal: ${escapeHtml(args.subtotalLabel.trim())}</li>`)
  }
  if (args.taxLineLabel?.trim()) {
    listItems.push(`<li>${escapeHtml(args.taxLineLabel.trim())}</li>`)
  }
  listItems.push(`<li>Invoice total: <strong>${escapeHtml(totalStr)}</strong></li>`)
  listItems.push(`<li>Due date: ${escapeHtml(args.dueDateLabel)}</li>`, `<li>Issued: ${escapeHtml(args.issuedDateLabel)}</li>`)
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
<p style="margin:8px 0 0;font-size:13px;color:#334155;"><strong>Certificates are on file for your job.</strong> Reply if you need copies.</p>
<p style="margin:10px 0 0;font-size:12px;color:#64748b;">PDF attachments may be included automatically when document delivery is enabled.</p>
</div>`
    : args.certificate?.included ?
      `<div style="margin-top:20px;padding:14px 16px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;">
<p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0f172a;">Certificate included</p>
<p style="margin:0;font-size:13px;color:#334155;">Your service certificate${
        args.certificate.templateName?.trim() ?
          ` (<strong>${escapeHtml(args.certificate.templateName.trim())}</strong>)`
        : ""
      } is on file for this work. <strong>Reply to this email if you need a copy sent separately.</strong></p>
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
    ...(args.subtotalLabel?.trim() ? [`Subtotal: ${args.subtotalLabel.trim()}`] : []),
    ...(args.taxLineLabel?.trim() ? [args.taxLineLabel.trim()] : []),
    `Invoice total: ${totalStr}`,
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
    textLines.push("", "Certificates are on file — reply to request copies.")
  } else if (args.certificate?.included) {
    textLines.push(
      "",
      "Certificate included — reply if you need a copy.",
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

export type AppointmentConfirmationEmailArgs = {
  organizationName: string
  customerName: string
  equipmentName: string
  workOrderLabel: string
  /** Friendly date label (e.g. "Mon May 11, 2026"). */
  scheduledDateLabel: string
  /** Optional friendly time-window label (e.g. "9:00 AM"). */
  scheduledTimeLabel?: string | null
  technicianLabel?: string | null
  locationLine?: string | null
  /** Optional dispatcher / scheduler note appended verbatim to the email. */
  messagePlain?: string
}

/**
 * Phase: Scheduling Field-Speed Polish — appointment confirmation template.
 *
 * Reuses the same Equipify-branded shell as the other transactional emails
 * (`wrapEquipifyEmail`) so we never spawn a parallel email design. The only
 * difference vs. `buildWorkOrderSummaryEmailContent` is the framing: this
 * template is sent *before* service to set expectations, while the summary
 * goes out *after* completion.
 */
export function buildAppointmentConfirmationEmailContent(
  args: AppointmentConfirmationEmailArgs,
): { subject: string; html: string; text: string } {
  const subject = `Appointment confirmed — ${args.workOrderLabel}`
  const timeLine = args.scheduledTimeLabel?.trim()
    ? `${escapeHtml(args.scheduledDateLabel)} at <strong>${escapeHtml(args.scheduledTimeLabel)}</strong>`
    : `${escapeHtml(args.scheduledDateLabel)}`
  const inner = `<p>Dear ${escapeHtml(args.customerName)},</p>
<p>This confirms your upcoming service appointment with <strong>${escapeHtml(args.organizationName)}</strong>.</p>
<ul style="padding-left:18px;margin:12px 0;">
<li><strong>Job:</strong> ${escapeHtml(args.workOrderLabel)}</li>
<li><strong>Equipment:</strong> ${escapeHtml(args.equipmentName)}</li>
<li><strong>When:</strong> ${timeLine}</li>
${args.technicianLabel ? `<li><strong>Technician:</strong> ${escapeHtml(args.technicianLabel)}</li>` : ""}
${args.locationLine ? `<li><strong>Where:</strong> ${escapeHtml(args.locationLine)}</li>` : ""}
</ul>
${
  args.messagePlain?.trim() ?
    plainTextToHtml(args.messagePlain)
  : `<p>If anything needs to change, reply to this email and we'll reach out as soon as possible.</p>`
}
<p style="font-size:13px;color:#475569;">A reminder may follow closer to the visit. You can also view this appointment in your customer portal once portal access is enabled.</p>`
  const html = wrapEquipifyEmail(args.organizationName, inner)
  const text = [
    `Dear ${args.customerName},`,
    "",
    `Appointment confirmed — ${args.organizationName}`,
    `Job: ${args.workOrderLabel}`,
    `Equipment: ${args.equipmentName}`,
    args.scheduledTimeLabel?.trim()
      ? `When: ${args.scheduledDateLabel} at ${args.scheduledTimeLabel}`
      : `When: ${args.scheduledDateLabel}`,
    args.technicianLabel ? `Technician: ${args.technicianLabel}` : "",
    args.locationLine ? `Where: ${args.locationLine}` : "",
    "",
    args.messagePlain?.trim() || "Reply to this email if anything needs to change.",
  ]
    .filter(Boolean)
    .join("\n")
  return { subject, html, text }
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

/** Ad-hoc staff → customer message from CRM contact surfaces (Phase 55.4). */
export function buildCustomerStaffMessageEmailContent(args: {
  organizationName: string
  customerName: string
  messagePlain: string
  subject: string
}): { subject: string; html: string; text: string } {
  const subject =
    args.subject.trim() || `Message from ${args.organizationName}`
  const inner = `<p>Hello ${escapeHtml(args.customerName)},</p>${plainTextToHtml(args.messagePlain)}`
  const html = wrapEquipifyEmail(args.organizationName, inner, undefined)
  const text = [
    `Hello ${args.customerName},`,
    "",
    args.messagePlain.trim(),
    "",
    `— ${args.organizationName}`,
  ].join("\n")
  return { subject, html, text }
}
