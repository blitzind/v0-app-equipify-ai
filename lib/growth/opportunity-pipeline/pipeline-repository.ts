import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeGrowthOpportunityRisk } from "@/lib/growth/opportunity-pipeline/pipeline-risk"
import {
  computeGrowthOpportunityWeightedAmount,
  resolveGrowthOpportunityStageProbability,
} from "@/lib/growth/opportunity-pipeline/pipeline-probability"
import {
  fetchGrowthOpportunityPipelineSettings,
  resolveStageLabel,
} from "@/lib/growth/opportunity-pipeline/pipeline-settings-repository"
import type {
  GrowthOpportunity,
  GrowthOpportunityDetail,
  GrowthOpportunityPipelineListInput,
  GrowthOpportunityPipelineListResult,
  GrowthOpportunityRiskSignal,
  GrowthOpportunityStageHistoryEntry,
  GrowthOpportunityStageKey,
} from "@/lib/growth/opportunity-pipeline/pipeline-types"

type OpportunityRow = {
  id: string
  org_id: string | null
  lead_id: string
  owner_user_id: string | null
  company_name: string
  title: string
  stage_key: string
  amount: number
  probability: number
  weighted_amount: number
  forecast_category: string
  expected_close_date: string | null
  source: string
  priority: string
  risk_score: number
  next_required_action: string | null
  loss_reason: string | null
  is_stale: boolean
  age_days: number
  last_activity_at: string
  stage_entered_at: string
  closed_won_at: string | null
  closed_lost_at: string | null
  created_at: string
  updated_at: string
}

type HistoryRow = {
  id: string
  opportunity_id: string
  from_stage_key: string | null
  to_stage_key: string
  amount: number | null
  probability: number | null
  changed_by: string | null
  changed_at: string
}

const SELECT =
  "id, org_id, lead_id, owner_user_id, company_name, title, stage_key, amount, probability, weighted_amount, forecast_category, expected_close_date, source, priority, risk_score, next_required_action, loss_reason, is_stale, age_days, last_activity_at, stage_entered_at, closed_won_at, closed_lost_at, created_at, updated_at"

function opportunitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunities")
}

function historyTable(admin: SupabaseClient) {
  return admin.schema("growth").from("opportunity_stage_history")
}

function daysSince(iso: string, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / (24 * 60 * 60 * 1000)))
}

function mapHistory(row: HistoryRow): GrowthOpportunityStageHistoryEntry {
  return {
    id: row.id,
    opportunityId: row.opportunity_id,
    fromStageKey: row.from_stage_key,
    toStageKey: row.to_stage_key,
    amount: row.amount,
    probability: row.probability,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
  }
}

