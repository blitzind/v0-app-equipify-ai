/** AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1B — Shared prospect research prompt builder (client-safe). */

import type { GrowthLead } from "@/lib/growth/types"
import type { GrowthLeadWebsiteFetchStatus } from "@/lib/growth/research-website-url"
import {
  GROWTH_PROSPECT_RESEARCH_AI_FIT_SCORE_KEY,
  GROWTH_PROSPECT_RESEARCH_AI_PAIN_POINTS_KEY,
  type GrowthProspectResearchOrganizationContext,
} from "@/lib/growth/research/growth-prospect-research-organization-context"

export type GrowthProspectResearchWebsitePromptContext = {
  fetchStatus: GrowthLeadWebsiteFetchStatus
  normalizedUrl: string | null
  excerpt: string | null
  websiteEnabled?: boolean
}

const RESEARCH_JSON_KEYS = [
  "company_summary",
  "website_summary",
  "likely_service_category",
  "service_area_clues",
  "company_size_estimate",
  "equipment_service_indicators",
  GROWTH_PROSPECT_RESEARCH_AI_PAIN_POINTS_KEY,
  GROWTH_PROSPECT_RESEARCH_AI_FIT_SCORE_KEY,
  "outreach_angles",
  "recommended_next_action",
  "research_confidence",
  "source_urls",
  "caveats",
  "decision_maker_candidates",
  "estimated_annual_revenue",
  "estimated_employee_count",
  "fleet_size_estimate",
  "crm_detected",
  "field_service_stack_detected",
] as const

function buildWebsiteInstructions(context: GrowthProspectResearchWebsitePromptContext): string {
  const websiteEnabled = context.websiteEnabled ?? true
  const hasExcerpt = Boolean(context.excerpt?.trim())

  if (!websiteEnabled) {
    return "Website fetching is disabled for this deployment — set website_summary to null and do not claim you visited a website."
  }
  if (hasExcerpt) {
    return "A website text excerpt is provided below. Summarize only what the excerpt supports. Do not invent page content not present in the excerpt."
  }
  if (context.normalizedUrl && context.fetchStatus !== "skipped") {
    return `Website fetch failed (status: ${context.fetchStatus}). Set website_summary to null and note the fetch failure in caveats. Use lead fields only.`
  }
  return "No website content was fetched — set website_summary to null and do not claim you visited a website."
}

function buildOrganizationContextBlock(
  organizationContext: GrowthProspectResearchOrganizationContext,
): string {
  if (organizationContext.source === "fallback_defaults") {
    return [
      "Organization seller context: unavailable — approved organization profile is not configured.",
      "Evaluate the prospect conservatively using lead facts only.",
      "Set organization_fit_score low when fit cannot be defended and explain uncertainty in caveats.",
      "Do not assume any specific vendor, product, or industry template.",
    ].join("\n")
  }

  const orgLabel = organizationContext.companyName?.trim() || "the selling organization"
  return [
    `Organization seller context for ${orgLabel} (approved business profile):`,
    JSON.stringify(
      {
        source: organizationContext.source,
        companyName: organizationContext.companyName,
        productsServices: organizationContext.productsServices,
        mission: organizationContext.mission,
        elevatorPitch: organizationContext.elevatorPitch,
        primaryValueProposition: organizationContext.primaryValueProposition,
        targetIndustries: organizationContext.targetIndustries,
        geography: organizationContext.geography,
        companySizeRanges: organizationContext.companySizeRanges,
        qualificationStandards: organizationContext.qualificationStandards,
        disqualifiers: organizationContext.disqualifiers,
        competitiveAdvantages: organizationContext.competitiveAdvantages,
        operationalProblemsSolved: organizationContext.operationalProblemsSolved,
        pricingPhilosophy: organizationContext.pricingPhilosophy,
      },
      null,
      2,
    ),
    `Evaluate prospect fit for ${orgLabel} only — not for any other vendor.`,
    "Use organization_fit_score (0-100) to express fit for this organization's offering and ICP.",
    "Use organization_pain_points for pains this organization's solution could address for the prospect.",
  ].join("\n")
}

