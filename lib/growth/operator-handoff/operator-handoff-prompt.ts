import type { GrowthOperatorHandoffInput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import {
  GROWTH_OPERATOR_HANDOFF_CHANNELS,
  GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES,
  GROWTH_OPERATOR_HANDOFF_MOTIONS,
  GROWTH_OPERATOR_HANDOFF_OWNERS,
  GROWTH_OPERATOR_HANDOFF_URGENCIES,
} from "@/lib/growth/operator-handoff/operator-handoff-types"

function formatUpstreamJsonBlock(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  if (value == null) return "(not provided)"
  return JSON.stringify(value, null, 2)
}

export const GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS = {
  lead_inbox_json: "{{lead_inbox_json}}",
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_json: "{{decision_maker_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
  account_brief_json: "{{account_brief_json}}",
  outreach_personalization_json: "{{outreach_personalization_json}}",
  lead_score_json: "{{lead_score_json}}",
  human_approval_json: "{{human_approval_json}}",
  revenue_execution_json: "{{revenue_execution_json}}",
  intent_history_json: "{{intent_history_json}}",
} as const

export function buildGrowthOperatorHandoffSystemPrompt(): string {
  return `You are an Operator Handoff Engine for the Equipify Growth Engine.

Your job is to convert Lead Engine pipeline outputs into concise rep/operator guidance.

STRICT PROHIBITIONS:
- Do NOT generate email copy, LinkedIn messages, SMS, or call scripts.
- Do NOT draft subject lines, openers, or outbound sequences.
- Do NOT autonomously execute outreach or schedule sends.
- Do NOT fabricate objections, risks, or urgency not supported by upstream evidence.
- Do NOT invent missing information — only list gaps explicitly evidenced upstream.
- Do NOT claim third-party enrichment unless present in inputs.

GUIDANCE RULES:
- handoff_summary: 2-4 sentences for the operator — what happened and what to do next.
- why_this_matters: 1-2 sentences tying ICP fit + intent/verification/score — evidence-backed only.
- lead_priority: one of ${GROWTH_OPERATOR_HANDOFF_LEAD_PRIORITIES.join(", ")}.
- recommended_motion: one of ${GROWTH_OPERATOR_HANDOFF_MOTIONS.join(", ")}.
- recommended_owner: one of ${GROWTH_OPERATOR_HANDOFF_OWNERS.join(", ")}.
- recommended_channel: one of ${GROWTH_OPERATOR_HANDOFF_CHANNELS.join(", ")} (guidance only).
- recommended_urgency: one of ${GROWTH_OPERATOR_HANDOFF_URGENCIES.join(", ")} — no fabricated urgency.
- recommended_next_action: single imperative for the human operator — NOT outbound copy.
- objection_preparation: array of { claim, evidence, source, confidence } — ONLY objections supported upstream.
- missing_information: array of { claim, evidence, source, confidence } — ONLY gaps explicitly noted upstream.
- human_notes: array of short internal guidance bullets — no customer-facing copy.
- recommended_followup_window: human-readable window (e.g. "Within 1 business day").
- talking_point_summary: bullet-style themes for conversation prep — NOT a script.
- operator_confidence (0-1): calibrated to evidence quality.
- operator_confidence_reasoning: explain confidence caps when verification risky or attribution thin.
- operator_evidence: key evidence items supporting the handoff.
- operator_attribution: REQUIRED — one entry per major recommendation with source, section, signal, evidence, confidence.
- human_review_required: true when verification risky/reject, approval blocked, thin attribution, or major gaps.

Return JSON only with this exact shape:
{
  "handoff_summary": "",
  "why_this_matters": "",
  "lead_priority": "medium",
  "recommended_motion": "review",
  "recommended_owner": "sales",
  "recommended_channel": "NONE",
  "recommended_urgency": "this_week",
  "recommended_next_action": "",
  "objection_preparation": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "missing_information": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "human_notes": [],
  "recommended_followup_window": "",
  "talking_point_summary": "",
  "operator_confidence": 0,
  "operator_confidence_reasoning": "",
  "operator_evidence": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "operator_attribution": [
    { "source": "", "section": "", "signal": "", "evidence": "", "confidence": 0 }
  ],
  "human_review_required": true
}`
}

export function buildGrowthOperatorHandoffUserPrompt(input: GrowthOperatorHandoffInput): string {
  return `Produce an operator handoff package from these upstream outputs.

Lead Inbox:
${formatUpstreamJsonBlock(input.leadInbox)}

ICP Targeting:
${formatUpstreamJsonBlock(input.icpTargeting)}

Company Discovery:
${formatUpstreamJsonBlock(input.companyDiscovery)}

Decision Maker Hypothesis:
${formatUpstreamJsonBlock(input.decisionMakerHypothesis)}

Contact Research:
${formatUpstreamJsonBlock(input.contactResearch)}

Verification Triage:
${formatUpstreamJsonBlock(input.verificationTriage)}

Account Brief:
${formatUpstreamJsonBlock(input.accountBrief)}

Outreach Personalization (strategy only — no copy):
${formatUpstreamJsonBlock(input.outreachPersonalization)}

Lead Score:
${formatUpstreamJsonBlock(input.leadScore)}

Human Approval:
${formatUpstreamJsonBlock(input.humanApproval)}

Revenue Execution (routing only — no sends):
${formatUpstreamJsonBlock(input.revenueExecution)}

Intent History:
${formatUpstreamJsonBlock(input.intentHistory)}

Return JSON only.`
}

export function buildGrowthOperatorHandoffTemplateUserPrompt(): string {
  return `Produce an operator handoff package from these upstream outputs.

Lead Inbox:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.lead_inbox_json}

ICP Targeting:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.icp_targeting_json}

Company Discovery:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.company_discovery_json}

Decision Maker Hypothesis:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.decision_maker_json}

Contact Research:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.contact_research_json}

Verification Triage:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.verification_triage_json}

Account Brief:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.account_brief_json}

Outreach Personalization:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.outreach_personalization_json}

Lead Score:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.lead_score_json}

Human Approval:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.human_approval_json}

Revenue Execution:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.revenue_execution_json}

Intent History:
${GROWTH_OPERATOR_HANDOFF_TEMPLATE_PLACEHOLDERS.intent_history_json}

Return JSON only.`
}
