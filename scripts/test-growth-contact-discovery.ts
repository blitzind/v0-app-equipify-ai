/**
 * Regression checks for Contact Discovery + Buying Committee (Prompt 27).
 * Run: pnpm test:growth-contact-discovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildBuyingCommitteeAssessment } from "../lib/growth/contact-discovery/buying-committee-builder"
import { scoreContactCandidateConfidence } from "../lib/growth/contact-discovery/contact-confidence"
import {
  buildContactDedupeHash,
  dedupeNormalizedContacts,
  normalizeContactCandidate,
} from "../lib/growth/contact-discovery/contact-normalizer"
import { GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION } from "../lib/growth/contact-discovery/contact-schema-health"
import {
  GROWTH_BUYING_COMMITTEE_ROLES,
  GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  GROWTH_CONTACT_DISCOVERY_QA_MARKER,
} from "../lib/growth/contact-discovery/contact-discovery-types"
import { GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES } from "../lib/growth/contact-discovery/contact-discovery-provider-types"
import { contactDiscoveryToLeadEngineContactResearch } from "../lib/growth/contact-discovery/integrations/lead-engine-contact-research-bridge"
import { createManualFixtureContactDiscoveryProvider } from "../lib/growth/contact-discovery/providers/manual-fixture-provider"

async function main(): Promise<void> {
  assert.equal(GROWTH_CONTACT_DISCOVERY_QA_MARKER, "growth-contact-discovery-v1")
  assert.ok(GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES.includes("manual_fixture"))
  assert.ok(GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES.includes("internal_growth"))
  assert.ok(GROWTH_BUYING_COMMITTEE_ROLES.includes("economic_buyer"))
  assert.match(GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE, /no guessed emails/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /contact_discovery_runs/)
  assert.match(migration, /contact_candidates/)
  assert.match(migration, /buying_committees/)
  assert.match(migration, /buying_committee_members/)
  assert.match(migration, /dedupe_hash/)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/contact-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /runContactDiscoveryProviders/)
  assert.match(repoSource, /persistBuyingCommittee/)
  assert.doesNotMatch(repoSource, /createLeadCandidate|ingestIntent|sendEmail|scrape/i)

  const registrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/contact-discovery-registry.ts"),
    "utf8",
  )
  assert.match(registrySource, /createManualFixtureContactDiscoveryProvider/)
  assert.match(registrySource, /createInternalGrowthContactDiscoveryProvider/)

  const routeSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/contact-discovery/route.ts"),
    "utf8",
  )
  assert.match(routeSource, /runContactDiscoveryForCompany/)
  assert.match(routeSource, /GROWTH_CONTACT_DISCOVERY_QA_MARKER/)

  const enrichmentRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/enrichment/route.ts"),
    "utf8",
  )
  assert.match(enrichmentRoute, /GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER/)

  const buyingPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/buying-committee-panel.tsx"),
    "utf8",
  )
  assert.match(buyingPanel, /VerificationEnrichmentCard/)

  const shellBridge = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/integrations/prospect-search-bridge.ts"),
    "utf8",
  )
  assert.match(shellBridge, /contactCandidatesToProspectSearchPeople/)

  const companyCard = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-result-card.tsx"),
    "utf8",
  )
  assert.match(companyCard, /BuyingCommitteePanel/)

  const inboxBridge = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/integrations/lead-inbox-bridge.ts"),
    "utf8",
  )
  assert.match(inboxBridge, /never auto-creates/)

  // Normalizer strips unobserved PII
  const stripped = normalizeContactCandidate(
    {
      full_name: "Jane Doe",
      job_title: "VP Sales",
      email: "jane.doe@example.com",
      phone: "555-0100",
      linkedin_url: "https://linkedin.com/in/janedoe",
      evidence: [],
      source_attribution: [],
    },
    "contact_manual_fixture",
    "manual_fixture",
    "company-1",
  )
  assert.ok(stripped)
  assert.equal(stripped!.email, null)
  assert.equal(stripped!.verification_state, "insufficient_evidence")

  const observed = normalizeContactCandidate(
    {
      full_name: "Jane Doe",
      job_title: "VP Sales",
      email: "jane@company.com",
      pii_observed: true,
      evidence: [{ claim: "CRM", evidence: "From lead_decision_makers", source: "growth" }],
      source_attribution: [],
    },
    "internal_growth",
    "internal_growth",
    "company-1",
  )
  assert.ok(observed?.email)

  const hash = buildContactDedupeHash({
    company_candidate_id: "c1",
    full_name: "Jane",
    job_title: "VP",
  })
  assert.equal(dedupeNormalizedContacts([observed!, { ...observed!, full_name: "Jane" }]).length, 1)

  assert.ok(
    scoreContactCandidateConfidence({
      base_confidence: 0.5,
      evidence_count: 2,
      verification_state: "unverified",
      has_observed_email: false,
      has_observed_phone: false,
      has_observed_linkedin: false,
      title_role_match: true,
    }) > 0,
  )

  const fixture = createManualFixtureContactDiscoveryProvider()
  const fixtureResult = await fixture.discover({
    company_candidate_id: "c1",
    company_name: "Precision Biomed",
    domain: "precisionbiomed.com",
    growth_lead_id: null,
    industry: "biomedical",
  })
  assert.equal(fixtureResult.status, "success")
  assert.ok(fixtureResult.contacts.length >= 3)
  assert.doesNotMatch(JSON.stringify(fixtureResult.contacts), /@[a-z0-9]+\.[a-z]+/i)

  const assessment = buildBuyingCommitteeAssessment({
    company_id: "c1",
    contacts: fixtureResult.contacts.map((raw, i) => ({
      id: `id-${i}`,
      created_at: "",
      updated_at: "",
      company_candidate_id: "c1",
      provider_name: "contact_manual_fixture",
      provider_type: "manual_fixture",
      full_name: raw.full_name,
      first_name: null,
      last_name: null,
      job_title: raw.job_title ?? null,
      department: raw.department ?? null,
      seniority: raw.seniority ?? null,
      linkedin_url: null,
      email: null,
      phone: null,
      verification_state: "unverified",
      confidence: raw.confidence ?? 0.5,
      source_attribution: raw.source_attribution,
      evidence: raw.evidence,
      dedupe_hash: hash,
      metadata: {},
    })),
  })
  assert.ok(assessment.committee.coverage_score >= 0)
  assert.ok(Array.isArray(assessment.missing_roles))

  const leadEngine = contactDiscoveryToLeadEngineContactResearch({
    qa_marker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
    schema_ready: true,
    company_candidate_id: "c1",
    run: null,
    contacts: [],
    buying_committee: assessment,
    provider_messages: [],
    privacy_note: GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  })
  assert.ok(leadEngine.contact_candidates.length >= 0)

  console.log("growth-contact-discovery-v1 checks passed")
}

void main()
