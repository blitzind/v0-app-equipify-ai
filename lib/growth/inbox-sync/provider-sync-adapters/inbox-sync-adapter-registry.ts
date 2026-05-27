import "server-only"

import type { GrowthInboxProviderRawMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import { normalizeProviderMessage } from "@/lib/growth/inbox-sync/provider-message-normalizer"
import type { GrowthInboxNormalizedMessage } from "@/lib/growth/inbox-sync/inbox-sync-types"

export type GrowthInboxSyncAdapter = {
  providerFamily: string
  listRecentMessages(): Promise<GrowthInboxProviderRawMessage[]>
  normalizeMessage(raw: GrowthInboxProviderRawMessage): GrowthInboxNormalizedMessage
  getThreadId(raw: GrowthInboxProviderRawMessage): string | null
  getMessageId(raw: GrowthInboxProviderRawMessage): string
}

function isSimulateEnabled(): boolean {
  return process.env.GROWTH_INBOX_SYNC_SIMULATE?.trim() === "true"
}

function fixtureMessages(providerFamily: string, mailboxConnectionId: string): GrowthInboxProviderRawMessage[] {
  const now = new Date().toISOString()
  return [
    {
      provider_message_id: `${providerFamily}-fixture-reply-1`,
      provider_thread_id: `${providerFamily}-thread-1`,
      in_reply_to: "transport-msg-fixture-1",
      references: ["transport-msg-fixture-1"],
      from_email: "prospect@example.com",
      to_email: "ops@equipify.local",
      subject: "Re: Follow up on equipment services",
      body_preview: "Thanks for reaching out — can you share pricing details?",
      message_timestamp: now,
    },
    {
      provider_message_id: `${providerFamily}-fixture-reply-2`,
      provider_thread_id: `${providerFamily}-thread-2`,
      from_email: "buyer@acme.example",
      to_email: "ops@equipify.local",
      subject: "Re: Demo request",
      body_preview: "Let's schedule a call next week.",
      message_timestamp: now,
    },
  ].map((message) => ({ ...message, provider_thread_id: message.provider_thread_id ?? null }))
}

function createAdapter(providerFamily: string, mailboxConnectionId: string, supported: boolean): GrowthInboxSyncAdapter {
  return {
    providerFamily,
    async listRecentMessages() {
      if (isSimulateEnabled()) return fixtureMessages(providerFamily, mailboxConnectionId)
      if (!supported) return []
      return []
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

export function getInboxSyncAdapter(input: {
  providerFamily: string
  mailboxConnectionId: string
}): GrowthInboxSyncAdapter {
  switch (input.providerFamily) {
    case "google":
      return createAdapter("google", input.mailboxConnectionId, true)
    case "microsoft":
      return createAdapter("microsoft", input.mailboxConnectionId, true)
    case "smtp":
      return createAdapter("smtp", input.mailboxConnectionId, false)
    case "custom":
    default:
      return createAdapter(input.providerFamily, input.mailboxConnectionId, false)
  }
}
