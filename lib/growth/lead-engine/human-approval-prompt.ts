import type { GrowthLeadEngineHumanApprovalInput } from "@/lib/growth/lead-engine/human-approval-types"
import {
  GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES,
  GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES,
  GROWTH_LEAD_ENGINE_APPROVAL_STATUSES,
  GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS,
  GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS,
} from "@/lib/growth/lead-engine/human-approval-types"

function formatUpstreamJsonBlock(
  value: GrowthLeadEngineHumanApprovalInput["icpTargeting"],
): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineHumanApprovalSystemPrompt(): string {
  const statuses = GROWTH_LEAD_ENGINE_APPROVAL_STATUSES.join(" | ")
  const priorities = GROWTH_LEAD_ENGINE_APPROVAL_PRIORITIES.join(" | ")
  const reasonCodes = GROWTH_LEAD_ENGINE_APPROVAL_REASON_CODES.join(", ")
  const reviewAreas = GROWTH_LEAD_ENGINE_REQUIRED_REVIEW_AREAS.join(" | ")
  const actions = GROWTH_LEAD_ENGINE_RECOMMENDED_HUMAN_ACTIONS.join(" | ")

  return `You are a Human Approval Engine for the Equipify Lead Engine.

Your job is to route leads for HUMAN approval review from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT autonomously approve leads for outbound execution.
- Do NOT autonomously send outreach or generate messages.
- Do NOT fabricate approval blockers, escalation reasons, or evidence.
- Do NOT approve without source_attribution evidence.
- Do NOT hide approval logic — all decisions must be explainable.

APPROVAL STATUS (${statuses}):

approved (ready for human approver — NOT autonomous outbound):
- lead_score >= 70
- verification disposition is NOT reject
- upstream human_review_required flags are false (account brief, personalization, lead score)
- source_attribution sufficient (>= 2 entries with evidence)
- no blocking risk conditions (reject, company mismatch, high risk, disqualification)

conditional:
- enrichment needed OR verification risky OR incomplete evidence
- low brief/personalization completeness OR reviewer decision needed
- lead_score 50–69 OR risky verification with manageable path forward

blocked:
- verification reject OR disqualification reasons present
- company mismatch OR insufficient evidence OR attribution failures
- high risk (risk_score >= 70, HIGH_RISK_CONTACT, DUPLICATE_POSSIBLE)
- lead_score < 25 or priority disqualified

APPROVAL PRIORITY (${priorities}):
- urgent: blocked with fatal mismatch OR reject OR escalation
- normal: conditional review OR lead_score 70–84
- low: deprioritized or weak fit

REQUIRED REVIEW AREAS (use only): ${reviewAreas}

RECOMMENDED HUMAN ACTIONS (one or more): ${actions}
- approve: only when approval_status is approved and evidence is strong
- enrich / verify_contact / request_review / deprioritize / disqualify as appropriate

APPROVAL BLOCKERS:
- ARRAY of { code, evidence, source, confidence } — evidence-backed only
- Never invent blockers

ESCALATION:
- escalation_required true ONLY with explicit escalation_reason citing upstream evidence
- Never fabricate escalation

ALLOWED REASON CODES (use only these exact strings):
${reasonCodes}

source_attribution: REQUIRED with evidence for each major approval decision.

Return JSON only.`
}

export function buildGrowthLeadEngineHumanApprovalUserPrompt(
  input: GrowthLeadEngineHumanApprovalInput,
): string {
  return [
    "Determine human approval routing from the upstream Lead Engine outputs below.",
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
    "Lead Score Output:",
    formatUpstreamJsonBlock(input.leadScore),
    "",
    "Return JSON only.",
  ].join("\n")
}

export const GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
  account_brief_json: "{{account_brief_json}}",
  outreach_personalization_json: "{{outreach_personalization_json}}",
  lead_score_json: "{{lead_score_json}}",
} as const

export function buildGrowthLeadEngineHumanApprovalTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_HUMAN_APPROVAL_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineHumanApprovalUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
    verificationTriage: p.verification_triage_json,
    accountBrief: p.account_brief_json,
    outreachPersonalization: p.outreach_personalization_json,
    leadScore: p.lead_score_json,
  })
}
