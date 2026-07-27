/**
 * AVA-BLOCK-IMAGING-FRESH-GENERATION-1A — Focused stale supervised generation recovery.
 * Discards unsent/unapproved drafts via existing lifecycle, then re-runs canonical supervised generation.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listGrowthAiCopilotGenerationsForLead,
  type GrowthAiCopilotGeneration,
} from "@/lib/growth/ai-copilot-repository"
import type { GrowthAiCopilotGenerationStatus } from "@/lib/growth/ai-copilot-types"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildCanonicalEvidenceForLead } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import {
  projectDurableStateFromStage,
  resolveEarliestIncompleteDurableStage,
} from "@/lib/growth/draft-factory/draft-factory-durable-engine"
import { createPostgresDraftFactoryRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository"
import { discardGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { fetchActiveOutboundSenderAssignment } from "@/lib/growth/outbound-sender-affinity/outbound-sender-affinity-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateGrowthPortfolioLeadEligibility } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import {
  isReviewableSupervisedAvaGeneration,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import {
  bodyContainsLegacyAvaSignatureMarkers,
  stripAccidentalAvaSignatureFromBody,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import {
  findExistingAvaSupervisedSendableDraft,
  isSendableAvaSupervisedDraft,
} from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import { runEquipifySupervisedAvaOutreach } from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"

export const AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER =
  "ava-supervised-stale-generation-recovery-1a-v1" as const

/** AVA-BLOCK-IMAGING-FRESH-GENERATION-1A — scoped recovery allowlist. */
export const BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
export const BLOCK_IMAGING_LEGACY_GENERATION_ID = "2bbacf99-b884-442f-a5b2-ce78132368cf" as const

const RECOVERY_ALLOWLIST = new Set<string>([BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID])

const AVA_SUPERVISED_DRAFT_PROMPT_VARIANT = "ava_direct_production_cutover_1a" as const

function isDiscardableUnsentUnapprovedSupervisedDraft(
  generation: GrowthAiCopilotGeneration,
): boolean {
  return (
    generation.generationType === "cold_email" &&
    generation.promptVariant === AVA_SUPERVISED_DRAFT_PROMPT_VARIANT &&
    generation.status === "draft" &&
    !generation.approvedAt &&
    !generation.sentAt &&
    Boolean(generation.generatedSubject?.trim()) &&
    Boolean(generation.generatedContent?.trim())
  )
}

