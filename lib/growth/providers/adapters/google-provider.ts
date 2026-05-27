import {
  buildRfc822Message,
  encodeBase64Url,
  hasCredential,
  truncateTransportError,
} from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderAdapterHealthResult,
  ProviderAdapterValidationResult,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"

export const googleProviderAdapter: GrowthProviderAdapter = {
  family: "google",

  capabilities() {
    return { oauthMailbox: true, smtp: false, apiKey: false, webhooks: false, tracking: false }
  },

  validate(credentials) {
    if (!hasCredential(credentials.access_token)) {
      return { ok: false, status: "invalid", summary: "Google mailbox OAuth access token is required." }
    }
    if (!hasCredential(credentials.from_address)) {
      return { ok: false, status: "warning", summary: "Sender from address not configured." }
    }
    return { ok: true, status: "valid", summary: "Google Workspace OAuth mailbox credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "critical", summary: validation.summary }
    return { ok: true, tier: "healthy", summary: "Google transport adapter ready." }
  },

  async send(credentials, message): Promise<ProviderSendResult> {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, error: validation.summary }

    if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
      return { ok: true, provider_message_id: `sim-google-${Date.now()}`, simulated: true }
    }

    try {
      const raw = encodeBase64Url(buildRfc822Message({ ...message, from: credentials.from_address ?? message.from }))
      const response = await fetch(GMAIL_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
      })

      const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: { message?: string } }
      if (!response.ok) {
        return { ok: false, error: truncateTransportError(payload.error?.message ?? `Gmail API ${response.status}`) }
      }
      return { ok: true, provider_message_id: payload.id ?? undefined }
    } catch (error) {
      return { ok: false, error: truncateTransportError(error instanceof Error ? error.message : "Google send failed.") }
    }
  },
}

export function validateGoogleCredentials(credentials: ProviderAdapterCredentials): ProviderAdapterValidationResult {
  return googleProviderAdapter.validate(credentials)
}

export function healthGoogleCredentials(credentials: ProviderAdapterCredentials): ProviderAdapterHealthResult {
  return googleProviderAdapter.health(credentials)
}

export async function sendViaGoogle(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  return googleProviderAdapter.send(credentials, message)
}
