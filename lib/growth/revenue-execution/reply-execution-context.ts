import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadEmailEventSummary } from "@/lib/growth/outbound/email-event-summary"

const POSITIVE_REPLY_CLASSIFICATIONS = new Set([
  "interested",
  "positive_interest",
  "meeting_intent",
  "budget",
])

export type LeadReplyExecutionContext = {
  latestReplyClassification: string | null
  hasPositiveReply: boolean
}

export async function fetchLeadReplyExecutionContext(
  admin: SupabaseClient,
  input: { leadId: string; contactEmail?: string | null },
): Promise<LeadReplyExecutionContext> {
  const emailSummary = await fetchGrowthLeadEmailEventSummary(admin, input.leadId, input.contactEmail)
  const classification = emailSummary.latestReplyClassification

  return {
    latestReplyClassification: classification,
    hasPositiveReply: classification != null && POSITIVE_REPLY_CLASSIFICATIONS.has(classification),
  }
}
