import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { computeCommitteeCompletion, committeeCompletionToCoverageConfidence } from "@/lib/growth/committee-intelligence/committee-completion-engine"
import { computeCompanyConfidenceScore, freshnessConfidenceFromAgeDays } from "@/lib/growth/confidence-intelligence/company-confidence-scoring"
import type { GrowthCompanyConfidenceScore } from "@/lib/growth/confidence-intelligence/confidence-intelligence-types"
import { listCompanyContacts } from "@/lib/growth/contact-discovery/company-contact-repository"
import { computeCompanyContactCoverage } from "@/lib/growth/contact-discovery/company-contact-coverage"
import { loadCompanyGrowthSignalsSnapshot } from "@/lib/growth/company-growth-signals/growth-signal-repository"
import {
  buildCompanyRelationships,
  type RelationshipCompanyInput,
} from "@/lib/growth/market-intelligence/company-relationship-engine"
import {
  buildDiscoveryPatternKey,
  computeDiscoveryPriorityBoost,
} from "@/lib/growth/market-intelligence/discovery-feedback-loop"
import { buildMarketKey, computeMarketCoverageScore } from "@/lib/growth/market-intelligence/market-coverage-scoring"
import {
  GROWTH_MARKET_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_MARKET_INTELLIGENCE_QA_MARKER,
  type GrowthCommandMarketHealth,
  type GrowthCompanyRelationship,
  type GrowthMarketCoverageScore,
} from "@/lib/growth/market-intelligence/market-intelligence-types"
import { isGrowthMarketIntelligenceSchemaReady } from "@/lib/growth/market-intelligence/market-intelligence-schema-health"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function companyToRelationshipInput(company: GrowthProspectSearchCompanyResult): RelationshipCompanyInput {
  return {
    company_id: company.id,
    company_name: company.company_name,
    industry: company.industry,
    state: company.state,
    city: company.city,
    lead_engine_score: company.lead_engine_score ?? company.lead_score,
    growth_signal_score: company.growth_signal_score,
    crm_detected: company.crm_detected,
    field_service_software: company.field_service_software,
    employees: company.employees,
    signal_types: company.company_signal_summary?.growth_indicators ?? [],
  }
}

export async function persistCompanyRelationships(
  admin: SupabaseClient,
  anchor: GrowthProspectSearchCompanyResult,
  pool: GrowthProspectSearchCompanyResult[],
): Promise<GrowthCompanyRelationship[]> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return []

  const relationships = buildCompanyRelationships(companyToRelationshipInput(anchor), pool.map(companyToRelationshipInput))
  await admin.schema("growth").from("company_relationships").delete().eq("company_id", anchor.id)

  for (const relationship of relationships) {
    if (!relationship.evidence_excerpt.trim()) continue
    await admin.schema("growth").from("company_relationships").insert({
      company_id: relationship.company_id,
      related_company_id: relationship.related_company_id,
      relationship_type: relationship.relationship_type,
      relationship_strength: relationship.relationship_strength,
      evidence_excerpt: relationship.evidence_excerpt,
      metadata: { related_company_name: relationship.related_company_name },
      updated_at: new Date().toISOString(),
    })
  }

  return relationships
}

export async function loadCompanyRelationships(
  admin: SupabaseClient,
  companyId: string,
  limit = 5,
): Promise<GrowthCompanyRelationship[]> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return []
  const { data } = await admin
    .schema("growth")
    .from("company_relationships")
    .select("*")
    .eq("company_id", companyId)
    .order("relationship_strength", { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>
    const metadata = r.metadata && typeof r.metadata === "object" ? (r.metadata as Record<string, unknown>) : {}
    return {
      id: asString(r.id),
      company_id: asString(r.company_id),
      related_company_id: asString(r.related_company_id),
      related_company_name: asString(metadata.related_company_name) || "Related company",
      relationship_type: asString(r.relationship_type) as GrowthCompanyRelationship["relationship_type"],
      relationship_strength: Number(r.relationship_strength ?? 0),
      evidence_excerpt: asString(r.evidence_excerpt),
    }
  })
}

