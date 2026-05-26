/**
 * Regression checks for Intent → Lead Engine bridge (Prompt 15).
 * Run: pnpm test:growth-intent-lead-bridge
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  aggregateIntentSession,
  extractIdentityFromContacts,
  singleSessionVisitHistory,
} from "../lib/growth/lead-engine/intent/intent-session-aggregator"
import { computeIntentCandidateScore } from "../lib/growth/lead-engine/intent/intent-candidate-scoring"
import { GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD } from "../lib/growth/lead-engine/intent/intent-threshold-engine"
import {
  buildIntentCandidateDedupeHash,
  checkIntentCandidateDedupe,
} from "../lib/growth/lead-engine/intent/intent-lead-dedupe"
import {
  evaluateIntentThreshold,
  isConsentValidForBridge,
} from "../lib/growth/lead-engine/intent/intent-threshold-engine"
import { bridgeIntentSessionToLeadCandidate } from "../lib/growth/lead-engine/intent/intent-to-lead-bridge"
import { GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER } from "../lib/growth/lead-engine/intent/intent-candidate-types"
import type {
  GrowthIntentPixelConversionEvent,
  GrowthIntentPixelIdentifiedContact,
  GrowthIntentPixelPageviewEvent,
  GrowthIntentPixelVisitorSession,
} from "../lib/growth/intent-pixel/intent-pixel-types"

async function main(): Promise<void> {
assert.equal(GROWTH_INTENT_LEAD_BRIDGE_QA_MARKER, "growth-intent-lead-bridge-v1")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/intent/intent-to-lead-bridge.ts"),
  "utf8",
)
assert.match(bridgeSource, /bridgeIntentSessionToLeadCandidate/)
assert.match(bridgeSource, /explicit identified_contacts|identity not inferred/)
assert.doesNotMatch(bridgeSource, /auto_outreach/)

function baseSession(overrides: Partial<GrowthIntentPixelVisitorSession> = {}): GrowthIntentPixelVisitorSession {
  return {
    id: "sess-1",
    site_id: "site-1",
    visitor_key: "v_test",
    session_key: "s_test",
    is_identified: false,
    consent_status: "granted",
    first_touch_utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "spring", utm_term: "", utm_content: "" },
    last_touch_utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "spring", utm_term: "", utm_content: "" },
    first_referrer: "https://google.com",
    last_referrer: null,
    first_landing_url: "https://example.com/",
    last_page_url: "https://example.com/pricing",
    device_metadata: { user_agent: "", language: "", timezone: "", screen_width: null, screen_height: null, platform: "" },
    browser_metadata: { referrer: "", landing_url: "", page_url: "" },
    pageview_count: 4,
    total_time_on_site_ms: 120_000,
    started_at: new Date().toISOString(),
    last_activity_at: new Date().toISOString(),
    ended_at: null,
    ...overrides,
  }
}

function pageview(path: string): GrowthIntentPixelPageviewEvent {
  return {
    id: `pv-${path}`,
    session_id: "sess-1",
    page_url: `https://example.com${path}`,
    page_path: path,
    page_title: "",
    referrer: null,
    utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
    duration_ms: 30_000,
    captured_at: new Date().toISOString(),
  }
}

function conversion(type: GrowthIntentPixelConversionEvent["conversion_type"]): GrowthIntentPixelConversionEvent {
  return {
    id: "cv-1",
    session_id: "sess-1",
    conversion_type: type,
    conversion_label: type === "booking" ? "Book demo" : "Contact",
    page_url: "https://example.com/contact",
    metadata: {},
    captured_at: new Date().toISOString(),
  }
}

const session = baseSession()
const pageviews = [
  pageview("/"),
  pageview("/pricing"),
  pageview("/demo"),
  pageview("/contact"),
]
const visitHistory = singleSessionVisitHistory(session, pageviews, [conversion("form_submit")])

const aggregated = aggregateIntentSession({
  site_key: "equipify-sandbox",
  session,
  visit_history: visitHistory,
  identified_contacts: [],
})

const score = computeIntentCandidateScore(aggregated)
assert.ok(score.intent_score >= GROWTH_INTENT_MINIMUM_SCORE_THRESHOLD)
assert.ok(score.scoring_breakdown.page_depth != null)
assert.ok(score.scoring_breakdown.time_on_site != null)
assert.ok(score.reasoning.length > 0)

// Identified contact from explicit capture only
const contact: GrowthIntentPixelIdentifiedContact = {
  id: "ic-1",
  session_id: "sess-1",
  capture_source: "form",
  email: "lead@example.com",
  phone: null,
  full_name: "Alex Operator",
  linkedin_url: null,
  company_name: "Example Co",
  captured_at: new Date().toISOString(),
}
const identity = extractIdentityFromContacts([contact])
assert.equal(identity.email, "lead@example.com")
assert.equal(identity.identity_rejected, false)

// Anonymous — no fabricated identity
const anonIdentity = extractIdentityFromContacts([])
assert.equal(anonIdentity.email, null)
assert.equal(anonIdentity.full_name, null)

// Consent gate
assert.equal(isConsentValidForBridge("granted", true), true)
assert.equal(isConsentValidForBridge("denied", true), false)
assert.equal(isConsentValidForBridge("unknown", true), false)

// Dedupe
const hash1 = buildIntentCandidateDedupeHash({
  email: "lead@example.com",
  session_id: "sess-1",
  visitor_key: "v_test",
  domain: "example.com",
})
const hash2 = buildIntentCandidateDedupeHash({
  email: "lead@example.com",
  session_id: "sess-1",
  visitor_key: "v_test",
  domain: "example.com",
})
assert.equal(hash1, hash2)

const dedupe = checkIntentCandidateDedupe(
  { email: "lead@example.com", session_id: "sess-1" },
  new Set([hash1]),
  { emails: new Set(["lead@example.com"]) },
)
assert.equal(dedupe.dedupe_matched, true)
assert.ok(dedupe.dedupe_reason?.includes("email") || dedupe.matched_on.includes("dedupe_hash"))

// Threshold + full bridge — eligible
const bridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "equipify-sandbox",
  session,
  visit_history: visitHistory,
  identified_contacts: [contact],
  consent_required: true,
})
assert.equal(bridge.ok, true)
assert.ok(bridge.lead_candidate)
assert.equal(bridge.lead_candidate?.qa_marker, "growth-intent-lead-bridge-v1")
assert.equal(bridge.lead_candidate?.candidate_type, "identified")
assert.equal(bridge.lead_candidate?.lead_engine_eligible, true)
assert.ok(bridge.lead_candidate!.candidate_attribution.length >= 2)
assert.ok(bridge.lead_candidate!.candidate_evidence.length > 0)
assert.ok(bridge.lead_candidate!.dedupe_hash.length > 0)
assert.equal(bridge.pipeline_entry, "contact_research")

// Low score — not eligible
const lowSession = baseSession({
  total_time_on_site_ms: 1000,
  pageview_count: 0,
  first_touch_utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
  last_touch_utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
  last_page_url: "https://example.com/",
  first_landing_url: "https://example.com/",
})
const lowBridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "equipify-sandbox",
  session: lowSession,
  visit_history: singleSessionVisitHistory(lowSession, [], []),
  consent_required: true,
})
assert.ok(lowBridge.lead_candidate)
assert.equal(lowBridge.lead_candidate?.lead_engine_eligible, false)

// Consent denied — blocked
const deniedBridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "equipify-sandbox",
  session: baseSession({ consent_status: "denied" }),
  visit_history: visitHistory,
  consent_required: true,
})
assert.equal(deniedBridge.lead_candidate?.lead_engine_eligible, false)

// Dedupe blocks eligibility
const dupBridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "equipify-sandbox",
  session,
  visit_history: visitHistory,
  identified_contacts: [contact],
  known_dedupe_hashes: new Set([hash1]),
  crm_dedupe_index: { emails: new Set(["lead@example.com"]) },
})
assert.equal(dupBridge.lead_candidate?.dedupe_matched, true)
assert.equal(dupBridge.lead_candidate?.lead_engine_eligible, false)

// Provider failure isolation — bad aggregate still returns result envelope
const threshold = evaluateIntentThreshold({
  aggregated,
  intent_score: 3,
  identity: anonIdentity,
  consent_required: true,
  dedupe_matched: false,
})
assert.equal(threshold.lead_engine_eligible, false)
assert.ok(threshold.blockers.length > 0)

// Returning visitor type
const multiHistory = {
  ...visitHistory,
  session_count: 3,
  sessions: [
    ...visitHistory.sessions,
    { ...visitHistory.sessions[0]!, session_key: "s_old_1" },
    { ...visitHistory.sessions[0]!, session_key: "s_old_2" },
  ],
}
const returningBridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "equipify-sandbox",
  session,
  visit_history: multiHistory,
  consent_required: true,
})
assert.ok(
  ["returning", "high_intent", "identified"].includes(returningBridge.lead_candidate?.candidate_type ?? ""),
)

console.log("growth-intent-lead-bridge-v1 checks passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
