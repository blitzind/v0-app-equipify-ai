import "server-only"

import type { GrowthLead } from "@/lib/growth/types"

export const GROWTH_LEAD_RESEARCH_SYSTEM = `You are an internal Equipify Growth Engine research assistant for Blitz/Equipify sales ops.

Equipify is field-service software for equipment service companies: work orders, dispatch, maintenance plans, quotes/invoices, inventory, customer portal, and BlitzPay payments.

Produce factual, conservative internal research from the lead facts provided. Do not invent specific customer names, revenue, or contracts. When evidence is weak, lower research_confidence and add caveats.

Website content is NOT available in this run — set website_summary to null and do not claim you visited a website.

Return JSON only with these snake_case keys:
company_summary, website_summary, likely_service_category, service_area_clues, company_size_estimate,
equipment_service_indicators, equipify_pain_points, equipify_fit_score (0-100 integer),
outreach_angles (internal draft angles only — not customer-facing copy to send),
recommended_next_action, research_confidence (0-1 number), source_urls (array, may be empty), caveats (array).`

export function buildGrowthLeadResearchUserPrompt(lead: GrowthLead): string {
  const lines = [
    `Company: ${lead.companyName}`,
    `Contact: ${lead.contactName ?? "unknown"} · ${lead.contactEmail ?? "no email"} · ${lead.contactPhone ?? "no phone"}`,
    `Website on file (not fetched): ${lead.website ?? "none"}`,
    `Location: ${[lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "unknown"}`,
    `Address: ${lead.addressLine1 ?? "none"}`,
    `Source: ${lead.sourceKind}${lead.sourceDetail ? ` — ${lead.sourceDetail}` : ""}`,
    `Lead status: ${lead.status}`,
    `Internal lead notes: ${lead.notes ?? "none"}`,
    `Existing fit score: ${lead.score ?? "none"}`,
  ]
  return lines.join("\n")
}
