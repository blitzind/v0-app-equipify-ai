/**
 * AVA-BLOCK-IMAGING-RESURFACE-AND-HOME-TRUTH-AUDIT-1A — Read-only production audit probe.
 * Run: pnpm probe:ava-block-imaging-resurface-and-home-truth-audit-1a:production
 */

import { listGrowthAiCopilotGenerationsForLead } from "../lib/growth/ai-copilot-repository"
import { resolveCanonicalApprovalQueueCount, resolveCanonicalApprovedReadyToSendCount, resolveCanonicalOutreachDraftCount } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import {
  readAvaSupervisedOutboundApprovalBinding,
  readAvaSupervisedOutboundSendReceipt,
} from "../lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import { readAvaSupervisedOutboundSendLifecycle } from "../lib/growth/ava-reasoning/ava-supervised-outbound-1b-types"
import {
  BLOCK_IMAGING_FRESH_GENERATION_ID,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isReviewableSupervisedAvaGeneration,
  isSendEligibleSupervisedAvaGeneration,
  isSupervisedAvaGenerationSent,
  loadSupervisedAvaGenerationsForHome,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { emptyCanonicalOperatorApprovalSnapshot } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { findExistingAvaSupervisedSendableDraft } from "../lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import { resolveDraftFactoryDurableRepository } from "../lib/growth/draft-factory/draft-factory-durable-repository-factory"
import {
  buildGrowthHomeReviewQueuePresentation,
  buildGrowthHomeReviewQueueDailyBrief,
  buildSupervisedReadyByLeadIdMap,
} from "../lib/growth/home/growth-home-review-queue-1b"
import { buildGrowthHomeCurrentFocusPresentation } from "../lib/growth/home/growth-home-simplification-1a"
import { buildHeroExecutiveBriefing } from "../lib/growth/workspace/executive-briefing/growth-home-operator-experience-live-3b"
import { buildGrowthHomeWorkspaceSummary } from "../lib/growth/home/growth-home-workspace-summary-service"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import type { GrowthAiCopilotGeneration } from "../lib/growth/ai-copilot-types"

const CERT_ID = "ava-block-imaging-resurface-and-home-truth-audit-1a-v1" as const
const BLOCK_IMAGING_LEAD_ID = BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID
const KNOWN_GENERATION_IDS = [
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
  BLOCK_IMAGING_FRESH_GENERATION_ID,
  "84b0395d-f41d-4093-bf84-f854b1d26ea2",
]

function contactFromGeneration(generation: GrowthAiCopilotGeneration): string | null {
  const classification = generation.classification as Record<string, unknown>
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const email = (recommended as { email?: string }).email?.trim()
    const name = (recommended as { name?: string }).name?.trim()
    if (email) return name ? `${name} <${email}>` : email
  }
  const contacts = generation.inputSnapshot?.contactsSupplied
  if (Array.isArray(contacts)) {
    for (const row of contacts) {
      if (row && typeof row === "object" && (row as { contactabilityStatus?: string }).contactabilityStatus === "contactable") {
        const email = (row as { email?: string }).email?.trim()
        const name = (row as { name?: string }).name?.trim()
        if (email) return name ? `${name} <${email}>` : email
      }
    }
  }
  return null
}