export async function computeAndPersistCompanyConfidence(
  admin: SupabaseClient,
  companyId: string,
  hints?: {
    discovery_confidence?: number | null
    last_verified_at?: string | null
  },
): Promise<GrowthCompanyConfidenceScore | null> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return null

  const [contacts, signals] = await Promise.all([
    listCompanyContacts(admin, companyId).catch(() => []),
    loadCompanyGrowthSignalsSnapshot(admin, companyId).catch(() => null),
  ])

  const coverage = computeCompanyContactCoverage(contacts)
  const committee = computeCommitteeCompletion(
    contacts.map((contact) => ({ full_name: contact.full_name, job_title: contact.job_title })),
  )

  const lastVerified = hints?.last_verified_at ?? signals?.score?.last_computed_at ?? null
  const ageDays = lastVerified ? (Date.now() - Date.parse(lastVerified)) / (1000 * 60 * 60 * 24) : null

  const score = computeCompanyConfidenceScore({
    company_id: companyId,
    discovery_confidence: hints?.discovery_confidence ?? null,
    contact_confidence: coverage.contact_confidence_score,
    signal_confidence: signals?.score?.growth_signal_score ?? null,
    coverage_confidence: committeeCompletionToCoverageConfidence(committee.completion_pct),
    freshness_confidence: freshnessConfidenceFromAgeDays(ageDays),
    evidence: [
      ...(coverage.contact_confidence_score > 0
        ? [{ dimension: "contact", score: coverage.contact_confidence_score, excerpt: `Contact coverage ${coverage.coverage_label}` }]
        : []),
      ...(signals?.score
        ? [{ dimension: "signal", score: signals.score.growth_signal_score, excerpt: `Growth signal tier ${signals.score.signal_tier}` }]
        : []),
      ...(committee.completion_pct > 0
        ? [{ dimension: "coverage", score: committee.completion_pct, excerpt: `Committee completion ${committee.completion_label}` }]
        : []),
    ],
  })

  await admin.schema("growth").from("company_confidence_scores").upsert({
    ...score,
    updated_at: new Date().toISOString(),
  })

  return score
}

export async function loadCompanyConfidenceScore(
  admin: SupabaseClient,
  companyId: string,
): Promise<GrowthCompanyConfidenceScore | null> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return null
  const { data } = await admin
    .schema("growth")
    .from("company_confidence_scores")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  return {
    company_id: companyId,
    discovery_confidence: Number(row.discovery_confidence ?? 0),
    contact_confidence: Number(row.contact_confidence ?? 0),
    signal_confidence: Number(row.signal_confidence ?? 0),
    coverage_confidence: Number(row.coverage_confidence ?? 0),
    freshness_confidence: Number(row.freshness_confidence ?? 0),
    overall_confidence: Number(row.overall_confidence ?? 0),
    evidence: Array.isArray(row.evidence) ? (row.evidence as GrowthCompanyConfidenceScore["evidence"]) : [],
    last_computed_at: asString(row.last_computed_at),
  }
}

export async function refreshMarketCoverageScore(
  admin: SupabaseClient,
  input: {
    market_label: string
    territory_id?: string | null
    industry?: string | null
    companies: GrowthProspectSearchCompanyResult[]
    territory_opportunity_score?: number | null
  },
): Promise<GrowthMarketCoverageScore | null> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return null

  const total = input.companies.length
  const researched = input.companies.filter((c) => (c.lead_engine_score ?? 0) > 0 || c.company_signal_summary).length
  const contacted = input.companies.filter((c) => c.in_revenue_queue || c.existing_prospect).length
  const pipeline = input.companies.filter((c) => c.existing_prospect && !c.existing_customer).length
  const customers = input.companies.filter((c) => c.existing_customer).length
  const signalDensity =
    total > 0
      ? Math.round(
          input.companies.reduce((sum, c) => sum + (c.growth_signal_score ?? 0), 0) / total,
        )
      : 0
  const contactCoverage =
    total > 0
      ? Math.round(
          input.companies.reduce(
            (sum, c) => sum + (c.contact_intelligence?.contact_coverage_score ?? 0),
            0,
          ) / total,
        )
      : 0

  const score = computeMarketCoverageScore({
    market_key: buildMarketKey({ territory_id: input.territory_id, industry: input.industry, label: input.market_label }),
    market_label: input.market_label,
    territory_id: input.territory_id,
    industry: input.industry,
    market_total_discovered: total,
    market_researched: researched,
    market_contacted: contacted,
    market_active_pipeline: pipeline,
    market_customers: customers,
    market_signal_density: signalDensity,
    market_contact_coverage: contactCoverage,
    territory_strength: input.territory_opportunity_score ?? 0,
  })

  await admin.schema("growth").from("market_coverage_scores").upsert({
    ...score,
    updated_at: new Date().toISOString(),
  })

  return score
}

