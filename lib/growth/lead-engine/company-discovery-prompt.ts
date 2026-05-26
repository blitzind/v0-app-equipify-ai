import type { GrowthLeadEngineCompanyDiscoveryInput } from "@/lib/growth/lead-engine/company-discovery-types"
import { GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS } from "@/lib/growth/lead-engine/company-discovery-types"

function formatDiscoveryField(label: string, value: string): string {
  const trimmed = value.trim()
  return `${label}: ${trimmed || "(not provided)"}`
}

function formatIcpTargetingBlock(icpTargeting: GrowthLeadEngineCompanyDiscoveryInput["icpTargeting"]): string {
  if (typeof icpTargeting === "string") {
    const trimmed = icpTargeting.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(icpTargeting, null, 2)
}

export function buildGrowthLeadEngineCompanyDiscoverySystemPrompt(): string {
  const fitTiers = GROWTH_LEAD_ENGINE_COMPANY_FIT_TIERS.join(" | ")

  return `You are a Company Discovery Engine for the Equipify Lead Engine.

Your job is to normalize a candidate company using ONLY the ICP targeting logic and supplied evidence.

STRICT PROHIBITIONS:
- Do NOT invent missing facts.
- Do NOT invent contacts.
- Do NOT create outreach copy.
- Do NOT score contacts.
- Do NOT claim you browsed beyond the website text and snippets provided.
- Do NOT infer employee count or revenue unless explicit evidence supports it.

REQUIREMENTS:
- Apply ICP qualification_rules, disqualifiers, firmographic_filters, and technology_filters from the ICP output.
- fit_score (0-100) must be explainable from matched_icp_rules, signals, and source_evidence.
- confidence (0-1) reflects evidence quality and completeness — NOT how attractive the company seems.
- fit_tier must be one of: ${fitTiers}.
- If a profile field is unknown, use "" for strings, [] for arrays, or null for employee_estimate / revenue_estimate.
- Flag weak websites, unclear service offering, unrelated industries, and enterprise mismatch when evidence supports it.
- Every non-trivial claim in fit_assessment or signals should have a matching source_evidence entry.
- recommended_next_step.action should be operational (e.g. "Enrich website", "Disqualify", "Promote to prospect queue", "Manual review") — not outreach copy.

Return JSON only with this exact shape:
{
  "company_profile": {
    "company_name": "",
    "domain": "",
    "industry": "",
    "sub_industry": "",
    "business_model": "",
    "service_area": [],
    "headquarters": "",
    "employee_estimate": null,
    "revenue_estimate": null,
    "phone": "",
    "address": "",
    "social_links": []
  },
  "fit_assessment": {
    "fit_score": 0,
    "fit_tier": "low",
    "confidence": 0,
    "matched_icp_rules": [],
    "missing_evidence": [],
    "disqualifiers": []
  },
  "signals": {
    "positive_fit_signals": [],
    "negative_fit_signals": [],
    "pain_signals": [],
    "buying_triggers": [],
    "technology_signals": [],
    "growth_signals": []
  },
  "recommended_next_step": {
    "action": "",
    "reason": ""
  },
  "source_evidence": [
    {
      "claim": "",
      "evidence": "",
      "source": ""
    }
  ]
}`
}

export function buildGrowthLeadEngineCompanyDiscoveryUserPrompt(
  input: GrowthLeadEngineCompanyDiscoveryInput,
): string {
  return [
    "Evaluate this candidate company against the ICP targeting output using only the evidence below.",
    "",
    "ICP Targeting Output:",
    formatIcpTargetingBlock(input.icpTargeting),
    "",
    formatDiscoveryField("Candidate Source", input.candidateSource),
    formatDiscoveryField("Candidate Company Name", input.companyName),
    formatDiscoveryField("Candidate Domain", input.domain),
    "",
    "Candidate Website Text:",
    input.websiteText.trim() ? input.websiteText.trim() : "(not provided)",
    "",
    "Search Result Snippets:",
    input.searchSnippets.trim() ? input.searchSnippets.trim() : "(not provided)",
    "",
    "Known Metadata:",
    input.knownMetadata.trim() ? input.knownMetadata.trim() : "(not provided)",
    "",
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  candidate_source: "{{candidate_source}}",
  company_name: "{{company_name}}",
  domain: "{{domain}}",
  website_text: "{{website_text}}",
  search_snippets: "{{search_snippets}}",
  known_metadata: "{{known_metadata}}",
} as const

export function buildGrowthLeadEngineCompanyDiscoveryTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_COMPANY_DISCOVERY_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineCompanyDiscoveryUserPrompt({
    icpTargeting: p.icp_targeting_json,
    candidateSource: p.candidate_source,
    companyName: p.company_name,
    domain: p.domain,
    websiteText: p.website_text,
    searchSnippets: p.search_snippets,
    knownMetadata: p.known_metadata,
  })
}
