/** Shared research evidence selection for openers and subjects (Phase 4.1 / 4.2). */

import type { OutreachContextPacket, ResearchOpenerSource } from "@/lib/growth/outreach/personalization/personalization-types"

export const RESEARCH_EVIDENCE_CONFIDENCE_MEDIUM = 45
export const RESEARCH_EVIDENCE_CONFIDENCE_HIGH = 60

export const RESEARCH_EVIDENCE_BANNED_PHRASES = [
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

export type ResearchEvidenceCandidate = {
  source: ResearchOpenerSource
  evidence: string
}

export function dedupeResearchFacts(facts: string[]): string[] {
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

export function isUsableResearchFact(fact: string, companyName: string): boolean {
  const trimmed = fact.trim()
  if (trimmed.length < 12) return false
  if (trimmed.toLowerCase() === companyName.toLowerCase()) return false
  for (const pattern of RESEARCH_EVIDENCE_BANNED_PHRASES) {
    if (pattern.test(trimmed)) return false
  }
  return true
}

export function truncateResearchSnippet(summary: string, max = 100): string {
  const trimmed = summary.trim().replace(/[.…]+$/, "")
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(" ")
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function buildIndustryContextFact(packet: OutreachContextPacket): string | null {
  if (packet.hiringSignals[0] && isUsableResearchFact(packet.hiringSignals[0], packet.companyName)) {
    return packet.hiringSignals[0]
  }

  if (packet.equipmentServiceIndicators[0]) {
    const indicator = packet.equipmentServiceIndicators[0]
    if (isUsableResearchFact(indicator, packet.companyName)) {
      return packet.location ? `${indicator} in ${packet.location}` : indicator
    }
  }

  if (packet.industryLabel && packet.location) {
    const label = `${packet.industryLabel} operator in ${packet.location}`
    if (isUsableResearchFact(label, packet.companyName)) return label
  }

  return null
}

export function resolveResearchEvidenceConfidenceTier(
  researchConfidence: number | null,
): "high" | "medium" | null {
  if (researchConfidence == null) return null
  if (researchConfidence >= RESEARCH_EVIDENCE_CONFIDENCE_HIGH) return "high"
  if (researchConfidence >= RESEARCH_EVIDENCE_CONFIDENCE_MEDIUM) return "medium"
  return null
}

export function selectResearchEvidenceCandidate(
  packet: OutreachContextPacket,
  confidenceTier: "high" | "medium",
): ResearchEvidenceCandidate | null {
  const company = packet.companyName.trim()

  if (packet.websiteSummary) {
    const summary = truncateResearchSnippet(packet.websiteSummary)
    if (isUsableResearchFact(summary, company)) {
      return { source: "website_summary", evidence: summary }
    }
  }

  for (const fact of dedupeResearchFacts(packet.websiteFindings)) {
    if (isUsableResearchFact(fact, company)) return { source: "website_finding", evidence: fact }
  }

  for (const fact of dedupeResearchFacts(packet.outreachAngles)) {
    if (isUsableResearchFact(fact, company)) return { source: "outreach_angle", evidence: fact }
  }

  if (packet.leadEngineGuidance) {
    for (const fact of dedupeResearchFacts(packet.leadEngineGuidance.prioritizedOutreachAngles)) {
      if (isUsableResearchFact(fact, company)) return { source: "lead_engine_angle", evidence: fact }
    }
    for (const fact of dedupeResearchFacts(packet.leadEngineGuidance.prioritizedPainPoints)) {
      if (isUsableResearchFact(fact, company)) return { source: "lead_engine_pain", evidence: fact }
    }
  }

  for (const fact of dedupeResearchFacts(packet.researchPainPoints)) {
    if (isUsableResearchFact(fact, company)) return { source: "research_pain_point", evidence: fact }
  }

  if (confidenceTier === "high") {
    if (packet.companySummary) {
      const summary = truncateResearchSnippet(packet.companySummary)
      if (isUsableResearchFact(summary, company)) {
        return { source: "company_summary", evidence: summary }
      }
    }

    const industryFact = buildIndustryContextFact(packet)
    if (industryFact) return { source: "industry_context", evidence: industryFact }
  }

  return null
}
