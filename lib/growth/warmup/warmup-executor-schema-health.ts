import type { SupabaseClient } from "@supabase/supabase-js"

export const GROWTH_WARMUP_EXECUTOR_SCHEMA_MIGRATION =
  "20270925120000_growth_warmup_executor_1a.sql" as const

export async function isGrowthWarmupExecutorSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.schema("growth").from("warmup_recipients").select("id").limit(1)
  return !error
}

export async function probeGrowthWarmupExecutorTables(
  admin: SupabaseClient,
): Promise<{ recipients: boolean; send_runs: boolean; send_attempts: boolean }> {
  const probe = async (table: string) => {
    const { error } = await admin.schema("growth").from(table).select("id").limit(1)
    return !error
  }
  return {
    recipients: await probe("warmup_recipients"),
    send_runs: await probe("warmup_send_runs"),
    send_attempts: await probe("warmup_send_attempts"),
  }
}
