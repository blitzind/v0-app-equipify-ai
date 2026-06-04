import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthRepByUserId } from "@/lib/growth/assignment/rep-roster-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  fetchGrowthOpportunityByLeadId,
  insertGrowthOpportunityRow,
  insertGrowthOpportunityStageHistory,
  recomputeGrowthOpportunityDerivedFields,
  updateGrowthOpportunityRow,
} from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  computeGrowthOpportunityWeightedAmount,
  resolveGrowthOpportunityStageProbability,
} from "@/lib/growth/opportunity-pipeline/pipeline-probability"
import {
  fetchGrowthOpportunityPipelineSettings,
  isClosedStage,
  resolveStageLabel,
} from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import type {
  CreateGrowthOpportunityInput,
  GrowthOpportunity,
  GrowthOpportunityForecastCategory,
  GrowthOpportunityStageKey,
  UpdateGrowthOpportunityStageInput,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"
import {
  emitGrowthOpportunityAmountChangedTimeline,
  emitGrowthOpportunityClosedLostTimeline,
  emitGrowthOpportunityClosedWonTimeline,
  emitGrowthOpportunityCreatedTimeline,
  emitGrowthOpportunityForecastChangedTimeline,
  emitGrowthOpportunityOwnerChangedTimeline,
  emitGrowthOpportunityStageChangedTimeline,
  emitGrowthOpportunityStaleDetectedTimeline,
} from "@/lib/growth/opportunity-pipeline/pipeline-timeline-emitter"
import {
  emitGrowthOpportunityCloseDatePassedNotification,
  emitGrowthOpportunityOwnerOverloadedNotification,
} from "@/lib/growth/notifications/notification-integrations"
import { recordRevenueAttributionEvent } from "@/lib/growth/revenue-intelligence/revenue-attribution"
import { resolveAttributionContextForLead } from "@/lib/growth/revenue-attribution/resolve-attribution-context"

type Actor = { userId?: string | null; email?: string | null }

export type MutateGrowthOpportunityResult =
  | { ok: true; opportunity: GrowthOpportunity }
  | { ok: false; code: string; message: string }

async function ownerOverloaded(admin: SupabaseClient, ownerUserId: string | null): Promise<boolean> {
  if (!ownerUserId) return false
  const rep = await fetchGrowthRepByUserId(admin, ownerUserId)
  return rep?.isOverCapacity ?? false
}

export async function createGrowthOpportunity(
  admin: SupabaseClient,
  input: CreateGrowthOpportunityInput & { actor?: Actor },
): Promise<MutateGrowthOpportunityResult> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { ok: false, code: "lead_not_found", message: "Lead not found." }

  const existing = await fetchGrowthOpportunityByLeadId(admin, input.leadId)
  if (existing) return { ok: false, code: "already_exists", message: "Opportunity already exists for this lead." }

  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const stageKey: GrowthOpportunityStageKey = input.stageKey ?? "new_opportunity"
  const amount = input.amount ?? 0
  const probability = resolveGrowthOpportunityStageProbability(stageKey, settings.stageProbabilityOverrides)
  const weightedAmount = computeGrowthOpportunityWeightedAmount(amount, probability)
  const ownerUserId = input.ownerUserId ?? lead.assignedTo ?? null
  const now = new Date().toISOString()

  const opportunity = await insertGrowthOpportunityRow(admin, {
    lead_id: input.leadId,
    owner_user_id: ownerUserId,
    company_name: lead.companyName,
    title: input.title ?? `${lead.companyName} opportunity`,
    stage_key: stageKey,
    amount,
    probability,
    weighted_amount: weightedAmount,
    forecast_category: input.forecastCategory ?? "pipeline",
    expected_close_date: input.expectedCloseDate ?? null,
    source: input.source ?? "manual",
    priority: input.priority ?? "medium",
    last_activity_at: now,
    stage_entered_at: now,
  })

  await insertGrowthOpportunityStageHistory(admin, {
    opportunityId: opportunity.id,
    fromStageKey: null,
    toStageKey: stageKey,
    amount,
    probability,
    changedBy: input.actor?.email ?? input.actor?.userId ?? null,
  })

  await emitGrowthOpportunityCreatedTimeline(admin, {
    leadId: input.leadId,
    opportunityId: opportunity.id,
    title: opportunity.title,
    stageLabel: resolveStageLabel(settings, stageKey),
    actor: input.actor,
  })

  const enriched = await recomputeGrowthOpportunityDerivedFields(admin, opportunity.id, {
    followUpAt: lead.followUpAt,
    engagementTrend: lead.opportunityReadinessTrend,
    ownerOverloaded: await ownerOverloaded(admin, ownerUserId),
  })

  logGrowthEngine("opportunity_created", { opportunityId: opportunity.id, leadId: input.leadId, stageKey })

  const ctx = await resolveAttributionContextForLead(admin, input.leadId, {
    opportunityId: opportunity.id,
    repUserId: ownerUserId,
  })
  await recordRevenueAttributionEvent(admin, {
    leadId: input.leadId,
    eventType: "opportunity_created",
    opportunityId: opportunity.id,
    sequenceId: ctx?.sequenceId ?? null,
    sequenceEnrollmentId: ctx?.sequenceEnrollmentId ?? null,
    senderAccountId: ctx?.senderAccountId ?? null,
    weightedAmount: weightedAmount,
    attributionWeight: 0.5,
    metadata: { source: "opportunity_pipeline", stage_key: stageKey, rep_user_id: ownerUserId },
  }).catch(() => undefined)

  return { ok: true, opportunity: enriched ?? opportunity }
}

