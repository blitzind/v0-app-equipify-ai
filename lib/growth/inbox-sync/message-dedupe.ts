import type { GrowthInboxNormalizedMessage } from "@/lib/growth/inbox-sync/inbox-sync-types"
import { buildMessagePreview } from "@/lib/growth/inbox-sync/provider-message-normalizer"

export type GrowthInboxDedupeInput = {
  providerFamily: string
  providerMessageId: string
  messageHash: string
  mailboxConnectionId: string
  inboxThreadId?: string | null
  fromEmail: string
  messageTimestamp: string
  bodyPreview: string
}

export type GrowthInboxDedupeState = {
  existingProviderMessageIds: Set<string>
  existingMessageHashes: Set<string>
  previewKeys: Set<string>
}

export function buildInboxPreviewDedupeKey(input: {
  fromEmail: string
  messageTimestamp: string
  bodyPreview: string
}): string {
  return [
    input.fromEmail.trim().toLowerCase(),
    input.messageTimestamp,
    buildMessagePreview(input.bodyPreview),
  ].join("|")
}

export function createInboxDedupeState(): GrowthInboxDedupeState {
  return {
    existingProviderMessageIds: new Set(),
    existingMessageHashes: new Set(),
    previewKeys: new Set(),
  }
}

export function shouldSkipInboxDuplicate(
  input: GrowthInboxDedupeInput,
  state: GrowthInboxDedupeState,
): { skip: boolean; reason?: "provider_message_id" | "message_hash" | "preview_fingerprint" } {
  const providerKey = `${input.providerFamily}:${input.providerMessageId}`
  if (state.existingProviderMessageIds.has(providerKey)) {
    return { skip: true, reason: "provider_message_id" }
  }

  const hashKey = `${input.mailboxConnectionId}:${input.messageHash}`
  if (state.existingMessageHashes.has(hashKey)) {
    return { skip: true, reason: "message_hash" }
  }

  const previewKey = buildInboxPreviewDedupeKey({
    fromEmail: input.fromEmail,
    messageTimestamp: input.messageTimestamp,
    bodyPreview: input.bodyPreview,
  })
  if (state.previewKeys.has(previewKey)) {
    return { skip: true, reason: "preview_fingerprint" }
  }

  return { skip: false }
}

export function registerImportedInboxMessage(
  message: GrowthInboxNormalizedMessage,
  input: { providerFamily: string; mailboxConnectionId: string },
  state: GrowthInboxDedupeState,
): void {
  state.existingProviderMessageIds.add(`${input.providerFamily}:${message.providerMessageId}`)
  state.existingMessageHashes.add(`${input.mailboxConnectionId}:${message.messageHash}`)
  state.previewKeys.add(
    buildInboxPreviewDedupeKey({
      fromEmail: message.fromEmail,
      messageTimestamp: message.messageTimestamp,
      bodyPreview: message.bodyPreview,
    }),
  )
}
