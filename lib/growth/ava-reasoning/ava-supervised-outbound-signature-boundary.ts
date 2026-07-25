/**
 * AVA-SUPERVISED-OUTBOUND-1A — Transport-time signature boundary (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { prepareGrowthAiCopilotOutboundEmailContent } from "@/lib/growth/run-ai-copilot-generation"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"
import { outboundBodyContainsSignature } from "@/lib/growth/signatures/signature-injection"
import {
  countHtmlSignatureMarkers,
  countPlaintextSignatureSeparators,
  fingerprintAvaSupervisedOutboundBody,
  outboundUnsignedBodyRequiresReapproval,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"

export class AvaSupervisedOutboundTransportPrepError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "AvaSupervisedOutboundTransportPrepError"
    this.code = code
  }
}

export async function prepareAvaSupervisedOutboundTransportEmail(
  admin: SupabaseClient,
  input: {
    senderAccountId: string
    subject: string
    unsignedBody: string
    deliveryAttemptId?: string | null
  },
): Promise<{
  subject: string
  html: string
  text: string
  unsignedBody: string
  bodyFingerprint: string
  signatureInjected: boolean
  signatureProfileId: string | null
  signatureResolutionSource: string | null
}> {
  const resolved = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: input.senderAccountId,
  })

  if (!resolved.signature?.html?.trim() && !resolved.signature?.text?.trim()) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "signature_profile_missing",
      "Approved sender has no active outbound signature profile.",
    )
  }

  if (
    outboundUnsignedBodyRequiresReapproval({
      approvedUnsignedBody: input.unsignedBody,
      canonicalSignatureText: resolved.signature?.text ?? null,
    })
  ) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "stale_approval_signature_normalization_required",
      "Approved body still contains a legacy signature block. Reapprove the draft before sending.",
    )
  }

  const sanitizedBody = stripAccidentalAvaSignatureFromBody(
    input.unsignedBody,
    resolved.signature?.text ?? null,
  )
  const bodyFingerprint = fingerprintAvaSupervisedOutboundBody(sanitizedBody)

  const plaintextBoundariesBeforeAppend = countPlaintextSignatureSeparators(sanitizedBody)
  if (plaintextBoundariesBeforeAppend > 0) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "plaintext_signature_boundary_count_invalid",
      "Unsigned outbound body still contains a signature separator.",
    )
  }

  const prepared = await prepareGrowthAiCopilotOutboundEmailContent(admin, {
    senderAccountId: input.senderAccountId,
    subject: input.subject,
    body: sanitizedBody,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
  })

  const signatureSeparators = countPlaintextSignatureSeparators(prepared.text)
  const htmlSignatureMarkers = countHtmlSignatureMarkers(prepared.html)

  if (signatureSeparators > 1) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "plaintext_signature_boundary_count_invalid",
      "Prepared outbound body has more than one plaintext signature boundary.",
    )
  }

  if (prepared.signatureInjected && signatureSeparators !== 1) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "plaintext_signature_boundary_count_invalid",
      "Prepared outbound body is missing the canonical plaintext signature boundary.",
    )
  }

  if (prepared.signatureInjected && htmlSignatureMarkers !== 1) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "html_signature_marker_count_invalid",
      "Prepared outbound HTML is missing the canonical signature marker.",
    )
  }

  if (
    prepared.signatureInjected &&
    !outboundBodyContainsSignature(prepared.html, prepared.text)
  ) {
    throw new AvaSupervisedOutboundTransportPrepError(
      "html_signature_marker_count_invalid",
      "Prepared outbound HTML signature marker validation failed.",
    )
  }

  return {
    subject: prepared.subject,
    html: prepared.html,
    text: prepared.text,
    unsignedBody: sanitizedBody,
    bodyFingerprint,
    signatureInjected: prepared.signatureInjected,
    signatureProfileId: resolved.profileId,
    signatureResolutionSource: resolved.resolutionSource,
  }
}

export { stripAccidentalAvaSignatureFromBody, fingerprintAvaSupervisedOutboundBody }
