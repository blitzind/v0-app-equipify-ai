/**
 * Regression checks for Search Intent Signal Engine (Prompt 19).
 * Run: pnpm test:growth-search-intent-signals
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  extractKeywordFromReferrerUrl,
  isEmptyKeyword,
  normalizeKeyword,
} from "../lib/growth/search-intent/search-intent-keywords"
import {
  classifyIntentCategory,
  classifySearchIntentSignal,
} from "../lib/growth/search-intent/search-intent-classifier"
import {
  computeSearchIntentScoreContribution,
  scoreSearchIntentSignal,
} from "../lib/growth/search-intent/search-intent-score"
import { attachAttributionToSignals } from "../lib/growth/search-intent/search-intent-attribution"
import {
  buildSearchIntentCaptureInputsFromAggregate,
  captureSearchIntentFromAggregatedSession,
} from "../lib/growth/search-intent/search-intent-repository"
import {
  GROWTH_SEARCH_INTENT_CATEGORIES,
  GROWTH_SEARCH_INTENT_QA_MARKER,
  GROWTH_SEARCH_INTENT_SOURCE_TYPES,
  GROWTH_SEARCH_INTENT_STAGES,
} from "../lib/growth/search-intent/search-intent-types"
import { aggregateIntentSession, singleSessionVisitHistory } from "../lib/growth/lead-engine/intent/intent-session-aggregator"
import { computeIntentCandidateScore } from "../lib/growth/lead-engine/intent/intent-candidate-scoring"
import { bridgeIntentSessionToLeadCandidate } from "../lib/growth/lead-engine/intent/intent-to-lead-bridge"
import type { GrowthIntentPixelPageviewEvent, GrowthIntentPixelVisitorSession } from "../lib/growth/intent-pixel/intent-pixel-types"

async function main(): Promise<void> {
assert.equal(GROWTH_SEARCH_INTENT_QA_MARKER, "growth-search-intent-signals-v1")
assert.equal(GROWTH_SEARCH_INTENT_CATEGORIES.length, 9)
assert.equal(GROWTH_SEARCH_INTENT_STAGES.length, 5)
assert.equal(GROWTH_SEARCH_INTENT_SOURCE_TYPES.length, 8)

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270318120000_growth_engine_search_intent_signals.sql"),
  "utf8",
)
assert.match(migration, /growth\.search_intent_signals/)
assert.match(migration, /intent_category/)
const dropMigration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270936120000_growth_engine_drop_legacy_lead_inbox_4f.sql"),
  "utf8",
)
assert.match(dropMigration, /drop column if exists lead_inbox_id/)
assert.match(dropMigration, /drop table if exists growth\.lead_inbox/)
assert.match(migration, /source_attribution/)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/search-intent/search-intent-repository.ts"),
  "utf8",
)
assert.match(repoSource, /captureSearchIntentFromAggregatedSession/)
assert.match(repoSource, /persistSearchIntentSignals/)
assert.doesNotMatch(repoSource, /private Google|search console|autonomous|outreach/)

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-engine/intent/intent-to-lead-bridge.ts"),
  "utf8",
)
assert.match(bridgeSource, /captureSearchIntentFromAggregatedSession/)
assert.match(bridgeSource, /search_intent_signals/)

assert.equal(normalizeKeyword("  BioMed   Service "), "biomed service")
assert.equal(isEmptyKeyword(""), true)

const referrerKw = extractKeywordFromReferrerUrl(
  "https://www.google.com/search?q=biomedical+equipment+repair",
)
assert.equal(referrerKw.keyword, "biomedical equipment repair")
assert.equal(referrerKw.pattern, "referrer:q")

assert.equal(classifyIntentCategory("pricing plans", "/pricing"), "pricing_research")
assert.equal(classifyIntentCategory("book demo", "/demo"), "demo_intent")

const classified = classifySearchIntentSignal({
  site_key: "demo",
  visitor_key: "v1",
  session_key: "s1",
  keyword: "pricing",
  source_type: "utm_keyword",
  utm_term: "pricing",
  utm_source: "google",
  utm_medium: "cpc",
  utm_campaign: "spring",
  matched_page_path: "/pricing",
})
assert.ok(classified)
assert.equal(classified!.intent_category, "pricing_research")

const lowReferrerOnly = classifySearchIntentSignal({
  site_key: "demo",
  visitor_key: "v1",
  session_key: "s1",
  keyword: null,
  source_type: "referrer_keyword",
  referrer: "https://www.google.com/",
})
assert.equal(lowReferrerOnly, null)

function session(overrides: Partial<GrowthIntentPixelVisitorSession> = {}): GrowthIntentPixelVisitorSession {
  return {
    id: "sess-1",
    site_id: "site-1",
    visitor_key: "v_test",
    session_key: "s_test",
    is_identified: false,
    consent_status: "granted",
    first_touch_utm: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_term: "equipment repair",
      utm_content: "",
    },
    last_touch_utm: {
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_term: "equipment repair",
      utm_content: "",
    },
    first_referrer: "https://www.google.com/search?q=equipment+repair",
    last_referrer: "https://www.google.com/search?q=equipment+repair",
    first_landing_url: "https://example.com/pricing",
    last_page_url: "https://example.com/pricing",
    device_metadata: {
      user_agent: "",
      language: "",
      timezone: "",
      screen_width: null,
      screen_height: null,
      platform: "",
    },
    browser_metadata: { referrer: "", landing_url: "", page_url: "" },
    pageview_count: 3,
    total_time_on_site_ms: 90_000,
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
    page_title: "Pricing",
    referrer: null,
    utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
    duration_ms: 20_000,
    captured_at: new Date().toISOString(),
  }
}

const aggregated = aggregateIntentSession({
  site_key: "demo-site",
  session: session(),
  visit_history: {
    ...singleSessionVisitHistory(session()),
    sessions: [
      {
        session_key: "s_test",
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        pageview_count: 3,
        total_time_on_site_ms: 90_000,
        is_identified: false,
        consent_status: "granted",
        first_touch_utm: session().first_touch_utm,
        last_touch_utm: session().last_touch_utm,
        pageviews: [pageview("/pricing"), pageview("/demo"), pageview("/")],
        conversions: [],
      },
    ],
  },
})

const inputs = buildSearchIntentCaptureInputsFromAggregate(aggregated)
assert.ok(inputs.length >= 2)

const capture = captureSearchIntentFromAggregatedSession(aggregated)
assert.ok(capture.signals.length >= 1)
assert.ok(capture.contribution.points > 0)

const withAttr = attachAttributionToSignals(capture.signals)
assert.ok(withAttr[0].source_attribution.length >= 1)

const scored = scoreSearchIntentSignal(capture.signals[0])
assert.ok(scored >= 0 && scored <= 100)

const baseScore = computeIntentCandidateScore(aggregated)
const boosted = computeIntentCandidateScore(aggregated, { searchIntent: capture.contribution })
assert.ok(boosted.intent_score >= baseScore.intent_score)

const bridge = await bridgeIntentSessionToLeadCandidate({
  site_key: "demo-site",
  session: session(),
  visit_history: aggregated.visit_history,
  consent_required: false,
})
assert.equal(bridge.ok, true)
if (bridge.ok && bridge.lead_candidate) {
  assert.ok(bridge.lead_candidate.search_intent_signals.length >= 1)
  assert.ok(bridge.lead_candidate.search_intent_summary?.signal_count)
  assert.ok(
    bridge.lead_candidate.scoring_breakdown.search_intent_top != null ||
      boosted.intent_score > baseScore.intent_score,
  )
}

console.log("growth-search-intent-signals: all checks passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
