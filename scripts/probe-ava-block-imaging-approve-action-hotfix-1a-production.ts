/**
 * AVA-BLOCK-IMAGING-APPROVE-ACTION-HOTFIX-1A — Production approve action probe (mutate when CONFIRM=true).
 */

import { fetchGrowthAiCopilotGenerationById } from "../lib/growth/ai-copilot-repository"
import { approveGrowthAiCopilotGeneration } from "../lib/growth/run-ai-copilot-generation"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { readAvaSupervisedOutboundApprovalBinding } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { fetchActiveOutboundSenderAssignment } from "../lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"

const BLOCK_IMAGING_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"

const CERT_ID = "ava-block-imaging-approve-action-hotfix-1a-v1" as const
const GENERATION_ID = process.env.AVA_BLOCK_IMAGING_APPROVE_PROBE_GENERATION_ID?.trim() ||
  "84b0395d-f41d-4093-bf84-f854b1d26ea2"
const CONFIRM = process.env.AVA_BLOCK_IMAGING_APPROVE_PROBE_CONFIRM === "true"
const PROBE_ACTOR_USER_ID = "system"

async function snapshot(admin: Awaited<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>["admin"], generationId: string) {
  const generation = await fetchGrowthAiCopilotGenerationById(admin!, generationId)
  if (!generation) return null
  const binding = readAvaSupervisedOutboundApprovalBinding(generation.classification as Record<string, unknown>)
  const affinity = await fetchActiveOutboundSenderAssignment(admin!, {
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    leadId: BLOCK_IMAGING_LEAD_ID,
    contactEmail: binding?.recipientEmail ?? generation.inputSnapshot?.contactsSupplied?.[0]?.email ?? "",
  }).catch(() => null)
  return {
    generationId: generation.id,
    status: generation.status,
    approvedAt: generation.approvedAt,
    subject: generation.generatedSubject,
    bodyLength: generation.generatedContent.length,
    hasBinding: hasValidMessageApprovalBindingForGeneration(generation),
    binding: binding
      ? {
          generationId: binding.generationId,
          senderEmail: binding.senderEmail,
          senderAccountId: binding.senderAccountId,
          assignmentSource: binding.assignmentSource,
          senderPoolId: binding.senderPoolId,
        }
      : null,
    presentation: resolveAvaSupervisedOutboundApprovalPresentation(generation),
    senderAffinity: affinity
      ? {
          senderAccountId: affinity.senderAccountId,
          senderEmail: affinity.senderEmail,
          assignmentSource: affinity.assignmentSource,
        }
      : null,
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] Block Imaging approve-action probe`)
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const before = await snapshot(cert.admin, GENERATION_ID)
  console.log(JSON.stringify({ phase: "before", before }, null, 2))

  if (!CONFIRM) {
    console.log(JSON.stringify({ phase: "skipped_mutate", hint: "Set AVA_BLOCK_IMAGING_APPROVE_PROBE_CONFIRM=true to run approve" }, null, 2))
    return
  }

  try {
    const approved = await approveGrowthAiCopilotGeneration(cert.admin, {
      generationId: GENERATION_ID,
      actingUserId: PROBE_ACTOR_USER_ID,
      actingUserEmail: "probe@equipify.ai",
    })
    const after = await snapshot(cert.admin, GENERATION_ID)
    console.log(
      JSON.stringify(
        {
          phase: "after_approve",
          approveReturnedStatus: approved?.status ?? null,
          after,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          phase: "approve_threw",
          message: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    )
  }
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
