import "server-only"

import {
  getGmailHeader,
  normalizeRfcMessageId,
  type GmailHeader,
} from "@/lib/growth/inbox-sync/gmail-message-utils"

export type { GmailHeader } from "@/lib/growth/inbox-sync/gmail-message-utils"
export {
  getGmailHeader,
  normalizeRfcMessageId,
  parseEmailAddress,
  parseReferencesHeader,
} from "@/lib/growth/inbox-sync/gmail-message-utils"

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

export type GmailMessageListItem = { id?: string; threadId?: string }

export type GmailMessageResource = {
  id?: string
  threadId?: string
  internalDate?: string
  snippet?: string
  payload?: { headers?: GmailHeader[] }
  error?: { message?: string }
}

export async function gmailApiFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } }
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: data.error?.message ?? `Gmail API ${response.status}`,
    }
  }
  return { ok: true, data }
}

export async function fetchGmailSentMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<{ threadId: string | null; rfcMessageId: string | null }> {
  const result = await gmailApiFetch<GmailMessageResource>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Message-ID`,
  )
  if (!result.ok) {
    return { threadId: null, rfcMessageId: null }
  }
  const messageIdHeader = getGmailHeader(result.data.payload?.headers, "Message-ID")
  return {
    threadId: result.data.threadId?.trim() || null,
    rfcMessageId: normalizeRfcMessageId(messageIdHeader),
  }
}