export function buildGrowthProspectResearchSystemPrompt(input: {
  websiteContext: GrowthProspectResearchWebsitePromptContext
  organizationContext: GrowthProspectResearchOrganizationContext
}): string {
  const orgLabel = input.organizationContext.companyName?.trim() || "the selling organization"

  return [
    `You are an internal Growth Engine research assistant evaluating prospect fit for ${orgLabel}.`,
    buildOrganizationContextBlock(input.organizationContext),
    "Produce factual, conservative internal research from the lead facts and organization seller context provided.",
    "Do not invent specific customer names, revenue, or contracts.",
    "When evidence is weak, lower research_confidence and add caveats.",
    buildWebsiteInstructions(input.websiteContext),
    "",
    "Return JSON only with these snake_case keys:",
    `${RESEARCH_JSON_KEYS.join(", ")},`,
    "decision_maker_candidates (array of objects with full_name, title, email, phone, linkedin_url, confidence, evidence_excerpt — only when supported by excerpt/lead facts; may be empty),",
    "estimated_annual_revenue, estimated_employee_count, fleet_size_estimate, crm_detected, field_service_stack_detected (nullable strings; omit guesses).",
  ].join("\n")
}

export function buildGrowthProspectResearchUserPrompt(input: {
  lead: GrowthLead
  websiteContext: GrowthProspectResearchWebsitePromptContext
  organizationContext: GrowthProspectResearchOrganizationContext
}): string {
  const lines = [
    buildOrganizationContextBlock(input.organizationContext),
    "",
    `Company: ${input.lead.companyName}`,
    `Contact: ${input.lead.contactName ?? "unknown"} · ${input.lead.contactEmail ?? "no email"} · ${input.lead.contactPhone ?? "no phone"}`,
    `Location: ${[input.lead.city, input.lead.state, input.lead.country].filter(Boolean).join(", ") || "unknown"}`,
    `Address: ${input.lead.addressLine1 ?? "none"}`,
    `Source: ${input.lead.sourceKind}${input.lead.sourceDetail ? ` — ${input.lead.sourceDetail}` : ""}`,
    `Lead status: ${input.lead.status}`,
    `Internal lead notes: ${input.lead.notes ?? "none"}`,
    `Existing fit score: ${input.lead.score ?? "none"}`,
  ]

  if (input.websiteContext.excerpt?.trim()) {
    lines.push(
      `Website URL (fetched): ${input.websiteContext.normalizedUrl ?? input.lead.website ?? "unknown"}`,
      `Website fetch status: ${input.websiteContext.fetchStatus}`,
      "Website text excerpt:",
      '"""',
      input.websiteContext.excerpt.trim(),
      '"""',
    )
  } else if (input.websiteContext.normalizedUrl && input.websiteContext.fetchStatus !== "skipped") {
    lines.push(
      `Website URL (fetch failed): ${input.websiteContext.normalizedUrl}`,
      `Website fetch status: ${input.websiteContext.fetchStatus}`,
      "Use lead fields only for website_summary.",
    )
  } else {
    lines.push(`Website on file (not fetched): ${input.lead.website ?? "none"}`)
  }

  return lines.join("\n")
}

export function researchPromptContainsHardcodedEquipifyProductFraming(prompt: string): boolean {
  return (
    /Equipify is field-service software/i.test(prompt) ||
    /work orders, dispatch, maintenance plans, quotes\/invoices, inventory, customer portal, and BlitzPay payments/i.test(
      prompt,
    ) ||
    /internal Equipify Growth Engine research assistant for Blitz\/Equipify sales ops/i.test(prompt) ||
    /You are an internal Equipify Growth Engine research assistant\./i.test(prompt)
  )
}
