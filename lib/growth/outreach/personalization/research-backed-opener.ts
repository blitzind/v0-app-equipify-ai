/** Research-backed cold email opener selection (Growth Engine Phase 4.2). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import {
  interpolateBlockText,
  OUTREACH_MESSAGE_BLOCK_LIBRARY,
} from "@/lib/growth/outreach/personalization/message-blocks"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import {
  isUsableResearchFact,
  resolveResearchEvidenceConfidenceTier,
  selectResearchEvidenceCandidate,
  truncateResearchSnippet,
  type ResearchEvidenceCandidate,
} from "@/lib/growth/outreach/personalization/research-evidence-selection"
import type { OutreachContextPacket, ResearchOpenerSource } from "@/lib/growth/outreach/personalization/personalization-types"

export {
  RESEARCH_EVIDENCE_CONFIDENCE_HIGH as RESEARCH_OPENER_CONFIDENCE_HIGH,
  RESEARCH_EVIDENCE_CONFIDENCE_MEDIUM as RESEARCH_OPENER_CONFIDENCE_MEDIUM,
  RESEARCH_EVIDENCE_BANNED_PHRASES as RESEARCH_OPENER_BANNED_PHRASES,
  resolveResearchEvidenceConfidenceTier as resolveResearchOpenerConfidenceTier,
  selectResearchEvidenceCandidate,
} from "@/lib/growth/outreach/personalization/research-evidence-selection"

export type ResearchBackedOpenerSelection = {
  text: string
  source: ResearchOpenerSource
  evidence: string
  confidenceTier: "high" | "medium"
}

function formatFactForEmbedding(fact: string, companyName: string): string {
  let cleaned = fact.trim().replace(/[.…]+$/, "")
  if (cleaned.toLowerCase().startsWith(companyName.toLowerCase())) {
    cleaned = cleaned.slice(companyName.length).trim().replace(/^[,\s—-]+/, "")
  }
  return cleaned
}

function lowercaseLeadIn(fact: string): string {
  if (!fact) return fact
  return fact.charAt(0).toLowerCase() + fact.slice(1)
}

const OPENER_TEMPLATES: Record<ResearchOpenerSource, string[]> = {
  website_finding: [
    "{{contactName}}, {{companyName}} {{fact}} — had one dispatch workflow question.",
    "Hi {{contactName}} — {{companyName}} {{fact}}; worth a quick ops compare?",
    "{{contactName}}, {{companyName}} {{fact}} — quick ops note.",
  ],
  outreach_angle: [
    "{{contactName}}, {{fact}} — one question for {{companyName}}.",
    "Hi {{contactName}} — {{fact}} at {{companyName}}; had a brief workflow question.",
    "{{contactName}}, {{fact}} for {{companyName}} — quick ops note.",
  ],
  research_pain_point: [
    "{{contactName}}, quick ops question for {{companyName}}: {{factLower}}.",
    "Hi {{contactName}} — {{companyName}} and {{factLower}}; had one focused note.",
    "{{contactName}}, one workflow question for {{companyName}} around {{factLower}}.",
  ],
  company_summary: [
    "{{contactName}}, {{companyName}} {{fact}} — quick ops question.",
    "Hi {{contactName}} — {{companyName}} {{fact}}; had one dispatch note.",
  ],
  industry_context: [
    "{{contactName}}, {{companyName}} {{fact}} — had one ops workflow question.",
    "Hi {{contactName}} — with {{companyName}} {{fact}}, had a brief dispatch question.",
  ],
}

function buildOpenerText(input: {
  candidate: ResearchEvidenceCandidate
  tokens: { companyName: string; contactName: string | null }
  variationSeed: string
}): string {
  const rawFact = formatFactForEmbedding(input.candidate.evidence, input.tokens.companyName)
  const embeddedFact =
    input.candidate.source === "website_finding" ||
    input.candidate.source === "company_summary" ||
    input.candidate.source === "industry_context"
      ? lowercaseLeadIn(rawFact)
      : rawFact
  const embeddedFactLower = lowercaseLeadIn(rawFact)

  const templates = OPENER_TEMPLATES[input.candidate.source]
  const templateIndex = pickVariantIndex(
    `${input.variationSeed}:research_opener:${input.candidate.source}`,
    templates.length,
  )
  const template = templates[templateIndex] ?? templates[0]!

  return interpolateBlockText(
    template.replaceAll("{{fact}}", embeddedFact).replaceAll("{{factLower}}", embeddedFactLower),
    input.tokens,
  )
}

export function shouldApplyResearchBackedOpener(input: {
  generationType: GrowthAiCopilotGenerationType
  openingBlockId: string
}): boolean {
  if (input.openingBlockId === "opening_follow_up") return false
  if (input.generationType === "breakup_email" || input.generationType === "response_draft") return false
  if (
    input.generationType === "follow_up_email" ||
    input.generationType === "reengagement_email" ||
    input.generationType === "next_message"
  ) {
    return false
  }
  return input.generationType === "cold_email" || input.generationType === "executive_email"
}

export function buildResearchBackedOpener(input: {
  packet: OutreachContextPacket
  generationType: GrowthAiCopilotGenerationType
  openingBlockId: string
  variationSeed: string
  tokens: { companyName: string; contactName: string | null }
}): ResearchBackedOpenerSelection | null {
  if (!shouldApplyResearchBackedOpener(input)) return null

  const confidenceTier = resolveResearchEvidenceConfidenceTier(input.packet.researchConfidence)
  if (!confidenceTier) return null

  const candidate = selectResearchEvidenceCandidate(input.packet, confidenceTier)
  if (!candidate) return null

  return {
    source: candidate.source,
    evidence: candidate.evidence,
    confidenceTier,
    text: buildOpenerText({
      candidate,
      tokens: input.tokens,
      variationSeed: input.variationSeed,
    }),
  }
}

export function buildGenericOpeningText(input: {
  openingBlockId: string
  variationSeed: string
  tokens: { companyName: string; contactName: string | null }
}): string {
  const templates = OUTREACH_MESSAGE_BLOCK_LIBRARY.opening
  const template = templates.find((entry) => entry.id === input.openingBlockId) ?? templates[0]!
  const variantIndex = pickVariantIndex(`${input.variationSeed}:opening:${template.id}`, template.variants.length)
  return interpolateBlockText(template.variants[variantIndex] ?? template.variants[0]!, input.tokens)
}

// Retained for tests that assert fact quality rules.
export function isUsableFact(fact: string, companyName: string): boolean {
  return isUsableResearchFact(fact, companyName)
}

export function truncateSummary(summary: string, max = 100): string {
  return truncateResearchSnippet(summary, max)
}
