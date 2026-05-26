import type { GrowthLeadEngineContactResearchInput } from "@/lib/growth/lead-engine/contact-research-types"
import { GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_CONFIDENCE_TIERS } from "@/lib/growth/lead-engine/contact-research-types"

function formatUpstreamJsonBlock(value: GrowthLeadEngineContactResearchInput["icpTargeting"]): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

function formatField(label: string, value: string): string {
  const trimmed = value.trim()
  return `${label}: ${trimmed || "(not provided)"}`
}

export function buildGrowthLeadEngineContactResearchSystemPrompt(): string {
  const tiers = GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_CONFIDENCE_TIERS

  return `You are a Contact Research Engine for the Equipify Lead Engine.

Your job is to extract candidate contacts ONLY when directly supported by the supplied evidence.

STRICT PROHIBITIONS:
- Do NOT invent people.
- Do NOT fabricate emails.
- Do NOT fabricate phone numbers.
- Do NOT infer or guess emails from name patterns (e.g. first.last@domain).
- Do NOT infer or guess phones from area codes or company main lines unless explicitly listed for that person.
- Do NOT hallucinate LinkedIn profiles or URLs.
- Do NOT claim Apollo, Seamless, PDL, Clay, or crawler results unless that data appears in Known Public Data or website text.
- Do NOT create outreach copy.

EVIDENCE REQUIREMENTS:
- Every contact_candidates entry MUST include at least one source_evidence item citing the exact snippet.
- Prefer evidence from: leadership pages, team pages, public bios, about pages, press releases, and structured public_data.
- If evidence is insufficient for any real person, return contact_candidates: [].
- Leave email, phone, or linkedin_url as "" when not explicitly stated in evidence — never fill with guesses.

CONFIDENCE SCALE (use these tiers consistently):
- ${tiers.direct} = direct evidence (name + title explicitly on page or in public_data)
- ${tiers.corroborated} = multiple corroborating sources for the same person
- ${tiers.weak} = weak or partial evidence (e.g. first name only on team page)
- ${tiers.unsupported} = do not include the candidate — omit instead of scoring 0

FIELD RULES:
- role_match_type: map to decision maker hypothesis roles (e.g. "primary", "secondary", "owner_pattern", "operations_pattern") when supported.
- email_confidence and phone_confidence: 0 when field is ""; otherwise match evidence tier for that field.
- confidence: overall person-level confidence from evidence tier.
- coverage.primary_roles_found / missing_roles: compare against decision_maker_hypothesis buying_committee roles.
- committee_completion: 0-100 percent of primary_targets roles with at least one evidenced candidate.
- research_quality.score: 0-100 reflecting evidence depth and committee coverage — not optimism.

FUTURE PROVIDERS (do not use unless data is present in inputs):
- Apollo, Seamless, People Data Labs, Clay, Lead Engine crawlers

Return JSON only with this exact shape:
{
  "contact_candidates": [
    {
      "full_name": "",
      "job_title": "",
      "department": "",
      "role_match_type": "",
      "email": "",
      "email_confidence": 0,
      "phone": "",
      "phone_confidence": 0,
      "linkedin_url": "",
      "source_evidence": [
        {
          "claim": "",
          "evidence": "",
          "source": ""
        }
      ],
      "confidence": 0
    }
  ],
  "coverage": {
    "primary_roles_found": [],
    "missing_roles": [],
    "committee_completion": 0
  },
  "research_quality": {
    "score": 0,
    "reasoning": []
  }
}`
}

export function buildGrowthLeadEngineContactResearchUserPrompt(
  input: GrowthLeadEngineContactResearchInput,
): string {
  return [
    "Extract evidenced contact candidates for this company using only the inputs below.",
    "",
    "ICP Targeting:",
    formatUpstreamJsonBlock(input.icpTargeting),
    "",
    "Company Discovery:",
    formatUpstreamJsonBlock(input.companyDiscovery),
    "",
    "Decision Maker Hypothesis:",
    formatUpstreamJsonBlock(input.decisionMakerHypothesis),
    "",
    formatField("Domain", input.domain),
    "",
    "Known Company Website Text:",
    input.websiteText.trim() ? input.websiteText.trim() : "(not provided)",
    "",
    "Known Public Data:",
    input.publicData.trim() ? input.publicData.trim() : "(not provided)",
    "",
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
  decision_maker_hypothesis_json: "{{decision_maker_hypothesis_json}}",
  domain: "{{domain}}",
  website_text: "{{website_text}}",
  public_data: "{{public_data}}",
} as const

export function buildGrowthLeadEngineContactResearchTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_CONTACT_RESEARCH_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineContactResearchUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
    decisionMakerHypothesis: p.decision_maker_hypothesis_json,
    domain: p.domain,
    websiteText: p.website_text,
    publicData: p.public_data,
  })
}
