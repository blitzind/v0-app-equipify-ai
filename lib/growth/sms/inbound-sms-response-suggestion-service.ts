import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { getInboxThread } from "@/lib/growth/inbox/thread-repository"
import { mapMemoryInfluenceToReplyCopilotRelationship } from "@/lib/growth/reply-intelligence/reply-copilot-memory"
import { buildSmsPersonalizationContext } from "@/lib/growth/sms/personalization/sms-context-builder"
import { buildInboundSmsResponseSuggestions } from "@/lib/growth/sms/inbound-sms-response-suggestions"
import type { GrowthInboundSmsResponseSuggestions } from "@/lib/growth/sms/inbound-sms-response-suggestion-types"

function resolveLatestInboundBody(
  explicitBody: string | null | undefined,
  messages: { direction: string; body_preview: string; message_timestamp: string }[] | undefined,
): string | null {
  if (explicitBody?.trim()) return explicitBody.trim()
  if (!messages?.length) return null

  const inbound = messages
    .filter((message) => message.direction === "inbound" && message.body_preview.trim())
    .sort((a, b) => b.message_timestamp.localeCompare(a.message_timestamp))

  return inbound[0]?.body_preview.trim() ?? null
}

export async function fetchInboundSmsResponseSuggestions(
  admin: SupabaseClient,
  input: {
    leadId: string
    threadId?: string | null
    inboundBody?: string | null
  },
): Promise<GrowthInboundSmsResponseSuggestions | null> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const [smsContext, memoryInfluence, thread] = await Promise.all([
    buildSmsPersonalizationContext(admin, lead),
    buildLeadMemoryInfluenceContext(admin, lead.id).catch(() => null),
    input.threadId ? getInboxThread(admin, input.threadId, true) : Promise.resolve(null),
  ])

  const inboundBody = resolveLatestInboundBody(input.inboundBody, thread?.messages)
  if (!inboundBody) return null

  const relationshipMemory = mapMemoryInfluenceToReplyCopilotRelationship(memoryInfluence)

  return buildInboundSmsResponseSuggestions({
    leadId: lead.id,
    inboundBody,
    contactName: lead.contactName,
    companyName: lead.companyName,
    packet: smsContext.packet,
    priorSmsPreviews: smsContext.priorSmsPreviews,
    priorEmailSummaries: smsContext.packet.priorReplySummaries,
    threadClassification: thread?.classification ?? null,
    nextBestAction: lead.nextBestAction,
    nextBestActionReason: lead.nextBestActionReason,
    relationshipMemory,
  })
}
