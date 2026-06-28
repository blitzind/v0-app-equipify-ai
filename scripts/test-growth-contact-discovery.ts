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
import {
  GROWTH_BUYING_COMMITTEE_ROLES,
  GROWTH_CONTACT_DISCOVERY_PRIVACY_NOTE,
  GROWTH_CONTACT_DISCOVERY_QA_MARKER,
} from "../lib/growth/contact-discovery/contact-discovery-types"
import { GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES } from "../lib/growth/contact-discovery/contact-discovery-provider-types"
import { contactDiscoveryToLeadEngineContactResearch } from "../lib/growth/contact-discovery/integrations/lead-engine-contact-research-bridge"
import { companyContactToContactInput } from "../lib/growth/contact-discovery/integrations/company-contacts-bridge"
import { createManualFixtureContactDiscoveryProvider } from "../lib/growth/contact-discovery/providers/manual-fixture-provider"
import { computeCompanyContactCoverage } from "../lib/growth/contact-discovery/company-contact-coverage"
import { GROWTH_COMPANY_CONTACTS_QA_MARKER } from "../lib/growth/contact-discovery/company-contact-types"
import { scoreDecisionMakerTitle } from "../lib/growth/contact-discovery/decision-maker-score"
import { extractSchemaOrgPersonContacts } from "../lib/growth/contact-discovery/extract/extract-schema-org-person"
import { extractTeamPageContacts } from "../lib/growth/contact-discovery/extract/extract-team-page"
import { verifyPhoneNumber } from "../lib/growth/contact-verification/verify-phone"

const GROWTH_CONTACT_DISCOVERY_SCHEMA_MIGRATION =
  "20270323120000_growth_engine_contact_discovery.sql" as const

