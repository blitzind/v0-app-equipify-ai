import type { GrowthLeadEngineOutreachPersonalizationInput } from "@/lib/growth/lead-engine/outreach-personalization-types"
import {
  GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES,
  GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES,
  GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES,
  GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES,
  GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES,
} from "@/lib/growth/lead-engine/outreach-personalization-types"

function formatUpstreamJsonBlock(
  value: GrowthLeadEngineOutreachPersonalizationInput["icpTargeting"],
): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineOutreachPersonalizationSystemPrompt(): string {
  const channels = GROWTH_LEAD_ENGINE_OUTREACH_CHANNEL_PRIORITIES.join(" | ")
  const sequences = GROWTH_LEAD_ENGINE_OUTREACH_SEQUENCE_PRIORITIES.join(" | ")
  const socialProof = GROWTH_LEAD_ENGINE_OUTREACH_SOCIAL_PROOF_TYPES.join(" | ")
  const caseStudies = GROWTH_LEAD_ENGINE_OUTREACH_CASE_STUDY_TYPES.join(" | ")
  const ctaCategories = GROWTH_LEAD_ENGINE_OUTREACH_CTA_STRATEGY_CATEGORIES.join(" | ")

  return `You are an Outreach Personalization Engine for the Equipify Lead Engine.

Your job is to produce personalization GUIDANCE from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT generate email copy, SMS copy, call scripts, or LinkedIn messages.
- Do NOT fabricate business issues, technologies, growth initiatives, or urgency.
- Do NOT invent objections without upstream evidence.
- Do NOT fabricate customer names for social proof or case studies.
- Do NOT fabricate personalization facts beyond upstream evidence.
- Do NOT claim third-party enrichment unless present in upstream inputs.

EVIDENCE RULES:
- recommended_talking_points / recommended_problem_alignment / urgency_signals / timing_signals / recommended_objection_categories:
  ARRAY of { claim, evidence, source, confidence } — include ONLY when upstream evidence supports the item.
- recommended_business_outcomes: 2-6 short outcome bullets tied to ICP fit AND verified findings from account brief.
- recommended_social_proof_types: category strings ONLY from: ${socialProof}
- recommended_case_study_types: type strings ONLY from: ${caseStudies}
- recommended_cta_strategy: informational strategy category or guidance — use categories when possible: ${ctaCategories}
- recommended_channel_priority: ordered array using ONLY: ${channels}
- recommended_sequence_priority: one of: ${sequences}

CONTEXT FIELDS:
- personalization_summary: 2-3 sentences on how to personalize outreach using evidenced signals only.
- contact_context: role/title/verification context from contact research + verification triage — no invented contacts.
- company_context: concise company context from account brief + company discovery — no fabrication.

SCORING:
- personalization_confidence (0-1): overall evidenced personalization readiness.
- personalization_completeness (0-100): percent of sections substantiated with evidence.
- human_review_required: true when account brief or verification triage flags review, or evidence is weak.

source_attribution: REQUIRED — one entry per major section with source, section, signal, evidence, confidence.

Return JSON only with this exact shape:
{
  "personalization_summary": "",
  "contact_context": "",
  "company_context": "",
  "recommended_talking_points": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "recommended_problem_alignment": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "recommended_business_outcomes": [],
  "recommended_social_proof_types": [],
  "recommended_case_study_types": [],
  "recommended_objection_categories": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "recommended_cta_strategy": "",
  "urgency_signals": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "timing_signals": [
    { "claim": "", "evidence": "", "source": "", "confidence": 0 }
  ],
  "recommended_channel_priority": [],
  "recommended_sequence_priority": "",
  "personalization_confidence": 0,
  "personalization_completeness": 0,
  "human_review_required": false,
  "evidence_summary": "",
  "source_attribution": [
    { "source": "", "section": "personalization_summary", "signal": "", "evidence": "", "confidence": 0 }
  ]
}`
}

export function buildGrowthLeadEngineOutreachPersonalizationUserPrompt(
  input: GrowthLeadEngineOutreachPersonalizationInput,
): string {
  return [
    "Produce outreach personalization guidance from the upstream Lead Engine outputs below.",
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
    "Return JSON only.",
  ].join("\n")
}

export const GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
  account_brief_json: "{{account_brief_json}}",
} as const

export function buildGrowthLeadEngineOutreachPersonalizationTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_OUTREACH_PERSONALIZATION_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineOutreachPersonalizationUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
    verificationTriage: p.verification_triage_json,
    accountBrief: p.account_brief_json,
  })
}
