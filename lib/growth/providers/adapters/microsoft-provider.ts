import "server-only"

import { fetchGraphSentMessageMetadata, graphApiFetch } from "@/lib/growth/inbox-sync/graph-api-utils"
import { hasCredential, truncateTransportError } from "@/lib/growth/providers/adapters/adapter-utils"
import { GROWTH_MICROSOFT365_TRANSPORT_QA_MARKER } from "@/lib/growth/providers/adapters/provider-transport-capability-registry"
import type {
  GrowthProviderAdapter,
  ProviderAdapterCredentials,
  ProviderSendMessage,
  ProviderSendResult,
} from "@/lib/growth/providers/adapters/provider-adapter-types"

export { GROWTH_MICROSOFT365_TRANSPORT_QA_MARKER }

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

    return sendMicrosoftGraphMessage(credentials, message)
  },
}

async function sendMicrosoftGraphMessage(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  const accessToken = credentials.access_token
  if (!accessToken) return { ok: false, error: "Microsoft access token missing." }

  try {
    const draftBody = {
      subject: message.subject,
      body: {
        contentType: message.html ? "HTML" : "Text",
        content: message.html ?? message.text ?? "",
      },
      toRecipients: [{ emailAddress: { address: message.to } }],
      ...(message.replyTo
        ? { replyTo: [{ emailAddress: { address: message.replyTo } }] }
        : {}),
    }

    const created = await graphApiFetch<{ id?: string; conversationId?: string; internetMessageId?: string }>(
      accessToken,
      "/messages",
      { method: "POST", body: JSON.stringify(draftBody) },
    )
    if (!created.ok) {
      return { ok: false, error: truncateTransportError(created.message) }
    }

    const messageId = created.data.id?.trim()
    if (!messageId) {
      return { ok: false, error: "Microsoft Graph did not return a message id." }
    }

    const sent = await graphApiFetch(accessToken, `/messages/${encodeURIComponent(messageId)}/send`, {
      method: "POST",
    })
    if (!sent.ok) {
      return { ok: false, error: truncateTransportError(sent.message) }
    }

    const metadata = await fetchGraphSentMessageMetadata(accessToken, messageId)
    return {
      ok: true,
      provider_message_id: messageId,
      provider_thread_id: metadata.threadId ?? created.data.conversationId?.trim() ?? undefined,
      rfc_message_id: metadata.rfcMessageId ?? undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: truncateTransportError(error instanceof Error ? error.message : "Microsoft send failed."),
    }
  }
}

export async function sendViaMicrosoft(
  credentials: ProviderAdapterCredentials,
  message: ProviderSendMessage,
): Promise<ProviderSendResult> {
  return microsoftProviderAdapter.send(credentials, message)
}
