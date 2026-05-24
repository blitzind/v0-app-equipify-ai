import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"

type Actor = { userId?: string | null; email?: string | null }

export async function emitGrowthOpportunityCreatedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string; title: string; stageLabel: string; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_created",
    title: "Opportunity created",
    summary: `${input.title} — ${input.stageLabel}`,
    payload: { opportunityId: input.opportunityId, stageLabel: input.stageLabel },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityStageChangedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string
    fromStage: string
    toStage: string
    actor?: Actor
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "stage_changed",
    title: "Stage changed",
    summary: `${input.fromStage} → ${input.toStage}`,
    payload: { opportunityId: input.opportunityId, fromStage: input.fromStage, toStage: input.toStage },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityForecastChangedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string
    fromCategory: string
    toCategory: string
    actor?: Actor
  },
) {
  if (input.fromCategory === input.toCategory) return
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "forecast_changed",
    title: "Forecast changed",
    summary: `${input.fromCategory.replace(/_/g, " ")} → ${input.toCategory.replace(/_/g, " ")}`,
    payload: { opportunityId: input.opportunityId, fromCategory: input.fromCategory, toCategory: input.toCategory },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityOwnerChangedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string; ownerUserId: string | null; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "owner_changed",
    title: "Opportunity owner changed",
    summary: input.ownerUserId ? "Owner updated" : "Owner cleared",
    payload: { opportunityId: input.opportunityId, ownerUserId: input.ownerUserId },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityAmountChangedTimeline(
  admin: SupabaseClient,
  input: {
    leadId: string
    opportunityId: string
    fromAmount: number
    toAmount: number
    actor?: Actor
  },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "amount_changed",
    title: "Amount changed",
    summary: `$${input.fromAmount.toLocaleString()} → $${input.toAmount.toLocaleString()}`,
    payload: { opportunityId: input.opportunityId, fromAmount: input.fromAmount, toAmount: input.toAmount },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityStaleDetectedTimeline(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string; title: string },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "stale_detected",
    title: "Stale opportunity",
    summary: input.title,
    payload: { opportunityId: input.opportunityId },
  })
}

export async function emitGrowthOpportunityClosedWonTimeline(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string; amount: number; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_closed_won",
    title: "Closed won",
    summary: `$${input.amount.toLocaleString()}`,
    payload: { opportunityId: input.opportunityId, amount: input.amount },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}

export async function emitGrowthOpportunityClosedLostTimeline(
  admin: SupabaseClient,
  input: { leadId: string; opportunityId: string; lossReason: string | null; actor?: Actor },
) {
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_closed_lost",
    title: "Closed lost",
    summary: input.lossReason ?? "No reason provided",
    payload: { opportunityId: input.opportunityId, lossReason: input.lossReason },
    actorUserId: input.actor?.userId,
    actorEmail: input.actor?.email,
  })
}
