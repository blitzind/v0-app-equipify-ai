import "server-only"

import { normalizeRfcMessageId, parseEmailAddress } from "@/lib/growth/inbox-sync/gmail-message-utils"

const GRAPH_API_BASE = "https://graph.microsoft.com/v1.0/me"

export type GraphInternetMessageHeader = { name?: string; value?: string }

export type GraphMessageListItem = {
  id?: string
  conversationId?: string
  subject?: string
  bodyPreview?: string
  receivedDateTime?: string
  internetMessageId?: string
  from?: { emailAddress?: { address?: string; name?: string } }
  toRecipients?: Array<{ emailAddress?: { address?: string } }>
  internetMessageHeaders?: GraphInternetMessageHeader[]
}

export async function graphApiFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const response = await fetch(`${GRAPH_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (response.status === 204) {
    return { ok: true, data: {} as T }
  }

  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.error?.message ?? `Microsoft Graph ${response.status}`,
    }
  }
  return { ok: true, data }
}

export function getGraphHeader(
  headers: GraphInternetMessageHeader[] | undefined,
  name: string,
): string | null {
  const target = name.toLowerCase()
  const header = (headers ?? []).find((row) => row.name?.toLowerCase() === target)
  return header?.value?.trim() || null
}

export function parseGraphReferencesHeader(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  const matches = value.match(/<[^>]+>|[^\s<>]+@[^\s<>]+/g) ?? []
  return matches
    .map((part) => normalizeRfcMessageId(part))
    .filter((part): part is string => Boolean(part))
}

export async function fetchGraphSentMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<{ threadId: string | null; rfcMessageId: string | null }> {
  const result = await graphApiFetch<GraphMessageListItem>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?$select=conversationId,internetMessageId`,
  )
  if (!result.ok) {
    return { threadId: null, rfcMessageId: null }
  }
  return {
    threadId: result.data.conversationId?.trim() || null,
    rfcMessageId: normalizeRfcMessageId(result.data.internetMessageId),
  }
}

export function mapGraphMessageToRaw(
  message: GraphMessageListItem,
  mailboxEmail: string,
): import("@/lib/growth/inbox-sync/provider-message-normalizer").GrowthInboxProviderRawMessage | null {
  const providerMessageId = message.id?.trim()
  if (!providerMessageId) return null

  const fromEmail = parseEmailAddress(message.from?.emailAddress?.address ?? null)
  if (!fromEmail || fromEmail === mailboxEmail.toLowerCase()) return null

  const headers = message.internetMessageHeaders
  const inReplyTo = normalizeRfcMessageId(getGraphHeader(headers, "In-Reply-To"))
  const references = parseGraphReferencesHeader(getGraphHeader(headers, "References"))

  const toRecipient = message.toRecipients?.[0]?.emailAddress?.address ?? null

  return {
    provider_message_id: providerMessageId,
    provider_thread_id: message.conversationId?.trim() || null,
    in_reply_to: inReplyTo,
    references,
    from_email: fromEmail,
    to_email: parseEmailAddress(toRecipient),
    subject: message.subject?.trim() || null,
    body_preview: message.bodyPreview?.trim() || null,
    message_timestamp: message.receivedDateTime ?? new Date().toISOString(),
  }
}
