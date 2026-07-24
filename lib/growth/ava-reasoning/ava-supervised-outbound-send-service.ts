/**
 * AVA-SUPERVISED-OUTBOUND-1A/1B — Explicit supervised send for approved Ava drafts (server-only).
 */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { assertPreSendSuppressionAllowed } from "@/lib/growth/compliance/suppression-engine"
import { enforceGovernanceIfReady } from "@/lib/growth/governance/governance-enforcement"
import { executeTransportSend } from "@/lib/growth/providers/transport/transport-orchestrator"
import { emitGrowthLeadOutreachExecutedTimeline } from "@/lib/growth/timeline-emitter"
import {
  AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
  isAvaSupervisedOutboundGeneration,
  readAvaSupervisedOutboundApprovalBinding,
  readAvaSupervisedOutboundSendReceipt,
  type AvaSupervisedOutboundSendReceipt,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { assertAvaSupervisedOutboundSendAuthorized } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-authorization"
import { verifyAvaSupervisedOutboundApprovalBundle } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-bundle-verification"
import { AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import {
  claimAvaSupervisedOutboundSend,
  finalizeAvaSupervisedOutboundSendClaim,
  releaseAvaSupervisedOutboundSendClaim,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-send-claim"
import { touchOutboundSenderAssignmentLastUsed } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"

export type SendApprovedAvaSupervisedGenerationResult =
  | { ok: true; generation: GrowthAiCopilotGeneration; receipt: AvaSupervisedOutboundSendReceipt }
  | { ok: false; code: string; message: string; generation?: GrowthAiCopilotGeneration | null }

function buildReceipt(input: {
  generationId: string
  deliveryAttemptId: string
  providerMessageId: string | null
  senderAccountId: string
  recipientEmail: string
  subject: string
  bodyFingerprint: string
  signatureProfileId: string | null
  signatureResolutionSource: string | null
  signatureInjected: boolean
  sentAt: string
  status: AvaSupervisedOutboundSendReceipt["status"]
  errorCode?: string | null
  errorMessage?: string | null
}): AvaSupervisedOutboundSendReceipt {
  return {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
    generationId: input.generationId,
    deliveryAttemptId: input.deliveryAttemptId,
    providerMessageId: input.providerMessageId,
    senderAccountId: input.senderAccountId,
    recipientEmail: input.recipientEmail,
    subject: input.subject,
    bodyFingerprint: input.bodyFingerprint,
    signatureProfileId: input.signatureProfileId,
    signatureResolutionSource: input.signatureResolutionSource,
    signatureInjected: input.signatureInjected,
    sentAt: input.sentAt,
    status: input.status,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
  }
}

function buildSentClassification(input: {
  generation: GrowthAiCopilotGeneration
  receipt: AvaSupervisedOutboundSendReceipt
  sendAttemptId: string
  actingUserId: string
}) {
  return {
    ...(input.generation.classification as Record<string, unknown>),
    avaSupervisedOutboundSendReceipt: input.receipt,
    avaSupervisedOutboundSendLifecycle: {
      qaMarker: AVA_SUPERVISED_OUTBOUND_1B_QA_MARKER,
      status: "sent",
      claimedAt:
        (
          (input.generation.classification as Record<string, unknown>)
            .avaSupervisedOutboundSendLifecycle as { claimedAt?: string } | undefined
        )?.claimedAt ?? input.receipt.sentAt,
      claimedBy: input.actingUserId,
      sendAttemptId: input.sendAttemptId,
      completedAt: input.receipt.sentAt,
    },
  }
}

export async function sendApprovedAvaSupervisedGeneration(
  admin: SupabaseClient,
  input: {
    generationId: string
    actingUserId: string
    actingUserEmail: string
    actorOrganizationId?: string | null
    isPlatformAdmin?: boolean
    humanApproved?: boolean
    humanApprovalConfirmed?: boolean
  },
): Promise<SendApprovedAvaSupervisedGenerationResult> {
  let generation = await fetchGrowthAiCopilotGenerationById(admin, input.generationId)
  if (!generation) {
    return { ok: false, code: "not_found", message: "Generation not found.", generation: null }
  }

  if (!isAvaSupervisedOutboundGeneration(generation)) {
    return {
      ok: false,
      code: "not_ava_supervised_generation",
      message: "This send path is limited to supervised Ava direct drafts.",
      generation,
    }
  }

  const authorization = await assertAvaSupervisedOutboundSendAuthorized(admin, {
    generation,
    actorOrganizationId: input.actorOrganizationId ?? null,
    isPlatformAdmin: input.isPlatformAdmin ?? false,
  })
  if (!authorization.ok) {
    return { ok: false, code: authorization.code, message: authorization.message, generation }
  }

  const existingReceipt = readAvaSupervisedOutboundSendReceipt(
    generation.classification as Record<string, unknown>,
  )
  if (generation.sentAt && existingReceipt?.status === "sent") {
    return { ok: true, generation, receipt: existingReceipt }
  }

  if (existingReceipt?.status === "delivery_unknown") {
    return {
      ok: false,
      code: "delivery_unknown_requires_reconciliation",
      message: "Outbound delivery is ambiguous and requires operator reconciliation before retry.",
      generation,
    }
  }

  const binding = readAvaSupervisedOutboundApprovalBinding(
    generation.classification as Record<string, unknown>,
  )
  if (!binding || binding.generationId !== generation.id) {
    return {
      ok: false,
      code: "approval_binding_missing",
      message: "Approved send assets are not bound to this generation.",
      generation,
    }
  }

  const bundle = await verifyAvaSupervisedOutboundApprovalBundle(admin, {
    generation,
    binding,
    organizationId: authorization.organizationId,
  })
  if (!bundle.ok) {
    return { ok: false, code: bundle.code, message: bundle.message, generation }
  }

  if (generation.status !== "approved") {
    return {
      ok: false,
      code: "generation_not_approved",
      message: "Approve the draft before sending.",
      generation,
    }
  }

  const humanApproved = input.humanApproved ?? true
  const humanApprovalConfirmed = input.humanApprovalConfirmed ?? true
  if (!humanApproved || !humanApprovalConfirmed) {
    return {
      ok: false,
      code: "explicit_send_required",
      message: "Explicit operator send confirmation is required.",
      generation,
    }
  }

  const sendAttemptId = randomUUID()
  const claim = await claimAvaSupervisedOutboundSend(admin, {
    generationId: generation.id,
    actingUserId: input.actingUserId,
    sendAttemptId,
  })

  if (!claim.ok) {
    if (claim.code === "already_sent") {
      const latest = await fetchGrowthAiCopilotGenerationById(admin, generation.id)
      const receipt = latest
        ? readAvaSupervisedOutboundSendReceipt(latest.classification as Record<string, unknown>)
        : null
      if (latest && receipt?.status === "sent") {
        return { ok: true, generation: latest, receipt }
      }
    }
    return {
      ok: false,
      code: claim.code,
      message:
        claim.code === "send_in_progress"
          ? "Another send is already in progress for this generation."
          : claim.code === "delivery_unknown_requires_reconciliation"
            ? "Outbound delivery is ambiguous and requires operator reconciliation before retry."
            : "Could not claim this generation for send.",
      generation,
    }
  }

  generation = claim.generation

  await enforceGovernanceIfReady(admin, {
    action: "provider_send",
    actorUserId: input.actingUserId,
    actorEmail: input.actingUserEmail,
    sourceRoute: "ava_supervised_outbound.send",
    entityType: "ai_copilot_generation",
    entityId: generation.id,
    recipientEmail: binding.recipientEmail,
    humanApprovalConfirmed: true,
    approvalReason: "Human confirmed supervised Ava outbound send.",
  })

  const suppression = await assertPreSendSuppressionAllowed(admin, {
    email: binding.recipientEmail,
    leadId: generation.leadId,
    senderAccountId: binding.senderAccountId,
  })
  if (!suppression.allowed) {
    const receipt = buildReceipt({
      generationId: generation.id,
      deliveryAttemptId: "",
      providerMessageId: null,
      senderAccountId: binding.senderAccountId,
      recipientEmail: binding.recipientEmail,
      subject: binding.subject,
      bodyFingerprint: binding.bodyFingerprint,
      signatureProfileId: binding.signatureProfileId,
      signatureResolutionSource: binding.signatureResolutionSource,
      signatureInjected: false,
      sentAt: new Date().toISOString(),
      status: "failed",
      errorCode: suppression.reason ?? "suppression_blocked",
      errorMessage: "Recipient is blocked by suppression rules.",
    })
    await releaseAvaSupervisedOutboundSendClaim(admin, {
      generation,
      sendAttemptId,
      actingUserId: input.actingUserId,
      lifecycleStatus: "failed",
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      receipt,
    })
    return {
      ok: false,
      code: suppression.reason ?? "suppression_blocked",
      message: "Recipient is blocked by suppression rules.",
      generation,
    }
  }

  let prepared
  try {
    prepared = await prepareAvaSupervisedOutboundTransportEmail(admin, {
      senderAccountId: binding.senderAccountId,
      subject: binding.subject,
      unsignedBody: binding.unsignedBody,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const receipt = buildReceipt({
      generationId: generation.id,
      deliveryAttemptId: "",
      providerMessageId: null,
      senderAccountId: binding.senderAccountId,
      recipientEmail: binding.recipientEmail,
      subject: binding.subject,
      bodyFingerprint: binding.bodyFingerprint,
      signatureProfileId: binding.signatureProfileId,
      signatureResolutionSource: binding.signatureResolutionSource,
      signatureInjected: false,
      sentAt: new Date().toISOString(),
      status: "failed",
      errorCode: message,
      errorMessage: "Could not prepare outbound content with a single signature boundary.",
    })
    await releaseAvaSupervisedOutboundSendClaim(admin, {
      generation,
      sendAttemptId,
      actingUserId: input.actingUserId,
      lifecycleStatus: "failed",
      errorCode: message,
      errorMessage: receipt.errorMessage,
      receipt,
    })
    return {
      ok: false,
      code: message,
      message: receipt.errorMessage ?? message,
      generation,
    }
  }

  if (prepared.bodyFingerprint !== binding.bodyFingerprint) {
    const receipt = buildReceipt({
      generationId: generation.id,
      deliveryAttemptId: "",
      providerMessageId: null,
      senderAccountId: binding.senderAccountId,
      recipientEmail: binding.recipientEmail,
      subject: binding.subject,
      bodyFingerprint: binding.bodyFingerprint,
      signatureProfileId: binding.signatureProfileId,
      signatureResolutionSource: binding.signatureResolutionSource,
      signatureInjected: prepared.signatureInjected,
      sentAt: new Date().toISOString(),
      status: "failed",
      errorCode: "approved_body_mismatch",
      errorMessage: "Approved body no longer matches the bound approval fingerprint.",
    })
    await releaseAvaSupervisedOutboundSendClaim(admin, {
      generation,
      sendAttemptId,
      actingUserId: input.actingUserId,
      lifecycleStatus: "failed",
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      receipt,
    })
    return {
      ok: false,
      code: "approved_body_mismatch",
      message: receipt.errorMessage ?? "Approved body mismatch.",
      generation,
    }
  }

  const transport = await executeTransportSend(admin, {
    sender_account_id: binding.senderAccountId,
    to: binding.recipientEmail,
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
    lead_id: generation.leadId,
    human_approved: true,
    human_approval_confirmed: true,
    actorUserId: input.actingUserId,
    actorEmail: input.actingUserEmail,
    metadata: {
      governance_audit_recorded: true,
      ai_copilot_generation_id: generation.id,
      ava_supervised_outbound_qa_marker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
      ava_supervised_outbound_send_attempt_id: sendAttemptId,
      body_fingerprint: prepared.bodyFingerprint,
      signature_profile_id: prepared.signatureProfileId,
    },
  })

  const sentAt = new Date().toISOString()
  const deliveryAttemptId = transport.attempt?.id ?? ""
  const providerMessageId = transport.attempt?.provider_message_id ?? null
  const providerMaybeAccepted = Boolean(transport.ok && providerMessageId)

  if (!transport.ok || !deliveryAttemptId) {
    const receipt = buildReceipt({
      generationId: generation.id,
      deliveryAttemptId,
      providerMessageId,
      senderAccountId: binding.senderAccountId,
      recipientEmail: binding.recipientEmail,
      subject: prepared.subject,
      bodyFingerprint: prepared.bodyFingerprint,
      signatureProfileId: prepared.signatureProfileId,
      signatureResolutionSource: prepared.signatureResolutionSource,
      signatureInjected: prepared.signatureInjected,
      sentAt,
      status: "failed",
      errorCode: transport.error ?? "transport_failed",
      errorMessage: transport.error ?? "Transport send failed.",
    })
    await releaseAvaSupervisedOutboundSendClaim(admin, {
      generation,
      sendAttemptId,
      actingUserId: input.actingUserId,
      lifecycleStatus: "failed",
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
      receipt,
    })
    return {
      ok: false,
      code: receipt.errorCode ?? "transport_failed",
      message: receipt.errorMessage ?? "Transport send failed.",
      generation,
    }
  }

  const receipt = buildReceipt({
    generationId: generation.id,
    deliveryAttemptId,
    providerMessageId,
    senderAccountId: binding.senderAccountId,
    recipientEmail: binding.recipientEmail,
    subject: prepared.subject,
    bodyFingerprint: prepared.bodyFingerprint,
    signatureProfileId: prepared.signatureProfileId,
    signatureResolutionSource: prepared.signatureResolutionSource,
    signatureInjected: prepared.signatureInjected,
    sentAt,
    status: "sent",
  })

  const finalized = await finalizeAvaSupervisedOutboundSendClaim(admin, {
    generationId: generation.id,
    sendAttemptId,
    sentAt,
    generatedContent: binding.unsignedBody,
    classification: buildSentClassification({
      generation,
      receipt,
      sendAttemptId,
      actingUserId: input.actingUserId,
    }),
  })

  if (!finalized) {
    const ambiguousReceipt = buildReceipt({
      ...receipt,
      status: "delivery_unknown",
      errorCode: "delivery_unknown_persist_failed",
      errorMessage:
        "Provider may have accepted the message, but the send receipt could not be persisted. Reconcile before retrying.",
    })
    await releaseAvaSupervisedOutboundSendClaim(admin, {
      generation,
      sendAttemptId,
      actingUserId: input.actingUserId,
      lifecycleStatus: "delivery_unknown",
      errorCode: ambiguousReceipt.errorCode,
      errorMessage: ambiguousReceipt.errorMessage,
      receipt: ambiguousReceipt,
    })
    return {
      ok: false,
      code: "delivery_unknown_persist_failed",
      message: ambiguousReceipt.errorMessage ?? "Delivery unknown — reconciliation required.",
      generation,
    }
  }

  if (providerMaybeAccepted === false) {
    return {
      ok: false,
      code: "transport_receipt_incomplete",
      message: "Transport completed without a provider message id.",
      generation: finalized,
    }
  }

  await emitGrowthLeadOutreachExecutedTimeline(admin, {
    leadId: finalized.leadId,
    queueId: generation.id,
    channel: "email",
    summary: prepared.subject,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  }).catch(() => undefined)

  if (binding.senderAssignmentId) {
    await touchOutboundSenderAssignmentLastUsed(admin, binding.senderAssignmentId).catch(() => undefined)
  }

  return { ok: true, generation: finalized, receipt }
}
