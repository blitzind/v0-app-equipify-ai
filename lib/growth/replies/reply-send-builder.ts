import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthReplyDraft } from "@/lib/growth/replies/reply-draft-types"

const UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>'

export type GrowthReplySendPayload = {
  to: string
  subject: string
  html: string
  text: string
  senderAccountId: string
  providerId: string | null
}

export async function buildApprovedReplySendPayload(
  admin: SupabaseClient,
  input: { draft: GrowthReplyDraft; deliveryAttemptId?: string | null },
): Promise<GrowthReplySendPayload | { error: string }> {
  if (input.draft.status !== "approved") return { error: "draft_not_approved" }
  if (!input.draft.leadId) return { error: "missing_lead" }

  const lead = await fetchGrowthLeadById(admin, input.draft.leadId)
  if (!lead?.contactEmail) return { error: "missing_recipient_email" }

  const sender = await resolveSequenceExecutionSender(admin)
  if (!sender) return { error: "no_sender_route" }

  const body = input.draft.draftBody.trim()
  let html = `<div>${body.replace(/\n/g, "<br/>")}</div>${UNSUBSCRIBE_FOOTER}`
  if (input.deliveryAttemptId && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    html = applyOutboundEmailTracking({ html, deliveryAttemptId: input.deliveryAttemptId }).html ?? html
  }

  return {
    to: lead.contactEmail,
    subject: (input.draft.draftSubject ?? "Re: follow up").slice(0, 500),
    html: html.slice(0, 20000),
    text: `${body}\n\nReply STOP to unsubscribe.`.slice(0, 10000),
    senderAccountId: sender.senderAccountId,
    providerId: sender.providerId,
  }
}
