/**
 * Regression checks for Lead Engine Lead Score Engine (Prompt 8).
 * Run: pnpm test:growth-lead-engine-lead-score
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthLeadEngineLeadScoreSystemPrompt,
  buildGrowthLeadEngineLeadScoreTemplateUserPrompt,
  buildGrowthLeadEngineLeadScoreUserPrompt,
  GROWTH_LEAD_ENGINE_LEAD_SCORE_TEMPLATE_PLACEHOLDERS,
} from "../lib/growth/lead-engine/lead-score-prompt"
import {
  computeDeterministicLeadScore,
  computeRiskPenalties,
  gradeFromLeadScore,
  parseGrowthLeadEngineLeadScoreFromUpstream,
  parseGrowthLeadEngineLeadScoreOutput,
} from "../lib/growth/lead-engine/lead-score-parser"
import {
  GROWTH_LEAD_ENGINE_LEAD_SCORE_OUTPUT_JSON_KEYS,
  GROWTH_LEAD_ENGINE_LEAD_SCORE_QA_MARKER,
  GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS,
} from "../lib/growth/lead-engine/lead-score-types"

assert.equal(GROWTH_LEAD_ENGINE_LEAD_SCORE_QA_MARKER, "lead-engine-lead-score-v1")
assert.equal(GROWTH_LEAD_ENGINE_LEAD_SCORE_OUTPUT_JSON_KEYS.length, 16)
assert.equal(
  Object.values(GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0),
  100,
)

const systemPrompt = buildGrowthLeadEngineLeadScoreSystemPrompt()
assert.match(systemPrompt, /Do NOT fabricate scoring evidence/)
assert.match(systemPrompt, /Do NOT autonomously approve/)
assert.match(systemPrompt, /fit_score: 25/)
assert.match(systemPrompt, /LEAD GRADE/)
assert.match(systemPrompt, /approve_for_human_review/)

const userPrompt = buildGrowthLeadEngineLeadScoreUserPrompt({
  icpTargeting: { icp_summary: "Biomedical service ICP" },
  companyDiscovery: {
    company_profile: { company_name: "Precision Biomedical Services", domain: "precisionbiomed.example" },
  },
  decisionMakerHypothesis: {
    buying_committee: { primary_targets: [{ role: "Operations Director", confidence: 0.88 }] },
  },
  contactResearch: { contact_candidates: [] },
  verificationTriage: { disposition: "validated", verification_confidence: 0.9, risk_score: 10 },
  accountBrief: { research_confidence: 0.82, brief_completeness: 78, human_review_required: false },
  outreachPersonalization: {
    personalization_confidence: 0.8,
    personalization_completeness: 76,
    human_review_required: false,
  },
})
assert.match(userPrompt, /Precision Biomedical Services/)
assert.match(userPrompt, /Outreach Personalization Output/)

const templatePrompt = buildGrowthLeadEngineLeadScoreTemplateUserPrompt()
assert.ok(
  templatePrompt.includes(GROWTH_LEAD_ENGINE_LEAD_SCORE_TEMPLATE_PLACEHOLDERS.outreach_personalization_json),
)

assert.equal(gradeFromLeadScore(90), "A")
assert.equal(gradeFromLeadScore(75), "B")
assert.equal(gradeFromLeadScore(60), "C")
assert.equal(gradeFromLeadScore(30), "D")
assert.equal(gradeFromLeadScore(10), "F")

const attribution = [
  {
    source: "account_brief",
    section: "fit_score",
    signal: "icp_fit",
    evidence: "Biomedical service ICP segment match",
    confidence: 0.88,
  },
  {
    source: "verification_triage",
    section: "verification_score",
    signal: "email_confirmed",
    evidence: "Email confirmed on team page",
    confidence: 0.9,
  },
]

const components = {
  fit_score: 92,
  intent_score: 80,
  contactability_score: 88,
  verification_score: 90,
  account_quality_score: 86,
  personalization_score: 82,
}

const breakdown = computeDeterministicLeadScore(components, [])
assert.equal(breakdown.computed_lead_score, 87)
assert.equal(breakdown.components.length, 6)

const validLeadScore = {
  lead_score: 99,
  lead_grade: "A",
  ...components,
  risk_score: 12,
  priority_level: "high",
  recommended_next_action: "approve_for_human_review",
  disqualification_reasons: [],
  score_breakdown: breakdown,
  score_explanation: "Strong ICP fit with validated contact and complete brief.",
  human_review_required: false,
  source_attribution: attribution,
}

const parsed = parseGrowthLeadEngineLeadScoreOutput(JSON.stringify(validLeadScore))
assert.equal(parsed.ok, true)
if (parsed.ok) {
  assert.equal(parsed.output.lead_score, 87)
  assert.equal(parsed.output.lead_grade, "A")
  assert.equal(parsed.output.priority_level, "high")
  assert.equal(parsed.output.recommended_next_action, "approve_for_human_review")
  assert.equal(parsed.output.human_review_required, false)
}

const rejectParsed = parseGrowthLeadEngineLeadScoreFromUpstream(
  JSON.stringify({
    ...validLeadScore,
    lead_score: 95,
    verification_score: 90,
    fit_score: 90,
  }),
  {
    verificationTriage: {
      disposition: "reject",
      verification_confidence: 0.2,
      risk_score: 85,
      verification_reason_codes: ["COMPANY_MISMATCH"],
      human_review_required: true,
    } as never,
  },
)
assert.equal(rejectParsed.ok, true)
if (rejectParsed.ok) {
  assert.equal(rejectParsed.output.priority_level, "disqualified")
  assert.equal(rejectParsed.output.recommended_next_action, "disqualify")
  assert.ok(rejectParsed.output.lead_score < 60)
  assert.ok(rejectParsed.output.disqualification_reasons.length > 0)
}

const penalties = computeRiskPenalties(
  { verificationDisposition: "reject", verificationRiskScore: 85 },
  2,
)
assert.ok(penalties.some((row) => row.code === "VERIFICATION_REJECT"))

const noAttribution = parseGrowthLeadEngineLeadScoreOutput(
  JSON.stringify({ ...validLeadScore, source_attribution: [] }),
)
assert.equal(noAttribution.ok, false)

const inflatedIntent = parseGrowthLeadEngineLeadScoreOutput(
  JSON.stringify({
    ...validLeadScore,
    intent_score: 95,
    source_attribution: [attribution[0]],
  }),
)
assert.equal(inflatedIntent.ok, true)
if (inflatedIntent.ok) {
  assert.equal(inflatedIntent.output.intent_score, 55)
  assert.ok(inflatedIntent.output.human_review_required)
}

const typesPath = path.join(process.cwd(), "lib/growth/lead-engine/lead-score-types.ts")
const typesSource = fs.readFileSync(typesPath, "utf8")
assert.match(typesSource, /lead-engine-lead-score-v1/)

console.log("lead-score.test.ts: all checks passed")
