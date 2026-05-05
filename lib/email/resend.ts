import "server-only"

import { Resend } from "resend"

export class EmailConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EmailConfigError"
  }
}

function getFromAddress(): string {
  const from = process.env.EMAIL_FROM_ADDRESS?.trim()
  if (!from) {
    throw new EmailConfigError("EMAIL_FROM_ADDRESS is not set. Add it to the server environment.")
  }
  return from
}

function getOptionalReplyTo(): string | undefined {
  const r = process.env.EMAIL_REPLY_TO?.trim()
  return r || undefined
}

let resendSingleton: Resend | null = null

function getResendClient(): Resend {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    throw new EmailConfigError("RESEND_API_KEY is not set. Add it to the server environment to send email.")
  }
  if (!resendSingleton) {
    resendSingleton = new Resend(key)
  }
  return resendSingleton
}

export type SendEmailInput = {
  to: string | string[]
  subject: string
  html: string
  text?: string
  replyTo?: string
}

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; code?: "config" | "validation" | "provider" }

/**
 * Sends an email via Resend. Server-only; never import from client components.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  try {
    const from = getFromAddress()
    const resend = getResendClient()
    const replyTo = input.replyTo?.trim() || getOptionalReplyTo()

    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
      ...(replyTo ? { replyTo } : {}),
    })

    if (error) {
      return {
        ok: false,
        error: error.message ?? "Resend rejected the message.",
        code: "provider",
      }
    }

    return { ok: true, id: data?.id }
  } catch (e) {
    if (e instanceof EmailConfigError) {
      return { ok: false, error: e.message, code: "config" }
    }
    const message = e instanceof Error ? e.message : String(e)
    return { ok: false, error: message, code: "provider" }
  }
}
