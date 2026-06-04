/** Growth Inbox channel abstraction (Phase 5.1G). Client-safe. */

import type { GrowthInboxMessage, GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import type { GrowthSmsConversation, GrowthSmsMessage } from "@/lib/growth/sms/sms-types"

export const GROWTH_INBOX_CHANNELS = ["email", "sms"] as const
export type GrowthInboxChannel = (typeof GROWTH_INBOX_CHANNELS)[number]

export type GrowthInboxChannelThreadRef = {
  channel: GrowthInboxChannel
  threadId: string
  leadId: string
  label: string
  lastMessageAt: string | null
  preview: string
  smsConversationId?: string | null
  emailInboxThreadId?: string | null
}

export type GrowthInboxChannelThread = GrowthInboxChannelThreadRef & {
  messages: GrowthInboxChannelMessage[]
}

export type GrowthInboxChannelMessage = {
  channel: GrowthInboxChannel
  id: string
  direction: "inbound" | "outbound"
  sender: string
  recipient: string
  subject: string
  bodyPreview: string
  messageTimestamp: string
  providerMessageId?: string | null
}

export function mapEmailInboxThreadToChannelThread(thread: GrowthInboxThread): GrowthInboxChannelThread {
  return {
    channel: thread.channel ?? "email",
    threadId: thread.id,
    leadId: thread.lead_id,
    label: thread.lead_label,
    lastMessageAt: thread.last_message_at,
    preview: thread.subject,
    emailInboxThreadId: thread.id,
    smsConversationId: null,
    messages: (thread.messages ?? []).map((message) => mapEmailMessageToChannelMessage(message)),
  }
}

export function mapEmailMessageToChannelMessage(message: GrowthInboxMessage): GrowthInboxChannelMessage {
  return {
    channel: "email",
    id: message.id,
    direction: message.direction,
    sender: message.sender,
    recipient: message.recipient,
    subject: message.subject,
    bodyPreview: message.body_preview,
    messageTimestamp: message.message_timestamp,
    providerMessageId: null,
  }
}

export function mapSmsConversationToChannelThread(input: {
  conversation: GrowthSmsConversation
  leadLabel: string
  messages: GrowthSmsMessage[]
}): GrowthInboxChannelThread {
  return {
    channel: "sms",
    threadId: input.conversation.inboxThreadId ?? input.conversation.id,
    leadId: input.conversation.leadId,
    label: input.leadLabel,
    lastMessageAt: input.conversation.lastMessageAt,
    preview: input.conversation.lastMessagePreview,
    smsConversationId: input.conversation.id,
    emailInboxThreadId: input.conversation.inboxThreadId,
    messages: input.messages.map((message) => mapSmsMessageToChannelMessage(message)),
  }
}

export function mapSmsMessageToChannelMessage(message: GrowthSmsMessage): GrowthInboxChannelMessage {
  return {
    channel: "sms",
    id: message.id,
    direction: message.direction,
    sender: message.fromE164,
    recipient: message.toE164,
    subject: "SMS",
    bodyPreview: message.body,
    messageTimestamp: message.messageTimestamp,
    providerMessageId: message.providerMessageId,
  }
}

import type { GrowthInboxChannel } from "@/lib/growth/inbox/inbox-channel-types"

export const GROWTH_SMS_INBOX_PROVIDER_FAMILIES = [
  "twilio_sms",
  "telnyx_sms",
  "signalwire_sms",
] as const

export type GrowthSmsInboxProviderFamily = (typeof GROWTH_SMS_INBOX_PROVIDER_FAMILIES)[number]

export function resolveInboxThreadChannel(providerFamily: string): GrowthInboxChannel {
  if ((GROWTH_SMS_INBOX_PROVIDER_FAMILIES as readonly string[]).includes(providerFamily)) {
    return "sms"
  }
  return "email"
}

export const GROWTH_INBOX_CHANNEL_FILTER_OPTIONS = ["all", "email", "sms"] as const
export type GrowthInboxChannelFilter = (typeof GROWTH_INBOX_CHANNEL_FILTER_OPTIONS)[number]

export const GROWTH_INBOX_CHANNEL_LABELS: Record<GrowthInboxChannel, string> = {
  email: "Email",
  sms: "SMS",
}

export const GROWTH_INBOX_CHANNEL_FILTER_LABELS: Record<GrowthInboxChannelFilter, string> = {
  all: "All channels",
  email: "Email",
  sms: "SMS",
}

export function filterInboxThreadsByChannel(
  threads: GrowthInboxThread[],
  channel: GrowthInboxChannelFilter,
): GrowthInboxThread[] {
  if (channel === "all") return threads
  return threads.filter((thread) => thread.channel === channel)
}

export function inboxThreadNeedsAttention(thread: {
  requires_human_review: boolean
  thread_status: string
}): boolean {
  return thread.thread_status !== "archived" && thread.requires_human_review
}
