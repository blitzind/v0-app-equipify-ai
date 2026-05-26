/**
 * Regression checks for Lead Engine Revenue Execution Engine (Prompt 10).
 * Run: pnpm test:growth-lead-engine-revenue-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineRevenueExecutionSystemPrompt,
  buildGrowthLeadEngineRevenueExecutionTemplateUserPrompt,
  buildGrowthLeadEngineRevenueExecutionUserPrompt,
  GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/revenue-execution-prompt"
import {
  computeDeterministicExecutionStatus,
  parseGrowthLeadEngineRevenueExecutionFromUpstream,
  parseGrowthLeadEngineRevenueExecutionOutput,
} from "../lib/growth/lead-engine/revenue-execution-parser"
import {
  GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS,
  GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_QA_MARKER,
} from "../lib/growth/lead-engine/revenue-execution-types"

assert.equal(GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_QA_MARKER, "lead-engine-revenue-execution-v1")
assert.equal(GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_OUTPUT_JSON_KEYS.length, 18)
assert.equal(GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS.length, 5)

const systemPrompt = buildGrowthLeadEngineRevenueExecutionSystemPrompt()
assert.match(systemPrompt, /Do NOT autonomously execute outreach/)
assert.match(systemPrompt, /Do NOT generate email copy/)
assert.match(systemPrompt, /EXECUTION STATUS/)
assert.match(systemPrompt, /ready/)
assert.match(systemPrompt, /source_attribution/)
assert.match(systemPrompt, /outbound_sales/)

const userPrompt = buildGrowthLeadEngineRevenueExecutionUserPrompt({
  icpTargeting: { icp_summary: "Biomedical service ICP" },
  companyDiscovery: {
    company_profile: { company_name: "Precision Biomedical Services", domain: "precisionbiomed.example" },
  },
  decisionMakerHypothesis: { buying_committee: { primary_targets: [] } },
  contactResearch: { contact_candidates: [] },
  verificationTriage: { disposition: "validated", risk_score: 10 },
  accountBrief: { brief_completeness: 78 },
  outreachPersonalization: { recommended_channel_priority: ["EMAIL", "PHONE"] },
  leadScore: { lead_score: 87, priority_level: "high", recommended_next_action: "approve_for_human_review" },
  humanApproval: { approval_status: "approved", approval_priority: "normal", approval_blockers: [] },
})
assert.match(userPrompt, /Human Approval Output/)
assert.match(userPrompt, /Return JSON only/)

const templatePrompt = buildGrowthLeadEngineRevenueExecutionTemplateUserPrompt()
assert.ok(templatePrompt.includes(GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_TEMPLATE_PLACEHOLDERS.human_approval_json))

const readyContext = {
  approvalStatus: "approved",
  approvalPriority: "normal",
  approvalBlockersCount: 0,
  leadScore: 87,
  leadPriority: "high",
  verificationDisposition: "validated",
  personalizationChannels: ["EMAIL", "PHONE"],
  recommendedNextAction: "approve_for_human_review",
}

assert.equal(computeDeterministicExecutionStatus(readyContext, 2, []), "ready")

const attribution = [
  {
    source: "human_approval",
    section: "execution_status",
    signal: "approval_approved",
    evidence: "Human approval status approved with lead score 87",
    confidence: 0.9,
  },
  {
    source: "outreach_personalization",
    section: "recommended_channels",
    signal: "channel_priority",
    evidence: "EMAIL and PHONE recommended from personalization",
    confidence: 0.85,
  },
]

const validExecution = {
  execution_status: "ready",
  execution_readiness: 95,
  execution_priority: "urgent",
  recommended_execution_path: "call_sequence",
  recommended_channels: ["EMAIL", "PHONE"],
  recommended_sequence: "EMAIL_THEN_PHONE",
  recommended_sequence_steps: [
    {
      step_order: 1,
      channel: "EMAIL",
      action_category: "fit_validation",
      evidence: "Validated email contact from verification triage",
    },
    {
      step_order: 2,
      channel: "PHONE",
      action_category: "discovery_call",
      evidence: "Phone channel prioritized in personalization output",
    },
  ],
  recommended_timing: "business_hours_local_time",
  recommended_owner_type: "account_executive",
  recommended_handoff: "assign_owner",
  recommended_followup_strategy: "Human rep validates fit then schedules discovery — no auto-send.",
  recommended_touch_frequency: "immediate",
  execution_blockers: [],
  execution_dependencies: [],
  execution_confidence: 0.88,
  human_execution_required: true,
  evidence_summary: "Approved lead with strong score and validated channels.",
  source_attribution: attribution,
}

const parsed = parseGrowthLeadEngineRevenueExecutionOutput(JSON.stringify(validExecution), {
  upstream: readyContext,
})
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.execution_status, "ready")
  assert.equal(parsed.output.human_execution_required, true)
  assert.deepEqual(parsed.output.recommended_channels, ["EMAIL", "PHONE"])
  assert.equal(parsed.output.recommended_handoff, "assign_owner")
  assert.equal(parsed.output.execution_blockers.length, 0)
  assert.ok(parsed.output.execution_readiness >= 70)
}

const blockedApproval = parseGrowthLeadEngineRevenueExecutionFromUpstream(
  JSON.stringify({ ...validExecution, execution_status: "ready", execution_readiness: 99 }),
  {
    humanApproval: { approval_status: "blocked", approval_priority: "urgent", approval_blockers: [{ code: "X", evidence: "blocked", source: "human_approval", confidence: 0.9 }] } as never,
    leadScore: { lead_score: 20, priority_level: "disqualified" } as never,
    verificationTriage: { disposition: "reject" } as never,
  },
)
assert.equal(blockedApproval.ok, true)
if (blockedApproval.ok) {
  assert.equal(blockedApproval.output.execution_status, "blocked")
  assert.ok(blockedApproval.output.execution_blockers.length > 0)
  assert.equal(blockedApproval.output.recommended_handoff, "disqualify")
  assert.ok(blockedApproval.output.execution_confidence <= 0.4)
}

const waitingConditional = parseGrowthLeadEngineRevenueExecutionFromUpstream(
  JSON.stringify(validExecution),
  {
    humanApproval: { approval_status: "conditional", approval_priority: "normal", approval_blockers: [] } as never,
    leadScore: { lead_score: 65, recommended_next_action: "enrich_more" } as never,
  },
)
assert.equal(waitingConditional.ok, true)
if (waitingConditional.ok) {
  assert.equal(waitingConditional.output.execution_status, "waiting")
  assert.equal(waitingConditional.output.recommended_handoff, "enrich_first")
  assert.equal(waitingConditional.output.recommended_sequence_steps.length, 0)
}

const noAttribution = parseGrowthLeadEngineRevenueExecutionOutput(
  JSON.stringify({ ...validExecution, source_attribution: [] }),
  { upstream: readyContext },
)
assert.equal(noAttribution.ok, false)

const emailCopy = parseGrowthLeadEngineRevenueExecutionOutput(
  JSON.stringify({
    ...validExecution,
    recommended_followup_strategy: "Hi Maria, I wanted to reach out. Best regards.",
  }),
  { upstream: readyContext },
)
assert.equal(emailCopy.ok, true)
if (emailCopy.ok) {
  assert.match(emailCopy.output.recommended_followup_strategy, /Human rep/)
}

const fabricatedBlocker = parseGrowthLeadEngineRevenueExecutionOutput(
  JSON.stringify({
    ...validExecution,
    execution_blockers: [
      {
        code: "FAKE",
        evidence: "Assumed blocker",
        source: "invented",
        confidence: 0.99,
      },
    ],
  }),
  { upstream: readyContext },
)
assert.equal(fabricatedBlocker.ok, true)
if (fabricatedBlocker.ok) {
  assert.equal(fabricatedBlocker.output.execution_blockers.length, 0)
  assert.equal(fabricatedBlocker.output.execution_status, "ready")
}

const typesPath = path.join(process.cwd(), "lib/growth/lead-engine/revenue-execution-types.ts")
const typesSource = fs.readFileSync(typesPath, "utf8")
assert.match(typesSource, /lead-engine-revenue-execution-v1/)

console.log("revenue-execution.test.ts: all checks passed")
