/**
 * AVA-SUPERVISED-OUTBOUND-1A — Transport-time signature boundary (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { prepareGrowthAiCopilotOutboundEmailContent } from "@/lib/growth/run-ai-copilot-generation"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"
import { outboundBodyContainsSignature } from "@/lib/growth/signatures/signature-injection"
import {
  countPlaintextSignatureSeparators,
  fingerprintAvaSupervisedOutboundBody,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"

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

  const sanitizedBody = stripAccidentalAvaSignatureFromBody(
    input.unsignedBody,
    resolved.signature?.text ?? null,
  )
  const bodyFingerprint = fingerprintAvaSupervisedOutboundBody(sanitizedBody)

  const prepared = await prepareGrowthAiCopilotOutboundEmailContent(admin, {
    senderAccountId: input.senderAccountId,
    subject: input.subject,
    body: sanitizedBody,
    deliveryAttemptId: input.deliveryAttemptId ?? null,
  })

  const signatureSeparators = countPlaintextSignatureSeparators(prepared.text)
  if (signatureSeparators > 1) {
    throw new Error("duplicate_signature_boundary_violation")
  }

  if (
    prepared.signatureInjected &&
    !outboundBodyContainsSignature(prepared.html, prepared.text)
  ) {
    throw new Error("signature_marker_missing_after_injection")
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
