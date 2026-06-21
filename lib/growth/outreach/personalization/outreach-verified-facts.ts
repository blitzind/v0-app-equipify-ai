/** GS-AI-PLAYBOOK-1C — Verified company facts extraction for outreach (client-safe). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((entry) => entry.trim()).filter(Boolean))]
}

export function buildOutreachVerifiedFactsFromPacket(packet: OutreachContextPacket): string[] {
  const facts: string[] = []
  if (packet.companySummary) facts.push(packet.companySummary)
  if (packet.websiteSummary) facts.push(packet.websiteSummary)
  facts.push(...packet.websiteFindings)
  facts.push(...packet.equipmentServiceIndicators.map((entry) => `Service focus: ${entry}`))
  facts.push(...packet.outreachAngles.map((entry) => `Observed: ${entry}`))
  facts.push(...packet.enrichmentFindings)
  facts.push(...packet.hiringSignals.map((entry) => `Hiring signal: ${entry}`))
  if (packet.decisionMakerTitle) facts.push(`Contact role: ${packet.decisionMakerTitle}`)
  if (packet.websiteTextExcerpt) facts.push(`Site excerpt: ${packet.websiteTextExcerpt}`)
  return uniqueStrings(facts)
}
