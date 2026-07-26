/**
 * AVA-SUPERVISED-OUTBOUND-1A — Approval binding for supervised Ava drafts (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthAiCopilotGeneration } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { resolveAvaSupervisedOutboundSenderBundle } from "@/lib/growth/outbound-sender-affinity/ava-supervised-outbound-sender-resolution"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import {
  AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
  isAvaSupervisedOutboundGeneration,
  type AvaSupervisedOutboundApprovalBinding,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  fingerprintAvaSupervisedOutboundBody,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"

function classificationRecord(generation: GrowthAiCopilotGeneration): Record<string, unknown> {
  const raw = generation.classification
  if (raw && typeof raw === "object") return { ...(raw as Record<string, unknown>) }
  return {}
}

function resolveApprovedRecipient(generation: GrowthAiCopilotGeneration, leadEmail: string | null): string | null {
  const classification = classificationRecord(generation)
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const email = (recommended as { email?: string }).email?.trim()
    if (email) return email
  }

  const snapshot = generation.inputSnapshot ?? {}
  const contacts = Array.isArray(snapshot.contactsSupplied) ? snapshot.contactsSupplied : []
  for (const entry of contacts) {
    if (!entry || typeof entry !== "object") continue
    const contact = entry as { email?: string; contactabilityStatus?: string }
    if (contact.contactabilityStatus === "contactable" && contact.email?.trim()) {
      return contact.email.trim()
    }
  }

  return leadEmail?.trim() || null
}

export async function bindAvaSupervisedOutboundApproval(
  admin: SupabaseClient,
  input: {
    generation: GrowthAiCopilotGeneration
    actingUserId: string
  },
): Promise<{
  binding: AvaSupervisedOutboundApprovalBinding
  unsignedBody: string
  classification: Record<string, unknown>
}> {
  if (!isAvaSupervisedOutboundGeneration(input.generation)) {
    throw new Error("not_ava_supervised_generation")
  }

  const lead = await fetchGrowthLeadById(admin, input.generation.leadId)
  if (!lead) throw new Error("lead_not_found")

  const recipientEmail = resolveApprovedRecipient(input.generation, lead.contactEmail)
  if (!recipientEmail) throw new Error("approved_recipient_unavailable")

  const subject = input.generation.generatedSubject?.trim()
  if (!subject) throw new Error("approved_subject_unavailable")

  const organizationId = lead.promotedOrganizationId?.trim() || getGrowthEngineAiOrgId() || null
  if (!organizationId) throw new Error("organization_unavailable")

  const senderResolution = await resolveAvaSupervisedOutboundSenderBundle(admin, {
    organizationId,
    leadId: input.generation.leadId,
    recipientEmail,
    // inputSnapshot.approvedSender is draft prompt identity only — affinity uses pool or canonical fallback.
    explicitSenderAccountId: null,
  })
  if (!senderResolution.ok) {
    throw new Error(senderResolution.code)
  }

  const senderAccountId = senderResolution.senderAccountId
  if (!senderAccountId) throw new Error("approved_sender_unavailable")

  const resolvedSignature = await resolveOutboundSignatureForSender(admin, { senderAccountId })
  const unsignedBody = stripAccidentalAvaSignatureFromBody(
    input.generation.generatedContent,
    resolvedSignature.signature?.text ?? null,
  )
  if (!unsignedBody.trim()) throw new Error("approved_body_unavailable")

  const binding: AvaSupervisedOutboundApprovalBinding = {
    qaMarker: AVA_SUPERVISED_OUTBOUND_1A_QA_MARKER,
    generationId: input.generation.id,
    organizationId,
    recipientEmail,
    subject,
    unsignedBody,
    bodyFingerprint: fingerprintAvaSupervisedOutboundBody(unsignedBody),
    senderAccountId,
    senderAssignmentId: senderResolution.assignment.id,
    mailboxConnectionId: senderResolution.mailboxConnectionId,
    senderEmail: senderResolution.senderEmail,
    assignmentSource: senderResolution.assignment.assignmentSource,
    assignmentStrategy: senderResolution.assignment.assignmentStrategy,
    senderPoolId: senderResolution.assignment.senderPoolId,
    signatureProfileId: resolvedSignature.profileId,
    signatureResolutionSource: resolvedSignature.resolutionSource,
    approvedAt: new Date().toISOString(),
    approvedBy: input.actingUserId,
  }

  const classification = {
    ...classificationRecord(input.generation),
    avaSupervisedOutboundApproval: binding,
    signatureApplied: false,
    outboundSendAuthorized: true,
  }

  return { binding, unsignedBody, classification }
}
