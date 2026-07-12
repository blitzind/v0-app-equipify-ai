/**
 * SV1-5A — Production live Draft Factory advancement (server-only).
 * Always resolves Postgres. Never falls back to memory on Postgres errors.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAutonomousOutreachApprovalPackage } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service"
import { fetchLatestGrowthLeadResearchWorkflowSnapshot } from "@/lib/growth/aios/growth/growth-lead-research-workflow-service"
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
    contactVerifiedForEmail:
      lead.decisionMakerStatus === "verified_contactable" ||
      lead.decisionMakerStatus === "confirmed",
    personalizationReady: researchCurrent && decisionMakerAvailable,
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

  const allowGeneration = input.allowGeneration !== false

  return advanceDraftFactoryForLead({
    organizationId: input.organizationId,
    leadId: input.leadId,
    wake: input.wake,
    now,
    evidence,
    workerId,
    repository,
    completionHints: input.completionHints,
    generateViaGrowth5F: allowGeneration
      ? async ({ organizationId, leadId, now: generatedAt }) => {
          const lead = await fetchGrowthLeadById(admin, leadId)
          if (!lead) return null
          const snapshot = await fetchLatestGrowthLeadResearchWorkflowSnapshot(admin, {
            organizationId,
            leadId,
          })
          if (!snapshot) return null
          const growth5f = await buildAutonomousOutreachApprovalPackage(admin, {
            organizationId,
            leadId,
            companyName: lead.companyName,
            snapshot,
            generatedAt,
          })
          if (growth5f.pendingHumanApproval !== true || growth5f.transportBlocked !== true) {
            return null
          }
          return {
            packageId: growth5f.packageId,
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
