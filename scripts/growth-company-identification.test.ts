/**
 * Regression checks for Company Identification Engine (Prompt 20).
 * Run: pnpm test:growth-company-identification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  extractDomainFromEmail,
  isConsumerEmailDomain,
  normalizeDomain,
} from "../lib/growth/company-identification/company-identification-normalize"
import {
  buildObservableCompanyMatches,
  rankCompanyIdentificationMatches,
} from "../lib/growth/company-identification/company-identification-match"
import { computeCompanyIdentificationScoreContribution } from "../lib/growth/company-identification/company-identification-score"
import {
  identifyCompanyCandidates,
  identifyCompanyFromAggregatedSession,
} from "../lib/growth/company-identification/company-identification-repository"
import {
  GROWTH_COMPANY_IDENTIFICATION_MATCH_SOURCES,
  GROWTH_COMPANY_IDENTIFICATION_MATCH_TYPES,
  GROWTH_COMPANY_IDENTIFICATION_QA_MARKER,
} from "../lib/growth/company-identification/company-identification-types"
import { aggregateIntentSession, singleSessionVisitHistory } from "../lib/growth/lead-engine/intent/intent-session-aggregator"
import { computeIntentCandidateScore } from "../lib/growth/lead-engine/intent/intent-candidate-scoring"
import { bridgeIntentSessionToLeadCandidate } from "../lib/growth/lead-engine/intent/intent-to-lead-bridge"
import type { GrowthIntentPixelIdentifiedContact, GrowthIntentPixelVisitorSession } from "../lib/growth/intent-pixel/intent-pixel-types"

async function main(): Promise<void> {
assert.equal(GROWTH_COMPANY_IDENTIFICATION_QA_MARKER, "growth-company-identification-v1")
assert.equal(GROWTH_COMPANY_IDENTIFICATION_MATCH_SOURCES.length, 11)
assert.equal(GROWTH_COMPANY_IDENTIFICATION_MATCH_TYPES.length, 7)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270319120000_growth_engine_company_identification_matches.sql"),
  "utf8",
)
assert.match(migration, /growth\.company_identification_matches/)
assert.match(migration, /matched_source/)
assert.match(migration, /source_attribution/)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-identification/company-identification-repository.ts"),
  "utf8",
)
assert.match(repoSource, /identifyCompanyFromAggregatedSession/)
assert.match(repoSource, /persistCompanyIdentificationMatches/)
assert.doesNotMatch(repoSource, /anonymous IP always reveals|fabricated company identity/)

const providerTypes = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/providers/provider-types.ts"),
  "utf8",
)
assert.match(providerTypes, /company_identification/)

assert.equal(isConsumerEmailDomain("gmail.com"), true)
assert.equal(extractDomainFromEmail("ops@acmebiomed.com"), "acmebiomed.com")
assert.equal(normalizeDomain("https://www.acmebiomed.com/pricing"), "acmebiomed.com")

const observable = buildObservableCompanyMatches({
  site_key: "demo",
  visitor_key: "v1",
  session_key: "s1",
  submitted_company_name: "Acme Biomed",
  email: "ops@acmebiomed.com",
  company_domain: "acmebiomed.com",
  landing_page: "https://acmebiomed.com/pricing",
})
assert.ok(observable.some((m) => m.matched_source === "submitted_identity"))
assert.ok(observable.some((m) => m.matched_source === "email_domain"))
assert.ok(!observable.some((m) => m.company_domain === "gmail.com"))

const ranked = rankCompanyIdentificationMatches(observable)
assert.equal(ranked[0]?.matched_source, "submitted_identity")

const contribution = computeCompanyIdentificationScoreContribution(ranked, ranked[0] ?? null)
assert.ok(contribution.points > 0)

function session(): GrowthIntentPixelVisitorSession {
  return {
    id: "sess-1",
    site_id: "site-1",
    visitor_key: "v_test",
    session_key: "s_test",
    is_identified: true,
    consent_status: "granted",
    first_touch_utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
    last_touch_utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
    first_referrer: null,
    last_referrer: null,
    first_landing_url: "https://acmebiomed.com/",
    last_page_url: "https://acmebiomed.com/pricing",
    device_metadata: {
      user_agent: "",
      language: "",
      timezone: "",
      screen_width: null,
      screen_height: null,
      platform: "",
    },
    browser_metadata: { referrer: "", landing_url: "", page_url: "" },
    pageview_count: 2,
    total_time_on_site_ms: 60_000,
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    ended_at: null,
  }
}

const contacts: GrowthIntentPixelIdentifiedContact[] = [
  {
    id: "c1",
    session_id: "sess-1",
    capture_source: "form",
    email: "ops@acmebiomed.com",
    phone: null,
    full_name: "Ops Lead",
    linkedin_url: null,
    company_name: "Acme Biomed",
    captured_at: new Date().toISOString(),
  },
]

const aggregated = aggregateIntentSession({
  site_key: "demo",
  session: session(),
  visit_history: singleSessionVisitHistory(session()),
  identified_contacts: contacts,
})

const identified = await identifyCompanyFromAggregatedSession(aggregated, {
  email: "ops@acmebiomed.com",
  phone: null,
  full_name: "Ops Lead",
  company_name: "Acme Biomed",
  capture_source: "form",
  identity_rejected: false,
})
assert.ok(identified.top_match)
assert.ok(identified.is_candidate_match)

const baseScore = computeIntentCandidateScore(aggregated)
const boosted = computeIntentCandidateScore(aggregated, {
  companyIdentification: identified.contribution,
})
assert.ok(boosted.intent_score >= baseScore.intent_score)

const bridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "demo",
  session: session(),
  visit_history: aggregated.visit_history,
  identified_contacts: contacts,
  consent_required: false,
})
assert.equal(bridge.ok, true)
if (bridge.ok && bridge.lead_candidate) {
  assert.ok(bridge.lead_candidate.company_identification_matches.length >= 1)
  assert.equal(bridge.lead_candidate.company_identification_summary?.is_candidate_match, true)
}

const noFabrication = await identifyCompanyCandidates({
  site_key: "demo",
  visitor_key: "v_anon",
  session_key: "s_anon",
  email: "user@gmail.com",
})
const gmailMatches = noFabrication.matches.filter((m) => m.company_domain === "gmail.com")
assert.equal(gmailMatches.length, 0)

console.log("growth-company-identification: all checks passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
