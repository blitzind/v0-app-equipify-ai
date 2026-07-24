/**
 * FUZOR-COMPANY-INTELLIGENCE-1A / GPT-FIRST-1A — Business understanding prompt.
 * No Equipify. No ICP. No sales fit.
 */

import type { FuzorCompanyIntelligenceEvidencePacket } from "@/lib/growth/company-intelligence/gpt-business-understanding/fuzor-company-intelligence-types"

export function buildFuzorCompanyIntelligenceSystemPrompt(): string {
  return [
    "You help another AI employee understand a company well enough to make informed business decisions.",
    "",
    "Your objective is business comprehension — how the company operates, what it sells or delivers, who it serves, and how work likely flows day to day.",
    "This is not a homepage summary exercise. Synthesize understanding from all supplied evidence.",
    "",
    "Use only the supplied evidence.",
    "Do not invent facts.",
    "When evidence is incomplete, determine what the available evidence does support, then list genuine unknowns separately.",
    "Do not treat empty verified fields as proof that nothing is known if website excerpts, descriptions, or other sections contain usable information.",
    "",
    "Do not recommend software.",
    "Do not mention Equipify.",
    "Do not determine ICP fit or sales suitability.",
    "Do not output confidence percentages, maturity scores, fit scores, or probabilities.",
    "",
    "Return JSON matching the required schema exactly.",
  ].join("\n")
}

export function buildFuzorCompanyIntelligenceUserPrompt(
  packet: FuzorCompanyIntelligenceEvidencePacket,
): string {
  return [
    "Understand this company well enough that another AI employee could make informed business decisions about them.",
    "",
    "Here is the evidence currently available.",
    "Use it as appropriate. Stop when you honestly believe you understand the business from what is supplied, or when you cannot make further meaningful progress without new evidence.",
    "",
    "COMPANY",
    JSON.stringify(
      {
        name: packet.companyName,
        website: packet.website,
        linkedinCompanyUrl: packet.linkedinCompanyUrl,
      },
      null,
      2,
    ),
    "",
    "VERIFIED DESCRIPTION",
    packet.verifiedDescription ?? "(none)",
    "",
    "VERIFIED OFFERINGS",
    JSON.stringify(packet.verifiedOfferings, null, 2),
    "",
    "VERIFIED INDUSTRIES",
    JSON.stringify(packet.verifiedIndustries, null, 2),
    "",
    "VERIFIED CUSTOMERS",
    JSON.stringify(packet.verifiedCustomers, null, 2),
    "",
    "VERIFIED MARKETS",
    JSON.stringify(packet.verifiedMarkets, null, 2),
    "",
    "VERIFIED DIFFERENTIATORS",
    JSON.stringify(packet.verifiedDifferentiators, null, 2),
    "",
    "VERIFIED TECHNOLOGY SIGNALS",
    JSON.stringify(packet.verifiedTechnologySignals, null, 2),
    "",
    "VERIFIED HIRING SIGNALS",
    JSON.stringify(packet.verifiedHiringSignals, null, 2),
    "",
    "WEBSITE EXCERPTS",
    JSON.stringify(packet.websiteExcerpts, null, 2),
    "",
    "PAGES OBSERVED",
    JSON.stringify(packet.pagesObserved, null, 2),
    "",
    "DATAMOON FINDINGS",
    JSON.stringify(packet.datamoonFindings, null, 2),
    "",
    "PRIOR RESEARCH NOTES (may contain legacy tooling language — treat as secondary)",
    packet.priorResearchNotes ?? "(none)",
    "",
    "MISSING FROM COLLECTION",
    JSON.stringify(packet.missingFromCollection, null, 2),
    "",
    "Respond with JSON only.",
  ].join("\n")
}
