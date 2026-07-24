import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import type { GrowthReplyDraft } from "@/lib/growth/replies/reply-draft-types"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { fetchActiveOutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"

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

  const organizationId = lead.promotedOrganizationId?.trim() || getGrowthEngineAiOrgId() || null
  let senderAccountId: string | null = null
  let providerId: string | null = null

  if (organizationId) {
    const affinity = await fetchActiveOutboundSenderAssignment(admin, {
      organizationId,
      leadId: lead.id,
      contactEmail: lead.contactEmail,
    })
    if (affinity) {
      senderAccountId = affinity.senderAccountId
    }
  }

  if (!senderAccountId) {
    const sender = await resolveSequenceExecutionSender(admin, {
      organizationId,
      leadId: lead.id,
      contactEmail: lead.contactEmail,
    })
    if (!sender) {
      const routes = await listDeliveryRoutes(admin)
      const enabledRoute = routes.find((route) => route.enabled)
      if (!enabledRoute) return { error: "no_sender_route" }
      senderAccountId = enabledRoute.sender_account_id
      providerId = enabledRoute.provider_id
    } else {
      senderAccountId = sender.senderAccountId
      providerId = sender.providerId
    }
  }

  if (!senderAccountId) return { error: "no_sender_route" }

  const body = input.draft.draftBody.trim()
  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId,
    subject: input.draft.draftSubject ?? "Re: follow up",
    bodyText: body,
    unsubscribeFooterHtml: UNSUBSCRIBE_FOOTER,
    unsubscribeTextSuffix: "Reply STOP to unsubscribe.",
  })

  let html = prepared.htmlBody
  if (input.deliveryAttemptId && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    html = applyOutboundEmailTracking({ html, deliveryAttemptId: input.deliveryAttemptId }).html ?? html
  }

  return {
    to: lead.contactEmail,
    subject: prepared.subject.slice(0, 500),
    html: html.slice(0, 20000),
    text: prepared.textBody.slice(0, 10000),
    senderAccountId,
    providerId,
  }
}
