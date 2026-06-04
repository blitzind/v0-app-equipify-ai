import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  graphApiFetch,
  mapGraphMessageToRaw,
  type GraphMessageListItem,
} from "@/lib/growth/inbox-sync/graph-api-utils"
import { loadMailboxSyncCredentials } from "@/lib/growth/inbox-sync/mailbox-sync-credentials"
import type { GrowthInboxProviderRawMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import { normalizeProviderMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import type { GrowthInboxSyncAdapter } from "@/lib/growth/inbox-sync/provider-sync-adapters/inbox-sync-adapter-registry"

const DEFAULT_MAX_MESSAGES = 50
const DEFAULT_LOOKBACK_DAYS = 14

const MESSAGE_SELECT =
  "id,conversationId,subject,bodyPreview,receivedDateTime,internetMessageId,from,toRecipients,internetMessageHeaders"

function inboxSyncMaxMessages(): number {
  const parsed = Number(process.env.GROWTH_INBOX_SYNC_MAX_MESSAGES)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 100) : DEFAULT_MAX_MESSAGES
}

function inboxSyncLookbackDays(): number {
  const parsed = Number(process.env.GROWTH_INBOX_SYNC_LOOKBACK_DAYS)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 90) : DEFAULT_LOOKBACK_DAYS
}

function lookbackIso(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

async function listRecentInboxMessages(
  accessToken: string,
  maxResults: number,
  lookbackDays: number,
): Promise<GraphMessageListItem[]> {
  const since = lookbackIso(lookbackDays)
  const params = new URLSearchParams({
    $filter: `receivedDateTime ge ${since}`,
    $orderby: "receivedDateTime desc",
    $top: String(Math.min(maxResults, 50)),
    $select: MESSAGE_SELECT,
  })

  const collected: GraphMessageListItem[] = []
  let nextLink: string | null = `/mailFolders/inbox/messages?${params.toString()}`

  while (nextLink && collected.length < maxResults) {
    const path = nextLink.startsWith("http")
      ? nextLink.replace("https://graph.microsoft.com/v1.0/me", "")
      : nextLink

    const result = await graphApiFetch<{ value?: GraphMessageListItem[]; "@odata.nextLink"?: string }>(
      accessToken,
      path,
    )
    if (!result.ok) {
      throw new Error(result.message)
    }

    collected.push(...(result.data.value ?? []))
    const rawNext = result.data["@odata.nextLink"]
    nextLink = rawNext ? rawNext.replace("https://graph.microsoft.com/v1.0/me", "") : null
    if (!nextLink) break
  }

  return collected.slice(0, maxResults)
}

export function createMicrosoftInboxSyncAdapter(
  admin: SupabaseClient,
  mailboxConnectionId: string,
): GrowthInboxSyncAdapter {
  return {
    providerFamily: "microsoft",
    async listRecentMessages() {
      const credentials = await loadMailboxSyncCredentials(admin, mailboxConnectionId)
      if (!credentials || credentials.providerFamily !== "microsoft") return []

      const maxResults = inboxSyncMaxMessages()
      const lookbackDays = inboxSyncLookbackDays()
      const listed = await listRecentInboxMessages(credentials.accessToken, maxResults, lookbackDays)

      const rawMessages: GrowthInboxProviderRawMessage[] = []
      for (const item of listed) {
        const mapped = mapGraphMessageToRaw(item, credentials.emailAddress)
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
