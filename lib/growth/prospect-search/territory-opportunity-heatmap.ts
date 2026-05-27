/** Territory / opportunity heat map aggregation (Sprint 4.4). Client-safe — no providers. */

import type { GrowthBuyingStage } from "@/lib/growth/buying-stage/buying-stage-types"
import {
  hasActiveTerritoryFilter,
  normalizeCity,
  normalizeMetro,
  normalizePostalCode,
  normalizeState,
  normalizeTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-geo"
import type {
  GrowthProspectSearchExistingAccountMode,
  GrowthProspectSearchFilters,
  GrowthProspectSearchTerritoryFilter,
} from "@/lib/growth/prospect-search/prospect-search-types"

export const GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER =
  "growth-territory-opportunity-heatmap-v1" as const

export const GROWTH_TERRITORY_OPPORTUNITY_BUCKET_DIMENSIONS = [
  "state",
  "city",
  "metro",
  "postal_code",
] as const

export type GrowthTerritoryOpportunityBucketDimension =
  (typeof GROWTH_TERRITORY_OPPORTUNITY_BUCKET_DIMENSIONS)[number]

export type TerritoryOpportunityHeatmapCompanyInput = {
  id: string
  city?: string | null
  state?: string | null
  metro?: string | null
  postal_code?: string | null
  lead_score?: number | null
  lead_engine_score?: number | null
  intent_score?: number | null
  buying_stage?: string | null
  buying_stage_confidence?: number | null
  decision_maker_count?: number | null
  company_match_confidence?: number | null
  signal_confidence?: number | null
  is_suppressed?: boolean
  existing_customer?: boolean
  existing_prospect?: boolean
}

export type GrowthTerritoryOpportunitySummary = {
  total_companies: number
  qualified_prospects: number
  high_intent_prospects: number
  decision_maker_coverage_pct: number
  suppressed_count: number
  existing_customer_count: number
  existing_prospect_count: number
  average_lead_score: number
  top_buying_stages: Array<{ stage: string; count: number }>
  opportunity_score: number
  score_explanation: string[]
  suppression_adjusted_opportunity_count: number
}

export type GrowthTerritoryOpportunityBucketRow = {
  id: string
  label: string
  bucket_dimension: GrowthTerritoryOpportunityBucketDimension
  bucket_key: string
  city: string | null
  state: string | null
  metro: string | null
  postal_code: string | null
  company_count: number
  qualified_count: number
  high_intent_count: number
  average_lead_score: number
  buying_stage_maturity: number
  decision_maker_coverage_pct: number
  suppressed_count: number
  opportunity_score: number
  suppression_adjusted_opportunity_count: number
  score_explanation: string[]
}

export type GrowthTerritoryOpportunityRecommendedAction =
  | "review_territory"
  | "bulk_push_qualified"
  | "launch_outbound_review"
  | "save_workflow"

export type GrowthTerritoryOpportunityHeatmapResult = {
  qa_marker: typeof GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER
  visible: boolean
  bucket_dimension: GrowthTerritoryOpportunityBucketDimension
  has_geo_fields: boolean
  summary: GrowthTerritoryOpportunitySummary
  territories: GrowthTerritoryOpportunityBucketRow[]
  recommended_action: GrowthTerritoryOpportunityRecommendedAction
  recommended_action_label: string
  source: "materialized_index"
  no_provider_calls: true
}

export const QUALIFIED_LEAD_SCORE_MIN = 40
export const HIGH_INTENT_LEAD_SCORE_MIN = 65
export const HIGH_INTENT_INTENT_SCORE_MIN = 60

const HIGH_INTENT_BUYING_STAGES = new Set<GrowthBuyingStage>([
  "vendor_evaluation",
  "comparison",
  "purchase_ready",
  "active_opportunity",
])

const BUYING_STAGE_MATURITY: Record<string, number> = {
  awareness: 10,
  problem_identified: 20,
  solution_research: 35,
  vendor_evaluation: 50,
  comparison: 65,
  purchase_ready: 80,
  active_opportunity: 90,
  existing_customer_expansion: 75,
  retention_risk: 40,
}

const RECOMMENDED_ACTION_LABELS: Record<GrowthTerritoryOpportunityRecommendedAction, string> = {
  review_territory: "Review this territory",
  bulk_push_qualified: "Bulk push qualified",
  launch_outbound_review: "Launch outbound review",
  save_workflow: "Save workflow",
}

function resolveLeadScore(company: TerritoryOpportunityHeatmapCompanyInput): number {
  return company.lead_engine_score ?? company.lead_score ?? 0
}

export function isTerritoryQualifiedProspect(company: TerritoryOpportunityHeatmapCompanyInput): boolean {
  if (company.is_suppressed) return false
  return resolveLeadScore(company) >= QUALIFIED_LEAD_SCORE_MIN
}

export function isTerritoryHighIntentProspect(company: TerritoryOpportunityHeatmapCompanyInput): boolean {
  if (company.is_suppressed) return false
  const leadScore = resolveLeadScore(company)
  if (leadScore >= HIGH_INTENT_LEAD_SCORE_MIN) return true
  if ((company.intent_score ?? 0) >= HIGH_INTENT_INTENT_SCORE_MIN) return true
  const stage = company.buying_stage
  return Boolean(stage && HIGH_INTENT_BUYING_STAGES.has(stage as GrowthBuyingStage))
}

export function resolveTerritoryDecisionMakerCoveragePct(
  company: TerritoryOpportunityHeatmapCompanyInput,
): number {
  const count = company.decision_maker_count ?? 0
  if (count <= 0) return 0
  return Math.min(100, Math.round((count / 5) * 100))
}

export function resolveTerritoryContactConfidence(company: TerritoryOpportunityHeatmapCompanyInput): number {
  if (company.company_match_confidence != null) return company.company_match_confidence
  if (company.signal_confidence != null) return company.signal_confidence
  return resolveTerritoryDecisionMakerCoveragePct(company)
}

export function resolveBuyingStageMaturity(stage: string | null | undefined): number {
  if (!stage) return 0
  return BUYING_STAGE_MATURITY[stage] ?? 25
}

export function averageBuyingStageMaturity(companies: TerritoryOpportunityHeatmapCompanyInput[]): number {
  const withStage = companies.filter((row) => row.buying_stage)
  if (withStage.length === 0) return 0
  const total = withStage.reduce((sum, row) => sum + resolveBuyingStageMaturity(row.buying_stage), 0)
  return Math.round(total / withStage.length)
}

export function resolveTerritoryOpportunityBucketDimension(
  filters: GrowthProspectSearchFilters,
): GrowthTerritoryOpportunityBucketDimension {
  const territory = normalizeTerritoryFilter(filters.territory_filter)
  if (territory?.postal_codes?.length) return "postal_code"
  if (territory?.cities?.length === 1 && !territory.metros?.length) return "postal_code"
  if (territory?.metros?.length) return "metro"
  if (territory?.cities?.length) return "city"
  if (territory?.states?.length) return "city"
  return "state"
}

export function resolveTerritoryBucketKey(
  company: TerritoryOpportunityHeatmapCompanyInput,
  dimension: GrowthTerritoryOpportunityBucketDimension,
): { key: string; label: string; city: string | null; state: string | null; metro: string | null; postal_code: string | null } {
  const state = normalizeState(company.state)
  const city = normalizeCity(company.city)
  const metro = normalizeMetro(company.metro)
  const postal = normalizePostalCode(company.postal_code)

  switch (dimension) {
    case "postal_code": {
      const key = postal ?? "unknown"
      return {
        key,
        label: postal ? `${postal}${state ? ` · ${state}` : ""}` : "Unknown ZIP",
        city,
        state,
        metro,
        postal_code: postal,
      }
    }
    case "metro": {
      const key = metro ?? city ?? state ?? "unknown"
      const label = metro ?? city ?? state ?? "Unknown metro"
      return { key, label, city, state, metro, postal_code: postal }
    }
    case "city": {
      const key = `${city ?? "unknown"}|${state ?? ""}`
      const label = city && state ? `${titleCase(city)}, ${state}` : city ?? state ?? "Unknown city"
      return { key, label, city, state, metro, postal_code: postal }
    }
    case "state":
    default: {
      const key = state ?? "unknown"
      return { key, label: state ?? "Unknown state", city, state, metro, postal_code: postal }
    }
  }
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

export function computeTerritoryOpportunityHeatScore(input: {
  companies: TerritoryOpportunityHeatmapCompanyInput[]
  existingAccountMode?: GrowthProspectSearchExistingAccountMode
}): { score: number; explanation: string[]; suppression_adjusted_opportunity_count: number } {
  const companies = input.companies
  const total = companies.length
  if (total === 0) {
    return {
      score: 0,
      explanation: ["No indexed companies match the current territory scope."],
      suppression_adjusted_opportunity_count: 0,
    }
  }

  const qualified = companies.filter(isTerritoryQualifiedProspect)
  const highIntent = companies.filter(isTerritoryHighIntentProspect)
  const suppressed = companies.filter((row) => row.is_suppressed).length
  const existingCustomers = companies.filter((row) => row.existing_customer).length
  const existingProspects = companies.filter((row) => row.existing_prospect).length
  const withDm = companies.filter((row) => (row.decision_maker_count ?? 0) > 0).length
  const avgLead =
    total > 0
      ? Math.round(companies.reduce((sum, row) => sum + resolveLeadScore(row), 0) / total)
      : 0
  const avgMaturity = averageBuyingStageMaturity(companies)
  const avgContact =
    total > 0
      ? Math.round(companies.reduce((sum, row) => sum + resolveTerritoryContactConfidence(row), 0) / total)
      : 0
  const dmCoveragePct = Math.round((withDm / total) * 100)

  const qualifiedDensity = Math.min(25, Math.round((qualified.length / Math.max(total, 1)) * 50))
  const highIntentBoost = Math.min(20, highIntent.length * 2)
  const maturityPoints = Math.round((avgMaturity / 100) * 15)
  const dmPoints = Math.round((dmCoveragePct / 100) * 15)
  const contactPoints = Math.round((avgContact / 100) * 10)
  const suppressionPenalty = Math.min(20, suppressed * 2)
  const applyExistingPenalty = input.existingAccountMode !== "include_only"
  const existingPenalty = applyExistingPenalty
    ? Math.min(15, Math.round((existingCustomers + existingProspects) * 1.5))
    : 0

  const score = Math.max(
    0,
    Math.min(
      100,
      qualifiedDensity +
        highIntentBoost +
        maturityPoints +
        dmPoints +
        contactPoints -
        suppressionPenalty -
        existingPenalty,
    ),
  )

  const explanation = [
    `Qualified density +${qualifiedDensity} (${qualified.length}/${total} at lead score ≥ ${QUALIFIED_LEAD_SCORE_MIN}).`,
    `High-intent boost +${highIntentBoost} (${highIntent.length} high-intent).`,
    `Buying stage maturity +${maturityPoints} (avg ${avgMaturity}/100).`,
    `Decision maker coverage +${dmPoints} (${dmCoveragePct}% with indexed DMs).`,
    `Contact confidence +${contactPoints} (avg ${avgContact}/100).`,
    suppressionPenalty > 0 ? `Suppression penalty −${suppressionPenalty} (${suppressed} suppressed).` : "No suppression penalty.",
    existingPenalty > 0
      ? `Existing account overlap −${existingPenalty} (${existingCustomers + existingProspects} customer/prospect).`
      : applyExistingPenalty
        ? "No existing-account overlap penalty."
        : "Existing accounts included — overlap penalty skipped.",
    `Average lead score ${avgLead}.`,
    `Opportunity heat score ${score}/100.`,
  ]

  return {
    score,
    explanation,
    suppression_adjusted_opportunity_count: qualified.length,
  }
}

function buildTopBuyingStages(
  companies: TerritoryOpportunityHeatmapCompanyInput[],
): Array<{ stage: string; count: number }> {
  const counts = new Map<string, number>()
  for (const company of companies) {
    if (!company.buying_stage) continue
    counts.set(company.buying_stage, (counts.get(company.buying_stage) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
    .slice(0, 4)
    .map(([stage, count]) => ({ stage, count }))
}

export function aggregateTerritoryOpportunityHeatmap(input: {
  companies: TerritoryOpportunityHeatmapCompanyInput[]
  filters: GrowthProspectSearchFilters
  bucket_dimension?: GrowthTerritoryOpportunityBucketDimension
  savedSearchRestored?: boolean
}): GrowthTerritoryOpportunityHeatmapResult {
  const companies = input.companies
  const bucket_dimension = input.bucket_dimension ?? resolveTerritoryOpportunityBucketDimension(input.filters)
  const has_geo_fields = companies.some(
    (row) => Boolean(normalizeState(row.state) || normalizeCity(row.city) || normalizeMetro(row.metro)),
  )
  const visible =
    hasActiveTerritoryFilter(input.filters.territory_filter) ||
    input.savedSearchRestored === true ||
    has_geo_fields

  const scorePack = computeTerritoryOpportunityHeatScore({
    companies,
    existingAccountMode: input.filters.existing_account_mode,
  })

  const qualified = companies.filter(isTerritoryQualifiedProspect)
  const highIntent = companies.filter(isTerritoryHighIntentProspect)
  const withDm = companies.filter((row) => (row.decision_maker_count ?? 0) > 0).length
  const avgLead =
    companies.length > 0
      ? Math.round(companies.reduce((sum, row) => sum + resolveLeadScore(row), 0) / companies.length)
      : 0

  const summary: GrowthTerritoryOpportunitySummary = {
    total_companies: companies.length,
    qualified_prospects: qualified.length,
    high_intent_prospects: highIntent.length,
    decision_maker_coverage_pct:
      companies.length > 0 ? Math.round((withDm / companies.length) * 100) : 0,
    suppressed_count: companies.filter((row) => row.is_suppressed).length,
    existing_customer_count: companies.filter((row) => row.existing_customer).length,
    existing_prospect_count: companies.filter((row) => row.existing_prospect).length,
    average_lead_score: avgLead,
    top_buying_stages: buildTopBuyingStages(companies),
    opportunity_score: scorePack.score,
    score_explanation: scorePack.explanation,
    suppression_adjusted_opportunity_count: scorePack.suppression_adjusted_opportunity_count,
  }

  const groups = new Map<string, { meta: ReturnType<typeof resolveTerritoryBucketKey>; rows: TerritoryOpportunityHeatmapCompanyInput[] }>()
  for (const company of companies) {
    const meta = resolveTerritoryBucketKey(company, bucket_dimension)
    const bucket = groups.get(meta.key) ?? { meta, rows: [] }
    bucket.rows.push(company)
    groups.set(meta.key, bucket)
  }

  const territories: GrowthTerritoryOpportunityBucketRow[] = [...groups.entries()]
    .map(([bucket_key, group]) => {
      const bucketScore = computeTerritoryOpportunityHeatScore({
        companies: group.rows,
        existingAccountMode: input.filters.existing_account_mode,
      })
      const bucketQualified = group.rows.filter(isTerritoryQualifiedProspect)
      const bucketHighIntent = group.rows.filter(isTerritoryHighIntentProspect)
      const bucketWithDm = group.rows.filter((row) => (row.decision_maker_count ?? 0) > 0).length
      const bucketAvgLead =
        group.rows.length > 0
          ? Math.round(group.rows.reduce((sum, row) => sum + resolveLeadScore(row), 0) / group.rows.length)
          : 0

      return {
        id: `${bucket_dimension}:${bucket_key}`,
        label: group.meta.label,
        bucket_dimension,
        bucket_key,
        city: group.meta.city,
        state: group.meta.state,
        metro: group.meta.metro,
        postal_code: group.meta.postal_code,
        company_count: group.rows.length,
        qualified_count: bucketQualified.length,
        high_intent_count: bucketHighIntent.length,
        average_lead_score: bucketAvgLead,
        buying_stage_maturity: averageBuyingStageMaturity(group.rows),
        decision_maker_coverage_pct:
          group.rows.length > 0 ? Math.round((bucketWithDm / group.rows.length) * 100) : 0,
        suppressed_count: group.rows.filter((row) => row.is_suppressed).length,
        opportunity_score: bucketScore.score,
        suppression_adjusted_opportunity_count: bucketScore.suppression_adjusted_opportunity_count,
        score_explanation: bucketScore.explanation,
      }
    })
    .sort(
      (a, b) =>
        b.suppression_adjusted_opportunity_count - a.suppression_adjusted_opportunity_count ||
        b.opportunity_score - a.opportunity_score ||
        b.average_lead_score - a.average_lead_score ||
        b.buying_stage_maturity - a.buying_stage_maturity ||
        b.decision_maker_coverage_pct - a.decision_maker_coverage_pct ||
        b.qualified_count - a.qualified_count,
    )
    .slice(0, 12)

  const recommended_action = resolveTerritoryOpportunityRecommendedAction({
    summary,
    hasSavedSearch: input.savedSearchRestored === true,
  })

  return {
    qa_marker: GROWTH_TERRITORY_OPPORTUNITY_HEATMAP_QA_MARKER,
    visible,
    bucket_dimension,
    has_geo_fields,
    summary,
    territories,
    recommended_action,
    recommended_action_label: RECOMMENDED_ACTION_LABELS[recommended_action],
    source: "materialized_index",
    no_provider_calls: true,
  }
}

export function resolveTerritoryOpportunityRecommendedAction(input: {
  summary: GrowthTerritoryOpportunitySummary
  hasSavedSearch?: boolean
}): GrowthTerritoryOpportunityRecommendedAction {
  if (input.hasSavedSearch && input.summary.qualified_prospects >= 5) {
    return "launch_outbound_review"
  }
  if (input.summary.qualified_prospects >= 10 && input.summary.opportunity_score >= 55) {
    return "bulk_push_qualified"
  }
  if (!input.hasSavedSearch && input.summary.total_companies >= 20) {
    return "save_workflow"
  }
  return "review_territory"
}

export function applyTerritoryHeatmapDrilldown(
  filters: GrowthProspectSearchFilters,
  row: GrowthTerritoryOpportunityBucketRow,
): GrowthProspectSearchFilters {
  const base = normalizeTerritoryFilter(filters.territory_filter) ?? {}
  const territory: GrowthProspectSearchTerritoryFilter = { ...base }

  switch (row.bucket_dimension) {
    case "state":
      territory.states = [normalizeState(row.state ?? row.bucket_key) ?? row.bucket_key]
      territory.cities = undefined
      territory.metros = undefined
      territory.postal_codes = undefined
      break
    case "city":
      if (row.city) territory.cities = [row.city]
      if (row.state) territory.states = [row.state]
      territory.metros = undefined
      territory.postal_codes = undefined
      break
    case "metro":
      if (row.metro ?? row.bucket_key) territory.metros = [row.metro ?? row.bucket_key]
      territory.postal_codes = undefined
      break
    case "postal_code":
      if (row.postal_code ?? row.bucket_key) {
        territory.postal_codes = [row.postal_code ?? row.bucket_key]
      }
      break
  }

  return {
    ...filters,
    territory_filter: normalizeTerritoryFilter(territory),
  }
}

export function shouldShowTerritoryOpportunityPanel(input: {
  filters: GrowthProspectSearchFilters
  savedSearchRestored: boolean
  heatmap?: Pick<GrowthTerritoryOpportunityHeatmapResult, "visible" | "has_geo_fields"> | null
}): boolean {
  if (hasActiveTerritoryFilter(input.filters.territory_filter)) return true
  if (input.savedSearchRestored) return true
  if (input.heatmap?.visible || input.heatmap?.has_geo_fields) return true
  return false
}

export function indexCompanyToTerritoryHeatmapInput(
  company: import("@/lib/growth/prospect-search/prospect-search-types").GrowthProspectSearchIndexCompany,
): TerritoryOpportunityHeatmapCompanyInput {
  return {
    id: company.id,
    city: company.city,
    state: company.state,
    metro: company.metro,
    postal_code: company.postal_code,
    lead_score: company.lead_score,
    lead_engine_score: company.lead_engine_score,
    intent_score: company.intent_score,
    buying_stage: company.buying_stage,
    buying_stage_confidence: company.buying_stage_confidence,
    decision_maker_count: company.decision_maker_count,
    company_match_confidence: company.company_match_confidence,
    signal_confidence: company.signal_confidence,
    is_suppressed: company.is_suppressed,
    existing_customer: company.existing_customer,
    existing_prospect: company.existing_prospect,
  }
}

export function formatTerritoryOpportunityCountLabel(count: number, dimension: GrowthTerritoryOpportunityBucketDimension): string {
  const noun =
    dimension === "postal_code"
      ? count === 1
        ? "opportunity"
        : "opportunities"
      : count === 1
        ? "opportunity"
        : "opportunities"
  return `${count.toLocaleString()} ${noun}`
}
