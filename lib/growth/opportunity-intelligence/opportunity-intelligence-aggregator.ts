/** GE-OPPORTUNITY-INTELLIGENCE-1A — Aggregate existing intelligence into one read model. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { queryAiOsEvents } from "@/lib/growth/aios/ai-event-service"
import type { GrowthLeadResearchEvidenceSummary } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import type { GrowthLeadResearchNextBestAction } from "@/lib/growth/aios/growth/growth-lead-research-opportunity-assessment"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  listOpportunityRecommendations,
  listOpportunitySignals,
} from "@/lib/growth/opportunity-intelligence/crm-intelligence"
import {
  availableOpportunityIntelligenceField,
  unavailableOpportunityIntelligenceField,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-field"
import {
  GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
  hasAnyWorkflowSignal,
  parseGrowthLeadResearchWorkflowSnapshotFromEvent,
  readLeadNextBestActionFromLead,
  readProspectQualificationFromLeadMetadata,
  readRevenueExecutionTimelineFromMetadata,
  readRevenueReadinessSnapshotFromMetadata,
  readWorkflowSignalsFromLead,
  workflowSignalsComputedAt,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-readers"
import { OPPORTUNITY_INTELLIGENCE_SOURCES } from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-sources"
import {
  GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER,
  type OpportunityIntelligenceConfidenceValue,
  type OpportunityIntelligenceLabeledItem,
  type OpportunityIntelligenceRecommendationValue,
  type OpportunityIntelligenceViewModel,
} from "@/lib/growth/opportunity-intelligence/opportunity-intelligence-view-model-types"
import type { GrowthOpportunitySignalType } from "@/lib/growth/opportunity-intelligence/opportunity-types"
import { GROWTH_NEXT_BEST_ACTION_LABELS, type GrowthNextBestActionResult } from "@/lib/growth/nba-types"

const BUYING_SIGNAL_TYPES = new Set<GrowthOpportunitySignalType>([
  "meeting_interest",
  "budget_signal",
  "pricing_interest",
  "proposal_request",
  "urgency_signal",
  "timeline_interest",
])

export type BuildOpportunityIntelligenceViewModelInput = {
  admin: SupabaseClient
  leadId: string
  organizationId: string
}

export async function fetchLatestGrowthLeadResearchWorkflowSnapshot(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string },
) {
  const events = await queryAiOsEvents(admin, {
    organizationId: input.organizationId,
    eventType: GROWTH_LEAD_RESEARCH_WORKFLOW_STATUS_EVENT,
    limit: 100,
  })

  for (const event of events) {
    const leadId = event.entityId
    if (leadId !== input.leadId) continue

    const snapshot = parseGrowthLeadResearchWorkflowSnapshotFromEvent({
      leadId: input.leadId,
      occurredAt: event.occurredAt,
      missionId: event.missionId,
      workOrderId: event.workOrderId,
      payload: event.payload,
    })
    if (snapshot) return snapshot
  }

  return null
}

function collectRisks(input: {
  qualification: ReturnType<typeof readProspectQualificationFromLeadMetadata>
  revenueReadiness: ReturnType<typeof readRevenueReadinessSnapshotFromMetadata>
  researchEvidence: GrowthLeadResearchEvidenceSummary | null | undefined
  leadBlockers: Array<{ key: string; label: string }>
}): OpportunityIntelligenceLabeledItem[] {
  const items: OpportunityIntelligenceLabeledItem[] = []

  for (const risk of input.qualification?.risks ?? []) {
    items.push({ label: risk, source: OPPORTUNITY_INTELLIGENCE_SOURCES.prospectQualificationEngine })
  }
  for (const risk of input.revenueReadiness?.topRisks ?? []) {
    items.push({
      label: risk.label,
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.revenueReadiness,
      kind: risk.kind,
    })
  }
  for (const risk of input.researchEvidence?.potentialRisks ?? []) {
    items.push({ label: risk, source: OPPORTUNITY_INTELLIGENCE_SOURCES.researchEvidence })
  }
  for (const blocker of input.leadBlockers) {
    items.push({
      label: blocker.label,
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.workflowSignals,
      kind: blocker.key,
    })
  }

  return items
}

function collectStrengths(input: {
  qualification: ReturnType<typeof readProspectQualificationFromLeadMetadata>
  revenueReadiness: ReturnType<typeof readRevenueReadinessSnapshotFromMetadata>
  researchEvidence: { verifiedEvidence: string[] } | null | undefined
}): OpportunityIntelligenceLabeledItem[] {
  const items: OpportunityIntelligenceLabeledItem[] = []

  for (const strength of input.qualification?.strengths ?? []) {
    items.push({ label: strength, source: OPPORTUNITY_INTELLIGENCE_SOURCES.prospectQualificationEngine })
  }
  for (const signal of input.revenueReadiness?.topPositiveSignals ?? []) {
    items.push({
      label: signal.label,
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.revenueReadiness,
      kind: signal.kind,
    })
  }
  for (const evidence of input.researchEvidence?.verifiedEvidence ?? []) {
    items.push({ label: evidence, source: OPPORTUNITY_INTELLIGENCE_SOURCES.researchEvidence })
  }

  return items
}

function collectBlockers(input: {
  qualification: ReturnType<typeof readProspectQualificationFromLeadMetadata>
  researchQualificationMissing: string[]
  leadBlockers: Array<{ key: string; label: string }>
}): OpportunityIntelligenceLabeledItem[] {
  const items: OpportunityIntelligenceLabeledItem[] = []

  for (const blocker of input.qualification?.blockers ?? []) {
    items.push({ label: blocker, source: OPPORTUNITY_INTELLIGENCE_SOURCES.prospectQualificationEngine })
  }
  for (const missing of input.researchQualificationMissing) {
    items.push({ label: missing, source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchQualification })
  }
  for (const blocker of input.leadBlockers) {
    items.push({
      label: blocker.label,
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.workflowSignals,
      kind: blocker.key,
    })
  }

  return items
}

function resolveUpdatedAt(input: {
  leadUpdatedAt?: string | null
  revenueReadiness: ReturnType<typeof readRevenueReadinessSnapshotFromMetadata>
  workflowSignalsAt: string | null
  researchUpdatedAt: string | null
  buyingSignalsAt: string | null
  leadNbaAt: string | null
}): string {
  const timestamps = [
    input.revenueReadiness?.computedAt,
    input.workflowSignalsAt,
    input.researchUpdatedAt,
    input.buyingSignalsAt,
    input.leadNbaAt,
    input.leadUpdatedAt,
  ].filter((value): value is string => typeof value === "string" && value.length > 0)

  if (timestamps.length === 0) return new Date().toISOString()
  return timestamps.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]!
}

export async function buildOpportunityIntelligenceViewModel(
  input: BuildOpportunityIntelligenceViewModelInput,
): Promise<OpportunityIntelligenceViewModel | null> {
  const lead = await fetchGrowthLeadById(input.admin, input.leadId)
  if (!lead) return null

  const [researchSnapshot, opportunitySignals, opportunityRecommendations] = await Promise.all([
    fetchLatestGrowthLeadResearchWorkflowSnapshot(input.admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
    }),
    listOpportunitySignals(input.admin, { leadId: input.leadId, limit: 50 }),
    listOpportunityRecommendations(input.admin, { leadId: input.leadId, status: "pending", limit: 10 }),
  ])

  const qualificationValue = readProspectQualificationFromLeadMetadata(lead.metadata)
  const revenueReadinessValue = readRevenueReadinessSnapshotFromMetadata(lead.metadata)
  const executionTimelineValue = readRevenueExecutionTimelineFromMetadata(lead.metadata)
  const workflowSignalsValue = readWorkflowSignalsFromLead(lead)
  const leadNba = readLeadNextBestActionFromLead(lead)

  const buyingSignals = opportunitySignals.filter((signal) => BUYING_SIGNAL_TYPES.has(signal.signalType))
  const buyingSignalsComputedAt =
    buyingSignals.length > 0
      ? buyingSignals
          .map((signal) => signal.detectedAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
      : null

  const qualification = qualificationValue
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.prospectQualificationEngine,
        computedAt: qualificationValue.generatedAt,
        value: qualificationValue,
      })
    : unavailableOpportunityIntelligenceField()

  const revenueReadiness = revenueReadinessValue
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.revenueReadiness,
        computedAt: revenueReadinessValue.computedAt,
        value: revenueReadinessValue,
      })
    : unavailableOpportunityIntelligenceField()

  const revenueWorkflow = revenueReadinessValue
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.unifiedRevenueWorkflow,
        computedAt: revenueReadinessValue.computedAt,
        value: revenueReadinessValue,
      })
    : unavailableOpportunityIntelligenceField()

  let nextBestAction = unavailableOpportunityIntelligenceField<
    GrowthNextBestActionResult | GrowthLeadResearchNextBestAction
  >()

  if (researchSnapshot?.nextBestAction) {
    nextBestAction = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchNextBestAction,
      computedAt: researchSnapshot.updatedAt,
      value: researchSnapshot.nextBestAction,
    })
  } else if (leadNba.action) {
    nextBestAction = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.leadNextBestAction,
      computedAt: leadNba.computedAt,
      value: {
        action: leadNba.action,
        reason: leadNba.reason ?? "",
        confidence: "medium",
        label: leadNba.label ?? GROWTH_NEXT_BEST_ACTION_LABELS[leadNba.action],
        blockers: [],
        actionVersion: "v2",
      },
    })
  }

  const opportunityAssessment = researchSnapshot?.opportunityAssessment
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchOpportunityAssessment,
        computedAt: researchSnapshot.updatedAt,
        value: researchSnapshot.opportunityAssessment,
      })
    : unavailableOpportunityIntelligenceField()

  const workflowSignalsComputedAtValue = workflowSignalsComputedAt(lead)
  const workflowSignals = hasAnyWorkflowSignal(workflowSignalsValue)
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.workflowSignals,
        computedAt: workflowSignalsComputedAtValue,
        value: workflowSignalsValue,
      })
    : unavailableOpportunityIntelligenceField()

  const buyingSignalsField =
    buyingSignals.length > 0
      ? availableOpportunityIntelligenceField({
          source: OPPORTUNITY_INTELLIGENCE_SOURCES.buyingSignals,
          computedAt: buyingSignalsComputedAt,
          value: buyingSignals,
        })
      : unavailableOpportunityIntelligenceField()

  const evidenceSummary = researchSnapshot?.evidenceSummary
    ? availableOpportunityIntelligenceField({
        source: OPPORTUNITY_INTELLIGENCE_SOURCES.researchEvidence,
        computedAt: researchSnapshot.updatedAt,
        value: researchSnapshot.evidenceSummary,
      })
    : unavailableOpportunityIntelligenceField()

  let recommendation = unavailableOpportunityIntelligenceField<OpportunityIntelligenceRecommendationValue>()

  if (researchSnapshot?.opportunityAssessment?.recommendation) {
    recommendation = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchOpportunityAssessment,
      computedAt: researchSnapshot.updatedAt,
      value: {
        recommendation: researchSnapshot.opportunityAssessment.recommendation,
        description: researchSnapshot.opportunityAssessment.summary,
      },
    })
  } else if (opportunityRecommendations[0]) {
    const pending = opportunityRecommendations[0]
    recommendation = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.opportunityRecommendation,
      computedAt: pending.updatedAt,
      value: {
        recommendation: pending.recommendationType,
        recommendationType: pending.recommendationType,
        title: pending.title,
        description: pending.description,
        requiresHumanApproval: pending.requiresHumanApproval,
      },
    })
  }

  let confidence = unavailableOpportunityIntelligenceField<OpportunityIntelligenceConfidenceValue>()

  if (researchSnapshot?.opportunityAssessment) {
    confidence = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchOpportunityAssessment,
      computedAt: researchSnapshot.updatedAt,
      value: {
        confidence: researchSnapshot.opportunityAssessment.confidence,
        reason: researchSnapshot.opportunityAssessment.summary,
      },
    })
  } else if (qualificationValue) {
    confidence = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.prospectQualificationEngine,
      computedAt: qualificationValue.generatedAt,
      value: {
        confidence: qualificationValue.confidence,
      },
    })
  } else if (researchSnapshot?.qualification) {
    confidence = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.growthLeadResearchQualification,
      computedAt: researchSnapshot.updatedAt,
      value: {
        confidence: researchSnapshot.qualification.confidence,
        reason: researchSnapshot.qualification.reason,
      },
    })
  } else if (opportunityRecommendations[0]?.metadata?.confidenceLabel) {
    const pending = opportunityRecommendations[0]
    const meta = pending.metadata ?? {}
    confidence = availableOpportunityIntelligenceField({
      source: OPPORTUNITY_INTELLIGENCE_SOURCES.opportunityRecommendation,
      computedAt: pending.updatedAt,
      value: {
        confidence: typeof meta.confidence === "number" ? meta.confidence : 0,
        confidenceLabel: typeof meta.confidenceLabel === "string" ? meta.confidenceLabel : undefined,
      },
    })
  }

  const leadBlockers = lead.opportunityBlockers.map((blocker) => ({
    key: blocker.key,
    label: blocker.label,
  }))

  const riskItems = collectRisks({
    qualification: qualificationValue,
    revenueReadiness: revenueReadinessValue,
    researchEvidence: researchSnapshot?.evidenceSummary ?? null,
    leadBlockers,
  })
  const risks =
    riskItems.length > 0
      ? availableOpportunityIntelligenceField({
          source: OPPORTUNITY_INTELLIGENCE_SOURCES.researchEvidence,
          computedAt: researchSnapshot?.updatedAt ?? revenueReadinessValue?.computedAt ?? null,
          value: riskItems,
        })
      : unavailableOpportunityIntelligenceField()

  const strengthItems = collectStrengths({
    qualification: qualificationValue,
    revenueReadiness: revenueReadinessValue,
    researchEvidence: researchSnapshot?.evidenceSummary ?? null,
  })
  const strengths =
    strengthItems.length > 0
      ? availableOpportunityIntelligenceField({
          source: OPPORTUNITY_INTELLIGENCE_SOURCES.researchEvidence,
          computedAt: researchSnapshot?.updatedAt ?? revenueReadinessValue?.computedAt ?? null,
          value: strengthItems,
        })
      : unavailableOpportunityIntelligenceField()

  const blockerItems = collectBlockers({
    qualification: qualificationValue,
    researchQualificationMissing: researchSnapshot?.qualification?.missingEvidence ?? [],
    leadBlockers,
  })
  const blockers =
    blockerItems.length > 0
      ? availableOpportunityIntelligenceField({
          source: OPPORTUNITY_INTELLIGENCE_SOURCES.workflowSignals,
          computedAt: researchSnapshot?.updatedAt ?? workflowSignalsComputedAtValue,
          value: blockerItems,
        })
      : unavailableOpportunityIntelligenceField()

  const executionTimeline =
    executionTimelineValue.length > 0
      ? availableOpportunityIntelligenceField({
          source: OPPORTUNITY_INTELLIGENCE_SOURCES.revenueExecutionTimeline,
          computedAt:
            executionTimelineValue
              .map((entry) => entry.occurredAt)
              .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null,
          value: executionTimelineValue,
        })
      : unavailableOpportunityIntelligenceField()

  return {
    qa_marker: GROWTH_OPPORTUNITY_INTELLIGENCE_LAYER_QA_MARKER,
    leadId: input.leadId,
    organizationId: input.organizationId,
    qualification,
    revenueReadiness,
    nextBestAction,
    opportunityAssessment,
    workflowSignals,
    buyingSignals: buyingSignalsField,
    evidenceSummary,
    recommendation,
    confidence,
    risks,
    strengths,
    blockers,
    revenueWorkflow,
    executionTimeline,
    updatedAt: resolveUpdatedAt({
      revenueReadiness: revenueReadinessValue,
      workflowSignalsAt: workflowSignalsComputedAtValue,
      researchUpdatedAt: researchSnapshot?.updatedAt ?? null,
      buyingSignalsAt: buyingSignalsComputedAt,
      leadNbaAt: leadNba.computedAt,
    }),
  }
}
