import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LIMITS } from "@/lib/growth/sendr/growth-sendr-config"
import { resolveSendrAnalyticsDateRange } from "@/lib/growth/sendr/growth-sendr-analytics-date-range"
import { buildSendrLeadIntelligenceView } from "@/lib/growth/sendr/growth-sendr-timeline-intelligence-service"
import type {
  GrowthSendrAnalyticsDateRange,
  GrowthSendrAnalyticsProspectRow,
  GrowthSendrLeadIntelligenceMetadata,
} from "@/lib/growth/sendr/growth-sendr-types"

function isHighIntent(metadata: GrowthSendrLeadIntelligenceMetadata): boolean {
  return metadata.intentLevel === "high" || metadata.intentScore >= 50
}

export async function getSendrAnalyticsProspects(
  admin: SupabaseClient,
  input: {
    organizationId: string
    dateRange: GrowthSendrAnalyticsDateRange
    page?: number
    pageSize?: number
  },
): Promise<{
  items: GrowthSendrAnalyticsProspectRow[]
  total: number
  page: number
  pageSize: number
}> {
  const page = Math.max(1, input.page ?? 1)
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 100)
  const leadLimit = GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_LEADS

  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, metadata, first_name, last_name, company_name")
    .eq("promoted_organization_id", input.organizationId)
    .not("metadata->sendr_intelligence", "is", null)
    .order("updated_at", { ascending: false })
    .limit(leadLimit)

  if (error?.message?.includes("does not exist")) {
    return { items: [], total: 0, page, pageSize }
  }

  const rows: GrowthSendrAnalyticsProspectRow[] = []

  for (const row of data ?? []) {
    const typed = row as {
      id: string
      metadata: { sendr_intelligence?: GrowthSendrLeadIntelligenceMetadata }
      first_name: string | null
      last_name: string | null
      company_name: string | null
    }
    const intel = typed.metadata?.sendr_intelligence
    if (!intel || !isHighIntent(intel)) continue

    if (intel.lastSendrActivityAt) {
      const activityAt = new Date(intel.lastSendrActivityAt).getTime()
      const rangeStart = new Date(input.dateRange.startAt).getTime()
      const rangeEnd = new Date(input.dateRange.endAt).getTime()
      if (activityAt < rangeStart || activityAt > rangeEnd) continue
    }

    const view = await buildSendrLeadIntelligenceView(admin, {
      organizationId: input.organizationId,
      leadId: typed.id,
    })
    if (!view) continue

    rows.push({
      leadId: typed.id,
      contactName:
        [typed.first_name, typed.last_name].filter(Boolean).join(" ") ||
        view.contactName ||
        null,
      companyName: typed.company_name ?? view.companyName,
      intentScore: view.intentScore,
      intentLevel: view.intentLevel,
      lastActivityAt: view.lastSendrActivityAt,
      sendrPageViewed: view.landingPageTitle,
      sendrPageId: view.landingPageId,
      recommendation: view.recommendations[0]?.title ?? null,
    })
  }

  rows.sort((a, b) => b.intentScore - a.intentScore)
  const offset = (page - 1) * pageSize

  return {
    items: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    pageSize,
  }
}

export function parseSendrAnalyticsProspectsInput(searchParams: URLSearchParams) {
  return {
    dateRange: resolveSendrAnalyticsDateRange({
      preset: searchParams.get("dateRange"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    }),
    page: Number(searchParams.get("page") ?? "1"),
    pageSize: Number(searchParams.get("pageSize") ?? "25"),
  }
}
