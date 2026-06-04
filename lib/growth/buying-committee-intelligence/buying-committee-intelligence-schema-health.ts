import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"

const TABLES = [
  "buying_committee_runs",
  "buying_committee_evidence",
  "buying_committee_intelligence_members",
] as const

export async function isGrowthBuyingCommitteeIntelligenceSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  for (const table of TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) return false
  }
  return true
}

export function formatBuyingCommitteeIntelligenceSchemaHealthNotice(): string | null {
  return `Apply migration ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION} for buying committee intelligence (7.7A).`
}
