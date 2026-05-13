import { escapeHtml } from "@/lib/email/format"

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
