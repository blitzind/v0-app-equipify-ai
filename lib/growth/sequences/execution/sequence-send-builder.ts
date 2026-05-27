import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { applyExperimentVariantToSendPayload } from "@/lib/growth/experiments/experiment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import type { GrowthSequenceSendPayload } from "@/lib/growth/sequences/execution/sequence-execution-types"

const UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>'

function sanitizeHtml(value: string): string {
  return value.slice(0, 20000)
}

export async function resolveSequenceExecutionSender(
  admin: SupabaseClient,
): Promise<{ senderAccountId: string; providerId: string | null } | null> {
  const [routes, senders] = await Promise.all([listDeliveryRoutes(admin), listSenderAccounts(admin)])
  const enabledRoute = routes.find((route) => route.enabled)
  if (enabledRoute) {
    return { senderAccountId: enabledRoute.sender_account_id, providerId: enabledRoute.provider_id }
  }
  const sender = senders.find((row) => row.status === "connected" || row.status === "warming")
  if (!sender) return null
  return { senderAccountId: sender.id, providerId: null }
}

export async function buildSequenceExecutionSendPayload(
  admin: SupabaseClient,
  input: {
    sequenceStepId: string
    leadId: string
    deliveryAttemptId?: string | null
    sequenceEnrollmentId?: string | null
  },
): Promise<GrowthSequenceSendPayload | { error: string }> {
  const [step, lead] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
  ])
  if (!step) return { error: "step_not_found" }
  if (!lead?.contactEmail) return { error: "missing_recipient_email" }
  if (step.channel !== "email") return { error: "unsupported_channel" }

  const sender = await resolveSequenceExecutionSender(admin)
  if (!sender) return { error: "no_sender_route" }

  let subject = "Follow up"
  let body = step.instructions?.trim() || "Following up on our conversation."

  if (step.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, step.generationId)
    if (!generation) return { error: "missing_generation" }
    if (generation.status !== "approved") return { error: "generation_not_approved" }
    subject = generation.generatedSubject?.trim() || subject
    body = generation.generatedContent?.trim() || body
  }

  const experimentOverlay = await applyExperimentVariantToSendPayload(admin, {
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
    sequenceStepId: input.sequenceStepId,
    subject,
    body,
    senderAccountId: sender.senderAccountId,
    providerId: sender.providerId,
  })

  subject = experimentOverlay.subject
  body = experimentOverlay.body
  sender.senderAccountId = experimentOverlay.senderAccountId
  sender.providerId = experimentOverlay.providerId

  let html = sanitizeHtml(`<div>${body.replace(/\n/g, "<br/>")}</div>${UNSUBSCRIBE_FOOTER}`)
  if (input.deliveryAttemptId && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    html = applyOutboundEmailTracking({
      html,
      deliveryAttemptId: input.deliveryAttemptId,
    }).html ?? html
  }

  const text = `${body}\n\nReply STOP to unsubscribe.`

  return {
    to: lead.contactEmail,
    subject: subject.slice(0, 500),
    html,
    text: text.slice(0, 10000),
    senderAccountId: sender.senderAccountId,
    providerId: sender.providerId,
    experimentId: experimentOverlay.experimentId,
    experimentVariantId: experimentOverlay.variantId,
    experimentVariantLabel: experimentOverlay.variantLabel,
  }
}
