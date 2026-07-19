import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { applyOutboundEmailTracking } from "@/lib/growth/tracking/tracking-links"
import { applyExperimentVariantToSendPayload } from "@/lib/growth/experiments/experiment-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { resolveSenderRotationForPool } from "@/lib/growth/sender-pools/sender-pool-rotation-service"
import { listDeliveryRoutes } from "@/lib/growth/providers/provider-repository"
import { listSenderAccounts } from "@/lib/growth/sender/sender-repository"
import { isApolloEmailPlaceholderContent } from "@/lib/growth/apollo/apollo-sequence-placeholder-guard"
import type { GrowthSequenceSendPayload } from "@/lib/growth/sequences/execution/sequence-execution-types"
import {
  applySendrPageUrlMergeFields,
  resolvePreferredSenderAccountFromSendrLink,
  resolveSendrPageUrlForSequenceStep,
} from "@/lib/growth/sendr/growth-sendr-sequence-bridge-service"
import { fetchGrowthSequenceEnrollmentById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  applySequenceVideoAttachmentToEmailHtml,
  wireApprovedSequenceVideoAttachment,
} from "@/lib/growth/sequences/growth-sequence-video-send-builder-service"
import { prepareOutboundEmailContent } from "@/lib/growth/signatures/outbound-signature-runtime"
import { resolveTransportAuthority } from "@/lib/growth/sequences/execution/growth-transport-authority-1c"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"

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
    organizationId?: string | null
  },
): Promise<GrowthSequenceSendPayload | { error: string }> {
  const [step, lead, job] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
    input.sequenceExecutionJobId
      ? getSequenceExecutionJob(admin, input.sequenceExecutionJobId)
      : Promise.resolve(null),
  ])
  if (!step) return { error: "step_not_found" }
  if (!lead?.contactEmail) return { error: "missing_recipient_email" }
  if (step.channel !== "email") return { error: "unsupported_channel" }

  const organizationId =
    input.organizationId?.trim() ||
    lead.promotedOrganizationId?.trim() ||
    getGrowthEngineAiOrgId() ||
    null

  const authority = await resolveTransportAuthority(admin, {
    sequenceStepId: input.sequenceStepId,
    leadId: input.leadId,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    organizationId,
    contentTemplateVersionId: input.contentTemplateVersionId ?? null,
    personalizationGenerationId: input.personalizationGenerationId ?? null,
  })
  if ("error" in authority) return { error: authority.error }

  let subject = authority.subject
  let body = authority.bodyText

  if (step.channel === "email" && isApolloEmailPlaceholderContent({ subject, body })) {
    return {
      error:
        authority.source === "frozen_snapshot"
          ? "approved_transport_asset_invalid"
          : step.generationId
            ? "apollo_email_placeholder_blocked"
            : "missing_generation",
    }
  }

  let resolvedSender = await resolveSequenceExecutionSender(admin, {
    senderPoolId: input.senderPoolId ?? job?.senderPoolId ?? null,
    allowAutoRotation: authority.allowAutoRotation,
    manualSenderAccountId: authority.manualSenderAccountId ?? input.manualSenderAccountId ?? null,
    sequenceExecutionJobId: input.sequenceExecutionJobId,
  })
  if (!resolvedSender) return { error: "no_sender_route" }

  if (
    authority.source === "frozen_snapshot" &&
    resolvedSender.senderAccountId !== authority.senderAccountId
  ) {
    return { error: "approved_sender_substitution_blocked" }
  }

  let experimentOverlay = {
    subject,
    body,
    senderAccountId: resolvedSender.senderAccountId,
    providerId: resolvedSender.providerId,
    experimentId: null as string | null,
    variantId: null as string | null,
    variantLabel: null as string | null,
  }

  if (authority.source === "legacy_generation") {
    experimentOverlay = await applyExperimentVariantToSendPayload(admin, {
      leadId: input.leadId,
      sequenceEnrollmentId: input.sequenceEnrollmentId,
      sequenceStepId: input.sequenceStepId,
      subject,
      body,
      senderAccountId: resolvedSender.senderAccountId,
      providerId: resolvedSender.providerId,
    })
  }

  subject = experimentOverlay.subject
  body = experimentOverlay.body
  resolvedSender.senderAccountId = experimentOverlay.senderAccountId
  resolvedSender.providerId = experimentOverlay.providerId

  if (lead.promotedOrganizationId && authority.source === "legacy_generation") {
    const sendrPageUrl = await resolveSendrPageUrlForSequenceStep(admin, {
      organizationId: lead.promotedOrganizationId,
      sequencePatternStepId: step.sequencePatternStepId,
      leadId: input.leadId,
    })
    if (sendrPageUrl) {
      subject = applySendrPageUrlMergeFields(subject, sendrPageUrl)
      body = applySendrPageUrlMergeFields(body, sendrPageUrl)
    }
  }

  const prepared = await prepareOutboundEmailContent(admin, {
    senderAccountId: resolvedSender.senderAccountId,
    subject,
    bodyText: body,
    unsubscribeFooterHtml: UNSUBSCRIBE_FOOTER,
    unsubscribeTextSuffix: "Reply STOP to unsubscribe.",
  })

  subject = prepared.subject
  body = prepared.bodyText
  let html = sanitizeHtml(prepared.htmlBody)
  if (input.deliveryAttemptId && process.env.GROWTH_TRACKING_DISABLED?.trim() !== "true") {
    html = applyOutboundEmailTracking({
      html,
      deliveryAttemptId: input.deliveryAttemptId,
    }).html ?? html
  }

  const videoWire = await wireApprovedSequenceVideoAttachment(admin, {
    organizationId: lead.promotedOrganizationId,
    sequencePatternStepId: step.sequencePatternStepId,
    channel: "email",
    leadId: lead.id,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
    enrollmentStepId: step.id,
  })
  if (videoWire) {
    html = applySequenceVideoAttachmentToEmailHtml(html, videoWire)
  }

  const text = prepared.textBody.slice(0, 10000)

  return {
    to: lead.contactEmail,
    subject: subject.slice(0, 500),
    html,
    text,
    senderAccountId: resolvedSender.senderAccountId,
    providerId: resolvedSender.providerId,
    senderPoolId: resolvedSender.senderPoolId ?? input.senderPoolId ?? null,
    allowAutoRotation: resolvedSender.allowAutoRotation ?? authority.allowAutoRotation,
    manualSenderAccountId:
      resolvedSender.manualSenderAccountId ??
      authority.manualSenderAccountId ??
      input.manualSenderAccountId ??
      null,
    rotationReason: resolvedSender.rotationReason ?? null,
    rotationRiskLevel: resolvedSender.rotationRiskLevel ?? null,
    experimentId: experimentOverlay.experimentId,
    experimentVariantId: experimentOverlay.variantId,
    experimentVariantLabel: experimentOverlay.variantLabel,
    contentTemplateVersionId: input.contentTemplateVersionId ?? null,
    contentTemplateId: null,
    personalizationGenerationId: input.personalizationGenerationId ?? null,
    sequenceVideoAttachment: videoWire?.attribution ?? null,
    transportAuthoritySource: authority.source,
    transportContentHash: authority.contentHash || null,
    transportSnapshotId: authority.transportSnapshotId,
    outreachPackageId: authority.outreachPackageId,
  }
}