export async function rebuildDiscoveryOutcomePatterns(admin: SupabaseClient): Promise<number> {
  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return 0

  const safeQuery = async (query: PromiseLike<{ data: unknown[] | null }>) => {
    try {
      return await query
    } catch {
      return { data: [] as unknown[] }
    }
  }

  const [leadsRes, oppsRes, repliesRes, meetingsRes] = await Promise.all([
    admin.schema("growth").from("leads").select("id, industry, company_name").limit(500),
    safeQuery(admin.schema("growth").from("opportunities").select("lead_id, closed_won_at, closed_lost_at").limit(500)),
    safeQuery(admin.schema("growth").from("outbound_replies").select("lead_id, classification").limit(500)),
    safeQuery(admin.schema("growth").from("meetings").select("lead_id, status").limit(500)),
  ])

  const patterns = new Map<
    string,
    {
      industry: string | null
      won: number
      lost: number
      meetings: number
      positive: number
      negative: number
      closed: number
    }
  >()

  const leadIndustry = new Map<string, string | null>()
  for (const lead of leadsRes.data ?? []) {
    const row = lead as Record<string, unknown>
    leadIndustry.set(asString(row.id), asString(row.industry) || null)
    const key = buildDiscoveryPatternKey({
      industry: asString(row.industry) || null,
    })
    if (!patterns.has(key)) {
      patterns.set(key, {
        industry: asString(row.industry) || null,
        won: 0,
        lost: 0,
        meetings: 0,
        positive: 0,
        negative: 0,
        closed: 0,
      })
    }
  }

  for (const opp of oppsRes.data ?? []) {
    const row = opp as Record<string, unknown>
    const industry = leadIndustry.get(asString(row.lead_id)) ?? null
    const key = buildDiscoveryPatternKey({ industry })
    const bucket = patterns.get(key) ?? { industry, won: 0, lost: 0, meetings: 0, positive: 0, negative: 0, closed: 0 }
    if (row.closed_won_at) {
      bucket.won += 1
      bucket.closed += 1
    }
    if (row.closed_lost_at) bucket.lost += 1
    patterns.set(key, bucket)
  }

  for (const reply of repliesRes.data ?? []) {
    const row = reply as Record<string, unknown>
    const industry = leadIndustry.get(asString(row.lead_id)) ?? null
    const key = buildDiscoveryPatternKey({ industry })
    const bucket = patterns.get(key) ?? { industry, won: 0, lost: 0, meetings: 0, positive: 0, negative: 0, closed: 0 }
    const classification = asString(row.classification).toLowerCase()
    if (classification.includes("positive") || classification.includes("interested")) bucket.positive += 1
    if (classification.includes("negative") || classification.includes("not_interested")) bucket.negative += 1
    patterns.set(key, bucket)
  }

  for (const meeting of meetingsRes.data ?? []) {
    const row = meeting as Record<string, unknown>
    const industry = leadIndustry.get(asString(row.lead_id)) ?? null
    const key = buildDiscoveryPatternKey({ industry })
    const bucket = patterns.get(key) ?? { industry, won: 0, lost: 0, meetings: 0, positive: 0, negative: 0, closed: 0 }
    if (asString(row.status) !== "cancelled") bucket.meetings += 1
    patterns.set(key, bucket)
  }

  let upserted = 0
  for (const [pattern_key, stats] of patterns.entries()) {
    const boost = computeDiscoveryPriorityBoost({
      pattern_key,
      industry: stats.industry,
      won_count: stats.won,
      lost_count: stats.lost,
      meetings_booked: stats.meetings,
      positive_replies: stats.positive,
      negative_replies: stats.negative,
      closed_deals: stats.closed,
      evidence_excerpt: `Won ${stats.won}, lost ${stats.lost}, meetings ${stats.meetings}, positive replies ${stats.positive}`,
    })
    await admin.schema("growth").from("discovery_outcome_patterns").upsert({
      pattern_key,
      industry: stats.industry,
      won_count: stats.won,
      lost_count: stats.lost,
      meetings_booked: stats.meetings,
      positive_replies: stats.positive,
      negative_replies: stats.negative,
      closed_deals: stats.closed,
      discovery_priority_boost: boost,
      evidence_excerpt: `Outcome-weighted discovery boost ${boost}`,
      last_computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    upserted += 1
  }

  return upserted
}

export async function fetchCommandMarketHealth(admin: SupabaseClient): Promise<GrowthCommandMarketHealth> {
  const empty: GrowthCommandMarketHealth = {
    coverage_percent: 0,
    whitespace_percent: 0,
    discovery_velocity: 0,
    new_companies_discovered: 0,
    high_fit_discovered: 0,
    signal_velocity: 0,
    market_penetration: 0,
    committee_completion_avg: 0,
    related_company_opportunities: 0,
    prospect_saturation: 0,
  }

  if (!(await isGrowthMarketIntelligenceSchemaReady(admin))) return empty

  const today = new Date().toISOString().slice(0, 10)
  const [statsRes, marketRes, relRes, confRes, runsRes] = await Promise.all([
    admin.schema("growth").from("discovery_statistics").select("*").eq("stat_date", today),
    admin.schema("growth").from("market_coverage_scores").select("*").limit(20),
    admin.schema("growth").from("company_relationships").select("id").gte("relationship_strength", 70).limit(200),
    admin.schema("growth").from("company_confidence_scores").select("coverage_confidence").limit(200),
    admin.schema("growth").from("discovery_runs").select("new_companies_found, high_fit_found").gte("created_at", `${today}T00:00:00.000Z`),
  ])

  const stats = statsRes.data ?? []
  const markets = (marketRes.data ?? []) as Record<string, unknown>[]
  const newCompanies = stats.reduce((sum, row) => sum + Number((row as Record<string, unknown>).new_companies_found ?? 0), 0)
  const highFit = stats.reduce((sum, row) => sum + Number((row as Record<string, unknown>).high_fit_found ?? 0), 0)
  const coverageAvg =
    markets.length > 0
      ? Math.round(markets.reduce((sum, row) => sum + Number(row.coverage_score ?? 0), 0) / markets.length)
      : 0
  const whitespaceAvg =
    markets.length > 0
      ? Math.round(markets.reduce((sum, row) => sum + Number(row.whitespace_score ?? 0), 0) / markets.length)
      : 0
  const penetrationAvg =
    markets.length > 0
      ? Number(
          (
            markets.reduce((sum, row) => sum + Number(row.market_penetration_percent ?? 0), 0) / markets.length
          ).toFixed(1),
        )
      : 0
  const signalAvg =
    markets.length > 0
      ? Math.round(markets.reduce((sum, row) => sum + Number(row.market_signal_density ?? 0), 0) / markets.length)
      : 0
  const committeeAvg =
    (confRes.data ?? []).length > 0
      ? Math.round(
          (confRes.data ?? []).reduce(
            (sum, row) => sum + Number((row as Record<string, unknown>).coverage_confidence ?? 0),
            0,
          ) / (confRes.data ?? []).length,
        )
      : 0

  const runCount = runsRes.data?.length ?? 0
  const saturation = markets.length > 0 ? Math.round((penetrationAvg / 100) * 100) : 0

  return {
    coverage_percent: coverageAvg,
    whitespace_percent: whitespaceAvg,
    discovery_velocity: runCount,
    new_companies_discovered: newCompanies,
    high_fit_discovered: highFit,
    signal_velocity: signalAvg,
    market_penetration: penetrationAvg,
    committee_completion_avg: committeeAvg,
    related_company_opportunities: relRes.data?.length ?? 0,
    prospect_saturation: saturation,
  }
}

export async function processMarketHealthRefreshQueue(admin: SupabaseClient, limit = 10): Promise<{ processed: number; failed: number }> {
  const { data } = await admin
    .schema("growth")
    .from("market_health_refresh_queue")
    .select("id, market_key")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .limit(limit)

  let processed = 0
  let failed = 0

  for (const row of data ?? []) {
    const queueId = asString((row as Record<string, unknown>).id)
    if (!queueId) continue
    await admin.schema("growth").from("market_health_refresh_queue").update({ status: "running" }).eq("id", queueId)
    try {
      await rebuildDiscoveryOutcomePatterns(admin)
      await admin
        .schema("growth")
        .from("market_health_refresh_queue")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", queueId)
      processed += 1
    } catch (error) {
      failed += 1
      await admin
        .schema("growth")
        .from("market_health_refresh_queue")
        .update({
          status: "failed",
          last_error: error instanceof Error ? error.message.slice(0, 240) : "Refresh failed",
          attempts: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueId)
    }
  }

  return { processed, failed }
}

export async function queueMarketHealthRefresh(admin: SupabaseClient): Promise<number> {
  const { data } = await admin.schema("growth").from("market_coverage_scores").select("market_key").limit(50)
  let queued = 0
  for (const row of data ?? []) {
    const marketKey = asString((row as Record<string, unknown>).market_key)
    if (!marketKey) continue
    const { error } = await admin.schema("growth").from("market_health_refresh_queue").upsert(
      { market_key: marketKey, reason: "stale", status: "pending", scheduled_for: new Date().toISOString() },
      { onConflict: "market_key,reason" },
    )
    if (!error) queued += 1
  }
  if (queued === 0) {
    await admin.schema("growth").from("market_health_refresh_queue").upsert(
      { market_key: "global", reason: "stale", status: "pending", scheduled_for: new Date().toISOString() },
      { onConflict: "market_key,reason" },
    )
    queued = 1
  }
  return queued
}

export function marketIntelligenceMeta() {
  return {
    qa_marker: GROWTH_MARKET_INTELLIGENCE_QA_MARKER,
    privacy_note: GROWTH_MARKET_INTELLIGENCE_PRIVACY_NOTE,
  }
}
