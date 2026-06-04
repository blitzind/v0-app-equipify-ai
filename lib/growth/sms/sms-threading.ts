import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { addInboxMessage, createInboxThread } from "@/lib/growth/inbox/thread-repository"
import type { GrowthInboxMessage, GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { normalizeToE164 } from "@/lib/growth/sms/phone-normalization"
import {
  createSmsConversation,
  fetchGrowthSmsWorkspaceSettings,
  findSmsConversationByLeadAndParticipant,
  findUnlinkedSmsInboxThreadForLead,
  linkSmsConversationInboxThread,
} from "@/lib/growth/sms/sms-repository"
import type { GrowthSmsConversation } from "@/lib/growth/sms/sms-types"

function smsInboxThreadSubject(participantE164: string): string {
  return `SMS · ${participantE164}`
}

async function ensureSmsConversationInboxBridge(
  admin: SupabaseClient,
  conversation: GrowthSmsConversation,
  participantE164: string,
): Promise<GrowthSmsConversation> {
  if (conversation.inboxThreadId) return conversation

  const subject = smsInboxThreadSubject(participantE164)
  let inboxThreadId = await findUnlinkedSmsInboxThreadForLead(admin, {
    leadId: conversation.leadId,
    subject,
  })

  if (!inboxThreadId) {
    const inboxThread = await createInboxThread(admin, {
      lead_id: conversation.leadId,
      subject,
      provider_family: "twilio_sms",
    })
    inboxThreadId = inboxThread.id
  }

  await linkSmsConversationInboxThread(admin, conversation.id, inboxThreadId)
  return { ...conversation, inboxThreadId }
}

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
  if (existing) {
    if (input.bridgeInbox === false) return existing
    return ensureSmsConversationInboxBridge(admin, existing, normalizedParticipant)
  }

  const settings = await fetchGrowthSmsWorkspaceSettings(admin)
  const fromE164 = settings?.fromE164 ?? "+18333784743"

  const conversation = await createSmsConversation(admin, {
    organizationId: input.organizationId ?? null,
    leadId: input.leadId,
    participantE164: normalizedParticipant,
    fromE164,
    metadata: { created_by: "sms_threading" },
  })

  if (input.bridgeInbox === false) return conversation
  return ensureSmsConversationInboxBridge(admin, conversation, normalizedParticipant)
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
