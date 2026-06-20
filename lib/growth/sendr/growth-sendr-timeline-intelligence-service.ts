import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById, updateGrowthLead } from "@/lib/growth/lead-repository"
import {
  GROWTH_SENDR_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import {
  computeSendrLeadIntentFromEvents,
  loadSendrEngagementEventsForLead,
} from "@/lib/growth/sendr/growth-sendr-engagement-intelligence-service"
import { consumeSendrBudget } from "@/lib/growth/sendr/growth-sendr-guardrails"
import { generateSendrRecommendations } from "@/lib/growth/sendr/growth-sendr-recommendation-service"
import type { GrowthSendrLeadIntelligenceMetadata } from "@/lib/growth/sendr/growth-sendr-types"
import { isRuntimeKillSwitchEnabled } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

export async function syncSendrLeadTimelineIntelligence(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
  },
): Promise<GrowthSendrLeadIntelligenceMetadata | null> {
  const enabled = await isRuntimeKillSwitchEnabled(admin, "sendr_intelligence_enabled")
  if (!enabled) return null

  const budget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "sendr_intelligence",
  })
  if (!budget.allowed) return null

  const timelineBudget = await consumeSendrBudget(admin, {
    organizationId: input.organizationId,
    resourceType: "sendr_timeline_updates",
  })
  if (!timelineBudget.allowed) return null

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const events = await loadSendrEngagementEventsForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })

  const computed = computeSendrLeadIntentFromEvents(events)
  const snapshot: GrowthSendrLeadIntelligenceMetadata = {
    intentScore: computed.intentScore,
    intentLevel: computed.intentLevel,
    lastSendrActivityAt: computed.lastSendrActivityAt,
    sendrEngagementCount: computed.sendrEngagementCount,
    lastUpdatedAt: new Date().toISOString(),
    qa_marker: GROWTH_SENDR_INTELLIGENCE_QA_MARKER,
  }

  try {
    const existingMetadata = lead.metadata ?? {}
    await updateGrowthLead(admin, input.leadId, {
      metadata: {
        ...existingMetadata,
        sendr_intelligence: snapshot,
      },
    })
  } catch {
    return null
  }

  return snapshot
}

export async function countSendrIntelligenceUpdatesToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("promoted_organization_id", organizationId)
    .gte("metadata->sendr_intelligence->>lastUpdatedAt", dayStart)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function buildSendrLeadIntelligenceView(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
  },
) {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return null

  const events = await loadSendrEngagementEventsForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
  })
  const computed = computeSendrLeadIntentFromEvents(events)
  const recommendationsEnabled = await isRuntimeKillSwitchEnabled(admin, "sendr_recommendations_enabled")
  const recommendations = recommendationsEnabled
    ? generateSendrRecommendations({
        intentScore: computed.intentScore,
        intentLevel: computed.intentLevel,
        signals: computed.signals,
        lastSendrActivityAt: computed.lastSendrActivityAt,
      })
    : []

  const latestPageId = events.find((e) => e.landing_page_id)?.landing_page_id ?? null
  let landingPageTitle: string | null = null
  if (latestPageId) {
    const { data } = await admin
      .schema("growth")
      .from("growth_landing_pages")
      .select("title")
      .eq("id", latestPageId)
      .maybeSingle()
    landingPageTitle = data ? String((data as { title: string }).title) : null
  }

  return {
    leadId: lead.id,
    contactName: lead.contactName,
    companyName: lead.companyName,
    landingPageId: latestPageId,
    landingPageTitle,
    intentScore: computed.intentScore,
    intentLevel: computed.intentLevel,
    lastSendrActivityAt: computed.lastSendrActivityAt,
    sendrEngagementCount: computed.sendrEngagementCount,
    recommendations,
  }
}
