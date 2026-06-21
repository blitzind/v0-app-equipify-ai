/** GS-AI-PLAYBOOK-2D/2E/3A — Deterministic channel assembly rules (client-safe). */

import type { GrowthPlaybookPromptChannel } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"
import type {
  GrowthPlaybookOptimizationChannel,
  GrowthPlaybookPromptSectionKey,
  GrowthPlaybookPromptSectionPriority,
} from "@/lib/growth/playbooks/prompt-optimization/growth-playbook-prompt-optimization-types"

export const GROWTH_PLAYBOOK_PROMPT_SECTION_PRIORITIES: Record<
  GrowthPlaybookPromptSectionKey,
  GrowthPlaybookPromptSectionPriority
> = {
  verified_company_facts: "CRITICAL",
  verified_company_summary: "IMPORTANT",
  verified_operational_signals: "IMPORTANT",
  verified_growth_signals: "OPTIONAL",
  verified_technology_signals: "OPTIONAL",
  verified_customer_signals: "OPTIONAL",
  verified_differentiators: "OPTIONAL",
  narrative_direction: "CRITICAL",
  recommended_tone: "CRITICAL",
  cta_guidance: "CRITICAL",
  context_weighting: "CRITICAL",
  preferred_cta: "CRITICAL",
  buyer_persona_framework: "IMPORTANT",
  recommended_language: "IMPORTANT",
  preferred_proof: "IMPORTANT",
  topics_to_avoid: "IMPORTANT",
  buyer_persona: "IMPORTANT",
  proof_points: "IMPORTANT",
  objection_awareness: "IMPORTANT",
  industry_intelligence: "OPTIONAL",
  emphasize: "OPTIONAL",
  avoid: "OPTIONAL",
}

/** Trim order when budget exceeded — lowest priority removed first. */
export const GROWTH_PLAYBOOK_PROMPT_TRIM_ORDER: GrowthPlaybookPromptSectionKey[] = [
  "avoid",
  "emphasize",
  "verified_differentiators",
  "verified_customer_signals",
  "verified_technology_signals",
  "verified_growth_signals",
  "industry_intelligence",
  "objection_awareness",
  "proof_points",
  "buyer_persona",
  "buyer_persona_framework",
  "preferred_proof",
  "topics_to_avoid",
  "recommended_language",
  "verified_operational_signals",
]

export const GROWTH_PLAYBOOK_PROMPT_NEVER_TRIM: GrowthPlaybookPromptSectionKey[] = [
  "verified_company_facts",
  "narrative_direction",
  "recommended_tone",
  "cta_guidance",
  "context_weighting",
  "preferred_cta",
]

type ChannelRule = {
  include: GrowthPlaybookPromptSectionKey[]
  omitByDefault: GrowthPlaybookPromptSectionKey[]
  industryMaxLines: number | null
  objectionMaxItems: number | null
}

export const GROWTH_PLAYBOOK_CHANNEL_RULES: Record<GrowthPlaybookOptimizationChannel, ChannelRule> = {
  SMS: {
    include: [
      "verified_company_facts",
      "verified_company_summary",
      "narrative_direction",
      "recommended_language",
      "preferred_cta",
      "topics_to_avoid",
      "context_weighting",
    ],
    omitByDefault: [
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "industry_intelligence",
      "buyer_persona_framework",
      "preferred_proof",
      "proof_points",
      "objection_awareness",
      "emphasize",
      "avoid",
      "buyer_persona",
      "recommended_tone",
      "cta_guidance",
    ],
    industryMaxLines: 0,
    objectionMaxItems: 0,
  },
  VOICE: {
    include: [
      "verified_company_facts",
      "narrative_direction",
      "buyer_persona_framework",
      "recommended_language",
      "preferred_proof",
      "preferred_cta",
      "context_weighting",
      "recommended_tone",
    ],
    omitByDefault: [
      "verified_company_summary",
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "emphasize",
      "avoid",
      "buyer_persona",
      "topics_to_avoid",
      "proof_points",
      "cta_guidance",
      "objection_awareness",
    ],
    industryMaxLines: 2,
    objectionMaxItems: 0,
  },
  EMAIL: {
    include: [
      "verified_company_facts",
      "verified_company_summary",
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "industry_intelligence",
      "narrative_direction",
      "buyer_persona_framework",
      "recommended_language",
      "preferred_proof",
      "preferred_cta",
      "topics_to_avoid",
      "recommended_tone",
      "proof_points",
      "objection_awareness",
      "cta_guidance",
      "context_weighting",
    ],
    omitByDefault: ["emphasize", "avoid", "buyer_persona"],
    industryMaxLines: 3,
    objectionMaxItems: 3,
  },
  SHARE_PAGE: {
    include: [
      "verified_company_facts",
      "verified_company_summary",
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "industry_intelligence",
      "narrative_direction",
      "buyer_persona_framework",
      "recommended_language",
      "preferred_proof",
      "preferred_cta",
      "topics_to_avoid",
      "proof_points",
      "emphasize",
      "avoid",
      "cta_guidance",
      "context_weighting",
      "recommended_tone",
    ],
    omitByDefault: ["buyer_persona"],
    industryMaxLines: null,
    objectionMaxItems: 3,
  },
  COPILOT: {
    include: [
      "verified_company_facts",
      "verified_company_summary",
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "industry_intelligence",
      "narrative_direction",
      "buyer_persona_framework",
      "recommended_language",
      "preferred_proof",
      "preferred_cta",
      "topics_to_avoid",
      "recommended_tone",
      "proof_points",
      "cta_guidance",
      "objection_awareness",
      "context_weighting",
      "emphasize",
      "avoid",
    ],
    omitByDefault: ["buyer_persona"],
    industryMaxLines: null,
    objectionMaxItems: null,
  },
  REFINEMENT: {
    include: [
      "verified_company_facts",
      "verified_company_summary",
      "verified_operational_signals",
      "verified_growth_signals",
      "verified_technology_signals",
      "verified_customer_signals",
      "verified_differentiators",
      "industry_intelligence",
      "narrative_direction",
      "buyer_persona_framework",
      "recommended_language",
      "preferred_proof",
      "preferred_cta",
      "topics_to_avoid",
      "recommended_tone",
      "proof_points",
      "objection_awareness",
      "cta_guidance",
      "context_weighting",
      "emphasize",
      "avoid",
    ],
    omitByDefault: ["buyer_persona"],
    industryMaxLines: 5,
    objectionMaxItems: 3,
  },
}

