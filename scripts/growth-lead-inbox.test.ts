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
import { GROWTH_LEAD_INBOX_QA_MARKER } from "../lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthLeadInboxCreateInput, RevenueQueueRow } from "../lib/growth/lead-inbox/lead-inbox-types"

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
assert.match(repoSource, /resolveCanonicalLeadForInboxInput/)
assert.match(repoSource, /growth_lead_id/)
assert.match(repoSource, /GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER/)
const createLeadCandidateSource = repoSource.slice(
  repoSource.indexOf("export async function createLeadCandidate"),
)
assert.doesNotMatch(createLeadCandidateSource, /\.from\(["']lead_inbox["']\)[\s\S]*?\.insert\(/)
assert.doesNotMatch(createLeadCandidateSource, /\.insert\([\s\S]*?lead_inbox/)
assert.doesNotMatch(repoSource, /export async function loadLeadInbox/)
assert.doesNotMatch(repoSource, /export async function claimLead/)
assert.doesNotMatch(repoSource, /export async function archiveLead/)
assert.doesNotMatch(repoSource, /export async function markDuplicate/)
assert.doesNotMatch(repoSource, /export async function promoteToPipeline/)
assert.doesNotMatch(repoSource, /auto.?outreach|sendEmail|executePipeline/)

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts"),
  "utf8",
)
assert.match(bridgeSource, /resolveUnifiedLeadFromIntake/)
assert.match(bridgeSource, /GROWTH_LEAD_INBOX_CANONICAL_INTAKE_CUTOVER_QA_MARKER/)
assert.doesNotMatch(bridgeSource, /\.from\(["']lead_inbox["']\)/)
assert.doesNotMatch(repoSource, /new.*LeadCreationService/i)
assert.equal(canTransitionLeadInboxStatus("new", "reviewing"), true)
assert.equal(canTransitionLeadInboxStatus("new", "pipeline_complete"), false)
assert.equal(canTransitionLeadInboxStatus("approved", "running_pipeline"), true)
assert.ok(assertLeadInboxStatusTransition("reviewing", "approved").ok)
assert.equal(pipelineStatusForInboxStatus("running_pipeline", "queued"), "running")

const loaderSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/lead-inbox/lead-inbox-loader.ts"),
  "utf8",
)
assert.match(loaderSource, /intentCandidateToInboxInput/)
assert.match(loaderSource, /createLeadCandidate/)
assert.match(loaderSource, /growth_lead_id: growthLeadId/)

// Priority sort
const urgent: RevenueQueueRow = {
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
const low: RevenueQueueRow = {
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
const anonymousInput: GrowthLeadInboxCreateInput = {
  site_key: "equipify-sandbox",
  candidate_type: "anonymous",
  candidate_priority: "normal",
  intent_score: 0,
  intent_grade: "F",
  candidate_confidence: 0.5,
  pipeline_entry: "icp_targeting",
  company_name: "Anonymous visitor",
  dedupe_hash: "anon-hash",
  candidate_reasoning: [],
  candidate_evidence: [{ claim: "c", evidence: "e", source: "s" }],
  candidate_attribution: [{ source: "s", section: "x", signal: "y", evidence: "e", confidence: 0.5 }],
  session_count: 1,
  visit_count: 3,
  intent_session_id: "sess-anon",
  visitor_key: "v-anon",
  email: "should@clear.com",
  contact_name: "Should Clear",
}
const pii = validateInboxPiiPolicy(anonymousInput)
assert.equal(pii.sanitized.email, null)
assert.equal(pii.sanitized.contact_name, null)
assert.ok(pii.warnings.length > 0)

// Identified keeps explicit PII only
const identifiedInput: GrowthLeadInboxCreateInput = {
  site_key: "equipify-sandbox",
  candidate_type: "identified",
  candidate_priority: "high",
  intent_score: 18,
  intent_grade: "B",
  candidate_confidence: 0.72,
  pipeline_entry: "contact_research",
  company_name: "Example Co",
  email: "lead@example.com",
  contact_name: "Alex Operator",
  dedupe_hash: "hash_test_123",
  candidate_reasoning: ["High intent pricing visit"],
  candidate_evidence: [{ claim: "Pricing page", evidence: "/pricing", source: "intent_pixel" }],
  candidate_attribution: [
    { source: "growth.intent_pageview_events", section: "pageview", signal: "pricing", evidence: "/pricing", confidence: 0.7 },
  ],
  session_count: 2,
  visit_count: 5,
  intent_session_id: "sess-bridge-1",
  visitor_key: "v_test",
}
assert.equal(identifiedInput.email, "lead@example.com")
assert.equal(identifiedInput.contact_name, "Alex Operator")

// Loader mapping requires attribution + evidence
assert.ok(identifiedInput.candidate_attribution.length > 0)
assert.ok(identifiedInput.candidate_evidence.length > 0)

console.log("growth-lead-inbox-v1 checks passed")
