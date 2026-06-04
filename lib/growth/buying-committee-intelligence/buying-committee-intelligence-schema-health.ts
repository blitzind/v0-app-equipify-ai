import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-types"
import { GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_MIGRATION } from "@/lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"

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

export async function isGrowthBuyingCommitteeIntelligenceRuntimeSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  if (!(await isGrowthBuyingCommitteeIntelligenceSchemaReady(admin))) return false
  const { error } = await admin.schema("growth").from("buying_committee_jobs").select("id").limit(1)
  return !error
}

export function formatBuyingCommitteeIntelligenceSchemaHealthNotice(): string | null {
  return `Apply migration ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION} for buying committee intelligence (7.7A).`
}

export function formatBuyingCommitteeIntelligenceRuntimeSchemaHealthNotice(): string | null {
  return `Apply migrations ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MIGRATION} and ${GROWTH_BUYING_COMMITTEE_INTELLIGENCE_JOB_MIGRATION} for buying committee runtime (7.7B).`
}
