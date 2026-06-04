/** Research-backed cold email opener selection (Growth Engine Phase 4.2). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import {
  interpolateBlockText,
  OUTREACH_MESSAGE_BLOCK_LIBRARY,
} from "@/lib/growth/outreach/personalization/message-blocks"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import type { OutreachContextPacket, ResearchOpenerSource } from "@/lib/growth/outreach/personalization/personalization-types"

export const RESEARCH_OPENER_CONFIDENCE_MEDIUM = 45
export const RESEARCH_OPENER_CONFIDENCE_HIGH = 60

export const RESEARCH_OPENER_BANNED_PHRASES = [
  /i noticed your website/i,
  /i came across your company/i,
  /i saw your website/i,
  /i reviewed your website/i,
  /your website shows/i,
  /your site mentions/i,
  /according to your website/i,
  /congrats on/i,
  /impressive growth/i,
  /world-class/i,
  /^website on file/i,
] as const

export type ResearchBackedOpenerSelection = {
  text: string
  source: ResearchOpenerSource
  evidence: string
  confidenceTier: "high" | "medium"
}

type ResearchCandidate = {
  source: ResearchOpenerSource
  evidence: string
}

function dedupeFacts(facts: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const fact of facts) {
    const key = fact.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push(fact.trim())
  }
  return result
}

function isUsableFact(fact: string, companyName: string): boolean {
  const trimmed = fact.trim()
  if (trimmed.length < 12) return false
  if (trimmed.toLowerCase() === companyName.toLowerCase()) return false
  for (const pattern of RESEARCH_OPENER_BANNED_PHRASES) {
    if (pattern.test(trimmed)) return false
  }
  return true
}

function truncateSummary(summary: string, max = 100): string {
  const trimmed = summary.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
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

function buildIndustryContextFact(packet: OutreachContextPacket): string | null {
  if (packet.hiringSignals[0] && isUsableFact(packet.hiringSignals[0], packet.companyName)) {
    return packet.hiringSignals[0]
  }

  if (packet.equipmentServiceIndicators[0]) {
    const indicator = packet.equipmentServiceIndicators[0]
    if (isUsableFact(indicator, packet.companyName)) {
      return packet.location ? `${indicator} in ${packet.location}` : indicator
    }
  }

  if (packet.industryLabel && packet.location) {
    const label = `${packet.industryLabel} operator in ${packet.location}`
    if (isUsableFact(label, packet.companyName)) return label
  }

  return null
}

function selectResearchCandidate(
  packet: OutreachContextPacket,
  confidenceTier: "high" | "medium",
): ResearchCandidate | null {
  const company = packet.companyName.trim()

  for (const fact of dedupeFacts(packet.websiteFindings)) {
    if (isUsableFact(fact, company)) return { source: "website_finding", evidence: fact }
  }

  for (const fact of dedupeFacts(packet.outreachAngles)) {
    if (isUsableFact(fact, company)) return { source: "outreach_angle", evidence: fact }
  }

  for (const fact of dedupeFacts(packet.researchPainPoints)) {
    if (isUsableFact(fact, company)) return { source: "research_pain_point", evidence: fact }
  }

  if (confidenceTier === "high") {
    if (packet.companySummary) {
      const summary = truncateSummary(packet.companySummary)
      if (isUsableFact(summary, company)) {
        return { source: "company_summary", evidence: summary }
      }
    }

    const industryFact = buildIndustryContextFact(packet)
    if (industryFact) return { source: "industry_context", evidence: industryFact }
  }

  return null
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
  candidate: ResearchCandidate
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

export function resolveResearchOpenerConfidenceTier(
  researchConfidence: number | null,
): "high" | "medium" | null {
  if (researchConfidence == null) return null
  if (researchConfidence >= RESEARCH_OPENER_CONFIDENCE_HIGH) return "high"
  if (researchConfidence >= RESEARCH_OPENER_CONFIDENCE_MEDIUM) return "medium"
  return null
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

  const confidenceTier = resolveResearchOpenerConfidenceTier(input.packet.researchConfidence)
  if (!confidenceTier) return null

  const candidate = selectResearchCandidate(input.packet, confidenceTier)
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
