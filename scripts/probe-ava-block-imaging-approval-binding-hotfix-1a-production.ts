/**
 * AVA-BLOCK-IMAGING-APPROVAL-BINDING-HOTFIX-1A — Read-only production verification probe.
 */

import { fetchGrowthAiCopilotGenerationById, listGrowthAiCopilotGenerationsForLead } from "../lib/growth/ai-copilot-repository"
import {
  hasValidMessageApprovalBindingForGeneration,
  isUnboundApprovedSupervisedGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { containsProhibitedAvaOutboundStyleMarkers } from "../lib/growth/ava-reasoning/ava-outbound-copy-quality-boundary-core"
import { readAvaSupervisedOutboundApprovalBinding } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { bodyContainsLegacyAvaSignatureMarkers } from "../lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import {
  auditSupervisedLeadGenerationState,
  BLOCK_IMAGING_FRESH_GENERATION_ID,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import { fetchActiveOutboundSenderAssignment } from "../lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"

const CERT_ID = "ava-block-imaging-approval-binding-hotfix-1a-v1" as const

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] Block Imaging approval-binding probe`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const audit = await auditSupervisedLeadGenerationState(cert.admin, {
    organizationId: orgId,
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  })

  const generations = await listGrowthAiCopilotGenerationsForLead(
    cert.admin,
    BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
    20,
  )

  const current =
    generations.find((row) => row.id === audit.generationId) ??
    generations.find((row) => row.id === BLOCK_IMAGING_FRESH_GENERATION_ID) ??
    null
  const legacy = await fetchGrowthAiCopilotGenerationById(cert.admin, BLOCK_IMAGING_LEGACY_GENERATION_ID)
  const presentation = current ? resolveAvaSupervisedOutboundApprovalPresentation(current) : null
  const binding = current
    ? readAvaSupervisedOutboundApprovalBinding(current.classification as Record<string, unknown>)
    : null

  const recipientEmail =
    binding?.recipientEmail ??
    ((current?.classification as { recommendedContact?: { email?: string } })?.recommendedContact?.email ??
      null)

  const affinity =
    recipientEmail && current
      ? await fetchActiveOutboundSenderAssignment(cert.admin, {
          organizationId: orgId,
          leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
          contactEmail: recipientEmail,
        }).catch(() => null)
      : null

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
        currentGenerationId: current?.id ?? null,
        legacyGenerationId: BLOCK_IMAGING_LEGACY_GENERATION_ID,
        legacyStatus: legacy?.status ?? null,
        generationStatus: current?.status ?? null,
        generationApprovedAt: current?.approvedAt ?? null,
        subject: current?.generatedSubject ?? null,
        hasMessageApprovalBinding: current ? hasValidMessageApprovalBindingForGeneration(current) : false,
        unboundApprovedStatus: current ? isUnboundApprovedSupervisedGeneration(current) : false,
        bindingGenerationId: binding?.generationId ?? null,
        bindingAssignmentSource: binding?.assignmentSource ?? null,
        bindingSenderPoolId: binding?.senderPoolId ?? null,
        presentation,
        persistedBodyHasEmDash: containsProhibitedAvaOutboundStyleMarkers(current?.generatedContent ?? ""),
        subjectHasEmDash: containsProhibitedAvaOutboundStyleMarkers(current?.generatedSubject ?? ""),
        persistedBodyHasSignature: bodyContainsLegacyAvaSignatureMarkers(current?.generatedContent ?? ""),
        senderAffinity: affinity
          ? {
              senderAccountId: affinity.senderAccountId,
              assignmentSource: affinity.assignmentSource,
              senderPoolId: affinity.senderPoolId,
            }
          : null,
        sendEligible: presentation?.sendEligible ?? false,
        audit,
        actionableGenerations: generations
          .filter((row) => row.status === "draft" || row.status === "approved")
          .map((row) => ({
            id: row.id,
            status: row.status,
            createdAt: row.createdAt,
            hasBinding: hasValidMessageApprovalBindingForGeneration(row),
          })),
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
