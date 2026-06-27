/** GE-AI-3D-PROD-2 — Adaptive calibration service (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { publishGrowthAiEvent } from "@/lib/growth/aios/event-bus/growth-ai-event-bus-service"
import {
  generateAdaptiveCalibrationProposalsFromInsights,
  validateAdaptiveCalibrationGuardrails,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-engine"
import {
  appendAdaptiveCalibrationEvent,
  listAdaptiveCalibrationProposals,
  summarizeAdaptiveCalibrationByOrganization,
  updateAdaptiveCalibrationProposalStatus,
  upsertAdaptiveCalibrationProposal,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-repository"
import {
  formatGrowthAdaptiveCalibrationSchemaNotReadyMessage,
  isGrowthAdaptiveCalibrationSchemaReady,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-schema-health"
import {
  buildAdaptiveCalibrationProposalIdempotencyKey,
  canTransitionAdaptiveCalibrationStatus,
  GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES,
  GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
  GROWTH_ADAPTIVE_CALIBRATION_RULE,
  type GrowthAdaptiveCalibrationAdvisoryContext,
  type GrowthAdaptiveCalibrationProposal,
  type GrowthAdaptiveCalibrationReadModel,
} from "@/lib/growth/aios/learning/growth-adaptive-calibration-types"
import type { GrowthLearningInsight } from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"
import type { GrowthRevenueDirectorReadModel } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

export type AdaptiveCalibrationMutationResult =
  | { ok: true; proposal: GrowthAdaptiveCalibrationProposal; applied: false }
  | { ok: false; error: string; message: string }

function buildEmptyReadModel(generatedAt: string, schemaReady: boolean): GrowthAdaptiveCalibrationReadModel {
  return {
    readOnly: true,
    advisoryOnly: true,
    noAutoApply: true,
    qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
    generatedAt,
    rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
    schemaReady,
    summary: {
      proposedCount: 0,
      approvedNotAppliedCount: 0,
      rejectedCount: 0,
      highestImpactTitle: null,
      targetSystemsAffected: [],
      lastGeneratedAt: null,
    },
    proposals: [],
  }
}

async function publishCalibrationLifecycleEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    proposal: GrowthAdaptiveCalibrationProposal
    occurredAt: string
    extra?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await publishGrowthAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: input.eventType,
      category: "learning",
      source: "growth_adaptive_calibration",
      producer: "growth_adaptive_calibration_service",
      subjectType: "system",
      subjectId: input.proposal.id,
      payload: {
        proposalId: input.proposal.id,
        targetSystem: input.proposal.targetSystem,
        proposalType: input.proposal.proposalType,
        status: input.proposal.status,
        noAutoApply: true,
        applied: false,
        ...input.extra,
      },
      metadata: { qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER, nonMutating: true },
      occurredAt: input.occurredAt,
    })
  } catch {
    // Non-blocking.
  }
}

export async function syncAdaptiveCalibrationProposalsFromInsights(
  admin: SupabaseClient,
  input: {
    organizationId: string
    generatedAt: string
    insights: GrowthLearningInsight[]
  },
): Promise<GrowthAdaptiveCalibrationProposal[]> {
  if (!(await isGrowthAdaptiveCalibrationSchemaReady(admin))) return []

  const generated = generateAdaptiveCalibrationProposalsFromInsights(input)
  const persisted: GrowthAdaptiveCalibrationProposal[] = []

  for (const proposal of generated) {
    const guardrail = validateAdaptiveCalibrationGuardrails(proposal)
    if (!guardrail.ok) continue

    const idempotencyKey = buildAdaptiveCalibrationProposalIdempotencyKey({
      organizationId: input.organizationId,
      sourceInsightId: proposal.sourceInsightId,
    })

    const { proposal: saved, inserted } = await upsertAdaptiveCalibrationProposal(admin, {
      organizationId: input.organizationId,
      idempotencyKey,
      proposal,
    })
    persisted.push(saved)

    if (inserted) {
      await appendAdaptiveCalibrationEvent(admin, {
        organizationId: input.organizationId,
        proposalId: saved.id,
        eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalCreated,
        payload: {
          proposalId: saved.id,
          sourceInsightId: saved.sourceInsightId,
          targetSystem: saved.targetSystem,
          proposalType: saved.proposalType,
        },
      })
      await publishCalibrationLifecycleEvent(admin, {
        organizationId: input.organizationId,
        eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalCreated,
        proposal: saved,
        occurredAt: input.generatedAt,
      })
    }
  }

  return persisted
}

export async function fetchGrowthAdaptiveCalibrationReadModel(
  admin: SupabaseClient | null,
  input: { organizationId: string; generatedAt: string },
): Promise<GrowthAdaptiveCalibrationReadModel> {
  if (!admin) return buildEmptyReadModel(input.generatedAt, false)

  let schemaReady = false
  try {
    schemaReady = await isGrowthAdaptiveCalibrationSchemaReady(admin)
  } catch {
    return buildEmptyReadModel(input.generatedAt, false)
  }

  if (!schemaReady) return buildEmptyReadModel(input.generatedAt, false)

  try {
    const [proposals, summary] = await Promise.all([
      listAdaptiveCalibrationProposals(admin, { organizationId: input.organizationId, limit: 50 }),
      summarizeAdaptiveCalibrationByOrganization(admin, { organizationId: input.organizationId }),
    ])

    const proposed = proposals.filter((row) => row.status === "proposed")
    const approved = proposals.filter((row) => row.status === "approved")
    const highest = [...proposals].sort((a, b) => b.impact - a.impact)[0] ?? null
    const systems = [...new Set(proposals.map((row) => row.targetSystem))]

    return {
      readOnly: true,
      advisoryOnly: true,
      noAutoApply: true,
      qaMarker: GROWTH_ADAPTIVE_CALIBRATION_QA_MARKER,
      generatedAt: input.generatedAt,
      rule: GROWTH_ADAPTIVE_CALIBRATION_RULE,
      schemaReady: true,
      summary: {
        proposedCount: summary.proposedCount,
        approvedNotAppliedCount: summary.approvedCount,
        rejectedCount: summary.rejectedCount,
        highestImpactTitle: highest?.title ?? null,
        targetSystemsAffected: systems,
        lastGeneratedAt: summary.lastGeneratedAt,
      },
      proposals,
    }
  } catch {
    return buildEmptyReadModel(input.generatedAt, false)
  }
}

export async function approveAdaptiveCalibrationProposal(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId: string
    operatorUserId: string
    occurredAt: string
  },
): Promise<AdaptiveCalibrationMutationResult> {
  if (!(await isGrowthAdaptiveCalibrationSchemaReady(admin))) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthAdaptiveCalibrationSchemaNotReadyMessage(),
    }
  }

  const { fetchAdaptiveCalibrationProposalById } = await import(
    "@/lib/growth/aios/learning/growth-adaptive-calibration-repository"
  )
  const existing = await fetchAdaptiveCalibrationProposalById(admin, {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
  })
  if (!existing) {
    return { ok: false, error: "proposal_not_found", message: "Calibration proposal not found." }
  }
  if (!canTransitionAdaptiveCalibrationStatus(existing.status, "approved")) {
    return { ok: false, error: "invalid_transition", message: `Cannot approve from status ${existing.status}.` }
  }

  const proposal = await updateAdaptiveCalibrationProposalStatus(admin, {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
    status: "approved",
    approvedByUserId: input.operatorUserId,
    approvedAt: input.occurredAt,
  })

  await appendAdaptiveCalibrationEvent(admin, {
    organizationId: input.organizationId,
    proposalId: proposal.id,
    eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalApproved,
    payload: { approvedByUserId: input.operatorUserId, applied: false },
  })

  await publishCalibrationLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalApproved,
    proposal,
    occurredAt: input.occurredAt,
    extra: { approvedByUserId: input.operatorUserId, applied: false },
  })

  return { ok: true, proposal, applied: false }
}

export async function rejectAdaptiveCalibrationProposal(
  admin: SupabaseClient,
  input: {
    organizationId: string
    proposalId: string
    operatorUserId: string
    occurredAt: string
    rejectionReason?: string
  },
): Promise<AdaptiveCalibrationMutationResult> {
  if (!(await isGrowthAdaptiveCalibrationSchemaReady(admin))) {
    return {
      ok: false,
      error: "schema_not_ready",
      message: formatGrowthAdaptiveCalibrationSchemaNotReadyMessage(),
    }
  }

  const { fetchAdaptiveCalibrationProposalById } = await import(
    "@/lib/growth/aios/learning/growth-adaptive-calibration-repository"
  )
  const existing = await fetchAdaptiveCalibrationProposalById(admin, {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
  })
  if (!existing) {
    return { ok: false, error: "proposal_not_found", message: "Calibration proposal not found." }
  }
  if (!canTransitionAdaptiveCalibrationStatus(existing.status, "rejected")) {
    return { ok: false, error: "invalid_transition", message: `Cannot reject from status ${existing.status}.` }
  }

  const proposal = await updateAdaptiveCalibrationProposalStatus(admin, {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
    status: "rejected",
    rejectedByUserId: input.operatorUserId,
    rejectedAt: input.occurredAt,
    rejectionReason: input.rejectionReason ?? "Operator rejected calibration proposal.",
  })

  await appendAdaptiveCalibrationEvent(admin, {
    organizationId: input.organizationId,
    proposalId: proposal.id,
    eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalRejected,
    payload: { rejectedByUserId: input.operatorUserId, reason: input.rejectionReason ?? null },
  })

  await publishCalibrationLifecycleEvent(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_ADAPTIVE_CALIBRATION_EVENT_TYPES.proposalRejected,
    proposal,
    occurredAt: input.occurredAt,
    extra: { rejectedByUserId: input.operatorUserId },
  })

  return { ok: true, proposal, applied: false }
}

export function buildAdaptiveCalibrationAdvisoryContext(input: {
  proposals: GrowthAdaptiveCalibrationProposal[]
}): GrowthAdaptiveCalibrationAdvisoryContext {
  const proposed = input.proposals.filter((row) => row.status === "proposed")
  const approved = input.proposals.filter((row) => row.status === "approved")
  const topProposal =
    proposed.sort((a, b) => b.impact - a.impact || b.confidence - a.confidence)[0] ?? null

  return {
    topProposal,
    proposedCount: proposed.length,
    approvedPendingApplyCount: approved.length,
    highestRiskLevel:
      proposed.find((row) => row.riskLevel === "high")?.riskLevel ??
      proposed[0]?.riskLevel ??
      null,
  }
}

export function enrichRevenueDirectorWithAdaptiveCalibration(input: {
  revenueDirector: GrowthRevenueDirectorReadModel
  calibration: GrowthAdaptiveCalibrationReadModel
}): GrowthRevenueDirectorReadModel {
  const advisory = buildAdaptiveCalibrationAdvisoryContext({ proposals: input.calibration.proposals })
  const top = advisory.topProposal

  return {
    ...input.revenueDirector,
    calibrationAdvisory: advisory,
    recommendations: top
      ? [
          {
            id: top.id,
            title: top.title,
            summary: `${top.summary} (calibration proposal — approve to record intent; no auto-apply)`,
            source: "adaptive_calibration",
          },
          ...input.revenueDirector.recommendations,
        ].slice(0, 8)
      : input.revenueDirector.recommendations,
  }
}
