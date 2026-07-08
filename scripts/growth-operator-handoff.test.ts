/**
 * Regression checks for Operator Handoff Engine (Prompt 17).
 * Run: pnpm test:growth-operator-handoff
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthOperatorHandoffSystemPrompt,
  buildGrowthOperatorHandoffTemplateUserPrompt,
  buildGrowthOperatorHandoffUserPrompt,
  GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/operator-handoff/operator-handoff-prompt"
import {
  buildOperatorHandoffUpstreamContext,
  parseGrowthOperatorHandoffFromUpstream,
  parseGrowthOperatorHandoffOutput,
} from "../lib/growth/operator-handoff/operator-handoff-parser"
import {
  compareOperatorHandoffPriority,
  computeOperatorHandoffPriorityHints,
} from "../lib/growth/operator-handoff/operator-handoff-priority"
import {
  buildOperatorHandoffPackage,
  GROWTH_OPERATOR_HANDOFF_METADATA_KEY,
  loadOperatorHandoffFromRevenueQueue,
} from "../lib/growth/operator-handoff/operator-handoff-repository"
import {
  GROWTH_OPERATOR_HANDOFF_MOTIONS,
  GROWTH_OPERATOR_HANDOFF_OUTPUT_JSON_KEYS,
  GROWTH_OPERATOR_HANDOFF_QA_MARKER,
} from "../lib/growth/operator-handoff/operator-handoff-types"
import type { GrowthOperatorHandoffInput } from "../lib/growth/operator-handoff/operator-handoff-types"
import type { RevenueQueueRow } from "../lib/growth/lead-inbox/lead-inbox-types"

assert.equal(GROWTH_OPERATOR_HANDOFF_QA_MARKER, "growth-operator-handoff-v1")
assert.equal(GROWTH_OPERATOR_HANDOFF_OUTPUT_JSON_KEYS.length, 18)
assert.equal(GROWTH_OPERATOR_HANDOFF_MOTIONS.length, 8)

const systemPrompt = buildGrowthOperatorHandoffSystemPrompt()
assert.match(systemPrompt, /Do NOT generate email copy/)
assert.match(systemPrompt, /Do NOT fabricate objections/)
assert.match(systemPrompt, /Do NOT autonomously execute/)
assert.match(systemPrompt, /operator_attribution/)
assert.match(systemPrompt, /call_first/)
assert.match(systemPrompt, /human_review_required/)

const upstreamInput: GrowthOperatorHandoffInput = {
  leadInbox: null,
  icpTargeting: { icp_summary: "Biomedical service ICP" },
  companyDiscovery: {
    company_profile: { company_name: "Precision Biomedical Services", domain: "precisionbiomed.example" },
  },
  decisionMakerHypothesis: { buying_committee: { primary_targets: [] } },
  contactResearch: { contact_candidates: [] },
  verificationTriage: { disposition: "validated", risk_score: 10, human_review_required: false },
  accountBrief: { brief_completeness: 78, human_review_required: false, research_confidence: 0.85 },
  outreachPersonalization: {
    personalization_completeness: 76,
    human_review_required: false,
    personalization_confidence: 0.8,
  },
  leadScore: {
    lead_score: 87,
    priority_level: "high",
    human_review_required: false,
    disqualification_reasons: [],
    recommended_next_action: "approve_for_human_review",
  },
  humanApproval: {
    approval_status: "approved",
    approval_priority: "normal",
    approval_blockers: [],
  },
  revenueExecution: {
    recommended_owner_type: "account_executive",
    recommended_channels: ["PHONE"],
    human_execution_required: true,
  },
  intentHistory: { sessions: [], visit_count: 2 },
}

const userPrompt = buildGrowthOperatorHandoffUserPrompt(upstreamInput)
assert.match(userPrompt, /Revenue Queue/)
assert.match(userPrompt, /Intent History/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthOperatorHandoffTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.lead_score_json))

const hints = computeOperatorHandoffPriorityHints(upstreamInput)
assert.equal(hints.recommended_motion, "call_first")
assert.equal(hints.recommended_owner, "account_executive")
assert.equal(hints.recommended_channel, "PHONE")
assert.ok(compareOperatorHandoffPriority("high", "medium") < 0)

const context = buildOperatorHandoffUpstreamContext(upstreamInput)
assert.equal(context.verificationDisposition, "validated")
assert.equal(context.leadScore, 87)

const attribution = [
  {
    source: "lead_score",
    section: "handoff",
    signal: "lead_score_high",
    evidence: "Lead score 87 with validated verification",
    confidence: 0.9,
  },
  {
    source: "human_approval",
    section: "approval",
    signal: "approved",
    evidence: "Human approval status approved",
    confidence: 0.88,
  },
]

const operatorEvidence = [
  {
    claim: "Strong ICP fit",
    evidence: "Biomedical service ICP matches company profile",
    source: "icp_targeting",
    confidence: 0.85,
  },
]

const validHandoff = {
  handoff_summary: "High-intent lead ready for operator call prep — no outbound drafted.",
  why_this_matters: "Validated verification and approved human review support timely follow-up.",
  lead_priority: "high",
  recommended_motion: "call_first",
  recommended_owner: "account_executive",
  recommended_channel: "PHONE",
  recommended_urgency: "today",
  recommended_next_action: "Prepare for call using talking points — do not send email yet.",
  objection_preparation: [],
  missing_information: [],
  human_notes: ["Confirm decision maker title before first touch."],
  recommended_followup_window: "Within 1 business day",
  talking_point_summary: "ICP fit; validated contact; approved for human execution.",
  operator_confidence: 0.86,
  operator_confidence_reasoning: "Strong score and dual attribution.",
  operator_evidence: operatorEvidence,
  operator_attribution: attribution,
  human_review_required: true,
}

const parsed = parseGrowthOperatorHandoffFromUpstream(JSON.stringify(validHandoff), upstreamInput)
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.recommended_motion, "call_first")
  assert.equal(parsed.output.human_review_required, true)
  assert.ok(parsed.output.operator_confidence <= 0.86)
  assert.equal(parsed.output.operator_attribution.length, 2)
}

const riskyInput: GrowthOperatorHandoffInput = {
  ...upstreamInput,
  verificationTriage: { disposition: "risky", risk_score: 72, human_review_required: true },
  humanApproval: { approval_status: "conditional", approval_priority: "normal", approval_blockers: [] },
}
const riskyParsed = parseGrowthOperatorHandoffFromUpstream(JSON.stringify(validHandoff), riskyInput)
assert.equal(riskyParsed.ok, true)
if (riskyParsed.ok) {
  assert.ok(riskyParsed.output.operator_confidence <= 0.65)
  assert.equal(riskyParsed.output.human_review_required, true)
}

const rejectParsed = parseGrowthOperatorHandoffFromUpstream(
  JSON.stringify({
    ...validHandoff,
    recommended_motion: "call_first",
    recommended_urgency: "immediate",
  }),
  {
    ...upstreamInput,
    verificationTriage: { disposition: "reject", risk_score: 90, human_review_required: true },
    humanApproval: { approval_status: "blocked", approval_priority: "urgent", approval_blockers: [] },
  },
)
assert.equal(rejectParsed.ok, true)
if (rejectParsed.ok) {
  assert.equal(rejectParsed.output.recommended_motion, "disqualify")
  assert.equal(rejectParsed.output.recommended_urgency, "monitor")
  assert.ok(rejectParsed.output.operator_confidence <= 0.45)
}

const noAttribution = parseGrowthOperatorHandoffOutput(JSON.stringify({ ...validHandoff, operator_attribution: [] }))
assert.equal(noAttribution.ok, false)

const noEvidence = parseGrowthOperatorHandoffOutput(
  JSON.stringify({ ...validHandoff, operator_evidence: [] }),
)
assert.equal(noEvidence.ok, false)

const fabricatedObjection = parseGrowthOperatorHandoffFromUpstream(
  JSON.stringify({
    ...validHandoff,
    objection_preparation: [
      {
        claim: "Budget frozen",
        evidence: "assumed budget freeze from market rumors",
        source: "guess",
        confidence: 0.9,
      },
    ],
  }),
  upstreamInput,
)
assert.equal(fabricatedObjection.ok, true)
if (fabricatedObjection.ok) {
  assert.equal(fabricatedObjection.output.objection_preparation.length, 0)
}

const emailCopy = parseGrowthOperatorHandoffFromUpstream(
  JSON.stringify({
    ...validHandoff,
    handoff_summary: "Dear John, please book a demo with our team.",
    recommended_next_action: "Send this email: Hi there, subject: partnership",
  }),
  upstreamInput,
)
assert.equal(emailCopy.ok, false)

assert.equal(parsed.ok, true)
if (!parsed.ok) throw new Error("expected parsed handoff")
const pkg = buildOperatorHandoffPackage(upstreamInput, parsed.output)
assert.equal(pkg.qa_marker, GROWTH_OPERATOR_HANDOFF_QA_MARKER)

const inboxRow: RevenueQueueRow = {
  id: "inbox-1",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  site_key: "s",
  candidate_type: "high_intent",
  candidate_priority: "normal",
  intent_score: 80,
  intent_grade: "A",
  candidate_confidence: 0.8,
  pipeline_entry: "company_discovery",
  pipeline_status: "not_started",
  company_name: "Precision Biomedical",
  domain: "precisionbiomed.example",
  contact_name: null,
  email: null,
  phone: null,
  linkedin_url: null,
  dedupe_hash: "hash",
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
  intent_session_id: "sess",
  visitor_key: "visitor",
  existing_account_match: { matched: false, source: null, ids: [], evidence: "" },
  existing_lead_match: { matched: false, source: null, ids: [], evidence: "" },
  metadata: { [GROWTH_OPERATOR_HANDOFF_METADATA_KEY]: pkg },
}

const loaded = loadOperatorHandoffFromRevenueQueue(inboxRow)
assert.ok(loaded)
assert.equal(loaded?.handoff.recommended_motion, "call_first")

const repoSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/operator-handoff/operator-handoff-repository.ts"),
  "utf8",
)
assert.match(repoSource, /loadOperatorHandoffFromRevenueQueue/)
assert.match(repoSource, /GROWTH_OPERATOR_HANDOFF_METADATA_KEY/)
assert.doesNotMatch(repoSource, /saveOperatorHandoffToLeadInbox/)
assert.doesNotMatch(repoSource, /\.from\(["']lead_inbox["']\)/)
assert.doesNotMatch(repoSource, /sendEmail|auto.?outreach|executePipeline/)

const parserSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/operator-handoff/operator-handoff-parser.ts"),
  "utf8",
)
assert.match(parserSource, /operator_attribution/)
assert.match(parserSource, /human_review_required/)
assert.match(parserSource, /MESSAGE_COPY/)

console.log("growth-operator-handoff: all checks passed")
