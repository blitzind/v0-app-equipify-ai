import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER } from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase7-types"

export const GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_SCHEMA_PROBE_VERSION = "v1"

const REQUIRED_TABLES = [
  "multi_channel_activity_timeline_events",
  "channel_effectiveness_snapshots",
  "website_intent_correlation_snapshots",
] as const

export type GrowthMultichannelRevenueIntelligenceSchemaHealth = {
  qaMarker: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER
  probeVersion: typeof GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_SCHEMA_PROBE_VERSION
  ok: boolean
  tables: Record<(typeof REQUIRED_TABLES)[number], boolean>
  momentumColumnsExtended: boolean
  message: string
}

export async function probeGrowthMultichannelRevenueIntelligenceSchemaHealth(
  admin: SupabaseClient,
): Promise<GrowthMultichannelRevenueIntelligenceSchemaHealth> {
  const tables: Record<(typeof REQUIRED_TABLES)[number], boolean> = {
    multi_channel_activity_timeline_events: false,
    channel_effectiveness_snapshots: false,
    website_intent_correlation_snapshots: false,
  }

  for (const table of REQUIRED_TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    tables[table] = !error
  }

  let momentumColumnsExtended = false
  const { error: momentumError } = await admin
    .schema("growth")
    .from("buying_momentum_snapshots")
    .select("call_engagement_score, channel_mix")
    .limit(1)
  momentumColumnsExtended = !momentumError

  const ok = Object.values(tables).every(Boolean) && momentumColumnsExtended
  const message = ok
    ? "Multi-channel revenue intelligence schema healthy."
    : "Multi-channel revenue intelligence schema incomplete — apply migration 20270603120000 and reload PostgREST cache."

  return {
    qaMarker: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_QA_MARKER,
    probeVersion: GROWTH_MULTICHANNEL_REVENUE_INTELLIGENCE_SCHEMA_PROBE_VERSION,
    ok,
    tables,
    momentumColumnsExtended,
    message,
  }
}
