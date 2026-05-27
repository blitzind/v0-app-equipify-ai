/**
 * Regression checks for Company Signal Intelligence (Prompt 30).
 * Run: pnpm test:growth-company-signals
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { scoreCompanySignalConfidence } from "../lib/growth/company-signals/company-signal-confidence"
import { dedupeCompanySignals, buildCompanySignalDedupeHash } from "../lib/growth/company-signals/company-signal-dedupe"
import {
  buildCompanySignalUiSummary,
  normalizeDetectedCompanySignals,
} from "../lib/growth/company-signals/company-signal-engine"
import { detectOperationalSignals } from "../lib/growth/company-signals/company-operational-detector"
import { detectTechnologySignals } from "../lib/growth/company-signals/company-tech-detector"
import { GROWTH_COMPANY_SIGNAL_SCHEMA_MIGRATION } from "../lib/growth/company-signals/company-signal-schema-health"
import {
  GROWTH_COMPANY_SIGNAL_CATEGORIES,
  GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER,
  GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE,
} from "../lib/growth/company-signals/company-signal-types"
import type { GrowthCompanySignalContext } from "../lib/growth/company-signals/company-signal-context"

async function main(): Promise<void> {
  assert.equal(GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER, "growth-company-signal-intelligence-v1")
  assert.ok(GROWTH_COMPANY_SIGNAL_CATEGORIES.includes("technology"))
  assert.ok(GROWTH_COMPANY_SIGNAL_CATEGORIES.includes("field_service"))
  assert.match(GROWTH_COMPANY_SIGNAL_PRIVACY_NOTE, /evidence-backed/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_COMPANY_SIGNAL_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /company_signal_runs/)
  assert.match(migration, /company_signals/)
  assert.match(migration, /signal_category/)
  assert.match(migration, /source_attribution/)
  assert.doesNotMatch(migration, /scrape|apollo|seamless/i)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/company-signals/company-signal-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /runCompanySignalIntelligence/)
  assert.doesNotMatch(repoSource, /sendEmail|runLeadEnginePipeline|scrape/i)

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/company-signals/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /GROWTH_COMPANY_SIGNAL_INTELLIGENCE_QA_MARKER/)

  const cardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/company-signals/company-intelligence-card.tsx"),
    "utf8",
  )
  assert.match(cardSource, /Technology signals/)
  assert.match(cardSource, /Field service maturity/)

  const prospectBridge = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-real-world-discovery.ts"),
    "utf8",
  )
  assert.match(prospectBridge, /runCompanySignalIntelligence/)

  const ctx: GrowthCompanySignalContext = {
    company_candidate_id: "co-1",
    company_name: "Precision Biomed Services",
    domain: "precisionbiomed.com",
    website: "https://precisionbiomed.com",
    industry: "biomedical equipment service",
    category: "Medical equipment repair",
    description: "Biomedical equipment repair and dispatch scheduling for hospitals.",
    location: "Boston, MA",
    city: "Boston",
    state: "MA",
    country: "US",
    review_count: 80,
    rating: 4.5,
    observed_technology_signals: ["CRM: observed match"],
    observed_crm_signals: [],
    observed_service_signals: ["Medical equipment repair"],
    metadata: {},
  }

  const techRaw = detectTechnologySignals(ctx)
  assert.ok(techRaw.some((r) => r.signal_type === "crm_indicators"))
  assert.ok(!techRaw.some((r) => r.signal_type === "quickbooks_detected"))

  const opsRaw = detectOperationalSignals(ctx)
  assert.ok(opsRaw.some((r) => r.signal_type === "dispatch_workflow_indicators"))

  const normalized = normalizeDetectedCompanySignals(ctx)
  assert.ok(normalized.length > 0)
  assert.ok(normalized.every((n) => n.evidence.length > 0))
  assert.ok(normalized.every((n) => n.confidence > 0))

  const deduped = dedupeCompanySignals([
    normalized[0]!,
    { ...normalized[0]!, confidence: 0.1 },
  ])
  assert.equal(deduped.length, 1)
  assert.equal(deduped[0]!.confidence, normalized[0]!.confidence)

  const observedScore = scoreCompanySignalConfidence({
    tier: "observed",
    evidence_count: 2,
    pattern_strength: "strong",
  })
  const inferredScore = scoreCompanySignalConfidence({
    tier: "inferred",
    evidence_count: 1,
    pattern_strength: "weak",
  })
  assert.ok(observedScore > inferredScore)
  assert.ok(inferredScore <= 0.55)

  const ui = buildCompanySignalUiSummary(normalized)
  assert.ok(ui.operational_maturity.length > 0)
  assert.ok(Array.isArray(ui.technology_signals))

  const hash = buildCompanySignalDedupeHash({
    company_candidate_id: "co-1",
    signal_category: "technology",
    signal_type: "crm_indicators",
  })
  assert.equal(hash.length, 40)

  console.log("growth-company-signal-intelligence-v1 checks passed")

  // Multi-source growth signal engine (Sprint — Apollo replacement layer)
  const {
    GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
    GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
  } = await import("../lib/growth/company-growth-signals/company-growth-signal-types")
  const { GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_MIGRATION } = await import(
    "../lib/growth/company-growth-signals/company-growth-signal-schema-health"
  )
  const { detectCareersPageEvidence } = await import(
    "../lib/growth/company-growth-signals/detectors/careers-hiring-detector"
  )
  const { detectTechStackSignals, classifyTechStackSummary } = await import(
    "../lib/growth/company-growth-signals/detectors/tech-stack-signal-detector"
  )
  const { fetchReviewReputationSignalsStub } = await import(
    "../lib/growth/company-growth-signals/providers/review-provider-stub"
  )
  const { fetchPressExpansionSignalsStub } = await import(
    "../lib/growth/company-growth-signals/providers/press-provider-stub"
  )
  const { computeGrowthSignalScore, growthSignalRankBoost } = await import(
    "../lib/growth/company-growth-signals/growth-signal-scoring"
  )
  const { applyGrowthSignalsToCompanyResult } = await import(
    "../lib/growth/company-growth-signals/integrations/prospect-search-growth-signals-overlay"
  )
  const {
    growthSignalActionImpactBoost,
    growthSignalInboxIntentBoost,
    growthSignalInboxPriority,
  } = await import("../lib/growth/company-growth-signals/integrations/command-center-bridge")

  assert.equal(GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER, "growth-company-growth-signals-v1")
  assert.match(GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE, /evidence/i)

  const growthMigration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_COMPANY_GROWTH_SIGNALS_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(growthMigration, /company_evidence_sources/)
  assert.match(growthMigration, /company_growth_signals/)
  assert.match(growthMigration, /company_growth_signal_scores/)
  assert.match(growthMigration, /hiring_technicians/)
  assert.match(growthMigration, /competitor_detected/)
  assert.doesNotMatch(growthMigration, /apollo\.io|seamless\.ai|scrape/i)

  const careersHtml = `
    <html><body>
      <h1>Careers</h1>
      <p>We are hiring an HVAC technician and a service manager for our Boston branch.</p>
      <a href="https://boards.greenhouse.io/acme">Apply on Greenhouse</a>
    </body></html>
  `
  const careers = detectCareersPageEvidence({
    pageUrl: "https://acme.example/careers",
    html: careersHtml,
    plainText: "Careers We are hiring an HVAC technician and a service manager",
  })
  assert.ok(careers.evidence.length > 0)
  assert.ok(careers.signals.some((signal) => signal.signal_type === "hiring_technicians"))
  assert.ok(careers.signals.some((signal) => signal.signal_type === "hiring_operations"))
  assert.ok(careers.signals.every((signal) => signal.evidence_excerpt.trim().length > 0))

  const techHtml = `<html><body>Powered by ServiceTitan and HubSpot online booking widget.</body></html>`
  const tech = detectTechStackSignals({
    pageUrl: "https://acme.example",
    html: techHtml,
    plainText: "Powered by ServiceTitan and HubSpot online booking widget",
  })
  assert.ok(tech.signals.some((signal) => signal.signal_type === "competitor_detected"))
  assert.ok(tech.signals.every((signal) => signal.evidence_excerpt.trim().length > 0))
  const techSummary = classifyTechStackSummary(["ServiceTitan"])
  assert.equal(techSummary.competitor_present, true)
  assert.equal(techSummary.upgrade_opportunity, true)

  const reviewStub = fetchReviewReputationSignalsStub({
    company_name: "Acme HVAC",
    domain: "acme.example",
    review_count: 120,
    rating: 2.8,
  })
  assert.equal(reviewStub.provider, "stub")
  assert.ok(reviewStub.signals.every((signal) => signal.evidence_excerpt.trim().length > 0))

  const pressStub = fetchPressExpansionSignalsStub({
    company_name: "Acme HVAC",
    description: "Acme HVAC announced a new branch opening in Denver after acquiring a local contractor.",
  })
  assert.ok(pressStub.signals.some((signal) => signal.signal_type === "expansion" || signal.signal_type === "new_location"))
  assert.ok(pressStub.signals.every((signal) => signal.evidence_excerpt.trim().length > 0))

  const scored = computeGrowthSignalScore({
    signals: careers.signals,
    contact_coverage_score: 70,
    website_maturity_score: 65,
    icp_fit_score: 80,
  })
  assert.ok(scored.growth_signal_score >= 0 && scored.growth_signal_score <= 100)
  assert.ok(["low", "moderate", "high", "urgent"].includes(scored.signal_tier))
  assert.ok(scored.top_signals.every((signal) => signal.evidence_excerpt.trim().length > 0))

  assert.equal(growthSignalRankBoost(85), 0.04)
  assert.equal(growthSignalActionImpactBoost({ growthSignalScore: 85, signalTier: "urgent" }), 10)
  assert.equal(growthSignalInboxIntentBoost(85), 18)
  assert.equal(growthSignalInboxPriority("urgent"), "urgent")

  const bridged = applyGrowthSignalsToCompanyResult(
    {
      id: "co-1",
      source_type: "external_discovered",
      company_name: "Acme HVAC",
      website: "https://acme.example",
      industry: "HVAC",
      location: "Boston, MA",
      city: "Boston",
      state: "MA",
      postal_code: null,
      country: "US",
      metro: null,
      lat: null,
      lng: null,
      service_area: null,
      signals: [],
      match_reasoning: [],
      rank_score: 0.5,
      confidence: 0.7,
      signal_confidence: 0.4,
      lead_engine_score: 70,
      lead_engine_score_explanation: "ICP fit",
      lead_score: 70,
      buying_stage: "consideration",
      buying_stage_reason: null,
      intent_score: null,
      search_intent_category: null,
      company_match_confidence: null,
      crm_detected: null,
      field_service_software: null,
      website_platform: null,
      company_signal_summary: null,
      existing_customer: false,
      existing_prospect: false,
      in_lead_inbox: false,
      is_suppressed: false,
      suppression_reason: null,
    },
    {
      qa_marker: GROWTH_COMPANY_GROWTH_SIGNALS_QA_MARKER,
      schema_ready: true,
      company_id: "co-1",
      evidence_sources: [],
      signals: careers.signals.map((signal, index) => ({
        id: `sig-${index}`,
        company_id: "co-1",
        ...signal,
        detected_at: new Date().toISOString(),
        expires_at: null,
        metadata: {},
      })),
      score: scored,
      privacy_note: GROWTH_COMPANY_GROWTH_SIGNALS_PRIVACY_NOTE,
    },
  )
  assert.equal(bridged.growth_signal_score, scored.growth_signal_score)
  assert.equal(bridged.growth_signal_tier, scored.signal_tier)

  const growthSignalRepoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/company-growth-signals/growth-signal-repository.ts"),
    "utf8",
  )
  assert.match(growthSignalRepoSource, /runCompanyGrowthSignalDiscovery/)
  assert.match(growthSignalRepoSource, /computeGrowthSignalScore/)

  const cronSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-company-signal-refresh/route.ts"),
    "utf8",
  )
  assert.match(cronSource, /CRON_SECRET|x-cron-secret/)
  assert.match(cronSource, /processCompanyGrowthSignalRefreshQueue/)

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-growth-signals-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /growth-company-growth-signals-v1/)
  assert.match(panelSource, /Evidence:/)

  const researchSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/research/research-orchestrator.ts"),
    "utf8",
  )
  assert.match(researchSource, /runCompanyGrowthSignalDiscovery/)

  const copilotSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/ai-copilot-input.ts"),
    "utf8",
  )
  assert.match(copilotSource, /loadCompanyGrowthSignalsSnapshot/)
  assert.match(copilotSource, /topGrowthSignals/)

  console.log("growth-company-growth-signals-v1 checks passed")
}

void main()
