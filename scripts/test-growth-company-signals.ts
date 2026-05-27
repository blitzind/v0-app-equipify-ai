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
}

void main()
