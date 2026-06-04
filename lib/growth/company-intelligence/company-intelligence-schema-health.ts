import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_COMPANY_INTELLIGENCE_MIGRATION } from "@/lib/growth/company-intelligence/company-intelligence-types"
import { GROWTH_COMPANY_INTELLIGENCE_JOB_MIGRATION } from "@/lib/growth/company-intelligence/company-intelligence-runtime-types"

const FOUNDATION_TABLES = [
  "company_intelligence_runs",
  "company_intelligence_evidence",
  "company_intelligence_snapshots",
] as const

export async function isGrowthCompanyIntelligenceSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  for (const table of FOUNDATION_TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) return false
  }
  return true
}

export async function isGrowthCompanyIntelligenceRuntimeSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  if (!(await isGrowthCompanyIntelligenceSchemaReady(admin))) return false
  const { error } = await admin.schema("growth").from("company_intelligence_jobs").select("id").limit(1)
  return !error
}

export function growthCompanyIntelligenceSchemaNotReadyMessage(): string {
  return `Apply migration ${GROWTH_COMPANY_INTELLIGENCE_MIGRATION} first.`
}

export function growthCompanyIntelligenceRuntimeSchemaNotReadyMessage(): string {
  return `Apply migrations ${GROWTH_COMPANY_INTELLIGENCE_MIGRATION} and ${GROWTH_COMPANY_INTELLIGENCE_JOB_MIGRATION} first.`
}
