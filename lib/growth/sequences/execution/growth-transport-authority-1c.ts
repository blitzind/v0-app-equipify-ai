/** GE-AIOS-END-TO-END-1C — Single transport authority resolver (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthSequenceEnrollmentStepById } from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { resolveApprovedTemplateContent } from "@/lib/growth/content/dashboard"
import { getApprovedPersonalizationForJob } from "@/lib/growth/personalization/dashboard"
import { getSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import type { GrowthTransportAuthority1C } from "@/lib/growth/sequences/execution/growth-transport-authority-1c-types"
import { ensureSupervisedJobTransportSnapshot } from "@/lib/growth/sequences/execution/growth-transport-authority-job-bind-1c"
import { parseTransportSnapshot1C } from "@/lib/growth/sequences/execution/growth-transport-snapshot-1c"
import { getSenderAccount } from "@/lib/growth/sender/sender-repository"
import { resolveOutboundSignatureForSender } from "@/lib/growth/signatures/signature-resolver"

export type ResolveTransportAuthorityInput = {
  sequenceStepId: string
  leadId: string
  sequenceExecutionJobId?: string | null
  organizationId?: string | null
  contentTemplateVersionId?: string | null
  personalizationGenerationId?: string | null
}

export async function resolveTransportAuthority(
  admin: SupabaseClient,
  input: ResolveTransportAuthorityInput,
): Promise<GrowthTransportAuthority1C | { error: string }> {
  const job = input.sequenceExecutionJobId
    ? await getSequenceExecutionJob(admin, input.sequenceExecutionJobId)
    : null

  if (job && input.organizationId && !job.transportSnapshotId) {
    await ensureSupervisedJobTransportSnapshot(admin, {
      jobId: job.id,
      organizationId: input.organizationId,
    })
  }

  const refreshedJob = job?.id ? await getSequenceExecutionJob(admin, job.id) : job
  const snapshot = parseTransportSnapshot1C(refreshedJob?.transportSnapshot ?? null)
  if (snapshot) {
    const sender = await getSenderAccount(admin, snapshot.senderAccountId)
    if (!sender || (sender.status !== "connected" && sender.status !== "warming")) {
      return { error: "approved_sender_unavailable" }
    }

    return {
      qaMarker: GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER,
      source: "frozen_snapshot",
      subject: snapshot.subject,
      bodyText: snapshot.bodyText,
      senderAccountId: snapshot.senderAccountId,
      senderDisplayName: snapshot.senderDisplayName,
      senderEmail: snapshot.senderEmail,
      replyTo: snapshot.replyTo,
      outreachPackageId: snapshot.outreachPackageId,
      packageFingerprint: snapshot.packageFingerprint,
      contentHash: snapshot.contentHash,
      allowAutoRotation: false,
      manualSenderAccountId: snapshot.senderAccountId,
      snapshot,
      transportSnapshotId: snapshot.transportSnapshotId,
    }
  }

  return resolveLegacyGenerationTransportAuthority(admin, input)
}

async function resolveLegacyGenerationTransportAuthority(
  admin: SupabaseClient,
  input: ResolveTransportAuthorityInput,
): Promise<GrowthTransportAuthority1C | { error: string }> {
  const [step, lead, job] = await Promise.all([
    fetchGrowthSequenceEnrollmentStepById(admin, input.sequenceStepId),
    fetchGrowthLeadById(admin, input.leadId),
    input.sequenceExecutionJobId
      ? getSequenceExecutionJob(admin, input.sequenceExecutionJobId)
      : Promise.resolve(null),
  ])

  if (!step) return { error: "step_not_found" }
  if (!lead?.contactEmail) return { error: "missing_recipient_email" }

  let subject = step.instructions?.trim() || "Follow up"
  let body = step.instructions?.trim() || "Following up on our conversation."

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
  }

  if (step.generationId) {
    const generation = await fetchGrowthAiCopilotGenerationById(admin, step.generationId)
    if (!generation) return { error: "missing_generation" }
    if (generation.status !== "approved") return { error: "generation_not_approved" }
    subject = generation.generatedSubject?.trim() || subject
    body = generation.generatedContent?.trim() || body
  }

  if (input.personalizationGenerationId) {
    const personalization = await getApprovedPersonalizationForJob(
      admin,
      input.personalizationGenerationId,
    )
    if (!personalization) return { error: "personalization_not_approved" }
    subject = personalization.subject || subject
    body = personalization.body || body
  }

  const { resolveSequenceExecutionSender } = await import(
    "@/lib/growth/sequences/execution/sequence-send-builder"
  )
  const sender = await resolveSequenceExecutionSender(admin, {
    senderPoolId: job?.senderPoolId ?? null,
    allowAutoRotation: job?.allowAutoRotation ?? true,
    manualSenderAccountId: job?.manualSenderAccountId ?? null,
    sequenceExecutionJobId: input.sequenceExecutionJobId ?? null,
  })
  if (!sender) return { error: "no_sender_route" }

  const signature = await resolveOutboundSignatureForSender(admin, {
    senderAccountId: sender.senderAccountId,
  })
  const account = await getSenderAccount(admin, sender.senderAccountId)

  return {
    qaMarker: GE_AIOS_TRANSPORT_AUTHORITY_1C_QA_MARKER,
    source: "legacy_generation",
    subject,
    bodyText: body,
    senderAccountId: sender.senderAccountId,
    senderDisplayName: signature.displayName || account?.display_name || null,
    senderEmail: signature.mergeFields["sender.email"] || account?.email_address || null,
    replyTo: null,
    outreachPackageId: null,
    packageFingerprint: null,
    contentHash: "",
    allowAutoRotation: sender.allowAutoRotation ?? job?.allowAutoRotation ?? true,
    manualSenderAccountId: sender.manualSenderAccountId ?? job?.manualSenderAccountId ?? null,
    snapshot: null,
    transportSnapshotId: null,
  }
}
