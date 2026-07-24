/**
 * AVA-SIMPLE-OUTREACH-2A — Lean prompt. Trust GPT to reason from evidence.
 */

import type { AvaDirectOutreachContext } from "@/lib/growth/ava-direct-outreach/ava-direct-outreach-types"

export function buildAvaDirectOutreachSystemPrompt(): string {
  return [
    "You are Ava, Growth Operator for Equipify.",
    "",
    "Below is everything we know about a company.",
    "Determine whether Equipify should pursue them.",
    "",
    "Think like an experienced field-service salesperson.",
    "Use only the supplied evidence.",
    "Do not fabricate facts.",
    "",
    "If the company is a good fit:",
    "• explain why",
    "• identify the strongest sales angle",
    "• identify the best contact role",
    "• write a concise first-touch email",
    "",
    "If the company is not a fit:",
    "Explain why.",
    "",
    "If evidence is missing:",
    "State what is missing.",
    "",
    "Return JSON matching the required schema exactly.",
  ].join("\n")
}

export function buildAvaDirectOutreachUserPrompt(context: AvaDirectOutreachContext): string {
  return [
    "Here is everything we know.",
    "",
    "COMPANY",
    JSON.stringify(context.company, null, 2),
    "",
    "DECISION MAKER",
    JSON.stringify(context.decisionMaker, null, 2),
    "",
    "VERIFIED COMPANY DESCRIPTION",
    context.verifiedCompanyDescription ?? "(none)",
    "",
    "VERIFIED PRODUCTS / SERVICES",
    JSON.stringify(context.verifiedProductsServices, null, 2),
    "",
    "VERIFIED OPERATIONAL CAPABILITIES",
    JSON.stringify(context.verifiedOperationalCapabilities, null, 2),
    "",
    "RESEARCH SUMMARY",
    context.researchSummary ?? "(none)",
    "",
    "RELEVANT WEBSITE EXCERPTS",
    JSON.stringify(context.relevantWebsiteExcerpts, null, 2),
    "",
    "DATAMOON FINDINGS",
    JSON.stringify(context.datamoonFindings, null, 2),
    "",
    "KNOWN RISKS",
    JSON.stringify(context.knownRisks, null, 2),
    "",
    "MISSING INFORMATION",
    JSON.stringify(context.missingInformation, null, 2),
    "",
    "EQUIPIFY BUSINESS PROFILE",
    JSON.stringify(context.equipifyBusinessProfile, null, 2),
    "",
    "Respond with JSON only.",
  ].join("\n")
}
