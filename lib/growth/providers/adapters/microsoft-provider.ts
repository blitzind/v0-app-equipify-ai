import "server-only"

import { hasCredential, truncateTransportError } from "@/lib/growth/providers/adapters/adapter-utils"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

const GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/me/sendMail"

export const microsoftProviderAdapter: GrowthProviderAdapter = {
  family: "microsoft",

  capabilities() {
    return { oauthMailbox: true, smtp: false, apiKey: false, webhooks: false, tracking: false }
  },

  validate(credentials) {
    if (!hasCredential(credentials.access_token)) {
      return { ok: false, status: "invalid", summary: "Microsoft 365 OAuth access token is required." }
    }
    if (!hasCredential(credentials.from_address)) {
      return { ok: false, status: "warning", summary: "Sender from address not configured." }
    }
    return { ok: true, status: "valid", summary: "Microsoft 365 OAuth mailbox credentials present." }
  },

  health(credentials) {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, tier: "critical", summary: validation.summary }
    return { ok: true, tier: "healthy", summary: "Microsoft transport adapter ready." }
  },

  async send(credentials, message): Promise<ProviderSendResult> {
    const validation = this.validate(credentials)
    if (!validation.ok) return { ok: false, error: validation.summary }

    if (process.env.GROWTH_TRANSPORT_SIMULATE === "true") {
      return { ok: true, provider_message_id: `sim-microsoft-${Date.now()}`, simulated: true }
    }

    try {
      const response = await fetch(GRAPH_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: message.subject,
            body: {
              contentType: message.html ? "HTML" : "Text",
              content: message.html ?? message.text ?? "",
            },
            from: {
              emailAddress: {
                address: credentials.from_address ?? message.from,
                name: message.fromName ?? undefined,
              },
            },
            toRecipients: [{ emailAddress: { address: message.to } }],
            ...(message.replyTo ? { replyTo: [{ emailAddress: { address: message.replyTo } }] } : {}),
          },
          saveToSentItems: true,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
        return {
          ok: false,
          error: truncateTransportError(payload.error?.message ?? `Microsoft Graph ${response.status}`),
        }
      }

      return { ok: true, provider_message_id: `graph-${Date.now()}` }
    } catch (error) {
      return {
        ok: false,
        error: truncateTransportError(error instanceof Error ? error.message : "Microsoft send failed."),
      }
    }
  },
}

export async function sendViaMicrosoft(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  return microsoftProviderAdapter.send(credentials, message)
}
