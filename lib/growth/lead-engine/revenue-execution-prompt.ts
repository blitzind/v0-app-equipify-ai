import type { GrowthLeadEngineRevenueExecutionInput } from "@/lib/growth/lead-engine/revenue-execution-types"
import {
  GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS,
  GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS,
  GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES,
  GROWTH_LEAD_ENGINE_EXECUTION_PATHS,
  GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES,
  GROWTH_LEAD_ENGINE_EXECUTION_STATUSES,
  GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES,
} from "@/lib/growth/lead-engine/revenue-execution-types"

function formatUpstreamJsonBlock(
  value: GrowthLeadEngineRevenueExecutionInput["icpTargeting"],
): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineRevenueExecutionSystemPrompt(): string {
  const statuses = GROWTH_LEAD_ENGINE_EXECUTION_STATUSES.join(" | ")
  const priorities = GROWTH_LEAD_ENGINE_EXECUTION_PRIORITIES.join(" | ")
  const paths = GROWTH_LEAD_ENGINE_EXECUTION_PATHS.join(" | ")
  const channels = GROWTH_LEAD_ENGINE_EXECUTION_CHANNELS.join(" | ")
  const owners = GROWTH_LEAD_ENGINE_EXECUTION_OWNER_TYPES.join(" | ")
  const handoffs = GROWTH_LEAD_ENGINE_EXECUTION_HANDOFFS.join(" | ")
  const frequencies = GROWTH_LEAD_ENGINE_EXECUTION_TOUCH_FREQUENCIES.join(" | ")

  return `You are a Revenue Execution Engine for the Equipify Lead Engine.

Your job is to recommend HUMAN-OPERATED revenue execution routing from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT autonomously execute outreach or send messages.
- Do NOT generate email copy, SMS copy, call scripts, or LinkedIn messages.
- Do NOT fabricate execution blockers, dependencies, or readiness.
- Do NOT route to execution without source_attribution evidence.
- Do NOT hide execution gating logic.

EXECUTION STATUS (${statuses}):

ready:
- human_approval.approval_status == approved
- source_attribution sufficient (>= 2 entries)
- execution_blockers empty

waiting:
- approval_status == conditional OR enrichment/verification still pending

blocked:
- approval_status == blocked OR insufficient evidence OR attribution failures OR execution_blockers present

EXECUTION READINESS (0–100):
- Reflect evidenced readiness for human rep to begin — never fabricate high readiness.

EXECUTION PRIORITY (${priorities}): align with approval_priority and lead_score.

RECOMMENDED EXECUTION PATH (one of): ${paths}

RECOMMENDED CHANNELS (ordered, from allowlist only): ${channels}

RECOMMENDED SEQUENCE / STEPS:
- recommended_sequence: short label (e.g. EMAIL_THEN_PHONE)
- recommended_sequence_steps: ARRAY of { step_order, channel, action_category, evidence }
- action_category: informational only (e.g. discovery_call, fit_validation) — NOT message copy

RECOMMENDED OWNER TYPE (one of): ${owners}

RECOMMENDED HANDOFF (one of): ${handoffs}

RECOMMENDED TOUCH FREQUENCY (one of): ${frequencies}

RECOMMENDED FOLLOWUP STRATEGY:
- informational guidance for humans only — no generated outreach copy

EXECUTION BLOCKERS / DEPENDENCIES:
- ARRAY of { code, evidence, source, confidence } — evidence-backed only

human_execution_required: always true — humans execute, system only routes.

source_attribution: REQUIRED with evidence for each major execution decision.

Return JSON only.`
}

export function buildGrowthLeadEngineRevenueExecutionUserPrompt(
  input: GrowthLeadEngineRevenueExecutionInput,
): string {
  return [
    "Recommend human-operated revenue execution routing from the upstream Lead Engine outputs below.",
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
    "Human Approval Output:",
    formatUpstreamJsonBlock(input.humanApproval),
    "",
    "Return JSON only.",
  ].join("\n")
}

export const GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
  account_brief_json: "{{account_brief_json}}",
  outreach_personalization_json: "{{outreach_personalization_json}}",
  lead_score_json: "{{lead_score_json}}",
  human_approval_json: "{{human_approval_json}}",
} as const

export function buildGrowthLeadEngineRevenueExecutionTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_REVENUE_EXECUTION_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineRevenueExecutionUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
    verificationTriage: p.verification_triage_json,
    accountBrief: p.account_brief_json,
    outreachPersonalization: p.outreach_personalization_json,
    leadScore: p.lead_score_json,
    humanApproval: p.human_approval_json,
  })
}
