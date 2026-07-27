/**
 * AVA-SUPERVISED-GPT-SCHEDULER-WIRING-1A — Draft Factory scheduler → supervised GPT-5.5 generation.
 *
 * Replaces legacy deterministic Growth 5F package builder on the Ava scheduler path.
 * Legacy package persistence remains available to non-scheduler callers.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { evaluateGrowth5fPackagePreparation } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { invalidateCanonicalDecisionCacheForLead } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { selectLatestAuthoritativeOutreachPackage } from "@/lib/growth/aios/growth/growth-canonical-outreach-package-authority-1a"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { findExistingAvaSupervisedSendableDraft } from "@/lib/growth/ava-reasoning/equipify-supervised-draft-persistence"
import { runEquipifySupervisedAvaOutreach } from "@/lib/growth/ava-reasoning/equipify-supervised-cutover-service"
import {
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
  GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
  buildDraftFactorySchedulerGenerationProvenance,
} from "@/lib/growth/draft-factory/draft-factory-scheduler-actor-1a"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import {
  createGrowthAiOsRuntimeContext,
} from "@/lib/growth/aios/runtime/growth-aios-runtime-context-1a"

export type DraftFactorySupervisedAvaGenerationHandoffResult =
  | {
      packageId: string
      generationId: string
      pendingHumanApproval: true
      transportBlocked: true
      gptOutcome: "pursue" | "duplicate_reused"
    }
  | {
      gptOutcome: "reject"
      reason: string
    }
  | {
      gptOutcome: "hold"
      reason: string
    }
  | null

export function createDraftFactorySupervisedAvaGenerationHandoff(admin: SupabaseClient) {
  return async (input: {
    organizationId: string
    leadId: string
    now: string
  }): Promise<DraftFactorySupervisedAvaGenerationHandoffResult> =>
    runDraftFactorySupervisedAvaGenerationForScheduler(admin, input)
}

export async function runDraftFactorySupervisedAvaGenerationForScheduler(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    generatedAt: string
  },
): Promise<DraftFactorySupervisedAvaGenerationHandoffResult> {
  let draftFactoryPackageId: string | null = null
  let draftFactoryState: string | null = null
  try {
    const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
    if (resolved.kind === "postgres") {
      const dfState = await resolved.repository.getLeadState(input.organizationId, input.leadId)
      draftFactoryPackageId = dfState?.packageId ?? null
      draftFactoryState = dfState?.state ?? null
    }
  } catch {
    // Non-fatal — authority falls back to package body checks.
  }

  const existingDraft = await findExistingAvaSupervisedSendableDraft(admin, input.leadId, {
    includeApproved: false,
  }).catch(() => null)
  if (existingDraft?.id) {
    logGrowthEngine("draft_factory_supervised_generation_duplicate_reused", {
      qa_marker: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      generation_id: existingDraft.id,
    })
    return {
      packageId: existingDraft.id,
      generationId: existingDraft.id,
      pendingHumanApproval: true,
      transportBlocked: true,
      gptOutcome: "duplicate_reused",
    }
  }

  const priorRuns = await listOutreachPreparationRunsForLead(
    admin,
    input.organizationId,
    input.leadId,
  ).catch(() => [])

  const previousPackage = selectLatestAuthoritativeOutreachPackage({
    runs: priorRuns,
    draftFactoryPackageId,
    draftFactoryState,
  })

  if (!previousPackage && priorRuns.some((run) => run.approvalPackage?.pendingHumanApproval)) {
    invalidateCanonicalDecisionCacheForLead(input.leadId, "orphan_package_not_authoritative")
  }

  const runtimeContext = createGrowthAiOsRuntimeContext(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    boundary: "growth_5f_generation",
    cacheScope: "growth5f:supervised-scheduler",
    generatedAt: input.generatedAt,
    packageSnapshot: previousPackage,
    bypassDecisionCache: !previousPackage && draftFactoryState === "waiting_for_generation",
  })

  const canonicalDecision = await runtimeContext.getDecision().catch(() => null)
  const packageEnforcement = evaluateGrowth5fPackagePreparation(canonicalDecision, {
    proposedPurpose: "supervised_ava_outreach_generation",
    wakeCondition: "execution_completed",
    isDraftFactoryGenerationWake: true,
  })
  if (!packageEnforcement.allowed) {
    logGrowthEngine("draft_factory_supervised_generation_blocked_by_canonical_decision", {
      qa_marker: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      outcome: packageEnforcement.outcome,
      reason: packageEnforcement.reason,
      enforcement_fingerprint: packageEnforcement.enforcementFingerprint,
    })
    return null
  }

  const supervised = await runEquipifySupervisedAvaOutreach({
    admin,
    leadId: input.leadId,
    organizationId: input.organizationId,
    actingUserEmail: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_EMAIL,
    autonomousProvenance: buildDraftFactorySchedulerGenerationProvenance({
      organizationId: input.organizationId,
      generatedAt: input.generatedAt,
    }),
    persist: true,
    ignoreApprovedExistingDraft: false,
  })

  if (!supervised.ok) {
    logGrowthEngine("draft_factory_supervised_generation_failed", {
      qa_marker: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      code: supervised.code,
      message: supervised.message,
    })
    return null
  }

  const output = supervised.output
  const decision = output.decision

  logGrowthEngine("draft_factory_supervised_generation_completed", {
    qa_marker: GROWTH_AVA_SUPERVISED_SCHEDULER_ACTOR_1A_QA_MARKER,
    organization_id: input.organizationId,
    lead_id: input.leadId,
    decision,
    model: output.model,
    persisted_generation_id: output.persistedGenerationId,
    persistence_status: output.persistenceStatus,
    signature_applied: output.signatureApplied,
  })

  if (decision === "reject") {
    return {
      gptOutcome: "reject",
      reason: output.rationale?.trim() || "Supervised Ava rejected this prospect.",
    }
  }

  if (decision === "hold" || decision === "needs_more_research") {
    return {
      gptOutcome: "hold",
      reason: output.rationale?.trim() || `Supervised Ava ${decision}.`,
    }
  }

  const generationId = output.persistedGenerationId
  if (decision === "pursue" && generationId) {
    invalidateCanonicalDecisionCacheForLead(input.leadId, "supervised_generation_created")
    return {
      packageId: generationId,
      generationId,
      pendingHumanApproval: true,
      transportBlocked: true,
      gptOutcome: "pursue",
    }
  }

  if (decision === "pursue" && !generationId) {
    return {
      gptOutcome: "hold",
      reason:
        output.persistenceStatus === "duplicate_reused"
          ? "Pursue decision but an existing supervised draft already exists."
          : "Pursue decision did not produce a sendable supervised draft.",
    }
  }

  return {
    gptOutcome: "hold",
    reason: output.rationale?.trim() || `Unexpected supervised decision: ${String(decision)}`,
  }
}
