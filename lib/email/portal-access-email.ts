import { escapeHtml } from "@/lib/email/format"
import { wrapEquipifyEmail } from "@/lib/email/wrap-equipify-email"

export type PortalAccessEmailArgs = {
  organizationName: string
  customerName: string
  accessUrl: string
  expiresAtIso?: string | null
}

function formatExpiry(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return new Date(t).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function buildPortalAccessEmailContent(args: PortalAccessEmailArgs): {
  subject: string
  html: string
  text: string
} {
  const org = escapeHtml(args.organizationName)
  const cust = escapeHtml(args.customerName)
  const href = escapeHtml(args.accessUrl)
  const expiresLabel = formatExpiry(args.expiresAtIso)
  const expiresHtml = expiresLabel
    ? `<p style="margin:12px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:13px;line-height:1.55;color:#64748b;">This link expires on ${escapeHtml(expiresLabel)} and can be used once to sign in.</p>`
    : ""

  const subject = `Access your ${args.organizationName} customer portal`

  const inner = `<p style="margin:0 0 14px;font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;">Hello ${cust},</p>
<p style="margin:0 0 18px;font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6;color:#334155;">${org} has shared secure access to your customer portal. Use the button below to sign in — no password is required.</p>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 12px 0;">
<tr><td align="left">
<a href="${href}" style="display:inline-block;padding:12px 22px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;line-height:1.25;color:#ffffff;text-decoration:none;border-radius:8px;background-color:#1e293b;">
Open customer portal
</a>
</td></tr></table>
${expiresHtml}
<p style="margin:18px 0 0;font-family:system-ui,-apple-system,sans-serif;font-size:12px;line-height:1.55;color:#64748b;">If the button does not work, copy and paste this link into your browser:<br/>
<span style="word-break:break-all;">${href}</span></p>`

  const html = wrapEquipifyEmail(args.organizationName, inner, undefined, { transactionalClosing: true })

  const textLines = [
    `Hello ${args.customerName},`,
    "",
    `${args.organizationName} has shared secure access to your customer portal.`,
    "",
    `Open customer portal: ${args.accessUrl}`,
  ]
  if (expiresLabel) {
    textLines.push("", `This link expires on ${expiresLabel} and can be used once to sign in.`)
  }
  textLines.push("", `Sent on behalf of ${args.organizationName}.`)

  return { subject, html, text: textLines.join("\n") }
}