function mapOpportunity(
  row: OpportunityRow,
  stageLabel: string,
  riskSignals: GrowthOpportunityRiskSignal[] = [],
): GrowthOpportunity {
  const stageAgeDays = daysSince(row.stage_entered_at)
  return {
    id: row.id,
    orgId: row.org_id,
    leadId: row.lead_id,
    ownerUserId: row.owner_user_id,
    companyName: row.company_name,
    title: row.title,
    stageKey: row.stage_key as GrowthOpportunityStageKey,
    stageLabel,
    amount: Number(row.amount),
    probability: row.probability,
    weightedAmount: Number(row.weighted_amount),
    forecastCategory: row.forecast_category as GrowthOpportunity["forecastCategory"],
    expectedCloseDate: row.expected_close_date,
    source: row.source as GrowthOpportunity["source"],
    priority: row.priority as GrowthOpportunity["priority"],
    riskScore: row.risk_score,
    riskSignals,
    nextRequiredAction: row.next_required_action,
    lossReason: row.loss_reason,
    isStale: row.is_stale,
    ageDays: row.age_days,
    stageAgeDays,
    lastActivityAt: row.last_activity_at,
    stageEnteredAt: row.stage_entered_at,
    closedWonAt: row.closed_won_at,
    closedLostAt: row.closed_lost_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchGrowthOpportunityById(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<GrowthOpportunity | null> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin).select(SELECT).eq("id", opportunityId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapOpportunity(data as OpportunityRow, resolveStageLabel(settings, data.stage_key as GrowthOpportunityStageKey))
}

export async function fetchGrowthOpportunityByLeadId(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthOpportunity | null> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin).select(SELECT).eq("lead_id", leadId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapOpportunity(data as OpportunityRow, resolveStageLabel(settings, data.stage_key as GrowthOpportunityStageKey))
}

export async function fetchGrowthOpportunityDetail(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<GrowthOpportunityDetail | null> {
  const opportunity = await fetchGrowthOpportunityById(admin, opportunityId)
  if (!opportunity) return null

  const { data, error } = await historyTable(admin)
    .select("*")
    .eq("opportunity_id", opportunityId)
    .order("changed_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  return {
    ...opportunity,
    stageHistory: ((data ?? []) as HistoryRow[]).map(mapHistory),
  }
}

export async function listGrowthOpportunityPipeline(
  admin: SupabaseClient,
  input: GrowthOpportunityPipelineListInput,
): Promise<GrowthOpportunityPipelineListResult> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = opportunitiesTable(admin).select(SELECT, { count: "exact" })

  if (input.ownerUserId) query = query.eq("owner_user_id", input.ownerUserId)
  if (input.stageKey) query = query.eq("stage_key", input.stageKey)
  if (input.forecastCategory) query = query.eq("forecast_category", input.forecastCategory)
  if (input.priority) query = query.eq("priority", input.priority)
  if (input.stale === true) query = query.eq("is_stale", true)
  if (input.createdAfter) query = query.gte("created_at", input.createdAfter)
  if (input.createdBefore) query = query.lte("created_at", input.createdBefore)

  if (input.view === "my_pipeline" && input.ownerUserId) {
    query = query.eq("owner_user_id", input.ownerUserId).is("closed_won_at", null).is("closed_lost_at", null)
  } else if (input.view === "all_pipeline") {
    query = query.is("closed_won_at", null).is("closed_lost_at", null)
  } else if (input.view === "at_risk") {
    query = query.gte("risk_score", 40).is("closed_won_at", null).is("closed_lost_at", null)
  } else if (input.view === "needs_action") {
    query = query.or("is_stale.eq.true,risk_score.gte.50,next_required_action.not.is.null")
      .is("closed_won_at", null)
      .is("closed_lost_at", null)
  } else if (input.view === "forecast") {
    query = query.in("forecast_category", ["commit", "best_case", "pipeline"]).is("closed_won_at", null).is("closed_lost_at", null)
  } else if (input.view === "owner_board") {
    query = query.is("closed_won_at", null).is("closed_lost_at", null)
  } else {
    query = query.is("closed_won_at", null).is("closed_lost_at", null)
  }

  const { data, error, count } = await query
    .order("risk_score", { ascending: false })
    .order("weighted_amount", { ascending: false })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const total = count ?? 0
  const items = ((data ?? []) as OpportunityRow[]).map((row) =>
    mapOpportunity(row, resolveStageLabel(settings, row.stage_key as GrowthOpportunityStageKey)),
  )

  return { items, total, hasMore: offset + limit < total }
}

export async function insertGrowthOpportunityStageHistory(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    fromStageKey: string | null
    toStageKey: string
    amount: number | null
    probability: number | null
    changedBy?: string | null
  },
): Promise<void> {
  const { error } = await historyTable(admin).insert({
    opportunity_id: input.opportunityId,
    from_stage_key: input.fromStageKey,
    to_stage_key: input.toStageKey,
    amount: input.amount,
    probability: input.probability,
    changed_by: input.changedBy ?? null,
  })
  if (error) throw new Error(error.message)
}

export async function recomputeGrowthOpportunityDerivedFields(
  admin: SupabaseClient,
  opportunityId: string,
  leadContext?: {
    followUpAt?: string | null
    engagementTrend?: string | null
    ownerOverloaded?: boolean
  },
): Promise<GrowthOpportunity | null> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin).select(SELECT).eq("id", opportunityId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data as OpportunityRow
  const stageKey = row.stage_key as GrowthOpportunityStageKey
  const probability = resolveGrowthOpportunityStageProbability(stageKey, settings.stageProbabilityOverrides)
  const weightedAmount = computeGrowthOpportunityWeightedAmount(Number(row.amount), probability)
  const ageDays = daysSince(row.created_at)
  const stageAgeDays = daysSince(row.stage_entered_at)
  const risk = computeGrowthOpportunityRisk({
    stageKey,
    stageAgeDays,
    ageDays,
    staleStageDays: settings.staleStageDays,
    staleActivityDays: settings.staleActivityDays,
    lastActivityAt: row.last_activity_at,
    expectedCloseDate: row.expected_close_date,
    followUpAt: leadContext?.followUpAt ?? null,
    engagementTrend: leadContext?.engagementTrend ?? null,
    ownerOverloaded: leadContext?.ownerOverloaded ?? false,
  })

  const { data: updated, error: updateError } = await opportunitiesTable(admin)
    .update({
      probability,
      weighted_amount: weightedAmount,
      age_days: ageDays,
      risk_score: risk.riskScore,
      is_stale: risk.isStale,
      updated_at: new Date().toISOString(),
    })
    .eq("id", opportunityId)
    .select(SELECT)
    .single()

  if (updateError) throw new Error(updateError.message)
  return mapOpportunity(updated as OpportunityRow, resolveStageLabel(settings, stageKey), risk.riskSignals)
}

export async function insertGrowthOpportunityRow(
  admin: SupabaseClient,
  row: Record<string, unknown>,
): Promise<GrowthOpportunity> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin).insert(row).select(SELECT).single()
  if (error) throw new Error(error.message)
  const mapped = data as OpportunityRow
  return mapOpportunity(mapped, resolveStageLabel(settings, mapped.stage_key as GrowthOpportunityStageKey))
}

/** Compensating rollback when draft conversion fails after opportunity insert. */
export async function deleteGrowthOpportunityRow(
  admin: SupabaseClient,
  opportunityId: string,
): Promise<boolean> {
  const { error } = await opportunitiesTable(admin).delete().eq("id", opportunityId)
  return !error
}

export async function updateGrowthOpportunityRow(
  admin: SupabaseClient,
  opportunityId: string,
  patch: Record<string, unknown>,
): Promise<GrowthOpportunity | null> {
  const settings = await fetchGrowthOpportunityPipelineSettings(admin)
  const { data, error } = await opportunitiesTable(admin)
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", opportunityId)
    .select(SELECT)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  const mapped = data as OpportunityRow
  return mapOpportunity(mapped, resolveStageLabel(settings, mapped.stage_key as GrowthOpportunityStageKey))
}
