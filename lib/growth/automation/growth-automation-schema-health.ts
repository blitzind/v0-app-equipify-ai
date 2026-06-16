import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUTOMATION_BUILDER_MIGRATION } from "@/lib/growth/automation/growth-automation-types"

const TABLES = [
  "automation_flows",
  "automation_flow_versions",
  "automation_nodes",
  "automation_edges",
  "automation_validation_results",
] as const

export async function isGrowthAutomationBuilderSchemaReady(admin: SupabaseClient): Promise<boolean> {
  for (const table of TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) return false
  }
  return true
}

export async function probeGrowthAutomationBuilderSchema(
  admin: SupabaseClient,
): Promise<{ ready: boolean; migration: string; missingTables: string[] }> {
  const missingTables: string[] = []
  for (const table of TABLES) {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    if (error) missingTables.push(table)
  }
  return {
    ready: missingTables.length === 0,
    migration: GROWTH_AUTOMATION_BUILDER_MIGRATION,
    missingTables,
  }
}
