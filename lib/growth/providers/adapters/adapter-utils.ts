/** Shared adapter helpers — client-safe. */

import type { ProviderSendMessage } from "@/lib/growth/providers/adapters/provider-adapter-types"

export function buildRfc822Message(message: ProviderSendMessage): string {
  const from = message.fromName ? `${message.fromName} <${message.from}>` : message.from
  const lines = [`From: ${from}`, `To: ${message.to}`, `Subject: ${message.subject}`, "MIME-Version: 1.0"]
  if (message.replyTo) lines.push(`Reply-To: ${message.replyTo}`)

  if (message.html && message.text) {
    const boundary = `equipify-${Date.now()}`
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, "")
    lines.push(`--${boundary}`)
    lines.push("Content-Type: text/plain; charset=utf-8", "", message.text, "")
    lines.push(`--${boundary}`)
    lines.push("Content-Type: text/html; charset=utf-8", "", message.html, "")
    lines.push(`--${boundary}--`)
  } else if (message.html) {
    lines.push("Content-Type: text/html; charset=utf-8", "", message.html)
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8", "", message.text ?? "")
  }

  return lines.join("\r\n")
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url")
}

export function truncateTransportError(message: string, max = 240): string {
  const trimmed = message.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

export function hasCredential(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0
}
