import "server-only"

import { hasCredential, truncateTransportError } from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

export const resendProviderAdapter: GrowthProviderAdapter = {
  family: "resend",

  capabilities() {
    return { oauthMailbox: false, smtp: false, apiKey: true, webhooks: false, tracking: true }
  },

  validate(credentials) {
    if (!hasCredential(credentials.api_key)) {
      return { ok: false, status: "invalid", summary: "Resend API key is required." }
    }
    if (!hasCredential(credentials.from_address)) {
      return { ok: false, status: "warning", summary: "Resend from address not configured." }
    }
    return { ok: true, status: "valid", summary: "Resend API credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "critical", summary: validation.summary }
    return { ok: true, tier: "healthy", summary: "Resend transport adapter ready." }
  },

  async send(credentials, message): Promise<ProviderSendResult> {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, error: validation.summary }

    if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
      return { ok: true, provider_message_id: `sim-resend-${Date.now()}`, simulated: true }
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: credentials.from_address ?? message.from,
          to: [message.to],
          subject: message.subject,
          ...(message.html ? { html: message.html } : {}),
          ...(message.text ? { text: message.text } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as { id?: string; message?: string }
      if (!response.ok) {
        return { ok: false, error: truncateTransportError(payload.message ?? `Resend API ${response.status}`) }
      }
      return { ok: true, provider_message_id: payload.id ?? undefined }
    } catch (error) {
      return { ok: false, error: truncateTransportError(error instanceof Error ? error.message : "Resend send failed.") }
    }
  },
}

export async function sendViaResend(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  return resendProviderAdapter.send(credentials, message)
}
