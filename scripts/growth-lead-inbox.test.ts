/**
 * Regression checks for Lead Inbox + Candidate Queue (Prompt 16).
 * Run: pnpm test:growth-lead-inbox
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertLeadInboxStatusTransition,
  canTransitionLeadInboxStatus,
  pipelineStatusForInboxStatus,
} from "../lib/growth/lead-inbox/lead-inbox-status-engine"
import {
  compareLeadInboxPriority,
  sortLeadInboxQueue,
} from "../lib/growth/lead-inbox/lead-inbox-priority"
import { validateInboxPiiPolicy } from "../lib/growth/lead-inbox/lead-inbox-dedupe"
import { intentCandidateToInboxInput } from "../lib/growth/lead-inbox/lead-inbox-loader"
import { GROWTH_LEAD_INBOX_QA_MARKER } from "../lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthIntentLeadCandidate } from "../lib/growth/lead-engine/intent/intent-candidate-types"
import type { GrowthLeadInboxRow } from "../lib/growth/lead-inbox/lead-inbox-types"

assert.equal(GROWTH_LEAD_INBOX_QA_MARKER, "growth-lead-inbox-v1")

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270317120000_growth_engine_lead_inbox.sql"),
  "utf8",
)
assert.match(migration, /growth\.lead_inbox/)
assert.match(migration, /dedupe_hash/)
assert.match(migration, /intent_session_id/)
assert.match(migration, /existing_account_match/)
assert.match(migration, /status.*new/)

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-inbox/lead-inbox-repository.ts"),
  "utf8",
)
assert.match(repoSource, /createLeadCandidate/)
assert.match(repoSource, /loadLeadInbox/)
assert.match(repoSource, /claimLead/)
assert.match(repoSource, /archiveLead/)
assert.match(repoSource, /markDuplicate/)
assert.match(repoSource, /promoteToPipeline/)
assert.doesNotMatch(repoSource, /auto.?outreach|sendEmail|executePipeline/)

// Status transitions
assert.equal(canTransitionLeadInboxStatus("new", "reviewing"), true)
assert.equal(canTransitionLeadInboxStatus("new", "pipeline_complete"), false)
assert.equal(canTransitionLeadInboxStatus("approved", "running_pipeline"), true)
assert.ok(assertLeadInboxStatusTransition("reviewing", "approved").ok)
assert.equal(pipelineStatusForInboxStatus("running_pipeline", "queued"), "running")

// Priority sort
const urgent: GrowthLeadInboxRow = {
  id: "1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  site_key: "s",
  candidate_type: "high_intent",
  candidate_priority: "urgent",
  intent_score: 10,
  intent_grade: "B",
  candidate_confidence: 0.5,
  pipeline_entry: "company_discovery",
  pipeline_status: "not_started",
  company_name: "A",
  domain: null,
  contact_name: null,
  email: null,
  phone: null,
  linkedin_url: null,
  dedupe_hash: "a",
  candidate_reasoning: [],
  candidate_evidence: [{ claim: "c", evidence: "e", source: "s" }],
  candidate_attribution: [{ source: "s", section: "x", signal: "y", evidence: "e", confidence: 0.5 }],
  session_count: 1,
  visit_count: 1,
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  owner_id: null,
  status: "new",
  human_review_required: true,
  lead_engine_run_id: null,
  intent_session_id: "sess-1",
  visitor_key: "v1",
  existing_account_match: { matched: false, source: null, ids: [], evidence: "" },
  existing_lead_match: { matched: false, source: null, ids: [], evidence: "" },
  metadata: {},
}
const low: GrowthLeadInboxRow = {
  ...urgent,
  id: "2",
  candidate_priority: "low",
  intent_score: 20,
  dedupe_hash: "b",
  intent_session_id: "sess-2",
}
assert.ok(compareLeadInboxPriority(urgent, low) < 0)
const sorted = sortLeadInboxQueue([low, urgent])
assert.equal(sorted[0]?.id, "1")

// Anonymous PII policy
const anonymousInput = intentCandidateToInboxInput(
  makeCandidate({ candidate_type: "anonymous", identity: { email: null, phone: null, full_name: null, company_name: null, capture_source: null, identity_rejected: false } }),
  { site_key: "equipify-sandbox", session_count: 1, visit_count: 3 },
)
const pii = validateInboxPiiPolicy({
  ...anonymousInput,
  email: "should@clear.com",
  contact_name: "Should Clear",
})
assert.equal(pii.sanitized.email, null)
assert.equal(pii.sanitized.contact_name, null)
assert.ok(pii.warnings.length > 0)

// Identified keeps explicit PII only
const identifiedInput = intentCandidateToInboxInput(
  makeCandidate({
    candidate_type: "identified",
    identity: {
      email: "lead@example.com",
      phone: "+15551234567",
      full_name: "Alex Operator",
      company_name: "Example Co",
      capture_source: "form",
      identity_rejected: false,
    },
  }),
  { site_key: "equipify-sandbox", session_count: 2, visit_count: 5 },
)
assert.equal(identifiedInput.email, "lead@example.com")
assert.equal(identifiedInput.contact_name, "Alex Operator")

// Loader mapping requires attribution + evidence
assert.ok(identifiedInput.candidate_attribution.length > 0)
assert.ok(identifiedInput.candidate_evidence.length > 0)

function makeCandidate(overrides: Partial<GrowthIntentLeadCandidate>): GrowthIntentLeadCandidate {
  return {
    qa_marker: "growth-intent-lead-bridge-v1",
    candidate_id: "cand-1",
    site_key: "equipify-sandbox",
    visitor_key: "v_test",
    session_id: "sess-bridge-1",
    session_key: "s_test",
    consent_status: "granted",
    candidate_type: "identified",
    candidate_reasoning: ["High intent pricing visit"],
    intent_score: 18,
    intent_grade: "B",
    candidate_confidence: 0.72,
    candidate_priority: "high",
    lead_engine_eligible: true,
    recommended_pipeline_entry: "contact_research",
    dedupe_hash: "hash_test_123",
    dedupe_matched: false,
    dedupe_reason: null,
    domain: "example.com",
    identity: {
      email: "lead@example.com",
      phone: null,
      full_name: "Alex",
      company_name: "Example Co",
      capture_source: "form",
      identity_rejected: false,
    },
    candidate_evidence: [{ claim: "Pricing page", evidence: "/pricing", source: "intent_pixel" }],
    candidate_attribution: [
      { source: "growth.intent_pageview_events", section: "pageview", signal: "pricing", evidence: "/pricing", confidence: 0.7 },
    ],
    scoring_breakdown: { high_intent_paths: 4 },
    threshold_passed: true,
    threshold_reasons: ["Intent score meets threshold"],
    warnings: [],
    ...overrides,
  }
}

console.log("growth-lead-inbox-v1 checks passed")