function auditGeneration(generation: GrowthAiCopilotGeneration, attention: ReturnType<typeof buildSupervisedAvaHomeOperatorAttention>) {
  const classification = generation.classification as Record<string, unknown>
  const binding = readAvaSupervisedOutboundApprovalBinding(classification)
  const lifecycle = readAvaSupervisedOutboundSendLifecycle(classification)
  const receipt = readAvaSupervisedOutboundSendReceipt(classification)
  const presentation = resolveAvaSupervisedOutboundApprovalPresentation(generation)
  const sent = isSupervisedAvaGenerationSent(generation)
  const reviewable = isReviewableSupervisedAvaGeneration(generation)
  const sendEligible = isSendEligibleSupervisedAvaGeneration(generation)

  return {
    generationId: generation.id,
    createdAt: generation.createdAt,
    createdBy: generation.createdBy,
    status: generation.status,
    classificationPrimary: classification.primary ?? null,
    subject: generation.generatedSubject,
    recipient: contactFromGeneration(generation),
    approvalBindingPresent: hasValidMessageApprovalBindingForGeneration(generation),
    binding: binding
      ? {
          generationId: binding.generationId,
          senderEmail: binding.senderEmail,
          approvedAt: binding.approvedAt,
          approvedBy: binding.approvedBy,
        }
      : null,
    approvedBy: generation.approvedBy,
    approvedAt: generation.approvedAt,
    senderEmail: binding?.senderEmail ?? null,
    sentAt: generation.sentAt,
    sendLifecycle: lifecycle,
    sendReceipt: receipt,
    discarded: generation.status === "discarded",
    superseded: Boolean(classification.superseded === true || classification.supersededBy),
    sentAccordingToCanonicalResolver: sent,
    reviewableAccordingToCanonicalResolver: reviewable,
    sendEligibleAccordingToCanonicalResolver: sendEligible,
    presentation,
    inReadyForReview: attention.readyForReview.some((row) => row.generationId === generation.id),
    inApprovedReadyToSend: attention.approvedReadyToSend.some((row) => row.generationId === generation.id),
    leadInSentLeadIds: attention.sentLeadIds.includes(generation.leadId),
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] read-only Block Imaging lifecycle audit`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const admin = cert.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID

  const { data: leadRow, error: leadError } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, contact_name, contact_email, status, first_human_touch_at, metadata")
    .eq("id", BLOCK_IMAGING_LEAD_ID)
    .maybeSingle()
  if (leadError) throw new Error(leadError.message)

  const allGenerations = await listGrowthAiCopilotGenerationsForLead(admin, BLOCK_IMAGING_LEAD_ID, 100)
  const supervisedGenerations = await loadSupervisedAvaGenerationsForHome(admin, [BLOCK_IMAGING_LEAD_ID])
  const attention = buildSupervisedAvaHomeOperatorAttention({
    generations: supervisedGenerations,
    leadsById: new Map([[BLOCK_IMAGING_LEAD_ID, String(leadRow?.company_name ?? "Block Imaging")]]),
  })
  const mergedSnapshot = mergeSupervisedAvaIntoApprovalSnapshot({
    base: emptyCanonicalOperatorApprovalSnapshot(),
    attention,
  })
  const queue = buildGrowthHomeReviewQueuePresentation({
    packages: mergedSnapshot.packages,
    supervisedReadyByLeadId: buildSupervisedReadyByLeadIdMap(
      attention.readyForReview,
      attention.approvedReadyToSend,
    ),
  })
  const queueDailyBrief = buildGrowthHomeReviewQueueDailyBrief({ queue })
  const duplicateReuse = await findExistingAvaSupervisedSendableDraft(admin, BLOCK_IMAGING_LEAD_ID)

  const resolvedRepo = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
  const dfState =
    resolvedRepo.kind === "postgres"
      ? await resolvedRepo.repository.getLeadState(orgId, BLOCK_IMAGING_LEAD_ID)
      : null

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin,
    operatorEmail: cert.operatorEmail,
    actorUserId: cert.actorUserId,
  })

  const canonicalPendingApprovals = resolveCanonicalApprovalQueueCount(summary.canonicalOperatorApproval, 0)
  const canonicalApprovedReadyToSend = Math.max(
    resolveCanonicalApprovedReadyToSendCount(summary.canonicalOperatorApproval, 0),
    summary.supervisedOperatorAttention?.approvedReadyToSend?.length ?? 0,
    queue.approvedCount,
  )
  const lifecycleAwaitingApproval = Math.max(canonicalPendingApprovals, queue.awaitingReviewCount)
  const lifecycleApprovedReadyToSend = Math.max(canonicalApprovedReadyToSend, queue.approvedCount)
  const canonicalDraftCount = resolveCanonicalOutreachDraftCount(summary.canonicalOperatorApproval, 0)
  const blockInCanonical = (summary.canonicalOperatorApproval?.packages ?? []).filter(
    (row) => row.leadId === BLOCK_IMAGING_LEAD_ID,
  )
  const blockQueueRow = queue.rows.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID) ?? null

  const sentGenerations = allGenerations.filter((gen) => isSupervisedAvaGenerationSent(gen))
  const generationAudits = allGenerations.map((gen) => auditGeneration(gen, attention))
  const knownGenerationAudits = KNOWN_GENERATION_IDS.map((id) => {
    const gen = allGenerations.find((row) => row.id === id) ?? null
    return { knownId: id, found: Boolean(gen), audit: gen ? auditGeneration(gen, attention) : null }
  })

  const surfacedGenerationId =
    attention.approvedReadyToSend.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID)?.generationId ??
    attention.readyForReview.find((row) => row.leadId === BLOCK_IMAGING_LEAD_ID)?.generationId ??
    blockQueueRow?.packageId ??
    null

  const currentFocus = buildGrowthHomeCurrentFocusPresentation({
    pendingApprovals: lifecycleAwaitingApproval,
    approvedReadyToSend: lifecycleApprovedReadyToSend,
    recommendation: null,
    waitingItem: null,
    runtimeTrust: null,
    actionableCompanyName: blockQueueRow?.companyName ?? null,
    actionableCompanyHref: blockQueueRow?.reviewHref ?? null,
  })
  const heroBriefing = buildHeroExecutiveBriefing({
    statusLabel: "Working",
    pendingApprovals: lifecycleAwaitingApproval,
    approvedReadyToSend: lifecycleApprovedReadyToSend,
  })

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        lead: leadRow
          ? {
              id: leadRow.id,
              companyName: leadRow.company_name,
              contactName: leadRow.contact_name,
              contactEmail: leadRow.contact_email,
              status: leadRow.status,
              firstHumanTouchAt: leadRow.first_human_touch_at,
            }
          : null,
        draftFactoryState: dfState?.state ?? null,
        draftFactoryPackageId: dfState?.packageId ?? null,
        duplicateReuseWouldBlock: Boolean(duplicateReuse),
        duplicateReuseGenerationId: duplicateReuse?.id ?? null,
        generationCount: {
          allCopilot: allGenerations.length,
          supervisedHomeLoader: supervisedGenerations.length,
          sent: sentGenerations.length,
        },
        hasEverSentToBlockImaging: sentGenerations.length > 0,
        sentTransportEvidence: sentGenerations.map((gen) => ({
          generationId: gen.id,
          sentAt: gen.sentAt,
          subject: gen.generatedSubject,
          recipient: contactFromGeneration(gen),
          lifecycle: readAvaSupervisedOutboundSendLifecycle(gen.classification as Record<string, unknown>),
          receipt: readAvaSupervisedOutboundSendReceipt(gen.classification as Record<string, unknown>),
        })),
        knownGenerationAudits,
        allGenerationAudits: generationAudits,
        homeProjection: {
          readyForReview: attention.readyForReview,
          approvedReadyToSend: attention.approvedReadyToSend,
          sentLeadIds: attention.sentLeadIds,
          mergedPendingApprovalCount: mergedSnapshot.pendingApprovalCount,
          mergedApprovedReadyToSendCount: mergedSnapshot.approvedReadyToSendCount ?? 0,
          mergedOutreachDraftCount: mergedSnapshot.outreachDraftCount,
        },
        homeSurfaces: {
          surfacedGenerationId,
          blockQueueRow,
          blockInCanonicalPackages: blockInCanonical,
          queueDailyBrief,
          workspaceSummary: {
            canonicalPendingApprovals,
            canonicalApprovedReadyToSend,
            canonicalDraftCount,
            waitingForApproval: summary.avaConsole.waitingForApproval,
            canonicalOperatorFocus: summary.canonicalOperatorFocus,
            supervisedAttention: summary.supervisedOperatorAttention,
          },
          currentFocus,
          heroNarrative: heroBriefing.narrative,
          surfaceAgreement: {
            queueStatus: blockQueueRow?.statusLabel ?? null,
            queueAction: blockQueueRow?.showSendEmailAction
              ? "Send Email"
              : blockQueueRow?.showApproveEmailAction
                ? "Approve Email"
                : null,
            focusStatus: currentFocus?.statusLabel ?? null,
            focusNextAction: currentFocus?.nextActionLabel ?? null,
            heroWaitingForApproval: summary.avaConsole.waitingForApproval,
            heroRecommendSend: queueDailyBrief.recommendSendLine,
            heroPackagesPrepared: queueDailyBrief.packagesPreparedLine,
            allAgree:
              (blockQueueRow?.showSendEmailAction === true &&
                lifecycleAwaitingApproval === 0 &&
                lifecycleApprovedReadyToSend === 1 &&
                currentFocus?.statusLabel === "Ready to send" &&
                currentFocus?.nextActionLabel === "Send approved email" &&
                !/draft.*ready for review/i.test(heroBriefing.narrative) &&
                !/draft.*ready for review/i.test(summary.avaConsole.waitingForApproval ?? "")) ||
              (blockQueueRow?.showApproveEmailAction === true &&
                lifecycleAwaitingApproval === 1 &&
                currentFocus?.statusLabel === "Waiting for your approval"),
          },
        },
        invariants: { approvedDuringProbe: false, sentDuringProbe: false, mutatedProduction: false },
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
