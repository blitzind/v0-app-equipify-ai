import "server-only"

import type { BusinessProfileInput } from "@/lib/growth/business-profile/business-profile-types"
import { resolveAiTeammatePresentation } from "@/lib/workspace/ai-teammate-identity"

export function buildBusinessProfileAiDraftSystemPrompt(teammateName?: string | null): string {
  const teammate = resolveAiTeammatePresentation(teammateName)
  return [
    `You are ${teammate.name}, an AI growth strategist for Equipify AI OS.`,
    "Draft a Business Profile JSON object for lead discovery and revenue recommendations.",
    "Use operator inputs and any website context provided.",
    "Be specific but conservative — list assumptions and missing information the operator should confirm.",
    "Never approve the profile; output draft content only.",
    "Return JSON matching the requested schema exactly.",
  ].join("\n")
}

export function buildBusinessProfileAiDraftUserPrompt(input: {
  companyInput: BusinessProfileInput
  websiteContextSummary: string | null
  teammateName?: string | null
}): string {
  const { companyInput, websiteContextSummary } = input
  const teammate = resolveAiTeammatePresentation(input.teammateName)
  const lines = [
    "Create a Business Profile draft with these sections:",
    "- company: shortDescription, productsServices[], businessModel, primaryValueProposition",
    "- idealCustomers: targetIndustries[], companySizeRanges[], geography[], buyerPersonas[], disqualifiers[]",
    "- problemsAndTriggers: painPoints[], buyingTriggers[], competitorsAlternatives[], keywords[], negativeKeywords[]",
    "- salesAndMarketing: averageDealSize, salesCycleEstimate, messagingAngles[], qualificationCriteria[]",
    "- confidence: score (0-1), assumptions[], missingInformation[]",
    "",
    "Operator inputs:",
    `companyName: ${companyInput.companyName}`,
    `website: ${companyInput.website}`,
  ]

  if (companyInput.notes) lines.push(`notes: ${companyInput.notes}`)
  if (companyInput.whatTheySell) lines.push(`productsOrServices: ${companyInput.whatTheySell}`)
  if (companyInput.whoTheySellTo) lines.push(`currentCustomers: ${companyInput.whoTheySellTo}`)
  if (companyInput.geography) lines.push(`geography: ${companyInput.geography}`)
  if (companyInput.averageDealSize) lines.push(`averageDealSize: ${companyInput.averageDealSize}`)

  if (websiteContextSummary) {
    lines.push("", "Website homepage context (summarized, may be incomplete):", websiteContextSummary)
  } else {
    lines.push("", "Website homepage context: unavailable — infer cautiously from operator inputs.")
  }

  lines.push(
    "",
    "Requirements:",
    "- confidence.assumptions must explain what you inferred vs. what was explicit.",
    `- confidence.missingInformation should list gaps ${teammate.name} wants the operator to confirm.`,
    "- Do not invent precise financial metrics unless provided.",
  )

  return lines.join("\n")
}
