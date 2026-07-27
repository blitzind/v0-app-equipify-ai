/**
 * AVA-BLOCK-IMAGING-APPROVAL-BINDING-HOTFIX-1A — Recommendation vs message approval presentation (client-safe).
 */

import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  isAvaSupervisedOutboundGeneration,
  readAvaSupervisedOutboundApprovalBinding,
  readAvaSupervisedOutboundSendReceipt,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { readAvaSupervisedOutboundSendLifecycle } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"

export const AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER =
  "ava-supervised-outbound-approval-state-core-1a-v1" as const

export type AvaSupervisedOutboundApprovalPresentation = {
  qaMarker: typeof AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER
  supervisedOutbound: boolean
  recommendationApproved: boolean
  recommendationOperatorApproved: boolean
  recommendationStatusLabel: string
  messageApproved: boolean
  messageStatusLabel: string
  sendEligible: boolean
  showApproveEmailAction: boolean
  showSendEmailAction: boolean
  unboundApprovedStatus: boolean
}

function classificationPrimary(generation: GrowthAiCopilotGeneration): string {
  const raw = generation.classification
  if (raw && typeof raw === "object" && typeof (raw as { primary?: string }).primary === "string") {
    return (raw as { primary: string }).primary.trim().toLowerCase()
  }
  return ""
}

export function isRecommendationApprovedForGeneration(generation: GrowthAiCopilotGeneration): boolean {
  const primary = classificationPrimary(generation)
  if (primary === "pursue") return true
  if (primary === "hold" || primary === "reject") return false
  return generation.status !== "discarded" && generation.status !== "expired"
}

export function resolveRecommendationStatusLabel(generation: GrowthAiCopilotGeneration): string {
  const primary = classificationPrimary(generation)
  if (primary === "pursue") return "Recommended"
  if (primary === "hold") return "Needs more information"
  if (primary === "reject") return "Not recommended"
  return "Ready for review"
}

export function hasValidMessageApprovalBindingForGeneration(
  generation: GrowthAiCopilotGeneration,
): boolean {
  const binding = readAvaSupervisedOutboundApprovalBinding(
    generation.classification as Record<string, unknown>,
  )
  return Boolean(binding && binding.generationId === generation.id)
}

export function isUnboundApprovedSupervisedGeneration(
  generation: GrowthAiCopilotGeneration,
): boolean {
  return (
    isAvaSupervisedOutboundGeneration(generation) &&
    generation.status === "approved" &&
    !generation.sentAt &&
    !hasValidMessageApprovalBindingForGeneration(generation)
  )
}

export function resolveAvaSupervisedOutboundApprovalPresentation(
  generation: GrowthAiCopilotGeneration,
): AvaSupervisedOutboundApprovalPresentation {
  const supervisedOutbound = isAvaSupervisedOutboundGeneration(generation)
  if (!supervisedOutbound) {
    const legacyApproved = generation.status === "approved"
    const legacySent = Boolean(generation.sentAt)
    return {
      qaMarker: AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER,
      supervisedOutbound: false,
      recommendationApproved: isRecommendationApprovedForGeneration(generation),
      recommendationOperatorApproved: legacyApproved,
      recommendationStatusLabel: resolveRecommendationStatusLabel(generation),
      messageApproved: legacyApproved,
      messageStatusLabel: legacySent ? "Sent" : legacyApproved ? "Approved" : "Awaiting approval",
      sendEligible: legacyApproved && !legacySent,
      showApproveEmailAction: generation.status === "draft",
      showSendEmailAction: legacyApproved && !legacySent,
      unboundApprovedStatus: false,
    }
  }

  const recommendationApproved = isRecommendationApprovedForGeneration(generation)
  const messageApproved = hasValidMessageApprovalBindingForGeneration(generation)
  const unboundApprovedStatus = isUnboundApprovedSupervisedGeneration(generation)
  const recommendationOperatorApproved = messageApproved || generation.status === "approved"
  const sendReceipt = readAvaSupervisedOutboundSendReceipt(
    generation.classification as Record<string, unknown>,
  )
  const sendLifecycle = readAvaSupervisedOutboundSendLifecycle(
    generation.classification as Record<string, unknown>,
  )
  const isSent = Boolean(generation.sentAt || sendReceipt?.status === "sent")
  const isDeliveryUnknown =
    sendReceipt?.status === "delivery_unknown" || sendLifecycle?.status === "delivery_unknown"

  const messageStatusLabel = isSent
    ? "Sent"
    : isDeliveryUnknown
      ? "Delivery unknown"
      : messageApproved
        ? "Approved"
        : unboundApprovedStatus
          ? "Awaiting message approval"
          : generation.status === "draft"
            ? "Awaiting approval"
            : "Awaiting message approval"

  const sendEligible =
    messageApproved &&
    generation.status === "approved" &&
    !isSent &&
    !isDeliveryUnknown

  return {
    qaMarker: AVA_SUPERVISED_OUTBOUND_APPROVAL_STATE_CORE_QA_MARKER,
    supervisedOutbound: true,
    recommendationApproved,
    recommendationOperatorApproved,
    recommendationStatusLabel: resolveRecommendationStatusLabel(generation),
    messageApproved,
    messageStatusLabel,
    sendEligible,
    showApproveEmailAction:
      generation.status === "draft" || unboundApprovedStatus,
    showSendEmailAction: sendEligible,
    unboundApprovedStatus,
  }
}

export function summarizeSupervisedOperatorWorkspaceHeader(
  generation: GrowthAiCopilotGeneration,
): string {
  const presentation = resolveAvaSupervisedOutboundApprovalPresentation(generation)
  if (!presentation.supervisedOutbound) {
    if (generation.status === "draft") return "1 email ready for review"
    if (generation.status === "approved") return "Recommendation approved"
    return "Prepared outreach"
  }

  if (generation.status === "draft") return "1 email ready for review"
  if (presentation.sendEligible) return "Email approved — ready to send"
  if (presentation.unboundApprovedStatus) return "Recommendation approved — email awaiting approval"
  if (presentation.messageApproved) return "Email approved — ready to send"
  return "Prepared outreach ready for review"
}
