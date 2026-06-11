import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { applyExperimentVariantToSendPayload } from "@/lib/growth/experiments/experiment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { resolveSenderRotationForPool } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { resolveApprovedTemplateContent } from "@/lib/growth/content/dashboard"
import { isApolloEmailPlaceholderContent } from "@/lib/growth/apollo/apollo-sequence-placeholder-guard"
import { getApprovedPersonalizationForJob } from "@/lib/growth/personalization/dashboard"
import type { GrowthSequenceSendPayload } from "@/lib/growth/sequences/execution/sequence-execution-types"

const UNSUBSCRIBE_FOOTER =
  '<p style="font-size:12px;color:#666;margin-top:24px;">{{unsubscribe_link}} — Reply STOP to unsubscribe.</p>'

function sanitizeHtml(value: string): string {
  return value.slice(0, 20000)
}

export async function resolveSequenceExecutionSender(
  admin: SupabaseClient,
  options?: {
    senderPoolId?: string | null
    allowAutoRotation?: boolean
    manualSenderAccountId?: string | null
    sequenceExecutionJobId?: string | null
  },
): Promise<{
  senderAccountId: string
  providerId: string | null
  senderPoolId?: string | null
  allowAutoRotation?: boolean
  manualSenderAccountId?: string | null
  rotationReason?: string | null
  rotationRiskLevel?: string | null
} | null> {
  if (options?.senderPoolId && options.allowAutoRotation !== false) {
    const rotation = await resolveSenderRotationForPool(admin, {
      senderPoolId: options.senderPoolId,
      allowAutoRotation: options.allowAutoRotation,
      manualSenderAccountId: options.manualSenderAccountId,
      sequenceExecutionJobId: options.sequenceExecutionJobId,
    })
    if (rotation.selectedSenderAccountId) {
      return {
        senderAccountId: rotation.selectedSenderAccountId,
        providerId: rotation.selectedProviderId,
        senderPoolId: options.senderPoolId,
        allowAutoRotation: options.allowAutoRotation ?? true,
        manualSenderAccountId: options.manualSenderAccountId ?? null,
        rotationReason: rotation.reason,
        rotationRiskLevel: rotation.riskLevel,
      }
    }
  }

  if (options?.manualSenderAccountId && options.allowAutoRotation === false) {
    return {
      senderAccountId: options.manualSenderAccountId,
      providerId: null,
      senderPoolId: options.senderPoolId ?? null,
      allowAutoRotation: false,
      manualSenderAccountId: options.manualSenderAccountId,
    }
  }

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
    senderPoolId?: string | null
    allowAutoRotation?: boolean
    manualSenderAccountId?: string | null
    sequenceExecutionJobId?: string | null
    contentTemplateVersionId?: string | null
    personalizationGenerationId?: string | null
  },
): Promise<GrowthSequenceSendPayload | { error: string }> {
  const [step, lead] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
  ])
  if (!step) return { error: "step_not_found" }
  if (!lead?.contactEmail) return { error: "missing_recipient_email" }
  if (step.channel !== "email") return { error: "unsupported_channel" }

  const sender = await resolveSequenceExecutionSender(admin, {
    senderPoolId: input.senderPoolId,
    allowAutoRotation: input.allowAutoRotation,
    manualSenderAccountId: input.manualSenderAccountId,
    sequenceExecutionJobId: input.sequenceExecutionJobId,
  })
  if (!sender) return { error: "no_sender_route" }

  let subject = "Follow up"
  let body = step.instructions?.trim() || "Following up on our conversation."
  let contentTemplateVersionId: string | null = input.contentTemplateVersionId ?? null
  let contentTemplateId: string | null = null

  if (input.contentTemplateVersionId) {
    const resolved = await resolveApprovedTemplateContent(admin, {
      templateVersionId: input.contentTemplateVersionId,
      templateType: "sequence_email",
      mergeValues: {
        "lead.contact_name": lead.contactName ?? "[contact]",
        "lead.company_name": lead.companyName ?? "[company]",
        "lead.industry": "[industry]",
      },
    })
    if (!resolved) return { error: "content_template_not_approved" }
    subject = resolved.subject || subject
    body = resolved.body || body
    contentTemplateVersionId = resolved.templateVersionId
    contentTemplateId = resolved.templateId
  }

  if (step.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, step.generationId)
    if (!generation) return { error: "missing_generation" }
    if (generation.status !== "approved") return { error: "generation_not_approved" }
    subject = generation.generatedSubject?.trim() || subject
    body = generation.generatedContent?.trim() || body
  }

  if (step.channel === "email" && isApolloEmailPlaceholderContent({ subject, body })) {
    return { error: step.generationId ? "apollo_email_placeholder_blocked" : "missing_generation" }
  }

  const personalizationGenerationId = input.personalizationGenerationId ?? null
  if (personalizationGenerationId) {
    const personalization = await getApprovedPersonalizationForJob(admin, personalizationGenerationId)
    if (!personalization) return { error: "personalization_not_approved" }
    subject = personalization.subject || subject
    body = personalization.body || body
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
    senderPoolId: sender.senderPoolId ?? input.senderPoolId ?? null,
    allowAutoRotation: sender.allowAutoRotation ?? input.allowAutoRotation ?? true,
    manualSenderAccountId: sender.manualSenderAccountId ?? input.manualSenderAccountId ?? null,
    rotationReason: sender.rotationReason ?? null,
    rotationRiskLevel: sender.rotationRiskLevel ?? null,
    experimentId: experimentOverlay.experimentId,
    experimentVariantId: experimentOverlay.variantId,
    experimentVariantLabel: experimentOverlay.variantLabel,
    contentTemplateVersionId,
    contentTemplateId,
    personalizationGenerationId,
  }
}
