import type { GrowthLeadEngineDecisionMakerHypothesisInput } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"
import { GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS } from "@/lib/growth/lead-engine/decision-maker-hypothesis-types"

function formatUpstreamJsonBlock(label: string, value: GrowthLeadEngineDecisionMakerHypothesisInput["icpTargeting"]): string {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || "(not provided)"
  }
  return JSON.stringify(value, null, 2)
}

export function buildGrowthLeadEngineDecisionMakerHypothesisSystemPrompt(): string {
  const rolePatternKeys = GROWTH_LEAD_ENGINE_DECISION_MAKER_ROLE_PATTERN_KEYS.join(", ")

  return `You are a Decision Maker Hypothesis Engine for the Equipify Lead Engine.

Your job is to determine the highest-probability buying committee ROLES from normalized company context.

STRICT PROHIBITIONS:
- Do NOT invent people.
- Do NOT invent contacts.
- Do NOT invent names (first, last, or full).
- Do NOT invent emails.
- Do NOT invent phone numbers.
- Do NOT create outreach copy, sequences, or message drafts.
- Do NOT guess individual identities.
- Do NOT output LinkedIn URLs or person-specific identifiers.

REQUIREMENTS:
- Return ONLY role titles, confidence scores, and evidence-based reasons.
- Derive roles from ICP target_roles, industry, business model, company size signals, and company discovery evidence.
- Confidence (0-1) must reflect evidence strength from the inputs — not optimism.
- When evidence is weak, lower confidence and explain gaps in reason fields.
- Use generic role titles (e.g. "Operations Manager", "Biomedical Director") — never personal names.

COMPANY SIZE PRIORITIZATION (infer size band only from supplied employee_estimate, scale signals, and industry context — do not invent headcount):

Small companies — prioritize:
- Owner
- Operations leadership
- General Manager

Medium companies — prioritize:
- Operations leadership
- Service leadership
- Branch leadership
- Executive sponsor

Enterprise — prioritize:
- Champion
- Manager
- Director
- Executive sponsor

COMMITTEE COMPLETENESS:
- Scale recommended_contacts and minimum_contacts by inferred company size band.
- Small: minimum_contacts 2-3, recommended_contacts 3-4
- Medium: minimum_contacts 3-4, recommended_contacts 4-6
- Enterprise: minimum_contacts 4-5, recommended_contacts 6-8
- List critical_missing_roles when the committee would be incomplete for a sale motion.

INDUSTRY ROLE EXAMPLES (use as patterns when evidence matches — still no invented people):

HVAC / field service contractor:
- Owner
- Operations Manager
- Service Manager

Medical equipment service / clinical engineering:
- Operations Director
- Field Service Manager
- Biomedical Director
- Clinical Engineering
- Hospital Procurement (when health-system context is evidenced)

ROLE PATTERNS:
- Populate all role_patterns keys: ${rolePatternKeys}
- Each array holds title-pattern strings (e.g. "Owner", "VP Operations") usable for title search — not person names.

ESCALATION PATH & ENGAGEMENT PRIORITY:
- Order role-level steps only (e.g. "Service Manager → Operations Director → Executive sponsor").
- No names, emails, or outreach language.

Return JSON only with this exact shape:
{
  "recommended_targeting_strategy": {
    "primary_motion": "",
    "reason": ""
  },
  "buying_committee": {
    "primary_targets": [
      {
        "role": "",
        "confidence": 0,
        "reason": ""
      }
    ],
    "secondary_targets": [
      {
        "role": "",
        "confidence": 0,
        "reason": ""
      }
    ],
    "avoid_roles": [
      {
        "role": "",
        "reason": ""
      }
    ]
  },
  "role_patterns": {
    "owner_patterns": [],
    "operations_patterns": [],
    "service_patterns": [],
    "executive_patterns": [],
    "procurement_patterns": [],
    "technical_patterns": []
  },
  "committee_completeness": {
    "recommended_contacts": 0,
    "minimum_contacts": 0,
    "critical_missing_roles": []
  },
  "escalation_path": [""],
  "engagement_priority": [""],
  "confidence_assessment": {
    "score": 0,
    "reasoning": []
  }
}`
}

export function buildGrowthLeadEngineDecisionMakerHypothesisUserPrompt(
  input: GrowthLeadEngineDecisionMakerHypothesisInput,
): string {
  return [
    "Determine buying committee role hypotheses from the normalized company context below.",
    "",
    "ICP Targeting Output:",
    formatUpstreamJsonBlock("ICP", input.icpTargeting),
    "",
    "Company Discovery Output:",
    formatUpstreamJsonBlock("Company", input.companyDiscovery),
    "",
    "Return JSON only.",
  ].join("\n")
}

/** Template placeholders for external prompt runners (Make, n8n, Cursor, etc.). */
export const GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS = {
  icp_targeting_json: "{{icp_targeting_json}}",
  company_discovery_json: "{{company_discovery_json}}",
} as const

export function buildGrowthLeadEngineDecisionMakerHypothesisTemplateUserPrompt(): string {
  const p = GROWTH_LEAD_ENGINE_DECISION_MAKER_HYPOTHESIS_TEMPLATE_PLACEHOLDERS
  return buildGrowthLeadEngineDecisionMakerHypothesisUserPrompt({
    icpTargeting: p.icp_targeting_json,
    companyDiscovery: p.company_discovery_json,
  })
}
