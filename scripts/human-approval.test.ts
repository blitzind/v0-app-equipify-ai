/**
 * Regression checks for Lead Engine Human Approval Engine (Prompt 9).
 * Run: pnpm test:growth-lead-engine-human-approval
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineHumanApprovalSystemPrompt,
  buildGrowthLeadEngineHumanApprovalTemplateUserPrompt,
  buildGrowthLeadEngineHumanApprovalUserPrompt,
  GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/human-approval-prompt"
import {
  computeDeterministicApprovalStatus,
  parseGrowthLeadEngineHumanApprovalFromUpstream,
  parseGrowthLeadEngineHumanApprovalOutput,
} from "../lib/growth/lead-engine/human-approval-parser"
import {
  GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES,
  GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_QA_MARKER,
} from "../lib/growth/lead-engine/human-approval-types"

assert.equal(GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_QA_MARKER, "lead-engine-human-approval-v1")
assert.equal(GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_OUTPUT_JSON_KEYS.length, 14)
assert.ok(GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES.length >= 10)

const systemPrompt = buildGrowthLeadEngineHumanApprovalSystemPrompt()
assert.match(systemPrompt, /Do NOT autonomously approve/)
assert.match(systemPrompt, /Do NOT fabricate approval blockers/)
assert.match(systemPrompt, /approved/)
assert.match(systemPrompt, /conditional/)
assert.match(systemPrompt, /blocked/)
assert.match(systemPrompt, /source_attribution/)

const userPrompt = buildGrowthLeadEngineHumanApprovalUserPrompt({
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
  },
})
assert.match(userPrompt, /Lead Score Output/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineHumanApprovalTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_TEMPLATE_PLACEHOLDERS.lead_score_json))

const attribution = [
  {
    source: "lead_score",
    section: "approval_status",
    signal: "lead_score",
    evidence: "Lead score 87 with validated verification",
    confidence: 0.9,
  },
  {
    source: "verification_triage",
    section: "verification",
    signal: "disposition_validated",
    evidence: "Email confirmed on team page",
    confidence: 0.92,
  },
]

const approvedContext = {
  leadScore: 87,
  leadPriority: "high",
  disqualificationReasons: [],
  leadScoreHumanReview: false,
  verificationDisposition: "validated",
  verificationRiskScore: 10,
  verificationReasonCodes: [],
  verificationHumanReview: false,
  accountBriefHumanReview: false,
  accountBriefCompleteness: 78,
  personalizationHumanReview: false,
  personalizationCompleteness: 76,
}

assert.equal(computeDeterministicApprovalStatus(approvedContext, 2), "approved")

const validApproval = {
  approval_status: "approved",
  approval_reason_codes: ["READY_FOR_HUMAN_APPROVAL", "LEAD_SCORE_STRONG"],
  approval_confidence: 0.88,
  approval_priority: "normal",
  human_review_required: false,
  required_review_areas: ["scoring"],
  recommended_human_actions: ["approve"],
  approval_blockers: [],
  approval_summary: "Lead meets criteria for human approver review; no autonomous outbound.",
  review_notes_required: false,
  escalation_required: false,
  escalation_reason: "",
  evidence_summary: "Strong lead score with validated verification and sufficient attribution.",
  source_attribution: attribution,
}

const parsed = parseGrowthLeadEngineHumanApprovalOutput(JSON.stringify(validApproval), {
  upstream: approvedContext,
})
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.approval_status, "approved")
  assert.equal(parsed.output.human_review_required, true)
  assert.ok(parsed.output.recommended_human_actions.includes("approve"))
  assert.equal(parsed.output.approval_blockers.length, 0)
}

const blockedReject = parseGrowthLeadEngineHumanApprovalFromUpstream(
  JSON.stringify({
    ...validApproval,
    approval_status: "approved",
    approval_confidence: 0.99,
  }),
  {
    verificationTriage: {
      disposition: "reject",
      risk_score: 90,
      verification_reason_codes: ["COMPANY_MISMATCH"],
      human_review_required: true,
    } as never,
    leadScore: {
      lead_score: 20,
      priority_level: "disqualified",
      disqualification_reasons: ["Verification triage rejected the contact/company match."],
      human_review_required: true,
    } as never,
  },
)
assert.equal(blockedReject.ok, true)
if (blockedReject.ok) {
  assert.equal(blockedReject.output.approval_status, "blocked")
  assert.equal(blockedReject.output.approval_priority, "urgent")
  assert.ok(blockedReject.output.approval_blockers.length > 0)
  assert.ok(blockedReject.output.recommended_human_actions.includes("disqualify"))
  assert.ok(blockedReject.output.approval_confidence <= 0.45)
}

const conditionalRisky = parseGrowthLeadEngineHumanApprovalFromUpstream(
  JSON.stringify({ ...validApproval, approval_status: "approved" }),
  {
    verificationTriage: { disposition: "risky", risk_score: 40, human_review_required: true } as never,
    leadScore: { lead_score: 65, human_review_required: true, disqualification_reasons: [] } as never,
  },
)
assert.equal(conditionalRisky.ok, true)
if (conditionalRisky.ok) {
  assert.equal(conditionalRisky.output.approval_status, "conditional")
  assert.ok(conditionalRisky.output.required_review_areas.includes("verification"))
  assert.ok(conditionalRisky.output.recommended_human_actions.includes("request_review"))
}

const noAttribution = parseGrowthLeadEngineHumanApprovalOutput(
  JSON.stringify({ ...validApproval, source_attribution: [] }),
  { upstream: approvedContext },
)
assert.equal(noAttribution.ok, false)

const fabricatedBlocker = parseGrowthLeadEngineHumanApprovalOutput(
  JSON.stringify({
    ...validApproval,
    approval_blockers: [
      {
        code: "FAKE_BLOCKER",
        evidence: "Assumed policy violation",
        source: "invented",
        confidence: 0.99,
      },
    ],
  }),
  { upstream: approvedContext },
)
assert.equal(fabricatedBlocker.ok, true)
if (fabricatedBlocker.ok) {
  assert.equal(fabricatedBlocker.output.approval_blockers.length, 0)
}

const escalationWithoutReason = parseGrowthLeadEngineHumanApprovalOutput(
  JSON.stringify({ ...validApproval, escalation_required: true, escalation_reason: "" }),
  { upstream: approvedContext },
)
assert.equal(escalationWithoutReason.ok, true)
if (escalationWithoutReason.ok) {
  assert.equal(escalationWithoutReason.output.escalation_required, false)
}

const typesPath = path.join(process.cwd(), "lib/growth/lead-engine/human-approval-types.ts")
const typesSource = fs.readFileSync(typesPath, "utf8")
assert.match(typesSource, /lead-engine-human-approval-v1/)

console.log("human-approval.test.ts: all checks passed")
