import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import type { GrowthLeadStatus } from "@/lib/growth/types"

type Actor = { userId?: string | null; email?: string | null }

const CALL_DISPOSITION_TIMELINE: Partial<Record<GrowthLeadCallDisposition, GrowthLeadTimelineEventType>> = {
  call_attempted: "call_attempted",
  left_voicemail: "voicemail_left",
  interested: "interested",
  follow_up_later: "follow_up_created",
  no_answer: "call_attempted",
}

export async function emitGrowthLeadCreatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; companyName: string; sourceKind: string; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_created",
    title: "Lead created",
    summary: input.companyName,
    payload: { sourceKind: input.sourceKind },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadStatusChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: GrowthLeadStatus; to: GrowthLeadStatus; actor?: Actor },
) {
  if (input.from === input.to) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "status_changed",
    title: "Status changed",
    summary: `${input.from.replace(/_/g, " ")} → ${input.to.replace(/_/g, " ")}`,
    payload: { from: input.from, to: input.to },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadWebsiteChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: string | null; to: string | null; actor?: Actor },
) {
  if ((input.from ?? null) === (input.to ?? null)) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "website_changed",
    title: "Website changed",
    summary: input.to ?? "Removed",
    payload: { from: input.from, to: input.to },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadNotesUpdatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; field: "lead_notes" | "research_notes"; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "notes_updated",
    title: "Notes updated",
    summary: input.field === "lead_notes" ? "Lead notes" : "Research notes",
    payload: { field: input.field },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadOverrideChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number | null; to: number | null; actor?: Actor },
) {
  if (input.from === input.to) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "override_changed",
    title: "Priority override changed",
    summary: input.to != null ? `Override set to ${input.to}` : "Override cleared",
    payload: { from: input.from, to: input.to },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadPriorityChangedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    fromScore: number | null
    toScore: number | null
    fromTier: string | null
    toTier: string | null
  },
) {
  if (input.fromScore === input.toScore && input.fromTier === input.toTier) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "priority_changed",
    title: "Call priority changed",
    summary: `${input.fromScore ?? "—"} → ${input.toScore ?? "—"} (${input.toTier ?? "—"})`,
    payload: {
      fromScore: input.fromScore,
      toScore: input.toScore,
      fromTier: input.fromTier,
      toTier: input.toTier,
    },
  })
}

export async function emitGrowthLeadNextBestActionChangedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    from: GrowthNextBestAction | null
    to: GrowthNextBestAction | null
    reason?: string | null
  },
) {
  if (input.from === input.to) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "next_best_action_changed",
    title: "Next best action changed",
    summary: input.to?.replace(/_/g, " ") ?? "Cleared",
    payload: { from: input.from, to: input.to, reason: input.reason ?? null },
  })
}

export async function emitGrowthLeadResearchTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: "research_started" | "research_completed" | "research_failed"
    runId: string
    summary?: string
    payload?: Record<string, unknown>
    actor?: Actor
  },
) {
  const titles = {
    research_started: "Research started",
    research_completed: "Research completed",
    research_failed: "Research failed",
  } as const

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: titles[input.eventType],
    summary: input.summary,
    payload: input.payload ?? {},
    researchRunId: input.runId,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadWebsiteFetchTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: "website_fetch_failed" | "website_fetch_fixed"
    runId: string
    status: string
    url?: string | null
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: input.eventType === "website_fetch_failed" ? "Website fetch failed" : "Website fetch fixed",
    summary: input.status,
    payload: { status: input.status, url: input.url ?? null },
    researchRunId: input.runId,
  })
}

export async function emitGrowthLeadDecisionMakerTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    eventType: "decision_maker_added" | "decision_maker_confirmed" | "decision_maker_rejected"
    decisionMakerId: string
    fullName: string
    actor?: Actor
  },
) {
  const titles = {
    decision_maker_added: "Decision maker added",
    decision_maker_confirmed: "Decision maker confirmed",
    decision_maker_rejected: "Decision maker rejected",
  } as const

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: input.eventType,
    title: titles[input.eventType],
    summary: input.fullName,
    decisionMakerId: input.decisionMakerId,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadCallStartedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    sessionId: string
    phoneDialed: string
    dialMode: string
    actor?: Actor
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "call_started",
    title: "Dial initiated",
    summary: input.phoneDialed,
    payload: { sessionId: input.sessionId, dialMode: input.dialMode, phoneDialed: input.phoneDialed },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadCallDispositionTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    disposition: GrowthLeadCallDisposition
    callEventId: string
    followUpAt?: string | null
    actor?: Actor
  },
) {
  const eventType = CALL_DISPOSITION_TIMELINE[input.disposition]
  if (!eventType) return

  const titles: Record<string, string> = {
    call_attempted: input.disposition === "no_answer" ? "No answer" : "Call attempted",
    voicemail_left: "Voicemail left",
    interested: "Marked interested",
    follow_up_created: "Follow-up scheduled",
  }

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType,
    title: titles[eventType] ?? input.disposition,
    summary: input.followUpAt ? `Follow up ${input.followUpAt}` : null,
    payload: { disposition: input.disposition, followUpAt: input.followUpAt ?? null },
    callEventId: input.callEventId,
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadManualTouchTimeline(
  admin: SupabaseClient,
  input: { leadId: string; note?: string | null; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "manual_touch",
    title: "Manual Touch",
    summary: input.note?.trim() ? input.note.trim() : null,
    payload: { noteLength: input.note?.trim()?.length ?? 0 },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadImportCreatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; batchId: string; rowIndex: number; companyName: string; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "import_created",
    title: "Lead imported",
    summary: input.companyName,
    payload: { batchId: input.batchId, rowIndex: input.rowIndex },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadImportUpdatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; batchId: string; rowIndex: number; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "import_updated",
    title: "Lead updated from import",
    summary: `Batch row ${input.rowIndex + 1}`,
    payload: { batchId: input.batchId, rowIndex: input.rowIndex },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadFollowUpCompletedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; followUpAt: string | null; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "follow_up_completed",
    title: "Follow-up completed",
    summary: input.followUpAt,
    payload: { followUpAt: input.followUpAt },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthLeadEngagementScoreChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "engagement_score_changed",
    title: "Engagement score changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadEngagementTierChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: string; to: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "engagement_tier_changed",
    title: "Engagement tier changed",
    summary: `${input.from} → ${input.to}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadBecameHotTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_hot",
    title: "Lead became hot",
    summary: `Engagement score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadBecameDormantTimeline(
  admin: SupabaseClient,
  input: { leadId: string; lastActivityAt: string | null },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_dormant",
    title: "Lead became dormant",
    summary: input.lastActivityAt ?? "No recent activity",
    payload: { lastActivityAt: input.lastActivityAt },
  })
}

export async function emitGrowthLeadRelationshipStrengthChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "relationship_strength_changed",
    title: "Relationship strength changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadRelationshipBecameTrustedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "relationship_became_trusted",
    title: "Relationship became trusted",
    summary: `Relationship strength score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadRelationshipBecameStrategicTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "relationship_became_strategic",
    title: "Relationship became strategic",
    summary: `Relationship strength score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadRelationshipCooledTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number; lastMeaningfulTouchAt: string | null },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "relationship_cooled",
    title: "Relationship cooled",
    summary: input.lastMeaningfulTouchAt
      ? `Score ${input.score}; last meaningful touch ${input.lastMeaningfulTouchAt}`
      : `Score ${input.score}; no meaningful touches`,
    payload: {
      score: input.score,
      lastMeaningfulTouchAt: input.lastMeaningfulTouchAt,
    },
  })
}

export async function emitGrowthLeadOpportunityReadinessChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_readiness_changed",
    title: "Opportunity readiness changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadBecameSalesReadyTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_sales_ready",
    title: "Lead became sales ready",
    summary: `Opportunity readiness score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadBecamePriorityOpportunityTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_priority_opportunity",
    title: "Lead became priority opportunity",
    summary: `Opportunity readiness score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadOpportunityBlockerAddedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; key: string; label: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_blocker_added",
    title: "Opportunity blocker added",
    summary: input.label,
    payload: { key: input.key },
  })
}