async function listDiscardableUnsentUnapprovedSupervisedDrafts(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthAiCopilotGeneration[]> {
  const generations = await listGrowthAiCopilotGenerationsForLead(admin, leadId, 50)
  return generations.filter((generation) => isDiscardableUnsentUnapprovedSupervisedDraft(generation))
}

export type SupervisedGenerationBodySignatureOrigin =
  | "physically_persisted"
  | "preview_only"
  | "unsigned"

export type SupervisedGenerationAudit = {
  qaMarker: typeof AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER
  leadId: string
  companyName: string | null
  generationId: string | null
  generationStatus: GrowthAiCopilotGenerationStatus | null
  generationCreatedAt: string | null
  generationApprovedAt: string | null
  generationSentAt: string | null
  subject: string | null
  persistedBodyLength: number
  persistedBodyTail: string | null
  persistedBodyHasLegacySignatureMarkers: boolean
  strippedUnsignedBodyHasLegacySignatureMarkers: boolean
  signatureOrigin: SupervisedGenerationBodySignatureOrigin
  draftFactoryState: string | null
  canonicalStage: string
  projectedDurableState: string
  portfolioEligible: boolean
  portfolioReason: string | null
  actionableGenerationCount: number
  reviewableGenerationCount: number
  hasApprovalBinding: boolean
  hasSenderAffinity: boolean
  senderAffinitySample: { senderAccountId: string; contactEmail: string } | null
  duplicateReuseWouldBlockRegeneration: boolean
  discardableDraftGenerationIds: string[]
  whySurvivedRecovery: string[]
}

export type RecoverStaleSupervisedGenerationResult = {
  qaMarker: typeof AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER
  leadId: string
  dryRun: boolean
  auditBefore: SupervisedGenerationAudit
  discardedGenerationId: string | null
  discardedGenerationIds: string[]
  regenerationAttempted: boolean
  regenerationOk: boolean
  regenerationCode: string | null
  regenerationMessage: string | null
  newGenerationId: string | null
  persistenceStatus: string | null
  decision: string | null
  auditAfter: SupervisedGenerationAudit | null
}

function resolveApprovedRecipientEmail(generation: GrowthAiCopilotGeneration): string | null {
  const classification = (generation.classification ?? {}) as Record<string, unknown>
  const recommended = classification.recommendedContact
  if (recommended && typeof recommended === "object") {
    const email = (recommended as { email?: string }).email?.trim()
    if (email) return email
  }
  const contacts = Array.isArray(generation.inputSnapshot?.contactsSupplied)
    ? generation.inputSnapshot.contactsSupplied
    : []
  for (const entry of contacts) {
    if (!entry || typeof entry !== "object") continue
    const contact = entry as { email?: string; contactabilityStatus?: string }
    if (contact.contactabilityStatus === "contactable" && contact.email?.trim()) {
      return contact.email.trim()
    }
  }
  return null
}

function generationHasApprovalBinding(generation: GrowthAiCopilotGeneration | null): boolean {
  if (!generation) return false
  const classification = (generation.classification ?? {}) as Record<string, unknown>
  const binding = classification.avaSupervisedOutboundApprovalBinding
  return Boolean(binding && typeof binding === "object")
}

function classifySignatureOrigin(input: {
  persistedBody: string
  strippedUnsignedBody: string
}): SupervisedGenerationBodySignatureOrigin {
  const persistedHasMarkers = bodyContainsLegacyAvaSignatureMarkers(input.persistedBody)
  const strippedHasMarkers = bodyContainsLegacyAvaSignatureMarkers(input.strippedUnsignedBody)
  if (persistedHasMarkers) return "physically_persisted"
  if (!persistedHasMarkers && strippedHasMarkers) return "preview_only"
  if (input.persistedBody.trim() !== input.strippedUnsignedBody.trim()) return "physically_persisted"
  return "unsigned"
}

function whyGenerationSurvivedRecovery(input: {
  generation: GrowthAiCopilotGeneration | null
  draftFactoryState: string | null
  duplicateReuseWouldBlockRegeneration: boolean
}): string[] {
  const reasons: string[] = []
  if (!input.generation) {
    reasons.push("no_supervised_generation_found")
    return reasons
  }
  if (input.generation.status === "draft" && !input.generation.approvedAt && !input.generation.sentAt) {
    reasons.push("valid_unsent_unapproved_draft_not_orphan")
  }
  if (input.draftFactoryState !== "waiting_for_approval") {
    reasons.push(`draft_factory_state_${input.draftFactoryState ?? "unknown"}_not_orphan_waiting_for_approval`)
  }
  if (input.duplicateReuseWouldBlockRegeneration) {
    reasons.push("findExistingAvaSupervisedSendableDraft_would_duplicate_reuse")
  }
  reasons.push("orphan_reconcile_excludes_valid_supervised_drafts")
  return reasons
}

export async function auditSupervisedLeadGenerationState(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
): Promise<SupervisedGenerationAudit> {
  const [lead, dfRow, generations, supervisedForHome, evidence] = await Promise.all([
    fetchGrowthLeadById(admin, input.leadId),
    createPostgresDraftFactoryRepository(admin)
      .getLeadState(input.organizationId, input.leadId)
      .catch(() => null),
    listGrowthAiCopilotGenerationsForLead(admin, input.leadId, 50),
    loadSupervisedAvaGenerationsForHome(admin, [input.leadId]),
    buildCanonicalEvidenceForLead(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    }),
  ])

  const actionable = generations.filter(
    (g) =>
      g.generationType === "cold_email" &&
      (g.status === "draft" || g.status === "approved") &&
      !g.sentAt,
  )
  const reviewable = supervisedForHome.filter((g) => isReviewableSupervisedAvaGeneration(g))
  const primary =
    actionable.find((g) => g.status === "draft" && !g.approvedAt) ??
    actionable[0] ??
    generations.find((g) => g.id === BLOCK_IMAGING_LEGACY_GENERATION_ID) ??
    null

  const persistedBody = primary?.generatedContent?.trim() ?? ""
  const strippedUnsignedBody = persistedBody
    ? stripAccidentalAvaSignatureFromBody(persistedBody)
    : ""
  const recipientEmail = primary ? resolveApprovedRecipientEmail(primary) : null
  const affinity =
    recipientEmail && lead
      ? await fetchActiveOutboundSenderAssignment(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          contactEmail: recipientEmail,
        }).catch(() => null)
      : null

  const portfolio = lead
    ? evaluateGrowthPortfolioLeadEligibility({ lead, organizationId: input.organizationId })
    : { eligible: false, reason: "lead_not_found" as const }

  const stage = resolveEarliestIncompleteDurableStage(evidence)
  const projected = projectDurableStateFromStage(stage, evidence)
  const duplicateReuseWouldBlockRegeneration = Boolean(
    primary && (await findExistingAvaSupervisedSendableDraft(admin, input.leadId)),
  )
  const discardableDrafts = await listDiscardableUnsentUnapprovedSupervisedDrafts(
    admin,
    input.leadId,
  )

  return {
    qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
    leadId: input.leadId,
    companyName: lead?.companyName ?? null,
    generationId: primary?.id ?? null,
    generationStatus: primary?.status ?? null,
    generationCreatedAt: primary?.createdAt ?? null,
    generationApprovedAt: primary?.approvedAt ?? null,
    generationSentAt: primary?.sentAt ?? null,
    subject: primary?.generatedSubject ?? null,
    persistedBodyLength: persistedBody.length,
    persistedBodyTail: persistedBody ? persistedBody.slice(-240) : null,
    persistedBodyHasLegacySignatureMarkers: bodyContainsLegacyAvaSignatureMarkers(persistedBody),
    strippedUnsignedBodyHasLegacySignatureMarkers:
      bodyContainsLegacyAvaSignatureMarkers(strippedUnsignedBody),
    signatureOrigin: classifySignatureOrigin({ persistedBody, strippedUnsignedBody }),
    draftFactoryState: dfRow?.state ?? null,
    canonicalStage: stage,
    projectedDurableState: projected,
    portfolioEligible: portfolio.eligible,
    portfolioReason: portfolio.eligible ? null : portfolio.reasonCode,
    actionableGenerationCount: actionable.length,
    reviewableGenerationCount: reviewable.length,
    hasApprovalBinding: generationHasApprovalBinding(primary),
    hasSenderAffinity: Boolean(affinity),
    senderAffinitySample: affinity
      ? { senderAccountId: affinity.senderAccountId, contactEmail: affinity.contactEmail }
      : null,
    duplicateReuseWouldBlockRegeneration,
    discardableDraftGenerationIds: discardableDrafts.map((row) => row.id),
    whySurvivedRecovery: whyGenerationSurvivedRecovery({
      generation: primary,
      draftFactoryState: dfRow?.state ?? null,
      duplicateReuseWouldBlockRegeneration,
    }),
  }
}

