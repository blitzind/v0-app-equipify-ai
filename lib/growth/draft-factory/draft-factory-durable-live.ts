/**
 * SV1-5A — Production live Draft Factory advancement (server-only).
 * Always resolves Postgres. Never falls back to memory on Postgres errors.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"
import { resolveGrowthCanonicalDecisionForLeadCached } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache"
import { evaluateDraftFactoryDecisionGate } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { logGrowthEngine } from "@/lib/growth/access"
import { recordRuntimeGuardrailAudit } from "@/lib/growth/runtime-guardrails/growth-runtime-audit-repository"
import {
  advanceDraftFactoryForLead,
  type AdvanceDraftFactoryForLeadInput,
} from "@/lib/growth/draft-factory/draft-factory-durable-service"
import {
  AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
  type AiOsDraftFactoryAdvanceResultV5,
  type AiOsDraftFactoryCanonicalEvidence,
  type AiOsDraftFactoryWakeInput,
} from "@/lib/growth/draft-factory/draft-factory-durable-types"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { evaluateResourceAllocationFacade } from "@/lib/growth/resource-allocation/resource-allocation-facade-engine"
import { buildResourceAllocationSignalsFromLead } from "@/lib/growth/resource-allocation/resource-allocation-signal-builders"
import { isProspectResearchStale } from "@/lib/growth/research/growth-lead-research-readiness"

export async function buildCanonicalEvidenceForLead(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    portfolioSelected?: boolean
  },
): Promise<AiOsDraftFactoryCanonicalEvidence> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return {
      admitted: false,
      researchCurrent: false,
      knowledgeComplete: false,
      stopInvestment: true,
      portfolioSelected: false,
      decisionMakerAvailable: false,
      contactVerifiedForEmail: false,
      personalizationReady: false,
      draftValid: false,
      approved: false,
      rejected: false,
      failed: true,
    }
  }

  const resource = evaluateResourceAllocationFacade({
    organizationId: input.organizationId,
    accountId: lead.id,
    resourceClass: "email_drafting",
    signals: buildResourceAllocationSignalsFromLead(lead, {
      approvalRequired: true,
      approvalGranted: false,
    }),
  })

  const hasUsableResearch = Boolean(lead.latestProspectResearchRunId && lead.lastProspectResearchedAt)
  const researchStale = lead.lastProspectResearchedAt
    ? isProspectResearchStale(lead.lastProspectResearchedAt)
    : true
  const researchCurrent = hasUsableResearch && !researchStale
  const decisionMakerAvailable =
    Boolean(lead.primaryDecisionMakerId) ||
    Boolean(lead.contactName?.trim()) ||
    lead.decisionMakerStatus === "confirmed" ||
    lead.decisionMakerStatus === "verified_contactable" ||
    lead.decisionMakerStatus === "suspected"

  // GE-AIOS-CONTACT-1A — usable provider email on lead or confirmed DM unblocks contact stage for drafting.
  // Independently verified status is preferred; available-unverified still allows prep (send remains gated).
  const contactVerifiedForEmail =
    lead.decisionMakerStatus === "verified_contactable" ||
    lead.decisionMakerStatus === "confirmed" ||
    (Boolean(lead.contactEmail?.includes("@")) && decisionMakerAvailable)

  return {
    admitted: true,
    researchCurrent,
    researchRunId: lead.latestProspectResearchRunId,
    knowledgeComplete: researchCurrent,
    investmentState: resource.investment_state,
    stopInvestment: resource.investment_state === "stop_investment",
    portfolioSelected: input.portfolioSelected === true,
    decisionMakerAvailable,
    decisionMakerId: lead.primaryDecisionMakerId,
    contactVerifiedForEmail,
    personalizationReady: researchCurrent && decisionMakerAvailable && contactVerifiedForEmail,
    draftValid: false,
    approved: false,
    rejected: false,
  }
}

/**
 * Live production entry — Postgres durable SoR + Growth 5F generation when eligible.
 */
