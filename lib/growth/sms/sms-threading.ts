import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { addInboxMessage, createInboxThread } from "@/lib/growth/inbox/thread-repository"
import type { GrowthInboxMessage, GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import {
  createSmsConversation,
  fetchGrowthSmsWorkspaceSettings,
  findSmsConversationByLeadAndParticipant,
  linkSmsConversationInboxThread,
} from "@/lib/growth/sms/sms-repository"
import type { GrowthSmsConversation } from "@/lib/growth/sms/sms-types"

export async function findOrCreateSmsConversation(
  admin: SupabaseClient,
  input: {
    leadId: string
    participantE164: string
    organizationId?: string | null
    bridgeInbox?: boolean
  },
): Promise<GrowthSmsConversation> {
  const normalizedParticipant = normalizeToE164(input.participantE164)
  if (!normalizedParticipant) {
    throw new Error("invalid_participant_phone")
  }

  const existing = await findSmsConversationByLeadAndParticipant(admin, {
    leadId: input.leadId,
    participantE164: normalizedParticipant,
  })
  if (existing) return existing

  const settings = await fetchGrowthSmsWorkspaceSettings(admin)
  const fromE164 = settings?.fromE164 ?? "+18333784743"

  const conversation = await createSmsConversation(admin, {
    organizationId: input.organizationId ?? null,
    leadId: input.leadId,
    participantE164: normalizedParticipant,
    fromE164,
    metadata: { created_by: "sms_threading" },
  })

  if (input.bridgeInbox !== false) {
    const inboxThread = await createInboxThread(admin, {
      lead_id: input.leadId,
      subject: `SMS · ${normalizedParticipant}`,
      provider_family: "twilio_sms",
    })
    await linkSmsConversationInboxThread(admin, conversation.id, inboxThread.id)
    return { ...conversation, inboxThreadId: inboxThread.id }
  }

  return conversation
}

export async function appendSmsMessageToInboxBridge(
  admin: SupabaseClient,
  input: {
    conversation: GrowthSmsConversation
    direction: "inbound" | "outbound"
    body: string
    fromE164: string
    toE164: string
    providerMessageId?: string | null
    messageTimestamp?: string
  },
): Promise<{ thread: GrowthInboxThread; message: GrowthInboxMessage } | null> {
  if (!input.conversation.inboxThreadId) return null

  return addInboxMessage(admin, {
    thread_id: input.conversation.inboxThreadId,
    direction: input.direction,
    sender: input.fromE164,
    recipient: input.toE164,
    subject: `SMS · ${input.conversation.participantE164}`,
    body_preview: input.body.slice(0, 500),
    provider_message_id: input.providerMessageId ?? null,
    message_timestamp: input.messageTimestamp,
  })
}