export async function updateGrowthOpportunityStage(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    patch: UpdateGrowthOpportunityStageInput
    actor?: Actor
  },
): Promise<MutateGrowthOpportunityResult> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data: row, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, stage_key, amount, loss_reason, closed_won_at, closed_lost_at")
    .eq("id", input.opportunityId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!row) return { ok: false, code: "not_found", message: "Opportunity not found." }

  const fromStage = row.stage_key as GrowthOpportunityStageKey
  const toStage = input.patch.stageKey
  if (fromStage === toStage) {
    const current = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
    if (!current) return { ok: false, code: "not_found", message: "Opportunity not found." }
    return { ok: true, opportunity: current }
  }

  if (toStage === "closed_lost" && !input.patch.lossReason?.trim()) {
    return { ok: false, code: "loss_reason_required", message: "Loss reason is required to close lost." }
  }

  const probability = resolveGrowthOpportunityStageProbability(toStage, settings.stageProbabilityOverrides)
  const amount = Number(row.amount)
  const weightedAmount = computeGrowthOpportunityWeightedAmount(amount, probability)
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    stage_key: toStage,
    probability,
    weighted_amount: weightedAmount,
    stage_entered_at: now,
    last_activity_at: now,
    loss_reason: toStage === "closed_lost" ? input.patch.lossReason ?? null : null,
  }

  if (toStage === "closed_won") {
    patch.closed_won_at = now
    patch.closed_lost_at = null
    patch.forecast_category = "commit"
  } else if (toStage === "closed_lost") {
    patch.closed_lost_at = now
    patch.closed_won_at = null
    patch.forecast_category = "omitted"
  } else if (isClosedStage(settings, fromStage)) {
    patch.closed_won_at = null
    patch.closed_lost_at = null
  }

  const updated = await updateGrowthOpportunityRow(admin, input.opportunityId, patch)
  if (!updated) return { ok: false, code: "update_failed", message: "Could not update opportunity stage." }

  await insertGrowthOpportunityStageHistory(admin, {
    opportunityId: input.opportunityId,
    fromStageKey: fromStage,
    toStageKey: toStage,
    amount,
    probability,
    changedBy: input.actor?.email ?? input.actor?.userId ?? null,
  })

  await emitGrowthOpportunityStageChangedTimeline(admin, {
    leadId: row.lead_id as string,
    opportunityId: input.opportunityId,
    fromStage: resolveStageLabel(settings, fromStage),
    toStage: resolveStageLabel(settings, toStage),
    actor: input.actor,
  })

  if (toStage === "closed_won") {
    await emitGrowthOpportunityClosedWonTimeline(admin, {
      leadId: row.lead_id as string,
      opportunityId: input.opportunityId,
      amount,
      actor: input.actor,
    })

    const ctx = await resolveAttributionContextForLead(admin, row.lead_id as string, {
      opportunityId: input.opportunityId,
      repUserId: updated.ownerUserId,
    })
    await recordRevenueAttributionEvent(admin, {
      leadId: row.lead_id as string,
      eventType: "opportunity_won",
      opportunityId: input.opportunityId,
      sequenceId: ctx?.sequenceId ?? null,
      sequenceEnrollmentId: ctx?.sequenceEnrollmentId ?? null,
      senderAccountId: ctx?.senderAccountId ?? null,
      revenueAmount: amount,
      weightedAmount: amount,
      attributionWeight: 1,
      metadata: {
        source: "opportunity_pipeline",
        from_stage: fromStage,
        rep_user_id: updated.ownerUserId,
      },
    }).catch(() => undefined)
  }
  if (toStage === "closed_lost") {
    await emitGrowthOpportunityClosedLostTimeline(admin, {
      leadId: row.lead_id as string,
      opportunityId: input.opportunityId,
      lossReason: input.patch.lossReason ?? null,
      actor: input.actor,
    })
  }

  const lead = await fetchGrowthLeadById(admin, row.lead_id as string)
  const enriched = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId, {
    followUpAt: lead?.followUpAt ?? null,
    engagementTrend: lead?.opportunityReadinessTrend ?? null,
    ownerOverloaded: await ownerOverloaded(admin, updated.ownerUserId),
  })

  logGrowthEngine("opportunity_stage_changed", {
    opportunityId: input.opportunityId,
    fromStage,
    toStage,
  })

  return { ok: true, opportunity: enriched ?? updated }
}

