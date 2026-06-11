import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import { fetchGrowthLeadDecisionMakerById } from "@/lib/growth/decision-maker-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import type { GrowthOutboundReply } from "@/lib/growth/outbound/types"
import { classifyReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-classifier"
import {
  leadHasCallablePhone,
  processReplyIntelligence,
} from "@/lib/growth/reply-intelligence/process-reply-intelligence"
import { emitGrowthLeadStatusChangedTimeline } from "@/lib/growth/timeline-emitter"
import type { GrowthLeadStatus } from "@/lib/growth/types"
import { maybeBridgeApolloPipelineToMeetingIntelligenceForLead } from "@/lib/growth/apollo/apollo-meeting-bridge"

async function resolveDmPhone(
  admin: SupabaseClient,
  leadId: string,
  decisionMakerId: string | null,
): Promise<string | null> {
  if (!decisionMakerId) return null
  const dm = await fetchGrowthLeadDecisionMakerById(admin, leadId, decisionMakerId)
  return dm?.phone ?? null
}

async function resolveLastOutboundSentAt(
  admin: SupabaseClient,
  input: { leadId: string; deliveryAttemptId?: string | null; messageId?: string | null },
): Promise<string | null> {
  if (input.deliveryAttemptId) {
    const { data } = await admin
      .schema("growth")
      .from("delivery_attempts")
      .select("sent_at, created_at")
      .eq("id", input.deliveryAttemptId)
      .maybeSingle()
    const row = data as { sent_at?: string; created_at?: string } | null
    return row?.sent_at ?? row?.created_at ?? null
  }

  if (input.messageId) {
    const { data } = await admin
      .schema("growth")
      .from("outbound_messages")
      .select("sent_at")
      .eq("id", input.messageId)
      .maybeSingle()
    return (data as { sent_at?: string } | null)?.sent_at ?? null
  }

  const { data } = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("sent_at")
    .eq("lead_id", input.leadId)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data as { sent_at?: string } | null)?.sent_at ?? null
}

async function updateGrowthLeadStatusForReply(
  admin: SupabaseClient,
  input: { leadId: string; bodyPreview: string | null | undefined },
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return

  let nextStatus: GrowthLeadStatus | null = null

  if (!["replied", "call_ready"].includes(lead.status)) {
    nextStatus = "replied"
  }

  const dmPhone = await resolveDmPhone(admin, lead.id, lead.primaryDecisionMakerId)
  const classified = classifyReplyIntent(input.bodyPreview)
  if (classified.classification === "interested" && leadHasCallablePhone(lead, dmPhone)) {
    nextStatus = "call_ready"
  }

  if (nextStatus && nextStatus !== lead.status) {
    await updateGrowthLead(admin, input.leadId, { status: nextStatus })
    await emitGrowthLeadStatusChangedTimeline(admin, {
      leadId: input.leadId,
      from: lead.status,
      to: nextStatus,
    })
  }
}

/** Shared post-ingestion bridge: webhook and inbox-sync reply paths. */
export async function finalizeIngestedReplyIntelligence(
  admin: SupabaseClient,
  input: {
    leadId: string
    outboundReply: GrowthOutboundReply
    bodyPreview: string | null | undefined
    senderEmail?: string | null
    sequenceEnrollmentId?: string | null
    campaignId?: string | null
    ingestionEventId?: string | null
    deliveryAttemptId?: string | null
  },
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return

  await updateGrowthLeadStatusForReply(admin, {
    leadId: input.leadId,
    bodyPreview: input.bodyPreview,
  })

  const refreshedLead = (await fetchGrowthLeadById(admin, input.leadId)) ?? lead
  const dmPhone = await resolveDmPhone(admin, refreshedLead.id, refreshedLead.primaryDecisionMakerId)
  const lastOutboundSentAt = await resolveLastOutboundSentAt(admin, {
    leadId: input.leadId,
    deliveryAttemptId: input.deliveryAttemptId,
    messageId: input.outboundReply.messageId,
  })

  await processReplyIntelligence(admin, {
    reply: input.outboundReply,
    lead: refreshedLead,
    bodyPreview: input.bodyPreview,
    lastOutboundSentAt,
    hasCallablePhone: leadHasCallablePhone(refreshedLead, dmPhone),
    senderEmail: input.senderEmail,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    campaignId: input.campaignId,
    ingestionEventId: input.ingestionEventId,
  })

  await recomputeGrowthLeadWorkflowSignals(admin, input.leadId)

  await maybeBridgeApolloPipelineToMeetingIntelligenceForLead(admin, {
    lead_id: input.leadId,
    outbound_reply_id: input.outboundReply.id,
  })
}
