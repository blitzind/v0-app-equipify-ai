/**
 * Regression checks for Buying Stage Detection Engine (Prompt 21).
 * Run: pnpm test:growth-buying-stage-engine
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assessBuyingStage,
  assessBuyingStageFromSignals,
  pickDetectedBuyingStage,
  scoreBuyingStagesFromSignals,
} from "../lib/growth/buying-stage/buying-stage-engine"
import { collectBuyingStageSignals } from "../lib/growth/buying-stage/buying-stage-signals"
import { computeBuyingStageScoreContribution } from "../lib/growth/buying-stage/buying-stage-score"
import {
  assessBuyingStageFromAggregatedSession,
  buildBuyingStageInputFromAggregate,
} from "../lib/growth/buying-stage/buying-stage-repository"
import {
  GROWTH_BUYING_STAGE_QA_MARKER,
  GROWTH_BUYING_STAGE_SIGNAL_TYPES,
  GROWTH_BUYING_STAGES,
} from "../lib/growth/buying-stage/buying-stage-types"
import { aggregateIntentSession, singleSessionVisitHistory } from "../lib/growth/lead-engine/intent/intent-session-aggregator"
import { computeIntentCandidateScore } from "../lib/growth/lead-engine/intent/intent-candidate-scoring"
import { bridgeIntentSessionToLeadCandidate } from "../lib/growth/lead-engine/intent/intent-to-lead-bridge"
import type {
  GrowthIntentPixelConversionEvent,
  GrowthIntentPixelIdentifiedContact,
  GrowthIntentPixelPageviewEvent,
  GrowthIntentPixelVisitorSession,
} from "../lib/growth/intent-pixel/intent-pixel-types"

async function main(): Promise<void> {
  assert.equal(GROWTH_BUYING_STAGE_QA_MARKER, "growth-buying-stage-engine-v1")
  assert.equal(GROWTH_BUYING_STAGES.length, 9)
  assert.equal(GROWTH_BUYING_STAGE_SIGNAL_TYPES.length, 12)

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "supabase/migrations/20270320120000_growth_engine_buying_stage_assessments.sql",
    ),
    "utf8",
  )
  assert.match(migration, /growth\.buying_stage_assessments/)
  assert.match(migration, /detected_stage/)
  assert.match(migration, /signal_summary/)
  assert.match(migration, /source_attribution/)

  const repoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/buying-stage/buying-stage-repository.ts"),
    "utf8",
  )
  assert.match(repoSource, /assessBuyingStageFromAggregatedSession/)
  assert.match(repoSource, /persistBuyingStageAssessment/)
  assert.doesNotMatch(repoSource, /fabricated buying signal|executePipeline|sendEmail/)

  const bridgeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/lead-engine/intent/intent-to-lead-bridge.ts"),
    "utf8",
  )
  assert.match(bridgeSource, /assessBuyingStageFromAggregatedSession/)
  assert.match(bridgeSource, /buying_stage_summary/)
  assert.match(bridgeSource, /growth\.buying_stage_assessments/)

  const loaderSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/lead-inbox/lead-inbox-loader.ts"),
    "utf8",
  )
  assert.match(loaderSource, /buying_stage_summary/)
  assert.match(loaderSource, /persistBuyingStageAssessment/)

  const empty = assessBuyingStage({
    site_key: "demo",
    visitor_key: "v0",
    session_key: "s0",
    intent_score: 0,
    session_count: 1,
    visit_count: 0,
    unique_page_count: 0,
    total_time_on_site_ms: 0,
    high_intent_path_hits: [],
    conversion_types: [],
    has_identified_contact: false,
    existing_customer_ids: [],
    existing_lead_ids: [],
    search_intent_top_category: null,
    search_intent_signal_count: 0,
    search_intent_max_confidence: 0,
    company_match_confidence: 0,
    company_matched_source: null,
    operator_activity_count: 0,
  })
  assert.equal(empty.assessment, null)

  const purchaseSignals = collectBuyingStageSignals({
    site_key: "demo",
    visitor_key: "v1",
    session_key: "s1",
    intent_score: 20,
    session_count: 1,
    visit_count: 5,
    unique_page_count: 4,
    total_time_on_site_ms: 200_000,
    high_intent_path_hits: ["/pricing", "/demo"],
    conversion_types: ["booking"],
    has_identified_contact: true,
    existing_customer_ids: [],
    existing_lead_ids: [],
    search_intent_top_category: "demo_intent",
    search_intent_signal_count: 2,
    search_intent_max_confidence: 0.85,
    company_match_confidence: 0.8,
    company_matched_source: "email_domain",
    operator_activity_count: 0,
  })
  assert.ok(purchaseSignals.length >= 4)
  for (const signal of purchaseSignals) {
    assert.ok(signal.evidence.length > 0)
    assert.ok(signal.source_attribution.length > 0)
  }

  const purchaseAssessment = assessBuyingStageFromSignals(purchaseSignals)
  assert.ok(purchaseAssessment)
  assert.ok(
    ["purchase_ready", "active_opportunity", "vendor_evaluation"].includes(
      purchaseAssessment!.detected_stage,
    ),
  )
  assert.ok(purchaseAssessment!.stage_confidence <= 0.92)
  assert.ok(
    purchaseAssessment!.stage_reasoning.some((r) => r.toLowerCase().includes("candidate")),
  )

  const existingCustomer = assessBuyingStageFromSignals(
    collectBuyingStageSignals({
      site_key: "demo",
      visitor_key: "v2",
      session_key: "s2",
      intent_score: 8,
      session_count: 2,
      visit_count: 3,
      unique_page_count: 2,
      total_time_on_site_ms: 60_000,
      high_intent_path_hits: ["/product"],
      conversion_types: [],
      has_identified_contact: false,
      existing_customer_ids: ["cust-1"],
      existing_lead_ids: [],
      search_intent_top_category: "solution_aware",
      search_intent_signal_count: 1,
      search_intent_max_confidence: 0.7,
      company_match_confidence: 0.88,
      company_matched_source: "crm_customer",
      operator_activity_count: 1,
    }),
  )
  assert.ok(existingCustomer)
  assert.ok(
    ["existing_customer_expansion", "solution_research", "vendor_evaluation"].includes(
      existingCustomer!.detected_stage,
    ),
  )

  const lowEvidenceSignals = collectBuyingStageSignals({
    site_key: "demo",
    visitor_key: "v3",
    session_key: "s3",
    intent_score: 3,
    session_count: 1,
    visit_count: 1,
    unique_page_count: 1,
    total_time_on_site_ms: 5_000,
    high_intent_path_hits: [],
    conversion_types: [],
    has_identified_contact: false,
    existing_customer_ids: [],
    existing_lead_ids: [],
    search_intent_top_category: null,
    search_intent_signal_count: 0,
    search_intent_max_confidence: 0,
    company_match_confidence: 0,
    company_matched_source: null,
    operator_activity_count: 0,
  })
  const lowAssessment = assessBuyingStageFromSignals(lowEvidenceSignals)
  if (lowAssessment) {
    assert.ok(lowAssessment.stage_confidence <= 0.5)
  }

  const contribution = computeBuyingStageScoreContribution(purchaseAssessment)
  assert.ok(contribution.points > 0)
  assert.ok(contribution.confidence_boost >= 0)

  function baseSession(): GrowthIntentPixelVisitorSession {
    return {
      id: "sess-bs-1",
      site_id: "site-1",
      visitor_key: "v_bs",
      session_key: "s_bs",
      is_identified: true,
      consent_status: "granted",
      first_touch_utm: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "spring",
        utm_term: "biomedical repair",
        utm_content: "",
      },
      last_touch_utm: {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "spring",
        utm_term: "biomedical repair",
        utm_content: "",
      },
      first_referrer: "https://www.google.com/search?q=biomedical+equipment+repair",
      last_referrer: null,
      first_landing_url: "https://example.com/pricing",
      last_page_url: "https://example.com/demo",
      device_metadata: {
        user_agent: "",
        language: "",
        timezone: "",
        screen_width: null,
        screen_height: null,
        platform: "",
      },
      browser_metadata: { referrer: "", landing_url: "", page_url: "" },
      pageview_count: 4,
      total_time_on_site_ms: 150_000,
      started_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
      ended_at: null,
    }
  }

  function pageview(p: string): GrowthIntentPixelPageviewEvent {
    return {
      id: `pv-${p}`,
      session_id: "sess-bs-1",
      page_url: `https://example.com${p}`,
      page_path: p,
      page_title: "",
      referrer: null,
      utm: { utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "" },
      duration_ms: 30_000,
      captured_at: new Date().toISOString(),
    }
  }

  function conversion(
    type: GrowthIntentPixelConversionEvent["conversion_type"],
  ): GrowthIntentPixelConversionEvent {
    return {
      id: "cv-bs-1",
      session_id: "sess-bs-1",
      conversion_type: type,
      conversion_label: "Book demo",
      page_url: "https://example.com/demo",
      metadata: {},
      captured_at: new Date().toISOString(),
    }
  }

  const session = baseSession()
  const contact: GrowthIntentPixelIdentifiedContact = {
    id: "ic-bs-1",
    session_id: "sess-bs-1",
    capture_source: "form",
    email: "ops@acmebiomed.com",
    phone: null,
    full_name: "Ops Lead",
    linkedin_url: null,
    company_name: "Acme Biomed",
    captured_at: new Date().toISOString(),
  }
  const visitHistory = singleSessionVisitHistory(session, [
    pageview("/"),
    pageview("/pricing"),
    pageview("/demo"),
    pageview("/contact"),
  ], [conversion("booking")])
  const aggregated = aggregateIntentSession({
    site_key: "equipify-sandbox",
    session,
    visit_history: visitHistory,
    identified_contacts: [contact],
  })

  const preliminary = computeIntentCandidateScore(aggregated)
  const fromSession = assessBuyingStageFromAggregatedSession(aggregated, {
    intent_score: preliminary.intent_score,
    existing_customer_ids: [],
    existing_lead_ids: [],
  })
  assert.equal(fromSession.qa_marker, GROWTH_BUYING_STAGE_QA_MARKER)
  assert.ok(fromSession.assessment)
  assert.ok(fromSession.summary?.detected_stage)

  const input = buildBuyingStageInputFromAggregate(aggregated, {
    intent_score: preliminary.intent_score,
  })
  assert.ok(input.high_intent_path_hits.length > 0)

  const bridge = await bridgeIntentSessionToLeadCandidate({
    site_key: "equipify-sandbox",
    session,
    visit_history: visitHistory,
    identified_contacts: [contact],
    consent_required: true,
  })
  assert.equal(bridge.ok, true)
  if (bridge.ok && bridge.lead_candidate) {
    assert.ok(bridge.lead_candidate.buying_stage_assessment)
    assert.ok(bridge.lead_candidate.buying_stage_summary?.detected_stage)
    assert.equal(bridge.lead_candidate.buying_stage_summary?.is_candidate_assessment, true)
    assert.ok(
      bridge.lead_candidate.candidate_evidence.some((e) =>
        e.source.includes("buying_stage"),
      ),
    )
  }

  const scores = scoreBuyingStagesFromSignals(purchaseSignals)
  const picked = pickDetectedBuyingStage(scores.scores)
  assert.ok(GROWTH_BUYING_STAGES.includes(picked))

  console.log("growth-buying-stage-engine: all checks passed")
}

void main().catch((e) => {
  console.error(e)
  process.exit(1)
})
