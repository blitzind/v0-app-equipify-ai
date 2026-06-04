import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { mapSmsConversationToChannelThread } from "@/lib/growth/inbox/inbox-channel-types"
import type { GrowthInboxChannelThread } from "@/lib/growth/inbox/inbox-channel-types"
import { formatLeadLabel } from "@/lib/growth/lead-label"
import {
  getSmsConversationById,
  listSmsMessagesForConversation,
} from "@/lib/growth/sms/sms-repository"

export async function loadSmsInboxChannelThread(
  admin: SupabaseClient,
  conversationId: string,
): Promise<GrowthInboxChannelThread | null> {
  const conversation = await getSmsConversationById(admin, conversationId)
  if (!conversation) return null

  const { data: lead } = await admin
    .schema("growth")
    .from("leads")
    .select("company_name")
    .eq("id", conversation.leadId)
    .maybeSingle()

  const messages = await listSmsMessagesForConversation(admin, conversation.id)
  return mapSmsConversationToChannelThread({
    conversation,
    leadLabel: formatLeadLabel(typeof lead?.company_name === "string" ? lead.company_name : ""),
    messages,
  })
}

export async function listSmsInboxChannelThreadsForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthInboxChannelThread[]> {
  const { data, error } = await admin
    .schema("growth")
    .from("sms_conversations")
    .select("*")
    .eq("lead_id", leadId)
    .order("last_message_at", { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)

  const threads: GrowthInboxChannelThread[] = []
  for (const row of data ?? []) {
    const conversationId = String((row as { id: string }).id)
    const thread = await loadSmsInboxChannelThread(admin, conversationId)
    if (thread) threads.push(thread)
  }
  return threads
}