export async function updateGrowthOpportunityOwner(
  admin: SupabaseClient,
  input: { opportunityId: string; ownerUserId: string | null; actor?: Actor },
): Promise<MutateGrowthOpportunityResult> {
  const current = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, owner_user_id")
    .eq("id", input.opportunityId)
    .maybeSingle()

  if (!current.data) return { ok: false, code: "not_found", message: "Opportunity not found." }
  if (current.data.owner_user_id === input.ownerUserId) {
    const opp = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
    if (!opp) return { ok: false, code: "not_found", message: "Opportunity not found." }
    return { ok: true, opportunity: opp }
  }

  const updated = await updateGrowthOpportunityRow(admin, input.opportunityId, {
    owner_user_id: input.ownerUserId,
    last_activity_at: new Date().toISOString(),
  })
  if (!updated) return { ok: false, code: "update_failed", message: "Could not update opportunity owner." }

  await emitGrowthOpportunityOwnerChangedTimeline(admin, {
    leadId: current.data.lead_id as string,
    opportunityId: input.opportunityId,
    ownerUserId: input.ownerUserId,
    actor: input.actor,
  })

  if (await ownerOverloaded(admin, input.ownerUserId)) {
    await emitGrowthOpportunityOwnerOverloadedNotification(admin, {
      opportunityId: input.opportunityId,
      leadId: updated.leadId,
      companyName: updated.companyName,
      ownerUserId: input.ownerUserId,
    })
  }

  const lead = await fetchGrowthLeadById(admin, updated.leadId)
  const enriched = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId, {
    followUpAt: lead?.followUpAt ?? null,
    engagementTrend: lead?.opportunityReadinessTrend ?? null,
    ownerOverloaded: await ownerOverloaded(admin, input.ownerUserId),
  })

  return { ok: true, opportunity: enriched ?? updated }
}

export async function updateGrowthOpportunityAmount(
  admin: SupabaseClient,
  input: { opportunityId: string; amount: number; actor?: Actor },
): Promise<MutateGrowthOpportunityResult> {
  if (input.amount < 0) return { ok: false, code: "invalid_amount", message: "Amount must be non-negative." }

  const current = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, amount, stage_key, probability")
    .eq("id", input.opportunityId)
    .maybeSingle()

  if (!current.data) return { ok: false, code: "not_found", message: "Opportunity not found." }
  const fromAmount = Number(current.data.amount)
  if (fromAmount === input.amount) {
    const opp = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
    if (!opp) return { ok: false, code: "not_found", message: "Opportunity not found." }
    return { ok: true, opportunity: opp }
  }

  const probability = Number(current.data.probability)
  const weightedAmount = computeGrowthOpportunityWeightedAmount(input.amount, probability)

  const updated = await updateGrowthOpportunityRow(admin, input.opportunityId, {
    amount: input.amount,
    weighted_amount: weightedAmount,
    last_activity_at: new Date().toISOString(),
  })
  if (!updated) return { ok: false, code: "update_failed", message: "Could not update opportunity amount." }

  await emitGrowthOpportunityAmountChangedTimeline(admin, {
    leadId: current.data.lead_id as string,
    opportunityId: input.opportunityId,
    fromAmount,
    toAmount: input.amount,
    actor: input.actor,
  })

  const enriched = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
  return { ok: true, opportunity: enriched ?? updated }
}

