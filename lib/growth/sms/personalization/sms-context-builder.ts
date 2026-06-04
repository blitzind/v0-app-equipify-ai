import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLead } from "@/lib/growth/types"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import { projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"
import type { SmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-personalization-types"

export { SMS_CONTEXT_SOURCE_PRIORITY, projectSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-projection"

export async function buildSmsPersonalizationContext(
  admin: SupabaseClient,
  lead: GrowthLead,
): Promise<SmsPersonalizationContext> {
  const packet = await buildOutreachContextPacket(admin, lead)

  const { data: conversations } = await admin
    .schema("growth")
    .from("sms_conversations")
    .select("id")
    .eq("lead_id", lead.id)
    .order("last_message_at", { ascending: false })
    .limit(3)

  const conversationIds = (conversations ?? []).map((row) => String((row as { id: string }).id))
  let priorSmsPreviews: string[] = []

  if (conversationIds.length > 0) {
    const { data: messages } = await admin
      .schema("growth")
      .from("sms_messages")
      .select("body, direction, message_timestamp")
      .in("conversation_id", conversationIds)
      .order("message_timestamp", { ascending: false })
      .limit(6)

    priorSmsPreviews = (messages ?? [])
      .map((row) => String((row as { body?: string }).body ?? "").trim())
      .filter(Boolean)
  }

  return projectSmsPersonalizationContext({ packet, priorSmsPreviews })
}
