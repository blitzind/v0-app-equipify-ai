import "server-only"

import type { GrowthLead } from "@/lib/growth/types"
import { isGrowthResearchWebsiteEnabledEnv } from "@/lib/growth/research-website-config"
import type { GrowthLeadWebsiteFetchStatus } from "@/lib/growth/research-website-url"
import {
  buildGrowthProspectResearchOrganizationContextFallback,
  type GrowthProspectResearchOrganizationContext,
} from "@/lib/growth/research/growth-prospect-research-organization-context"
import {
  buildGrowthProspectResearchSystemPrompt,
  buildGrowthProspectResearchUserPrompt,
  type GrowthProspectResearchWebsitePromptContext,
} from "@/lib/growth/research/growth-prospect-research-prompt-builder"

export type GrowthLeadWebsitePromptContext = {
  fetchStatus: GrowthLeadWebsiteFetchStatus
  normalizedUrl: string | null
  excerpt: string | null
}

export function buildGrowthLeadResearchSystemPrompt(
  context: GrowthLeadWebsitePromptContext,
  organizationContext: GrowthProspectResearchOrganizationContext = buildGrowthProspectResearchOrganizationContextFallback(),
): string {
  const websiteContext: GrowthProspectResearchWebsitePromptContext = {
    ...context,
    websiteEnabled: isGrowthResearchWebsiteEnabledEnv(),
  }

  return buildGrowthProspectResearchSystemPrompt({
    websiteContext,
    organizationContext,
  })
}

export function buildGrowthLeadResearchUserPrompt(
  lead: GrowthLead,
  context: GrowthLeadWebsitePromptContext,
  organizationContext: GrowthProspectResearchOrganizationContext = buildGrowthProspectResearchOrganizationContextFallback(),
): string {
  const websiteContext: GrowthProspectResearchWebsitePromptContext = {
    ...context,
    websiteEnabled: isGrowthResearchWebsiteEnabledEnv(),
  }

  return buildGrowthProspectResearchUserPrompt({
    lead,
    websiteContext,
    organizationContext,
  })
}

/** @deprecated Use buildGrowthLeadResearchSystemPrompt — kept for imports during transition. */
export const GROWTH_LEAD_RESEARCH_SYSTEM = buildGrowthLeadResearchSystemPrompt({
  fetchStatus: "skipped",
  normalizedUrl: null,
  excerpt: null,
})