export async function advanceDraftFactoryForLeadLive(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wake: string | AiOsDraftFactoryWakeInput
    now?: string
    portfolioSelected?: boolean
    workerId?: string
    allowGeneration?: boolean
    completionHints?: AdvanceDraftFactoryForLeadInput["completionHints"]
  },
): Promise<AiOsDraftFactoryAdvanceResultV5> {
  const now = input.now ?? new Date().toISOString()
  const workerId = input.workerId ?? `df-live:${now}`

  let repository
  try {
    const resolved = await resolveDraftFactoryDurableRepository({
      runtime: "production",
      admin,
    })
    repository = resolved.repository
    if (resolved.kind !== "postgres") {
      throw new Error(`SV1-5A: expected postgres repository, got ${resolved.kind}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("draft_factory_postgres_fail_closed", {
      organization_id: input.organizationId,
      lead_id: input.leadId,
      message: message.slice(0, 400),
    })
    await recordRuntimeGuardrailAudit(admin, {
      organizationId: input.organizationId,
      resourceType: "draft_factory:postgres_fail_closed",
      severity: "error",
      message: `Draft Factory Postgres fail-closed — ${message.slice(0, 200)}`,
      context: {
        qa_marker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
        lead_id: input.leadId,
        pendingHumanApproval: true,
        transportBlocked: true,
      },
    }).catch(() => undefined)

    return {
      qaMarker: AI_OS_DRAFT_FACTORY_DURABLE_QA_MARKER,
      organizationId: input.organizationId,
      leadId: input.leadId,
      wakeType: "scheduled_resume",
      wakeFingerprint: `${input.organizationId}:${input.leadId}:fail_closed:${now}`,
      outcome: "retryable_failure",
      previousState: null,
      nextState: "paused",
      previousStage: null,
      nextStage: null,
      stageEvaluated: null,
      reason: `Postgres durable store unavailable — deferred (no memory fallback). ${message.slice(0, 180)}`,
      packageId: null,
      transportBlocked: true,
      pendingHumanApproval: true,
      duplicate: false,
      state: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        state: "paused",
        earliestIncompleteStage: null,
        version: 0,
        packageId: null,
        researchRunId: null,
        decisionMakerId: null,
        personalizationId: null,
        lastWakeType: null,
        lastWakeAt: null,
        nextEligibleWakeAt: now,
        attemptCounts: {
          research: 0,
          decisionMaker: 0,
          contactVerification: 0,
          personalization: 0,
          generation: 0,
        },
        lastErrorCode: "postgres_unavailable",
        lastErrorStage: null,
        pausedReason: "postgres_fail_closed",
        leaseOwner: null,
        leaseExpiresAt: null,
        createdAt: now,
        updatedAt: now,
      },
      decidedAt: now,
    }
  }

  const evidence = await buildCanonicalEvidenceForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    portfolioSelected: input.portfolioSelected,
  })

  let allowGeneration = input.allowGeneration !== false
  let completionHints = { ...(input.completionHints ?? {}) }

  const wakeType =
    typeof input.wake === "string"
      ? input.wake
      : typeof input.wake === "object" && input.wake && "type" in input.wake
        ? String((input.wake as { type: string }).type)
        : "scheduled_resume"

  const canonicalDecision = await resolveGrowthCanonicalDecisionForLeadCached(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: now,
    cacheScope: "draft-factory:advance",
  }).catch(() => null)
  const draftFactoryGate = evaluateDraftFactoryDecisionGate(canonicalDecision, {
    wakeCondition: wakeType,
  })
  if (!draftFactoryGate.allowGeneration) {
    completionHints = {
      ...completionHints,
      decisionEnforcementBlocked: true,
      canonicalDecisionEnforcementOutcome: draftFactoryGate.outcome,
      canonicalEnforcementFingerprint: draftFactoryGate.enforcementFingerprint,
      decisionNextEligibleWakeAt: draftFactoryGate.nextEligibleWakeAt,
      generationCapacityAvailable: false,
    }
    allowGeneration = false
  }

  const shouldDiscoverDecisionMaker =
    !evidence.decisionMakerAvailable ||
    wakeType === "decision_maker_required" ||
    wakeType === "datamoon_person_requested" ||
    wakeType === "datamoon_person_completed" ||
    wakeType === "datamoon_person_failed" ||
    wakeType === "provider_capacity_available"

  if (shouldDiscoverDecisionMaker && !evidence.stopInvestment) {
    try {
      const { evaluateAndEnrichDecisionMakerForLead } = await import(
        "@/lib/growth/datamoon-decision-maker/datamoon-dm-service"
      )
      const dmDecision = await evaluateAndEnrichDecisionMakerForLead(admin, {
        organizationId: input.organizationId,
        leadId: input.leadId,
        portfolioSelected: input.portfolioSelected === true,
        budgetAvailable: true,
        useLiveDiscoveryAdapter: true,
        generatedAt: now,
      })

      if (dmDecision.outcome === "provider_pending") {
        completionHints = {
          ...completionHints,
          inFlightDatamoon: true,
        }
        const nextPoll =
          dmDecision.explainability.providerProvenance
            .find((entry) => entry.startsWith("next_poll_at:"))
            ?.replace("next_poll_at:", "") ?? null
        if (nextPoll) {
          // Persist next eligible wake via repository after advance — pass through hints.
          completionHints = {
            ...completionHints,
            portfolioDeferred: false,
          }
          logGrowthEngine("datamoon_dm_discovery_pending_in_durable_df", {
            organization_id: input.organizationId,
            lead_id: input.leadId,
            next_poll_at: nextPoll,
            outcome: dmDecision.outcome,
          })
        }
      } else if (dmDecision.resumeDraftFactoryTo === "personalization" && dmDecision.selectedCandidate) {
        // Rebuild evidence so contact/DM flags reflect CONTACT-1A persistence.
        const refreshed = await buildCanonicalEvidenceForLead(admin, {
          organizationId: input.organizationId,
          leadId: input.leadId,
          portfolioSelected: input.portfolioSelected,
        })
        Object.assign(evidence, refreshed)
        completionHints = {
          ...completionHints,
          inFlightDatamoon: false,
          completeCurrentStage: wakeType === "datamoon_person_completed" ? true : completionHints.completeCurrentStage,
        }
      }
    } catch (error) {
      logGrowthEngine("datamoon_dm_discovery_durable_df_failed", {
        organization_id: input.organizationId,
        lead_id: input.leadId,
        message: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
      })
    }
  }

  return advanceDraftFactoryForLead({
    organizationId: input.organizationId,
    leadId: input.leadId,
    wake: input.wake,
    now,
    evidence,
    workerId,
    repository,
    completionHints,
    generateViaGrowth5F: allowGeneration
      ? async ({ organizationId, leadId, now: generatedAt }) => {
          const persisted = await generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory(
            admin,
            {
              organizationId,
              leadId,
              generatedAt,
            },
          )
          if (!persisted) return null
          return {
            packageId: persisted.packageId,
            pendingHumanApproval: true as const,
            transportBlocked: true as const,
          }
        }
      : undefined,
  })
}

/**
 * Fire-and-forget safe wake from completion events. Never throws to callers.
 */
export async function wakeDraftFactoryFromCompletionEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    wake: string | AiOsDraftFactoryWakeInput
    portfolioSelected?: boolean
    allowGeneration?: boolean
  },
): Promise<AiOsDraftFactoryAdvanceResultV5 | null> {
  try {
    return await advanceDraftFactoryForLeadLive(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      wake: input.wake,
      portfolioSelected: input.portfolioSelected ?? true,
      allowGeneration: input.allowGeneration === true,
      completionHints: { completeCurrentStage: true },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logGrowthEngine("draft_factory_wake_event_failed", {
      organization_id: input.organizationId,
      lead_id: input.leadId,
      message: message.slice(0, 240),
    })
    return null
  }
}
