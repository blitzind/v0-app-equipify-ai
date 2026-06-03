import { escapeHtml, plainTextToHtml } from "@/lib/email/format"
import { wrapEquipifyEmail } from "@/lib/email/wrap-equipify-email"

export type QuoteEmailArgs = {
  organizationName: string
  customerName: string
  quoteLabel: string
  amountLabel: string
  expiresLabel: string
  scopeSummary?: string
  messagePlain?: string
  subjectOverride?: string
  pdfAttached?: boolean
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
    args.pdfAttached
      ? "<p style=\"font-size:13px;color:#475569;\"><strong>PDF copy:</strong> The detailed quote is attached as a PDF to this email.</p>"
      : ""
  const html = wrapEquipifyEmail(args.organizationName, `${intro}${bodyBlock}${attach}`)
  const textLines = [
    `Dear ${args.customerName},`,
    "",
    `Quote ${args.quoteLabel} from ${args.organizationName}`,
    `Amount: ${args.amountLabel}`,
    `Expires: ${args.expiresLabel}`,
    args.scopeSummary ?? "",
    "",
    args.messagePlain?.trim() ||
      "Reply with questions or to proceed.",
  ]
  if (args.pdfAttached) textLines.push("", "A PDF copy of this quote is attached.")
  const text = textLines.join("\n")
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
