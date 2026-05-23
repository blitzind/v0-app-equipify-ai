import "server-only"

import type { GrowthLead } from "@/lib/growth/types"
import { isGrowthResearchWebsiteEnabledEnv } from "@/lib/growth/research-website-config"
import type { GrowthLeadWebsiteFetchStatus } from "@/lib/growth/research-website-url"

export type GrowthLeadWebsitePromptContext = {
  fetchStatus: GrowthLeadWebsiteFetchStatus
  normalizedUrl: string | null
  excerpt: string | null
}

export function buildGrowthLeadResearchSystemPrompt(context: GrowthLeadWebsitePromptContext): string {
  const websiteEnabled = isGrowthResearchWebsiteEnabledEnv()
  const hasExcerpt = Boolean(context.excerpt?.trim())

  const websiteInstructions = !websiteEnabled
    ? "Website fetching is disabled for this deployment — set website_summary to null and do not claim you visited a website."
    : hasExcerpt
      ? "A website text excerpt is provided below. Summarize only what the excerpt supports. Do not invent page content not present in the excerpt."
      : context.normalizedUrl && context.fetchStatus !== "skipped"
        ? `Website fetch failed (status: ${context.fetchStatus}). Set website_summary to null and note the fetch failure in caveats. Use lead fields only.`
        : "No website content was fetched — set website_summary to null and do not claim you visited a website."

  return `You are an internal Equipify Growth Engine research assistant for Blitz/Equipify sales ops.

Equipify is field-service software for equipment service companies: work orders, dispatch, maintenance plans, quotes/invoices, inventory, customer portal, and BlitzPay payments.

Produce factual, conservative internal research from the lead facts provided. Do not invent specific customer names, revenue, or contracts. When evidence is weak, lower research_confidence and add caveats.

${websiteInstructions}

Return JSON only with these snake_case keys:
company_summary, website_summary, likely_service_category, service_area_clues, company_size_estimate,
equipment_service_indicators, equipify_pain_points, equipify_fit_score (0-100 integer),
outreach_angles (internal draft angles only — not customer-facing copy to send),
recommended_next_action, research_confidence (0-1 number), source_urls (array, may be empty), caveats (array).`
}

export function buildGrowthLeadResearchUserPrompt(
  lead: GrowthLead,
  context: GrowthLeadWebsitePromptContext,
): string {
  const lines = [
    `Company: ${lead.companyName}`,
    `Contact: ${lead.contactName ?? "unknown"} · ${lead.contactEmail ?? "no email"} · ${lead.contactPhone ?? "no phone"}`,
    `Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "unknown"}`,
    `Address: ${lead.addressLine1 ?? "none"}`,
    `Source: ${lead.sourceKind}${lead.sourceDetail ? ` — ${lead.sourceDetail}` : ""}`,
    `Lead status: ${lead.status}`,
    `Internal lead notes: ${lead.notes ?? "none"}`,
    `Existing fit score: ${lead.score ?? "none"}`,
  ]

  if (context.excerpt?.trim()) {
    lines.push(
      `Website URL (fetched): ${context.normalizedUrl ?? lead.website ?? "unknown"}`,
      `Website fetch status: ${context.fetchStatus}`,
      "Website text excerpt:",
      '"""',
      context.excerpt.trim(),
      '"""',
    )
  } else if (context.normalizedUrl && context.fetchStatus !== "skipped") {
    lines.push(
      `Website URL (fetch failed): ${context.normalizedUrl}`,
      `Website fetch status: ${context.fetchStatus}`,
      "Use lead fields only for website_summary.",
    )
  } else {
    lines.push(`Website on file (not fetched): ${lead.website ?? "none"}`)
  }

  return lines.join("\n")
}

/** @deprecated Use buildGrowthLeadResearchSystemPrompt — kept for imports during transition. */
export const GROWTH_LEAD_RESEARCH_SYSTEM = buildGrowthLeadResearchSystemPrompt({
  fetchStatus: "skipped",
  normalizedUrl: null,
  excerpt: null,
})