async function main(): Promise<void> {
  assert.equal(GROWTH_CONTACT_DISCOVERY_QA_MARKER, "growth-contact-discovery-v1")
  assert.ok(GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES.includes("manual_fixture"))
  assert.ok(GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES.includes("internal_growth"))
  assert.ok(GROWTH_CONTACT_DISCOVERY_PROVIDER_TYPES.includes("website_public_extract"))
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
  assert.match(repoSource, /resolveOperatorContactDiscoveryProviderTypes/)
  assert.doesNotMatch(repoSource, /createLeadCandidate|ingestIntent|sendEmail|scrape/i)

  const registrySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/contact-discovery-registry.ts"),
    "utf8",
  )
  assert.match(registrySource, /createManualFixtureContactDiscoveryProvider/)
  assert.match(registrySource, /createInternalGrowthContactDiscoveryProvider/)
  assert.match(registrySource, /createWebsitePublicExtractContactDiscoveryProvider/)

  const operatorProvidersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/contact-discovery-operator-providers.ts"),
    "utf8",
  )
  assert.match(operatorProvidersSource, /website_public_extract/)
  assert.match(operatorProvidersSource, /internal_growth/)

  const websiteProviderMigration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270621120000_growth_website_public_extract_provider.sql"),
    "utf8",
  )
  assert.match(websiteProviderMigration, /website_public_extract/)

  const { mapExtractedWebsiteContactToProviderRaw, GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER } =
    await import("../lib/growth/contact-discovery/website-extract-mapper")
  assert.equal(GROWTH_WEBSITE_CONTACT_PROVIDER_QA_MARKER, "growth-website-contact-provider-v1")
  const mapped = mapExtractedWebsiteContactToProviderRaw({
    full_name: "Jane Owner",
    first_name: "Jane",
    last_name: "Owner",
    title: "President",
    department: null,
    email: "jane@acme.com",
    phone: null,
    linkedin_url: null,
    source_type: "team_page",
    leadership_indicator: true,
    source_evidence: [
      {
        claim: "Team member",
        evidence: "President on team page",
        source: "team_page",
        page_url: "https://acme.com/team",
      },
    ],
  })
  assert.ok(mapped?.pii_observed)
  assert.equal(mapped?.metadata?.qa_marker, "growth-website-contact-provider-v1")
  assert.doesNotMatch(mapped?.full_name ?? "", /\[Fixture\]/)

  const { mergeProspectSearchContactInputs } = await import(
    "../lib/growth/prospect-search/prospect-search-contact-merge"
  )
  const merged = mergeProspectSearchContactInputs([
    {
      id: "a",
      full_name: "Jane Owner",
      email: "jane@acme.com",
      confidence: 0.7,
      source_evidence: [{ claim: "Internal", evidence: "Lead DM", source: "internal_growth" }],
    },
    {
      id: "b",
      full_name: "Jane Owner",
      phone: "(512) 555-0100",
      confidence: 0.8,
      source_evidence: [{ claim: "Website", evidence: "Team page", source: "website_public_extract" }],
    },
  ])
  assert.equal(merged.length, 1)
  assert.equal(merged[0]?.email, "jane@acme.com")
  assert.equal(merged[0]?.phone, "(512) 555-0100")
  assert.equal(merged[0]?.source_evidence.length, 2)

  const { computeProspectSearchContactOutreachReadiness, GROWTH_PEOPLE_HYDRATION_QA_MARKER } =
    await import("../lib/growth/prospect-search/prospect-search-contact-readiness")
  assert.equal(GROWTH_PEOPLE_HYDRATION_QA_MARKER, "growth-people-hydration-v1")
  const readiness = computeProspectSearchContactOutreachReadiness({
    email: "jane@acme.com",
    phone: "(512) 555-0100",
    verification_status: "email_verified",
    confidence: 0.8,
  })
  assert.equal(readiness.email_available, true)
  assert.equal(readiness.outreach_ready, true)

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

  // --- Company contacts (Apollo replacement layer) ---

  assert.equal(GROWTH_COMPANY_CONTACTS_QA_MARKER, "growth-company-contacts-v1")

  const ceoScore = scoreDecisionMakerTitle({
    title: "CEO & Owner",
    source_type: "team_page",
    evidence_count: 2,
    has_website_evidence: true,
    exact_title_match: true,
  })
  assert.equal(ceoScore.decision_maker_score, 100)
  assert.ok(ceoScore.confidence_score >= 90)

  const dispatcherScore = scoreDecisionMakerTitle({ title: "Dispatcher" })
  assert.equal(dispatcherScore.decision_maker_score, 35)

  const teamHtml = `
    <div class="team-member"><h3>Jane Owner</h3><p class="title">President</p><a href="mailto:jane@acmehvac.com">Email</a></div>
    <div class="team-member"><h3>John Smith</h3><p class="title">Service Manager</p></div>
  `
  const extracted = extractTeamPageContacts(teamHtml, "https://acmehvac.com/team")
  assert.ok(extracted.some((item) => item.full_name === "Jane Owner"))
  assert.ok(extracted.some((item) => item.email === "jane@acmehvac.com"))

  const singleNameTeamHtml = `
    <section><h2>Our Team</h2>
      <div class="staff-member"><h4>Thanh</h4><p class="role">Biomedical Technician</p><a href="mailto:thanh@biomed-service.com">Email</a></div>
    </section>
  `
  const singleNameExtracted = extractTeamPageContacts(singleNameTeamHtml, "https://biomed-service.com/team")
  assert.ok(singleNameExtracted.some((item) => item.full_name === "Thanh"))
  assert.ok(singleNameExtracted.some((item) => item.title === "Biomedical Technician"))

  const elementorTeamHtml = `
    <div class="elementor-team-member">
      <div class="elementor-heading-title">Maria Lopez</div>
      <div class="elementor-heading-title">Operations Director</div>
    </div>
  `
  const elementorExtracted = extractTeamPageContacts(elementorTeamHtml, "https://example.com/team")
  assert.ok(elementorExtracted.some((item) => item.full_name === "Maria Lopez"))
  assert.ok(elementorExtracted.some((item) => item.title === "Operations Director"))

  const swappedTitleHtml = `
    <div class="team-member"><h3>Service Manager</h3><p class="title">Robert Chen</p></div>
  `
  const swappedExtracted = extractTeamPageContacts(swappedTitleHtml, "https://example.com/team")
  assert.ok(swappedExtracted.some((item) => item.full_name === "Robert Chen"))
  assert.ok(swappedExtracted.some((item) => item.title === "Service Manager"))

  const schemaHtml = `<script type="application/ld+json">{"@type":"Person","name":"Alex Thompson","jobTitle":"Operations Director","email":"alex@example.com"}</script>`
  const schemaContacts = extractSchemaOrgPersonContacts(schemaHtml, "https://example.com/about")
  assert.ok(schemaContacts.some((item) => item.full_name === "Alex Thompson"))

  const phone = verifyPhoneNumber("(512) 555-0100", "office main line")
  assert.equal(phone?.phone_status, "business")

  const coverage = computeCompanyContactCoverage([
    {
      id: "c1",
      company_id: "co1",
      growth_lead_id: null,
      contact_candidate_id: null,
      lead_decision_maker_id: null,
      full_name: "Jane Owner",
      first_name: "Jane",
      last_name: "Owner",
      title: "President",
      department: null,
      email: "jane@acme.com",
      email_status: "verified",
      phone: "(512) 555-0100",
      phone_status: "business",
      linkedin_url: null,
      confidence_score: 88,
      decision_maker_score: 100,
      source_type: "team_page",
      source_evidence: [{ claim: "President", evidence: "Team page", source: "team_page" }],
      contact_status: "verified",
      last_verified_at: new Date().toISOString(),
      dedupe_hash: "abc",
      created_at: "",
      updated_at: "",
      metadata: {},
    },
  ])
  assert.equal(coverage.coverage_label, "75%")
  assert.ok(coverage.decision_maker_discovered)

  const bridged = companyContactToContactInput({
    id: "c1",
    company_id: "co1",
    growth_lead_id: null,
    contact_candidate_id: null,
    lead_decision_maker_id: null,
    full_name: "Jane Owner",
    first_name: "Jane",
    last_name: "Owner",
    title: "President",
    department: null,
    email: "jane@acme.com",
    email_status: "verified",
    phone: null,
    phone_status: "unknown",
    linkedin_url: null,
    confidence_score: 88,
    decision_maker_score: 100,
    source_type: "team_page",
    source_evidence: [{ claim: "President", evidence: "Team page", source: "team_page" }],
    contact_status: "candidate",
    last_verified_at: null,
    dedupe_hash: "abc",
    created_at: "",
    updated_at: "",
    metadata: {},
  })
  assert.equal(bridged?.full_name, "Jane Owner")

  const migrationSource = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270403120000_growth_engine_company_contacts.sql"),
    "utf8",
  )
  assert.match(migrationSource, /create table if not exists growth\.company_contacts/)
  assert.match(migrationSource, /company_contact_refresh_queue/)

  const companyContactsRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/company-contacts/route.ts"),
    "utf8",
  )
  assert.match(companyContactsRoute, /requireGrowthEnginePlatformAccess/)

  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/company-contacts-panel.tsx"),
    "utf8",
  )
  assert.match(panelSource, /Decision makers/)
  assert.match(panelSource, /Research contacts/)

  const {
    GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER,
    GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER,
    GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER,
    parseWebsiteContactAcquisitionFromMetadata,
  } = await import("../lib/growth/contact-discovery/website-acquisition-metadata-bridge")
  assert.equal(GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER, "growth-deep-contact-acquisition-v1")
  assert.equal(GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER, "growth-website-extraction-quality-v1")
  assert.equal(GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER, "growth-public-profile-reference-v1")

  const { classifyWebsiteEmail, classifyWebsitePhone } = await import(
    "../lib/growth/contact-discovery/website-channel-classification"
  )
  const salesEmail = classifyWebsiteEmail({
    email: "sales@acme.com",
    pageType: "contact",
    pageText: "Contact our sales team",
    personName: null,
    title: null,
  })
  assert.equal(salesEmail.classification, "sales_email")
  const dispatchPhone = classifyWebsitePhone({
    phone: "(512) 555-0100",
    pageType: "contact",
    pageText: "Dispatch line available 24/7",
    branchName: null,
  })
  assert.equal(dispatchPhone.classification, "dispatch")

  const { scoreWebsiteContactEvidenceQuality } = await import(
    "../lib/growth/contact-discovery/website-evidence-quality"
  )
  const quality = scoreWebsiteContactEvidenceQuality({
    contact: {
      full_name: "Jane Owner",
      first_name: "Jane",
      last_name: "Owner",
      title: "President",
      department: null,
      email: "jane@acme.com",
      phone: null,
      linkedin_url: null,
      source_type: "team_page",
      source_page_type: "team",
      source_page_url: "https://acme.com/team",
      leadership_indicator: true,
      source_evidence: [
        {
          claim: "Team member",
          evidence: "Jane Owner, President",
          source: "team_page",
          page_url: "https://acme.com/team",
        },
      ],
    },
    pageType: "team",
    companyDomain: "acme.com",
    repeatedEvidenceCount: 1,
  })
  assert.ok(quality.evidence_quality_score >= 60)
  assert.equal(quality.evidence_quality_label, "strong_public_evidence")

  const { planWebsiteCrawlUrls } = await import("../lib/growth/contact-discovery/website-crawl-planner")
  const crawlPlan = planWebsiteCrawlUrls({
    websiteUrl: "https://acme.com",
    homepageHtml: '<a href="/team">Team</a><a href="/contact">Contact</a>',
    sitemapXml: "<?xml version=\"1.0\"?><urlset><loc>https://acme.com/about</loc></urlset>",
  })
  assert.ok(crawlPlan.some((entry) => entry.url.includes("/team")))
  assert.ok(crawlPlan.length <= 24)

  const { enrichExtractedWebsiteContacts } = await import(
    "../lib/growth/contact-discovery/website-extraction-enrichment"
  )
  const enriched = enrichExtractedWebsiteContacts({
    contacts: [
      {
        full_name: "Jane Owner",
        first_name: "Jane",
        last_name: "Owner",
        title: "President",
        department: null,
        email: "jane@acme.com",
        phone: null,
        linkedin_url: "https://www.linkedin.com/in/jane-owner",
        source_type: "team_page",
        source_page_type: "team",
        source_page_url: "https://acme.com/team",
        leadership_indicator: true,
        source_evidence: [
          {
            claim: "Team member",
            evidence: "Jane Owner, President",
            source: "team_page",
            page_url: "https://acme.com/team",
          },
        ],
      },
    ],
    companyDomain: "acme.com",
    linkedinCompanyUrls: ["https://www.linkedin.com/company/acme"],
  })
  assert.equal(enriched[0]?.email_classification, "owner_leadership_email")
  assert.ok(enriched[0]?.linkedin_reference_label?.includes("LinkedIn reference found"))

  const parsed = parseWebsiteContactAcquisitionFromMetadata({
    source_page_type: "team",
    email_classification: "personal_email",
    evidence_quality_label: "strong_public_evidence",
    evidence_quality_score: 82,
  })
  assert.equal(parsed.source_page_type, "team")
  assert.equal(parsed.evidence_quality_label, "strong_public_evidence")

  const bridgedAcquisition = companyContactToContactInput({
    id: "c1",
    company_id: "co1",
    growth_lead_id: null,
    contact_candidate_id: null,
    lead_decision_maker_id: null,
    full_name: "Jane Owner",
    first_name: "Jane",
    last_name: "Owner",
    title: "President",
    department: null,
    email: "jane@acme.com",
    email_status: "verified",
    phone: null,
    phone_status: "unknown",
    linkedin_url: null,
    confidence_score: 88,
    decision_maker_score: 100,
    source_type: "team_page",
    source_evidence: [{ claim: "President", evidence: "Team page", source: "team_page" }],
    contact_status: "candidate",
    last_verified_at: null,
    dedupe_hash: "abc",
    created_at: "",
    updated_at: "",
    metadata: {
      source_page_type: "team",
      evidence_quality_label: "strong_public_evidence",
      evidence_quality_score: 80,
    },
  })
  assert.equal(bridgedAcquisition?.source_page_type, "team")
  assert.equal(bridgedAcquisition?.evidence_quality_label, "strong_public_evidence")

  const { rankProspectSearchContactsForOutreach } = await import(
    "../lib/growth/prospect-search/prospect-search-contact-ranking"
  )
  const ranked = rankProspectSearchContactsForOutreach({
    contact_id: "c1",
    company_id: "co1",
    confidence_score: 0.7,
    persona: {
      persona_type: "decision_maker",
      persona_label: "Decision maker",
      icp_relevance: 0.8,
      buying_influence: 0.7,
      outreach_suitability: 0.6,
      confidence: 0.7,
      evidence: [],
    },
    email_eligibility: "eligible",
    call_eligibility: "needs_review",
    freshness_status: "fresh",
    outreach_ready: true,
    call_ready: false,
    email_available: true,
    phone_available: false,
    evidence_quality_label: "strong_public_evidence",
    email_classification: "generic_info_email",
  })
  assert.ok(ranked.ranking_reasons.some((reason) => reason.includes("Strong public website evidence")))
  assert.ok(
    ranked.ranking_reasons.some((reason) => reason.includes("Generic role email")),
  )

  const acquisitionPanel = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-contact-acquisition-panel.tsx"),
    "utf8",
  )
  assert.match(acquisitionPanel, /GROWTH_DEEP_CONTACT_ACQUISITION_QA_MARKER/)
  assert.match(acquisitionPanel, /GROWTH_WEBSITE_EXTRACTION_QUALITY_QA_MARKER/)
  assert.match(acquisitionPanel, /GROWTH_PUBLIC_PROFILE_REFERENCE_QA_MARKER/)
  assert.match(acquisitionPanel, /linkedin_reference_label/)

  const evidenceDrawer = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search/prospect-search-contact-evidence-drawer.tsx"),
    "utf8",
  )
  assert.match(evidenceDrawer, /ProspectSearchContactAcquisitionPanel/)

  const {
    GROWTH_PDL_PROVIDER_QA_MARKER,
    buildPdlPersonSearchQuery,
    mapPdlPeopleToContactDiscoveryRaw,
    isPdlSandboxEnabled,
  } = await import("../lib/growth/providers/pdl/index")
  assert.equal(GROWTH_PDL_PROVIDER_QA_MARKER, "growth-pdl-provider-v1")
  assert.equal(isPdlSandboxEnabled(), true)

  const query = buildPdlPersonSearchQuery({
    company_name: "Acme Medical Service",
    domain: "acmemedical.example",
    prefer_reachable: true,
  })
  assert.match(query.summary, /acmemedical.example/)

  const pdlMapped = mapPdlPeopleToContactDiscoveryRaw({
    company_name: "Acme Medical Service",
    domain: "acmemedical.example",
    sandbox: true,
    people: [
      {
        id: "pdl-1",
        full_name: "Jordan Lee",
        job_title: "Service Manager",
        work_email: "jordan@acmemedical.example",
        phone_numbers: [{ number: "+1 512 555 0100" }],
        likelihood: 8,
      },
    ],
  })
  assert.equal(pdlMapped.length, 1)
  assert.equal(pdlMapped[0]?.full_name, "Jordan Lee")
  assert.equal(pdlMapped[0]?.pii_observed, true)
  assert.match(pdlMapped[0]?.source_attribution[0]?.provider_name ?? "", /people_data_labs/)

  assert.match(operatorProvidersSource, /future_people_data_labs/)
  assert.match(registrySource, /createPeopleDataLabsContactDiscoveryProvider/)

  const pdlProviderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/providers/people-data-labs-provider.ts"),
    "utf8",
  )
  assert.match(pdlProviderSource, /GROWTH_PDL_PROVIDER_QA_MARKER/)
  assert.match(pdlProviderSource, /contact_candidates then synced to company_contacts/)

  const orchestrationSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-contact-first-orchestration.ts"),
    "utf8",
  )
  assert.match(orchestrationSource, /augmentProspectSearchCompaniesWithPdl/)
  assert.match(orchestrationSource, /pdl_augmentation/)

  const pdlHealthDashboardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-pdl-provider-health-dashboard.tsx"),
    "utf8",
  )
  assert.match(pdlHealthDashboardSource, /GROWTH_PDL_PROVIDER_HEALTH_QA_MARKER/)
  assert.match(pdlHealthDashboardSource, /Run PDL test lookup/)

  const pdlHealthRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/contact-discovery/provider-health/route.ts"),
    "utf8",
  )
  assert.match(pdlHealthRouteSource, /test_pdl_lookup/)
  assert.match(pdlHealthRouteSource, /loadGrowthPdlProviderHealth/)

  const providerHealthPageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/settings/provider-health/page.tsx"),
    "utf8",
  )
  assert.match(providerHealthPageSource, /GrowthPdlProviderHealthDashboard/)

  const grantsMigration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20270629120000_growth_contact_discovery_service_role_grants.sql",
    ),
    "utf8",
  )
  assert.match(grantsMigration, /contact_discovery_runs to service_role/)
  assert.match(grantsMigration, /contact_candidates to service_role/)

  const researchWebsiteUrlSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/research-website-url.ts"),
    "utf8",
  )
  assert.match(researchWebsiteUrlSource, /export function resolveReadyLeadWebsiteUrl/)

  const websiteDiscoverySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/website-contact-discovery.ts"),
    "utf8",
  )
  assert.match(websiteDiscoverySource, /resolveReadyLeadWebsiteUrl/)
  assert.doesNotMatch(websiteDiscoverySource, /fetchLeadWebsite\(normalized\)/)

  const {
    buildContactDiscoveryProviderOutcomes,
    formatProviderOutcomeSummary,
  } = await import("../lib/growth/contact-discovery/contact-discovery-provider-outcomes")
  const outcomes = buildContactDiscoveryProviderOutcomes({
    provider_results: [
      {
        provider_name: "people_data_labs",
        provider_type: "future_people_data_labs",
        status: "success",
        message: "3 person(s)",
        contacts: [{}, {}, {}] as never[],
      },
      {
        provider_name: "internal_growth",
        provider_type: "internal_growth",
        status: "skipped",
        message: "No matched Growth lead",
        contacts: [],
      },
    ],
    persisted_by_provider: { people_data_labs: 3, internal_growth: 0 },
  })
  assert.equal(outcomes.length, 2)
  assert.equal(outcomes[0]!.contacts_returned, 3)
  assert.equal(outcomes[0]!.contacts_persisted, 3)
  assert.match(
    formatProviderOutcomeSummary(outcomes[0]!),
    /PDL: 3 returned, 3 persisted/,
  )

  const contactRepoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/contact-discovery/contact-repository.ts"),
    "utf8",
  )
  assert.match(contactRepoSource, /provider_outcomes/)
  assert.match(contactRepoSource, /buildContactDiscoveryProviderOutcomes/)

  const acquisitionRepoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/acquisition/acquisition-repository.ts"),
    "utf8",
  )
  assert.match(acquisitionRepoSource, /provider_outcomes/)
  assert.match(acquisitionRepoSource, /contact_discovery_persistence_error/)

  const runDetailSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-acquisition-run-detail.tsx"),
    "utf8",
  )
  assert.match(runDetailSource, /CompaniesArtifactTable/)
  assert.match(runDetailSource, /formatProviderOutcomeSummary/)

  console.log("growth-contact-discovery-v1 checks passed")
}

void main()
