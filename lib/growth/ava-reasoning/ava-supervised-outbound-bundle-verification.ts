/**
 * AVA-SUPERVISED-OUTBOUND-1B — Frozen approval bundle verification (server-only).
 */

import "server-only"

import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import {
  fingerprintAvaSupervisedOutboundBody,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import type { AvaSupervisedOutboundApprovalBinding } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"
import type { SupabaseClient } from "@supabase/supabase-js"

export type AvaSupervisedOutboundBundleVerificationResult =
  | { ok: true }
  | { ok: false; code: string; message: string }

function resolveBoundRecipient(binding: AvaSupervisedOutboundApprovalBinding): string {
  return binding.recipientEmail.trim().toLowerCase()
}

export async function verifyAvaSupervisedOutboundApprovalBundle(
  admin: SupabaseClient,
  input: {
    generation: GrowthAiCopilotGeneration
    binding: AvaSupervisedOutboundApprovalBinding
    organizationId: string
  },
): Promise<AvaSupervisedOutboundBundleVerificationResult> {
  if (input.binding.generationId !== input.generation.id) {
    return {
      ok: false,
      code: "approval_binding_generation_mismatch",
      message: "Approval binding does not match this generation.",
    }
  }

  if (input.binding.organizationId && input.binding.organizationId !== input.organizationId) {
    return {
      ok: false,
      code: "approval_binding_organization_mismatch",
      message: "Approval binding organization no longer matches.",
    }
  }

  const subject = input.generation.generatedSubject?.trim() ?? ""
  if (subject !== input.binding.subject) {
    return {
      ok: false,
      code: "approval_subject_stale",
      message: "Approved subject changed after approval. Reapprove before sending.",
    }
  }

  const resolvedSignature = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: input.binding.senderAccountId,
  })

  const unsignedBody = stripAccidentalAvaSignatureFromBody(
    input.generation.generatedContent,
    resolvedSignature.signature?.text ?? null,
  )

  if (unsignedBody !== input.binding.unsignedBody) {
    return {
      ok: false,
      code: "approval_body_stale",
      message: "Approved body changed after approval. Reapprove before sending.",
    }
  }

  const fingerprint = fingerprintAvaSupervisedOutboundBody(unsignedBody)
  if (fingerprint !== input.binding.bodyFingerprint) {
    return {
      ok: false,
      code: "approval_body_fingerprint_mismatch",
      message: "Approved body fingerprint no longer matches the bound approval bundle.",
    }
  }

  if (input.binding.senderAccountId !== resolvedSignature.senderAccountId) {
    return {
      ok: false,
      code: "approval_sender_mismatch",
      message: "Approved sender account no longer matches.",
    }
  }

  if (
    input.binding.signatureProfileId &&
    resolvedSignature.profileId &&
    input.binding.signatureProfileId !== resolvedSignature.profileId
  ) {
    return {
      ok: false,
      code: "approval_signature_profile_stale",
      message: "Approved signature profile changed after approval. Reapprove before sending.",
    }
  }

  if (input.binding.senderAssignmentId) {
    const { fetchActiveOutboundSenderAssignment } = await import(
      "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
    )
    const assignment = await fetchActiveOutboundSenderAssignment(admin, {
      organizationId: input.organizationId,
      leadId: input.generation.leadId,
      contactEmail: input.binding.recipientEmail,
    })
    if (!assignment || assignment.id !== input.binding.senderAssignmentId) {
      return {
        ok: false,
        code: "approval_sender_assignment_stale",
        message: "Sender assignment changed after approval. Reapprove before sending.",
      }
    }
    if (assignment.senderAccountId !== input.binding.senderAccountId) {
      return {
        ok: false,
        code: "approval_sender_assignment_mismatch",
        message: "Approved sender assignment no longer matches.",
      }
    }
  }

  const boundRecipient = resolveBoundRecipient(input.binding)
  const classification = input.generation.classification as Record<string, unknown>
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const email = (recommended as { email?: string }).email?.trim().toLowerCase()
    if (email && email !== boundRecipient) {
      return {
        ok: false,
        code: "approval_recipient_stale",
        message: "Approved recipient changed after approval. Reapprove before sending.",
      }
    }
  }

  return { ok: true }
}

export function detectAvaSupervisedApprovalContentDrift(input: {
  generation: GrowthAiCopilotGeneration
  binding: AvaSupervisedOutboundApprovalBinding
  unsignedBody: string
}): boolean {
  const subject = input.generation.generatedSubject?.trim() ?? ""
  if (subject !== input.binding.subject) return true
  if (input.unsignedBody !== input.binding.unsignedBody) return true

  const classification = input.generation.classification as Record<string, unknown>
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const email = (recommended as { email?: string }).email?.trim().toLowerCase()
    const boundRecipient = input.binding.recipientEmail.trim().toLowerCase()
    if (email && email !== boundRecipient) return true
  }

  return false
}