const SECTION_HEADERS: Record<GrowthPlaybookPromptSectionKey, string> = {
  verified_company_facts: "=== Verified Company Facts ===",
  verified_company_summary: "=== Verified Company Summary ===",
  verified_operational_signals: "=== Verified Operational Signals ===",
  verified_growth_signals: "=== Verified Growth Signals ===",
  verified_technology_signals: "=== Verified Technology Signals ===",
  verified_customer_signals: "=== Verified Customer Signals ===",
  verified_differentiators: "=== Verified Differentiators ===",
  industry_intelligence: "=== Industry Intelligence (not verified for this company) ===",
  narrative_direction: "=== Narrative Direction ===",
  buyer_persona: "=== Buyer Persona ===",
  buyer_persona_framework: "=== Buyer Persona Framework ===",
  recommended_language: "=== Recommended Language ===",
  preferred_proof: "=== Preferred Proof ===",
  preferred_cta: "=== Preferred CTA ===",
  topics_to_avoid: "=== Topics To Avoid ===",
  recommended_tone: "=== Recommended Tone ===",
  proof_points: "=== Proof Points ===",
  cta_guidance: "=== CTA Guidance ===",
  objection_awareness: "=== Objection Awareness ===",
  context_weighting: "=== Context Weighting ===",
  emphasize: "=== Emphasize ===",
  avoid: "=== Avoid ===",
}

export const GROWTH_PLAYBOOK_ALL_PROMPT_SECTION_KEYS: GrowthPlaybookPromptSectionKey[] = [
  "verified_company_facts",
  "verified_company_summary",
  "verified_operational_signals",
  "verified_growth_signals",
  "verified_technology_signals",
  "verified_customer_signals",
  "verified_differentiators",
  "industry_intelligence",
  "narrative_direction",
  "buyer_persona_framework",
  "recommended_language",
  "preferred_proof",
  "preferred_cta",
  "topics_to_avoid",
  "buyer_persona",
  "recommended_tone",
  "proof_points",
  "cta_guidance",
  "objection_awareness",
  "context_weighting",
  "emphasize",
  "avoid",
]

export function mapLegacyPromptChannelToOptimizationChannel(
  channel: GrowthPlaybookPromptChannel,
): GrowthPlaybookOptimizationChannel {
  switch (channel) {
    case "sms":
      return "SMS"
    case "voice":
      return "VOICE"
    case "page":
      return "SHARE_PAGE"
    case "copilot":
      return "COPILOT"
    case "email":
    default:
      return "EMAIL"
  }
}

export function formatOrchestratedSectionBlock(
  key: GrowthPlaybookPromptSectionKey,
  body: string,
): string {
  return `${SECTION_HEADERS[key]}\n${body}`
}

export function capIndustryIntelligence(content: string, maxLines: number | null): string {
  if (maxLines === null) return content
  if (maxLines <= 0) return "- Omitted for channel budget — use narrative direction only."
  const lines = content.split("\n").filter((line) => line.trim())
  if (lines.length <= maxLines) return content
  return [...lines.slice(0, maxLines), `- (+${lines.length - maxLines} industry lines omitted for channel budget)`].join(
    "\n",
  )
}

export function capObjectionAwareness(content: string, maxItems: number | null): string {
  if (maxItems === null) return content
  if (maxItems <= 0) return "- No structured objections for this channel."
  const lines = content.split("\n").filter((line) => line.trim())
  if (lines.length <= maxItems) return content
  return [...lines.slice(0, maxItems), `- (+${lines.length - maxItems} objections omitted for channel budget)`].join(
    "\n",
  )
}
