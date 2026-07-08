/**
 * Regression checks for Market Graph + Confidence Intelligence.
 * Run: pnpm test:growth-market-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { computeCommitteeCompletion } from "../lib/growth/committee-intelligence/committee-completion-engine"
import {
  computeCompanyConfidenceScore,
  freshnessConfidenceFromAgeDays,
} from "../lib/growth/confidence-intelligence/company-confidence-scoring"
import {
  GROWTH_CONFIDENCE_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_CONFIDENCE_INTELLIGENCE_QA_MARKER,
} from "../lib/growth/confidence-intelligence/confidence-intelligence-types"
import { buildCompanyRelationships } from "../lib/growth/market-intelligence/company-relationship-engine"
import { computeMarketCoverageScore, buildMarketKey } from "../lib/growth/market-intelligence/market-coverage-scoring"
import {
  GROWTH_MARKET_INTELLIGENCE_PRIVACY_NOTE,
  GROWTH_MARKET_INTELLIGENCE_QA_MARKER,
  GROWTH_COMPANY_RELATIONSHIP_TYPES,
} from "../lib/growth/market-intelligence/market-intelligence-types"
import { GROWTH_MARKET_INTELLIGENCE_SCHEMA_MIGRATION } from "../lib/growth/market-intelligence/market-intelligence-schema-health"
import {
  applyMarketIntelligenceToCompanyResult,
  computeProspectSearchCommitteeCompletion,
  computeProspectSearchCompanyConfidence,
} from "../lib/growth/market-intelligence/integrations/prospect-search-market-overlay"
import { buildCompanyRelationships as buildBridgeRelationships } from "../lib/growth/market-intelligence/integrations/prospect-search-market-bridge"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

function sampleCompany(partial: Partial<GrowthProspectSearchCompanyResult>): GrowthProspectSearchCompanyResult {
  return {
    id: partial.id ?? "co-1",
    source_type: partial.source_type ?? "growth_lead",
    company_name: partial.company_name ?? "Anchor HVAC",
    website: partial.website ?? "https://anchor.example",
    industry: partial.industry ?? "HVAC",
    subindustry: partial.subindustry ?? null,
    employees: partial.employees ?? "51-100",
    revenue_range: partial.revenue_range ?? null,
    location: partial.location ?? "Nashville, TN",
    city: partial.city ?? "Nashville",
    state: partial.state ?? "TN",
    intent_score: partial.intent_score ?? null,
    buying_stage: partial.buying_stage ?? null,
    buying_stage_confidence: partial.buying_stage_confidence ?? null,
    buying_stage_reason: partial.buying_stage_reason ?? null,
    buying_stage_last_assessed_at: partial.buying_stage_last_assessed_at ?? null,
    lead_score: partial.lead_score ?? 72,
    lead_engine_score: partial.lead_engine_score ?? 72,
    lead_engine_score_label: partial.lead_engine_score_label ?? null,
    lead_engine_score_explanation: partial.lead_engine_score_explanation ?? null,
    lead_engine_last_run_at: partial.lead_engine_last_run_at ?? null,
    confidence: partial.confidence ?? 0.82,
    company_match_confidence: partial.company_match_confidence ?? null,
    decision_maker_coverage: partial.decision_maker_coverage ?? null,
    verification_status: partial.verification_status ?? "unverified",
    signals: partial.signals ?? [],
    search_intent_category: partial.search_intent_category ?? null,
    growth_lead_id: partial.growth_lead_id ?? null,
    prospect_id: partial.prospect_id ?? null,
    customer_id: partial.customer_id ?? null,
    rank_score: partial.rank_score ?? 1,
    match_reasoning: partial.match_reasoning ?? [],
    field_service_software: partial.field_service_software ?? "ServiceTitan",
    crm_detected: partial.crm_detected ?? null,
    growth_signal_score: partial.growth_signal_score ?? 78,
    growth_signal_tier: partial.growth_signal_tier ?? "high",
    contact_intelligence: partial.contact_intelligence ?? null,
    ...partial,
  }
}

async function main(): Promise<void> {
  assert.equal(GROWTH_MARKET_INTELLIGENCE_QA_MARKER, "growth-market-intelligence-v1")
  assert.equal(GROWTH_CONFIDENCE_INTELLIGENCE_QA_MARKER, "growth-confidence-intelligence-v1")
  assert.match(GROWTH_MARKET_INTELLIGENCE_PRIVACY_NOTE, /evidence/i)
  assert.match(GROWTH_CONFIDENCE_INTELLIGENCE_PRIVACY_NOTE, /evidence-backed/i)
  assert.equal(GROWTH_COMPANY_RELATIONSHIP_TYPES.length, 8)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_MARKET_INTELLIGENCE_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /company_relationships/)
  assert.match(migration, /market_coverage_scores/)
  assert.match(migration, /company_confidence_scores/)
  assert.match(migration, /discovery_outcome_patterns/)
  assert.match(migration, /market_health_refresh_queue/)

  const cronSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-market-health-refresh/route.ts"),
    "utf8",
  )
  assert.match(cronSource, /CRON_SECRET/)
  assert.match(cronSource, /queueMarketHealthRefresh/)
  assert.match(cronSource, /processMarketHealthRefreshQueue/)

  const anchor = {
    company_id: "co-1",
    company_name: "Anchor HVAC",
    industry: "HVAC",
    state: "TN",
    city: "Nashville",
    lead_engine_score: 78,
    field_service_software: "ServiceTitan",
    employees: "51-100",
    signal_types: ["hiring"],
  }
  const pool = [
    anchor,
    {
      company_id: "co-2",
      company_name: "Peer HVAC",
      industry: "HVAC",
      state: "TN",
      city: "Nashville",
      lead_engine_score: 74,
      field_service_software: "ServiceTitan",
      employees: "51-100",
      signal_types: ["hiring"],
    },
  ]

  const relationships = buildCompanyRelationships(anchor, pool, 5)
  assert.ok(relationships.length > 0)
  assert.ok(relationships.every((row) => row.evidence_excerpt.trim().length > 0))
  assert.ok(relationships.every((row) => row.relationship_strength >= 0 && row.relationship_strength <= 100))

  const committee = computeCommitteeCompletion([
    { full_name: "Alex Owner", job_title: "Owner" },
    { full_name: "Sam Ops", job_title: "Director of Operations" },
    { full_name: "Pat Service", job_title: "Service Manager" },
    { full_name: "Dana Dispatch", job_title: "Dispatcher" },
    { full_name: "Lee Field", job_title: "Field Service Director" },
  ])
  assert.equal(committee.completion_label, "75%")
  assert.ok(committee.missing_roles.includes("finance"))

  const confidence = computeCompanyConfidenceScore({
    company_id: "co-1",
    discovery_confidence: 95,
    contact_confidence: 88,
    signal_confidence: 90,
    coverage_confidence: 75,
    freshness_confidence: 96,
    evidence: [{ dimension: "discovery", score: 95, excerpt: "Provider-backed discovery" }],
  })
  assert.ok(confidence.overall_confidence >= 85)
  assert.equal(confidence.evidence.length, 1)

  assert.equal(freshnessConfidenceFromAgeDays(3), 96)
  assert.equal(freshnessConfidenceFromAgeDays(45), 70)

  const market = computeMarketCoverageScore({
    market_key: buildMarketKey({ label: "Nashville HVAC", industry: "HVAC" }),
    market_label: "Nashville HVAC",
    industry: "HVAC",
    market_total_discovered: 2141,
    market_researched: 640,
    market_contacted: 118,
    market_active_pipeline: 23,
    market_customers: 12,
    market_signal_density: 58,
    market_contact_coverage: 42,
    territory_strength: 71,
  })
  assert.equal(market.market_total_discovered, 2141)
  assert.ok(market.market_penetration_percent > 0)
  assert.ok(market.whitespace_score > 0)

  const companyA = sampleCompany({ id: "co-a", company_name: "Alpha HVAC" })
  const companyB = sampleCompany({ id: "co-b", company_name: "Beta HVAC" })
  const bridged = buildBridgeRelationships(companyA, [companyA, companyB], 5)
  assert.ok(bridged.length > 0)

  const withContacts = sampleCompany({
    contact_intelligence: {
      qa_marker: "growth-prospect-search-contact-intelligence-v1",
      schema_ready: true,
      has_contacts: true,
      contacts: [
        {
          id: "c1",
          name: "Alex Owner",
          title: "Owner",
          email: null,
          phone: null,
          role_type: "owner",
          confidence: 0.9,
          recommended_priority: 1,
          source_evidence: [{ claim: "Leadership page", evidence: "Listed on website leadership page", source: "lead" }],
        },
      ],
      committee_roles: [],
      committee_completeness_pct: 25,
      first_contact: null,
      confidence_explanation: null,
      outreach_recommendation: null,
      source_labels: [],
      empty_reason: null,
      contact_coverage_score: 40,
      contact_coverage_label: "Partial",
      contact_confidence_score: 82,
    },
  })
  const committeeOverlay = computeProspectSearchCommitteeCompletion(withContacts)
  assert.ok(committeeOverlay.completion_pct > 0)
  assert.ok(committeeOverlay.missing_roles.includes("finance"))
  const confidenceOverlay = computeProspectSearchCompanyConfidence(withContacts, committeeOverlay)
  assert.ok(confidenceOverlay)
  assert.ok(confidenceOverlay!.evidence.length > 0)

  const enriched = applyMarketIntelligenceToCompanyResult(withContacts, {
    related_companies: bridged,
    company_confidence: confidenceOverlay,
    committee_completion: committeeOverlay,
  })
  assert.ok(enriched.related_companies?.length)
  assert.ok(enriched.company_confidence)
  assert.ok(enriched.committee_completion)

  const commandSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-command-market-operating-section.tsx"),
    "utf8",
  )
  assert.match(commandSource, /Market Operating System/)
  assert.match(commandSource, /discovery_velocity/)

  console.log("growth-market-intelligence: all checks passed")
}

void main()
