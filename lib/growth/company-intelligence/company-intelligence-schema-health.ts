import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_COMPANY_INTELLIGENCE_MIGRATION } from "@/lib/growth/company-intelligence/company-intelligence-types"

const REQUIRED_TABLES = [
  "company_intelligence_runs",
  "company_intelligence_evidence",
  "company_intelligence_snapshots",
] as const

export async function isGrowthCompanyIntelligenceSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  for (const table of REQUIRED_TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) return false
  }
  return true
}

export function growthCompanyIntelligenceSchemaNotReadyMessage(): string {
  return `Apply migration ${GROWTH_COMPANY_INTELLIGENCE_MIGRATION} first.`
}