function assertRecoveryAllowed(leadId: string): void {
  if (!RECOVERY_ALLOWLIST.has(leadId)) {
    throw new Error("recovery_lead_not_allowlisted")
  }
}

function canonicalReadinessAllowsSupervisedRegeneration(
  audit: SupervisedGenerationAudit,
  options?: { allowLegacyApprovedUnsentWithoutBinding?: boolean },
): {
  ok: boolean
  reason: string | null
} {
  if (!audit.portfolioEligible) {
    return { ok: false, reason: audit.portfolioReason ?? "portfolio_ineligible" }
  }
  if (audit.hasApprovalBinding) {
    return { ok: false, reason: "approval_binding_present" }
  }
  if (audit.generationSentAt) {
    return { ok: false, reason: "generation_already_sent" }
  }
  if (
    audit.generationApprovedAt &&
    !options?.allowLegacyApprovedUnsentWithoutBinding
  ) {
    return { ok: false, reason: "generation_already_approved_or_sent" }
  }
  if (audit.canonicalStage === "complete" && audit.projectedDurableState === "approved") {
    return { ok: false, reason: "canonical_state_already_approved" }
  }
  return { ok: true, reason: null }
}

export async function recoverStaleSupervisedGenerationForLead(
  admin: SupabaseClient,
  input: {
    organizationId?: string | null
    leadId: string
    actingUserId: string
    actingUserEmail: string
    dryRun?: boolean
    expectedGenerationId?: string | null
  },
): Promise<RecoverStaleSupervisedGenerationResult> {
  assertRecoveryAllowed(input.leadId)

  const organizationId = input.organizationId?.trim() || getGrowthEngineAiOrgId()
  if (!organizationId) throw new Error("organization_unavailable")

  const auditBefore = await auditSupervisedLeadGenerationState(admin, {
    organizationId,
    leadId: input.leadId,
  })

  const readiness = canonicalReadinessAllowsSupervisedRegeneration(auditBefore, {
    allowLegacyApprovedUnsentWithoutBinding: true,
  })
  const dryRun = input.dryRun !== false

  const discardableDrafts = await listDiscardableUnsentUnapprovedSupervisedDrafts(
    admin,
    input.leadId,
  )

  if (
    input.expectedGenerationId &&
    discardableDrafts.length > 0 &&
    !discardableDrafts.some((row) => row.id === input.expectedGenerationId)
  ) {
    return {
      qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
      leadId: input.leadId,
      dryRun,
      auditBefore,
      discardedGenerationId: null,
      discardedGenerationIds: [],
      regenerationAttempted: false,
      regenerationOk: false,
      regenerationCode: "generation_id_mismatch",
      regenerationMessage: `Expected ${input.expectedGenerationId} among discardable drafts.`,
      newGenerationId: null,
      persistenceStatus: null,
      decision: null,
      auditAfter: null,
    }
  }

  const targetGeneration = discardableDrafts[0] ?? null

  if (!readiness.ok) {
    return {
      qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
      leadId: input.leadId,
      dryRun,
      auditBefore,
      discardedGenerationId: null,
      discardedGenerationIds: [],
      regenerationAttempted: false,
      regenerationOk: false,
      regenerationCode: "canonical_readiness_blocked",
      regenerationMessage: readiness.reason,
      newGenerationId: null,
      persistenceStatus: null,
      decision: null,
      auditAfter: null,
    }
  }

  if (dryRun) {
    return {
      qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
      leadId: input.leadId,
      dryRun: true,
      auditBefore,
      discardedGenerationId: targetGeneration?.id ?? null,
      discardedGenerationIds: discardableDrafts.map((row) => row.id),
      regenerationAttempted: true,
      regenerationOk: true,
      regenerationCode: "dry_run",
      regenerationMessage:
        discardableDrafts.length > 0
          ? "Would discard stale supervised drafts and run fresh supervised generation."
          : "Would run fresh supervised generation (stale draft already discarded).",
      newGenerationId: null,
      persistenceStatus: null,
      decision: null,
      auditAfter: null,
    }
  }

  const discardedGenerationIds: string[] = []
  for (const draft of discardableDrafts) {
    const discarded = await discardGrowthAiCopilotGeneration(admin, draft.id)
    if (!discarded || discarded.status !== "discarded") {
      throw new Error(`discard_failed:${draft.id}`)
    }
    discardedGenerationIds.push(draft.id)
  }

  const afterDiscardExisting = await findExistingAvaSupervisedSendableDraft(admin, input.leadId, {
    includeApproved: false,
  })
  if (afterDiscardExisting) {
    throw new Error("discard_did_not_clear_actionable_draft")
  }

  const regenerated = await runEquipifySupervisedAvaOutreach({
    admin,
    leadId: input.leadId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    organizationId,
    persist: true,
    ignoreApprovedExistingDraft: true,
  })

  if (!regenerated.ok) {
    const auditAfter = await auditSupervisedLeadGenerationState(admin, {
      organizationId,
      leadId: input.leadId,
    })
    return {
      qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
      leadId: input.leadId,
      dryRun: false,
      auditBefore,
      discardedGenerationId: targetGeneration?.id ?? null,
      discardedGenerationIds,
      regenerationAttempted: true,
      regenerationOk: false,
      regenerationCode: regenerated.code,
      regenerationMessage: regenerated.message,
      newGenerationId: null,
      persistenceStatus: null,
      decision: null,
      auditAfter,
    }
  }

  const output = regenerated.output
  const auditAfter = await auditSupervisedLeadGenerationState(admin, {
    organizationId,
    leadId: input.leadId,
  })

  return {
    qaMarker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
    leadId: input.leadId,
    dryRun: false,
    auditBefore,
    discardedGenerationId: targetGeneration?.id ?? null,
    discardedGenerationIds,
    regenerationAttempted: true,
    regenerationOk: output.decision === "pursue" && output.persistenceStatus === "persisted",
    regenerationCode: output.decision !== "pursue" ? "decision_not_pursue" : null,
    regenerationMessage:
      output.decision !== "pursue"
        ? output.rationale
        : output.persistenceStatus !== "persisted"
          ? `Persistence status: ${output.persistenceStatus}`
          : null,
    newGenerationId: output.persistedGenerationId,
    persistenceStatus: output.persistenceStatus,
    decision: output.decision,
    auditAfter,
  }
}

/** Minimal stale-draft freshness invariant (proposal only — not enforced globally). */
export const PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT = {
  summary:
    "Actionable supervised drafts with legacy signature markers or pre-boundary QA markers should be auto-invalidated before duplicate_reuse can block regeneration.",
  triggers: [
    "bodyContainsLegacyAvaSignatureMarkers(persistedBody)",
    "classification.signatureApplied === true on supervised cold_email drafts",
    "inputSnapshot.qaMarker predates ava-supervised-outbound-signature-boundary-core-1b-v1",
  ],
  action:
    "Mark draft discarded via discardGrowthAiCopilotGeneration; re-enter waiting_for_generation only when canonical readiness passes.",
} as const

export function isPersistedSupervisedDraftBodyUnsigned(body: string): boolean {
  const stripped = stripAccidentalAvaSignatureFromBody(body)
  return (
    !bodyContainsLegacyAvaSignatureMarkers(stripped) &&
    stripped.trim() === body.trim()
  )
}

export function wouldDuplicateReuseBlockRegeneration(input: {
  existingDraft: GrowthAiCopilotGeneration | null
}): boolean {
  return Boolean(input.existingDraft)
}

export { isSendableAvaSupervisedDraft }