export async function emitGrowthLeadOpportunityBlockerResolvedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; key: string; label: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_blocker_resolved",
    title: "Opportunity blocker resolved",
    summary: input.label,
    payload: { key: input.key },
  })
}

export async function emitGrowthLeadRevenueProbabilityChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "revenue_probability_changed",
    title: "Revenue probability changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadBecameForecastedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_forecasted",
    title: "Lead became forecasted",
    summary: `Revenue probability score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadBecameCommitCandidateTimeline(
  admin: SupabaseClient,
  input: { leadId: string; score: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "lead_became_commit_candidate",
    title: "Lead became commit candidate",
    summary: `Revenue probability score ${input.score}`,
    payload: { score: input.score },
  })
}

export async function emitGrowthLeadForecastConfidenceChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "forecast_confidence_changed",
    title: "Forecast confidence changed",
    summary: `${input.from} → ${input.to}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadForecastRegressionDetectedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    fromScore: number | null
    toScore: number
    fromTier: import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier | null
    toTier: import("@/lib/growth/revenue-forecast-types").GrowthRevenueProbabilityTier
    trajectory: import("@/lib/growth/revenue-forecast-types").GrowthRevenueTrajectory
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "forecast_regression_detected",
    title: "Forecast regression detected",
    summary:
      input.fromScore != null
        ? `Score ${input.fromScore} → ${input.toScore}; trajectory ${input.trajectory}`
        : `Score ${input.toScore}; trajectory ${input.trajectory}`,
    payload: {
      fromScore: input.fromScore,
      toScore: input.toScore,
      fromTier: input.fromTier,
      toTier: input.toTier,
      trajectory: input.trajectory,
    },
  })
}

export async function emitGrowthLeadExecutivePriorityChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "executive_priority_changed",
    title: "Executive priority changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadExecutiveInterventionRecommendedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    summary: string
    tier: import("@/lib/growth/executive-operating-types").GrowthExecutivePriorityTier
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "executive_intervention_recommended",
    title: "Executive intervention recommended",
    summary: input.summary,
    payload: { tier: input.tier },
  })
}

export async function emitGrowthLeadOperationalCapacityChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; from: number; to: number; summary: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "operational_capacity_changed",
    title: "Operational capacity changed",
    summary: `${input.from} → ${input.to}: ${input.summary}`,
    payload: { from: input.from, to: input.to },
  })
}

export async function emitGrowthLeadCapacityConstraintAddedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; key: string; label: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "capacity_constraint_added",
    title: "Capacity constraint added",
    summary: input.label,
    payload: { key: input.key },
  })
}

export async function emitGrowthLeadCapacityConstraintResolvedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; key: string; label: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "capacity_constraint_resolved",
    title: "Capacity constraint resolved",
    summary: input.label,
    payload: { key: input.key },
  })
}

export async function emitGrowthLeadOperationalRiskDetectedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    tier: import("@/lib/growth/operational-capacity-types").GrowthOperationalCapacityTier
    summary: string
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "operational_risk_detected",
    title: "Operational risk detected",
    summary: `${input.tier}: ${input.summary}`,
    payload: { tier: input.tier },
  })
}

export async function emitGrowthLeadAiCopilotGenerationCreatedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    generationId: string
    generationType: string
    summary: string
    actor?: { userId: string | null; email: string | null }
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "ai_copilot_generation_created",
    title: "AI copilot draft created",
    summary: input.summary,
    payload: { generationId: input.generationId, generationType: input.generationType },
    actor: input.actor,
  })
}

export async function emitGrowthLeadAiCopilotGenerationApprovedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    generationId: string
    generationType: string
    summary: string
    actor?: { userId: string | null; email: string | null }
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "ai_copilot_generation_approved",
    title: "AI copilot draft approved",
    summary: input.summary,
    payload: { generationId: input.generationId, generationType: input.generationType },
    actor: input.actor,
  })
}
