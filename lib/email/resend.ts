import "server-only"

import { Resend } from "resend"
import { getOutboundEmailEnv } from "@/lib/email/config"

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailConfigError"
  }
}

function requireFromAddress(): string {
  const from = getOutboundEmailEnv().fromAddress
  if (!from) {
    throw new EmailConfigError(
      "EMAIL_FROM_ADDRESS or EMAIL_FROM is not set. Add a verified sender address to the server environment.",
    )
  }
  return from
}

function defaultReplyTo(): string | undefined {
  const r = getOutboundEmailEnv().replyToDefault
  return r || undefined
}

let resendSingleton: Resend | null = null

function getResendClient(): Resend {
  const key = getOutboundEmailEnv().resendApiKey
  if (!key) {
    throw new EmailConfigError("RESEND_API_KEY is not set. Add it to the server environment to send email.")
  }
  if (!resendSingleton) {
    resendSingleton = new Resend(key)
  }
  return resendSingleton
}

function recipientCount(to: string | string[]): number {
  return Array.isArray(to) ? to.length : 1
}

function truncateForLog(s: string, max = 180): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function logOutboundEmail(payload: Record<string, unknown>) {
  try {
    console.info(JSON.stringify({ source: "outbound-email", provider: "resend", ...payload }))
  } catch {
    /* best-effort */
  }
}

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
  /** Binary attachments (e.g. invoice PDF). */
  attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
  /**
   * Observability category (Phase 55.1). Use stable snake_case identifiers.
   * @example "invoice_customer", "team_invite", "signup_welcome"
   */
  category?: string
  organizationId?: string | null
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: "config" | "validation" | "provider" }

/**
 * Sends an email via Resend. Server-only; never import from client components.
 * Configuration is read via {@link getOutboundEmailEnv}; failures are logged without bodies or secrets.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const category = input.category?.trim() || "transactional"
  const organizationId = input.organizationId ?? null
  const nRecipients = recipientCount(input.to)
  const replyToEffective = input.replyTo?.trim() || defaultReplyTo()
  const hasReplyTo = Boolean(replyToEffective)

  try {
    const from = requireFromAddress()
    const resend = getResendClient()

    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(replyToEffective ? { replyTo: replyToEffective } : {}),
      ...(input.attachments && input.attachments.length > 0 ?
        {
          attachments: input.attachments.map((a) => ({
            filename: a.filename,
            content: a.content,
            contentType: a.contentType ?? "application/octet-stream",
          })),
        }
      : {}),
    })

    if (error) {
      logOutboundEmail({
        category,
        organizationId,
        recipientCount: nRecipients,
        ok: false,
        code: "provider",
        error: truncateForLog(error.message ?? "Resend rejected the message."),
        hasReplyTo,
      })
      return {
        ok: false,
        error: error.message ?? "Resend rejected the message.",
        code: "provider",
      }
    }

    logOutboundEmail({
      category,
      organizationId,
      recipientCount: nRecipients,
      ok: true,
      providerMessageId: data?.id ?? null,
      hasReplyTo,
    })

    return { ok: true, id: data?.id }
  } catch (e) {
    if (e instanceof EmailConfigError) {
      logOutboundEmail({
        category,
        organizationId,
        recipientCount: nRecipients,
        ok: false,
        code: "config",
        error: truncateForLog(e.message),
        hasReplyTo,
      })
      return { ok: false, error: e.message, code: "config" }
    }
    const message = e instanceof Error ? e.message : String(e)
    logOutboundEmail({
      category,
      organizationId,
      recipientCount: nRecipients,
      ok: false,
      code: "provider",
      error: truncateForLog(message),
      hasReplyTo,
    })
    return { ok: false, error: message, code: "provider" }
  }
}
