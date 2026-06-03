import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGmailHeader,
  gmailApiFetch,
  normalizeRfcMessageId,
  parseEmailAddress,
  parseReferencesHeader,
  type GmailMessageListItem,
  type GmailMessageResource,
} from "@/lib/growth/inbox-sync/gmail-api-utils"
import { loadMailboxSyncCredentials } from "@/lib/growth/inbox-sync/mailbox-sync-credentials"
import type { GrowthInboxProviderRawMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import { normalizeProviderMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import type { GrowthInboxNormalizedMessage } from "@/lib/growth/inbox-sync/inbox-sync-types"
import type { GrowthInboxSyncAdapter } from "@/lib/growth/inbox-sync/provider-sync-adapters/inbox-sync-adapter-registry"

const DEFAULT_MAX_MESSAGES = 50
const DEFAULT_LOOKBACK_DAYS = 14
const METADATA_HEADERS = ["From", "To", "Subject", "Date", "In-Reply-To", "References", "Message-ID"]

function inboxSyncMaxMessages(): number {
  const parsed = Number(process.env.GROWTH_INBOX_SYNC_MAX_MESSAGES)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : DEFAULT_MAX_MESSAGES
}

function inboxSyncLookbackDays(): number {
  const parsed = Number(process.env.GROWTH_INBOX_SYNC_LOOKBACK_DAYS)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 90) : DEFAULT_LOOKBACK_DAYS
}

function messageTimestampFromInternalDate(value: string | undefined): string {
  const ms = Number(value)
  if (Number.isFinite(ms) && ms > 0) return new Date(ms).toISOString()
  return new Date().toISOString()
}

function buildInboundQuery(lookbackDays: number): string {
  return `in:inbox newer_than:${lookbackDays}d`
}

async function listRecentGmailMessageIds(
  accessToken: string,
  maxResults: number,
  lookbackDays: number,
): Promise<GmailMessageListItem[]> {
  const collected: GmailMessageListItem[] = []
  let pageToken: string | undefined

  while (collected.length < maxResults) {
    const params = new URLSearchParams({
      q: buildInboundQuery(lookbackDays),
      maxResults: String(Math.min(maxResults - collected.length, 50)),
    })
    if (pageToken) params.set("pageToken", pageToken)

    const result = await gmailApiFetch<{ messages?: GmailMessageListItem[]; nextPageToken?: string }>(
      accessToken,
      `/messages?${params.toString()}`,
    )
    if (!result.ok) {
      throw new Error(result.message)
    }

    collected.push(...(result.data.messages ?? []))
    pageToken = result.data.nextPageToken
    if (!pageToken) break
  }

  return collected.slice(0, maxResults)
}

async function fetchGmailMessageMetadata(
  accessToken: string,
  messageId: string,
): Promise<GmailMessageResource | null> {
  const params = new URLSearchParams({ format: "metadata" })
  for (const header of METADATA_HEADERS) {
    params.append("metadataHeaders", header)
  }

  const result = await gmailApiFetch<GmailMessageResource>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?${params.toString()}`,
  )
  if (!result.ok) return null
  return result.data
}

function mapGmailMessageToRaw(
  message: GmailMessageResource,
  mailboxEmail: string,
): GrowthInboxProviderRawMessage | null {
  const providerMessageId = message.id?.trim()
  if (!providerMessageId) return null

  const headers = message.payload?.headers
  const fromEmail = parseEmailAddress(getGmailHeader(headers, "From"))
  if (!fromEmail || fromEmail === mailboxEmail) return null

  const inReplyTo = normalizeRfcMessageId(getGmailHeader(headers, "In-Reply-To"))
  const references = parseReferencesHeader(getGmailHeader(headers, "References"))

  return {
    provider_message_id: providerMessageId,
    provider_thread_id: message.threadId?.trim() || null,
    in_reply_to: inReplyTo,
    references,
    from_email: fromEmail,
    to_email: parseEmailAddress(getGmailHeader(headers, "To")),
    subject: getGmailHeader(headers, "Subject"),
    body_preview: message.snippet?.trim() || null,
    message_timestamp: messageTimestampFromInternalDate(message.internalDate),
  }
}

export function createGoogleInboxSyncAdapter(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): GrowthInboxSyncAdapter {
  return {
    providerFamily: "google",
    async listRecentMessages() {
      const credentials = await loadMailboxSyncCredentials(admin, mailboxConnectionId)
      if (!credentials) return []

      const maxResults = inboxSyncMaxMessages()
      const lookbackDays = inboxSyncLookbackDays()
      const listed = await listRecentGmailMessageIds(credentials.accessToken, maxResults, lookbackDays)

      const rawMessages: GrowthInboxProviderRawMessage[] = []
      for (const item of listed) {
        const messageId = item.id?.trim()
        if (!messageId) continue
        const metadata = await fetchGmailMessageMetadata(credentials.accessToken, messageId)
        if (!metadata) continue
        const mapped = mapGmailMessageToRaw(metadata, credentials.emailAddress)
        if (mapped) rawMessages.push(mapped)
      }

      return rawMessages
    },
    normalizeMessage(raw) {
      return normalizeProviderMessage(raw, mailboxConnectionId)
    },
    getThreadId(raw) {
      return raw.provider_thread_id?.trim() || null
    },
    getMessageId(raw) {
      return raw.provider_message_id.trim()
    },
  }
}