export async function updateGrowthOpportunityForecastCategory(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    forecastCategory: GrowthOpportunityForecastCategory
    expectedCloseDate?: string | null
    actor?: Actor
  },
): Promise<MutateGrowthOpportunityResult> {
  const current = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, forecast_category, expected_close_date")
    .eq("id", input.opportunityId)
    .maybeSingle()

  if (!current.data) return { ok: false, code: "not_found", message: "Opportunity not found." }

  const patch: Record<string, unknown> = {
    forecast_category: input.forecastCategory,
    last_activity_at: new Date().toISOString(),
  }
  if (input.expectedCloseDate !== undefined) patch.expected_close_date = input.expectedCloseDate

  const updated = await updateGrowthOpportunityRow(admin, input.opportunityId, patch)
  if (!updated) return { ok: false, code: "update_failed", message: "Could not update forecast." }

  await emitGrowthOpportunityForecastChangedTimeline(admin, {
    leadId: current.data.lead_id as string,
    opportunityId: input.opportunityId,
    fromCategory: current.data.forecast_category as string,
    toCategory: input.forecastCategory,
    actor: input.actor,
  })

  const enriched = await recomputeGrowthOpportunityDerivedFields(admin, input.opportunityId)
  return { ok: true, opportunity: enriched ?? updated }
}

export async function touchGrowthOpportunityActivity(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<void> {
  await updateGrowthOpportunityRow(admin, opportunityId, {
    last_activity_at: new Date().toISOString(),
  })
}

export async function syncGrowthOpportunityOwnerFromLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<void> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  const opportunity = await fetchGrowthOpportunityByLeadId(admin, leadId)
  if (!lead || !opportunity || !lead.assignedTo) return
  if (opportunity.ownerUserId === lead.assignedTo) return
  await updateGrowthOpportunityOwner(admin, {
    opportunityId: opportunity.id,
    ownerUserId: lead.assignedTo,
    actor: { userId: lead.assignedTo, email: null },
  })
}

export async function evaluateGrowthOpportunityPipelineSignals(
  admin: SupabaseClient,
): Promise<{ staleDetected: number; closeDatePassed: number; atRisk: number }> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, company_name, owner_user_id, stage_key, expected_close_date, is_stale, risk_score")
    .is("closed_won_at", null)
    .is("closed_lost_at", null)
    .limit(200)

  if (error) throw new Error(error.message)

  let staleDetected = 0
  let closeDatePassed = 0
  let atRisk = 0
  const now = new Date()

  for (const row of data ?? []) {
    const lead = await fetchGrowthLeadById(admin, row.lead_id as string)
    const enriched = await recomputeGrowthOpportunityDerivedFields(admin, row.id as string, {
      followUpAt: lead?.followUpAt ?? null,
      engagementTrend: lead?.opportunityReadinessTrend ?? null,
      ownerOverloaded: await ownerOverloaded(admin, row.owner_user_id as string | null),
    })
    if (!enriched) continue

    if (enriched.isStale && !row.is_stale) {
      await emitGrowthOpportunityStaleDetectedTimeline(admin, {
        leadId: enriched.leadId,
        opportunityId: enriched.id,
        title: enriched.title,
      })
      const { emitGrowthStaleOpportunityNotification } = await import(
        "@/lib/growth/notifications/notification-integrations"
      )
      await emitGrowthStaleOpportunityNotification(admin, {
        leadId: enriched.leadId,
        companyName: enriched.companyName,
        ownerUserId: enriched.ownerUserId,
        opportunityId: enriched.id,
      })
      staleDetected += 1
    }

    if (
      enriched.expectedCloseDate &&
      Date.parse(enriched.expectedCloseDate) < now.getTime() &&
      !String(row.stage_key).startsWith("closed_")
    ) {
      await emitGrowthOpportunityCloseDatePassedNotification(admin, {
        opportunityId: enriched.id,
        leadId: enriched.leadId,
        companyName: enriched.companyName,
        ownerUserId: enriched.ownerUserId,
        expectedCloseDate: enriched.expectedCloseDate,
      })
      closeDatePassed += 1
    }

    if (enriched.riskScore >= 50) atRisk += 1
  }

  void settings
  return { staleDetected, closeDatePassed, atRisk }
}
