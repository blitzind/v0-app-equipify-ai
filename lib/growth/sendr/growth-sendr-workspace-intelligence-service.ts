import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthSendrLandingPages } from "@/lib/growth/sendr/growth-sendr-landing-page-repository"
import { computeSendrPageEngagementIntelligence } from "@/lib/growth/sendr/growth-sendr-engagement-intelligence-service"
import { generateSendrPageAttentionRecommendations } from "@/lib/growth/sendr/growth-sendr-recommendation-service"
import { buildSendrLeadIntelligenceView } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import type { GrowthSendrWorkspaceIntelligence } from "@/lib/growth/sendr/growth-sendr-types"
import { consumeSendrBudget } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export async function getGrowthSendrWorkspaceIntelligence(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthSendrWorkspaceIntelligence> {
  const fallback: GrowthSendrWorkspaceIntelligence = {
    topPerformingPages: [],
    highIntentProspects: [],
    pagesNeedingAttention: [],
  }

  const enabled = await isRuntimeKillSwitchEnabled(admin, "sendr_intelligence_enabled")
  if (!enabled) return fallback

  const budget = await consumeSendrBudget(admin, {
    organizationId,
    resourceType: "sendr_intelligence",
  })
  if (!budget.allowed) return fallback

  const { items: pages } = await listGrowthSendrLandingPages(admin, {
    organizationId,
    limit: 20,
  })

  const pageIntel = []
  for (const page of pages.slice(0, 10)) {
    const intel = await computeSendrPageEngagementIntelligence(admin, {
      organizationId,
      landingPageId: page.id,
    })
    if (intel) pageIntel.push(intel)
  }

  pageIntel.sort((a, b) => b.pageViews - a.pageViews)

  const pagesNeedingAttention = pageIntel
    .map((page) => {
      const attention = generateSendrPageAttentionRecommendations({
        pageViews: page.pageViews,
        ctaRate: page.ctaRate,
        bookingRate: page.bookingRate,
        title: page.title,
      })
      if (!attention) return null
      return { ...page, attentionReason: attention.attentionReason }
    })
    .filter(Boolean) as GrowthSendrWorkspaceIntelligence["pagesNeedingAttention"]

  const { data: leadPages } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("lead_id")
    .eq("organization_id", organizationId)
    .not("lead_id", "is", null)
    .is("deleted_at", null)
    .limit(50)

  const leadIds = [...new Set((leadPages ?? []).map((r) => String((r as { lead_id: string }).lead_id)))].slice(
    0,
    20,
  )

  const highIntentProspects = []
  for (const leadId of leadIds) {
    const view = await buildSendrLeadIntelligenceView(admin, { organizationId, leadId })
    if (!view || view.sendrEngagementCount === 0) continue
    if (view.intentLevel === "high" || view.intentScore >= 50) {
      highIntentProspects.push(view)
    }
  }

  highIntentProspects.sort((a, b) => b.intentScore - a.intentScore)

  if (await isRuntimeKillSwitchEnabled(admin, "sendr_recommendations_enabled")) {
    await consumeSendrBudget(admin, {
      organizationId,
      resourceType: "sendr_recommendations",
      volume: highIntentProspects.length + pagesNeedingAttention.length,
    })
  }

  return {
    topPerformingPages: pageIntel.slice(0, 5),
    highIntentProspects: highIntentProspects.slice(0, 5),
    pagesNeedingAttention: pagesNeedingAttention.slice(0, 5),
  }
}
