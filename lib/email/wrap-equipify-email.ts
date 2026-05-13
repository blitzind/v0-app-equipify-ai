import { escapeHtml } from "@/lib/email/format"

export type WrapEquipifyEmailOptions = {
  /** Omit “reply to this email” (customer invoice receipts and similar). */
  transactionalClosing?: boolean
}

export function wrapEquipifyEmail(
  organizationName: string,
  innerHtml: string,
  footerNote?: string,
  options?: WrapEquipifyEmailOptions,
): string {
  const foot =
    footerNote != null && footerNote.trim()
      ? `<p style="margin-top:24px;font-size:12px;color:#64748b;">${escapeHtml(footerNote)}</p>`
      : ""
  const platformClosing = options?.transactionalClosing ?
    `<p style="margin-top:24px;font-size:12px;color:#94a3b8;">Sent on behalf of ${escapeHtml(organizationName)}.</p>`
  : `<p style="margin-top:24px;font-size:12px;color:#94a3b8;">Sent on behalf of ${escapeHtml(organizationName)}. Reply to this email if you have questions.</p>`
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;color:#0f172a;max-width:560px;">
${innerHtml}
${foot}
${platformClosing}
</body></html>`
}
