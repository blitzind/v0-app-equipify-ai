import type { GrowthLeadEngineLeadScoreInput } from "@/lib/growth/lead-engine/lead-score-types"
import {
  GROWTH_LEAD_ENGINE_LEAD_GRADES,
  GROWTH_LEAD_ENGINE_LEAD_NEXT_ACTIONS,
  GROWTH_LEAD_ENGINE_LEAD_PRIORITY_LEVELS,
  GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS,
} from "@/lib/growth/lead-engine/lead-score-types"

function formatUpstreamJsonBlock(value: GrowthLeadEngineLeadScoreInput["icpTargeting"]): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineLeadScoreSystemPrompt(): string {
  const weights = Object.entries(GROWTH_LEAD_ENGINE_LEAD_SCORE_WEIGHTS)
    .map(([key, weight]) => `- ${key}: ${weight}`)
    .join("\n")
  const grades = GROWTH_LEAD_ENGINE_LEAD_GRADES.join(" | ")
  const priorities = GROWTH_LEAD_ENGINE_LEAD_PRIORITY_LEVELS.join(" | ")
  const actions = GROWTH_LEAD_ENGINE_LEAD_NEXT_ACTIONS.join(" | ")

  return `You are a Lead Score Engine for the Equipify Lead Engine.

Your job is to score leads deterministically from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT fabricate scoring evidence or inflate scores without attribution.
- Do NOT generate outreach copy, emails, SMS, or scripts.
- Do NOT autonomously approve leads for outbound — only recommend human review routing.
- Do NOT invent buying intent unsupported by upstream evidence.
- Do NOT hide scoring criteria — all component scores must be explainable.

COMPONENT SCORES (each integer 0–100, evidence-backed):
${weights}

WEIGHTED FORMULA (deterministic):
lead_score = round(
  (fit_score * 25 + intent_score * 20 + contactability_score * 15 +
   verification_score * 15 + account_quality_score * 15 + personalization_score * 10) / 100
  - total_risk_penalty
)
Clamp final lead_score to 0–100.

RISK PENALTIES (subtract from weighted score — document each in score_breakdown.risk_penalties):
- High verification risk_score (>= 70): up to -20
- verification disposition reject: up to -40
- verification disposition risky: up to -15
- DUPLICATE_POSSIBLE or HIGH_RISK_CONTACT: up to -15
- Missing or weak source_attribution: up to -25
- Low verification_confidence or brief/personalization confidence: up to -15
- Unsupported buying intent signals: reduce intent_score, do not inflate

LEAD GRADE (from final lead_score only):
- A: 85–100
- B: 70–84
- C: 50–69
- D: 25–49
- F: 0–24

PRIORITY LEVEL: ${priorities}
- high: lead_score >= 85 and low risk
- medium: lead_score 50–84
- low: lead_score 25–49
- disqualified: reject verification, fatal mismatch, or lead_score < 25

RECOMMENDED NEXT ACTION (one of: ${actions}):
- approve_for_human_review: strong score but human_review flags remain
- enrich_more: fit promising but missing company/contact evidence
- verify_contact: contactability or verification weak
- deprioritize: low-medium score with manageable risk
- disqualify: reject verification or score < 25

SCORE BREAKDOWN (required):
- components: array with component, score, weight, contribution
- raw_weighted_score: before penalties
- risk_penalties: array of { code, penalty, evidence }
- total_risk_penalty: sum of penalties
- computed_lead_score: must match lead_score after enforcement

source_attribution: REQUIRED with evidence for each major scoring decision.

Return JSON only with grades ${grades}.`
}

export function buildGrowthLeadEngineLeadScoreUserPrompt(
  input: GrowthLeadEngineLeadScoreInput,
): string {
  return [
    "Score this lead deterministically from the upstream Lead Engine outputs below.",
    "",
    "ICP Targeting Output:",
    formatUpstreamJsonBlock(input.icpTargeting),
    "",
    "Company Discovery Output:",
    formatUpstreamJsonBlock(input.companyDiscovery),
    "",
    "Decision Maker Hypothesis Output:",
    formatUpstreamJsonBlock(input.decisionMakerHypothesis),
    "",
    "Contact Research Output:",
    formatUpstreamJsonBlock(input.contactResearch),
    "",
    "Verification Triage Output:",
    formatUpstreamJsonBlock(input.verificationTriage),
    "",
    "Account Brief Output:",
    formatUpstreamJsonBlock(input.accountBrief),
    "",
    "Outreach Personalization Output:",
    formatUpstreamJsonBlock(input.outreachPersonalization),
    "",
    ...(input.buyingStage
      ? [
          "Buying Stage Assessment (candidate — observable behavior only, not guaranteed):",
          formatUpstreamJsonBlock(input.buyingStage),
          "",
        ]
      : []),
    "Return JSON only.",
  ].join("\n")
}

export const GROWTH_LEAD_ENGINE_LEAD_SCORE_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
  account_brief_json: "{{account_brief_json}}",
  outreach_personalization_json: "{{outreach_personalization_json}}",
} as const

export function buildGrowthLeadEngineLeadScoreTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_LEAD_SCORE_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineLeadScoreUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
    verificationTriage: p.verification_triage_json,
    accountBrief: p.account_brief_json,
    outreachPersonalization: p.outreach_personalization_json,
  })
}
