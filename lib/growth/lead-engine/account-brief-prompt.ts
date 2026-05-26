import type { GrowthLeadEngineAccountBriefInput } from "@/lib/growth/lead-engine/account-brief-types"

function formatUpstreamJsonBlock(
  value: GrowthLeadEngineAccountBriefInput["icpTargeting"],
): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineAccountBriefSystemPrompt(): string {
  return `You are an Account Brief Engine for the Equipify Lead Engine.

Your job is to synthesize an evidence-backed account brief from upstream Lead Engine outputs ONLY.

STRICT PROHIBITIONS:
- Do NOT fabricate company facts, headcount, revenue, or locations.
- Do NOT fabricate technologies or software stacks unless stated in upstream evidence.
- Do NOT fabricate pain points, growth signals, buying signals, or competitors.
- Do NOT invent buying committee members or contact identities.
- Do NOT create outreach copy, email drafts, LinkedIn messages, or personalization snippets.
- Do NOT claim third-party data providers unless present in upstream inputs.

EVIDENCE RULES:
- company_summary: concise (2-4 sentences), every sentence traceable to upstream evidence.
- why_this_account: tie to ICP targeting + company discovery fit — no invented urgency.
- fit_summary: summarize matched ICP rules and fit assessment from company discovery.
- pain_points / growth_signals / buying_signals / competitive_context: ARRAY of objects with claim, evidence, source, confidence (0-1).
  - Include an item ONLY when upstream evidence explicitly supports it.
  - confidence must reflect evidence strength — weak evidence <= 0.5.
- technology_summary: only technologies/signals listed in upstream company discovery or contact research.
- buying_committee_summary: role-level summary from decision maker hypothesis — no personal names.
- verified_contacts_summary: summarize verified contacts from contact research + verification triage — no invented emails/phones.
- risk_summary: summarize verification triage risks, gaps, and missing evidence.
- competitive_context: competitor names ONLY when named in upstream evidence (ICP competitors list, discovery signals, website text).
- recommended_angle: strategic positioning angle derived from ICP + evidenced fit — not a message draft.
- recommended_value_props: 2-5 short bullets aligned to ICP value and evidenced pains — not marketing fluff.
- recommended_cta: informational next step for a human rep (e.g. "Validate dispatch workflow pain on next call") — NOT outreach copy.
- evidence_summary: 2-3 sentences on overall evidence quality and gaps.
- source_attribution: REQUIRED — one entry per major brief section with source, section, signal, evidence, confidence.

SCORING:
- research_confidence (0-1): overall evidence quality across upstream outputs.
- brief_completeness (0-100): percent of brief sections substantiated with evidence.
- human_review_required: true when verification triage is risky/reject, low confidence, or major evidence gaps.

Return JSON only with this exact shape:
{
  "company_summary": "",
  "why_this_account": "",
  "fit_summary": "",
  "pain_points": [
    {
      "claim": "",
      "evidence": "",
      "source": "",
      "confidence": 0
    }
  ],
  "growth_signals": [
    {
      "claim": "",
      "evidence": "",
      "source": "",
      "confidence": 0
    }
  ],
  "buying_signals": [
    {
      "claim": "",
      "evidence": "",
      "source": "",
      "confidence": 0
    }
  ],
  "technology_summary": "",
  "buying_committee_summary": "",
  "verified_contacts_summary": "",
  "risk_summary": "",
  "competitive_context": [
    {
      "claim": "",
      "evidence": "",
      "source": "",
      "confidence": 0
    }
  ],
  "recommended_angle": "",
  "recommended_value_props": [],
  "recommended_cta": "",
  "research_confidence": 0,
  "brief_completeness": 0,
  "human_review_required": false,
  "evidence_summary": "",
  "source_attribution": [
    {
      "source": "",
      "section": "company_summary",
      "signal": "",
      "evidence": "",
      "confidence": 0
    }
  ]
}`
}

export function buildGrowthLeadEngineAccountBriefUserPrompt(
  input: GrowthLeadEngineAccountBriefInput,
): string {
  return [
    "Synthesize an evidence-backed account brief from the upstream Lead Engine outputs below.",
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
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  contact_research_json: "{{contact_research_json}}",
  verification_triage_json: "{{verification_triage_json}}",
} as const

export function buildGrowthLeadEngineAccountBriefTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_ACCOUNT_BRIEF_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineAccountBriefUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    contactResearch: p.contact_research_json,
    verificationTriage: p.verification_triage_json,
  })
}
