/**
 * Regression checks for Verification + Enrichment (Prompt 28).
 * Run: pnpm test:growth-verification-enrichment
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { normalizeCompanyEnrichmentResult } from "../lib/growth/enrichment/company-enrichment-engine"
import { normalizeContactVerificationResult } from "../lib/growth/enrichment/contact-verification-engine"
import { GROWTH_VERIFICATION_ENRICHMENT_SCHEMA_MIGRATION } from "../lib/growth/enrichment/enrichment-schema-health"
import {
  GROWTH_ENRICHMENT_PROVIDER_TYPES,
  type GrowthCompanyEnrichmentProviderResult,
  type GrowthContactVerificationProviderResult,
} from "../lib/growth/enrichment/enrichment-provider-types"
import {
  GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
  GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
} from "../lib/growth/enrichment/enrichment-types"
import { channelStatusLabel, scoreContactVerificationConfidence } from "../lib/growth/enrichment/verification-confidence"
import { enrichmentSnapshotToVerificationTriageHints } from "../lib/growth/enrichment/integrations/lead-engine-verification-bridge"
import { createManualFixtureEnrichmentProvider } from "../lib/growth/enrichment/providers/manual-fixture-provider"

async function main(): Promise<void> {
  assert.equal(GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER, "growth-verification-enrichment-v1")
  assert.ok(GROWTH_ENRICHMENT_PROVIDER_TYPES.includes("internal_growth"))
  assert.ok(GROWTH_ENRICHMENT_PROVIDER_TYPES.includes("manual_fixture"))
  assert.ok(GROWTH_ENRICHMENT_PROVIDER_TYPES.includes("future_hunter"))
  assert.match(GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE, /no guessed emails/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_VERIFICATION_ENRICHMENT_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /enrichment_runs/)
  assert.match(migration, /contact_verifications/)
  assert.match(migration, /company_enrichments/)
  assert.match(migration, /email_status/)
  assert.match(migration, /technology_signals/)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/enrichment/enrichment-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /runEnrichmentProviders/)
  assert.doesNotMatch(repoSource, /createLeadCandidate|sendEmail|scrape|guess/i)

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/enrichment/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /runVerificationEnrichment/)

  const cardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/lead-operator/verification-enrichment-card.tsx"),
    "utf8",
  )
  assert.match(cardSource, /Email verified/)
  assert.match(cardSource, /Technology signals/)

  const cvRaw: GrowthContactVerificationProviderResult = {
    contact_candidate_id: "c1",
    email_status: "not_present",
    phone_status: "not_present",
    linkedin_status: "not_present",
    verification_confidence: 0.3,
    verification_reason: "No PII",
    evidence: [{ claim: "Test", evidence: "No channels", source: "test", tier: "provider" }],
    source_attribution: [],
  }
  const cv = normalizeContactVerificationResult(cvRaw, "manual", "manual_fixture")
  assert.equal(cv.email_status, "not_present")

  const ceRaw: GrowthCompanyEnrichmentProviderResult = {
    company_candidate_id: "co1",
    employee_estimate: "21-50",
    revenue_estimate: null,
    industry: "Field service",
    subindustry: null,
    technology_signals: ["FSM"],
    crm_signals: [],
    service_signals: [],
    location_signals: [],
    confidence: 0.5,
    evidence: [{ claim: "Industry", evidence: "Fixture", source: "test", tier: "provider" }],
    source_attribution: [],
  }
  const ce = normalizeCompanyEnrichmentResult(ceRaw, "manual", "manual_fixture")
  assert.equal(ce.industry, "Field service")

  assert.ok(scoreContactVerificationConfidence({
    base_confidence: 0.4,
    evidence_count: 1,
    verification_state: "unverified",
    has_observed_email: false,
    has_observed_phone: false,
    has_observed_linkedin: false,
    title_role_match: false,
  }) > 0)

  const fixture = createManualFixtureEnrichmentProvider()
  const result = await fixture.enrich({
    contact_candidate_id: "c1",
    company_candidate_id: "co1",
    company_name: "Precision Biomed",
    domain: "precisionbiomed.com",
    growth_lead_id: null,
    contact_full_name: "[Fixture] Lead",
    contact_email: null,
    contact_phone: null,
    contact_linkedin: null,
  })
  assert.equal(result.status, "success")
  assert.doesNotMatch(JSON.stringify(result), /email.*@.*validated/i)

  const hints = enrichmentSnapshotToVerificationTriageHints({
    qa_marker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
    schema_ready: true,
    contact_candidate_id: "c1",
    company_candidate_id: "co1",
    run: null,
    contact_verifications: [],
    company_enrichments: [],
    provider_messages: [],
    privacy_note: GROWTH_VERIFICATION_ENRICHMENT_PRIVACY_NOTE,
    ui_summary: {
      email_verified_label: channelStatusLabel("not_present"),
      phone_verified_label: channelStatusLabel("not_present"),
      linkedin_verified_label: channelStatusLabel("not_present"),
      company_confidence_label: "—",
      technology_signals: [],
      industry_confidence_label: "—",
      enrichment_confidence_label: "—",
    },
  })
  assert.ok(hints.verification_confidence >= 0)

  console.log("growth-verification-enrichment-v1 checks passed")
}

void main()
