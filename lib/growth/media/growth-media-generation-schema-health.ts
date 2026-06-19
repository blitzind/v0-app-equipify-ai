import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_MEDIA_GENERATION_JOBS_MIGRATION } from "@/lib/growth/media/growth-media-generation-types"

const MEDIA_GENERATION_RUN_COLUMNS = [
  "id",
  "organization_id",
  "ai_job_id",
  "generation_type",
  "provider",
  "status",
  "progress_percent",
  "input_json",
  "output_json",
  "error_json",
  "retry_count",
  "started_at",
  "completed_at",
  "created_at",
  "updated_at",
] as const

export const GROWTH_MEDIA_GENERATION_SCHEMA_SETUP_MESSAGE =
  `Media generation runs table is not ready. Apply migration ${GROWTH_MEDIA_GENERATION_JOBS_MIGRATION}.`

export async function isGrowthMediaGenerationRunsSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .select(MEDIA_GENERATION_RUN_COLUMNS.join(", "))
    .limit(1)
  return !error
}

export async function probeGrowthMediaGenerationRunsSchema(admin: SupabaseClient): Promise<{
  media_generation_runs_ready: boolean
  error: string | null
}> {
  const ready = await isGrowthMediaGenerationRunsSchemaReady(admin)
  if (ready) return { media_generation_runs_ready: true, error: null }

  const { error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .select("id")
    .limit(1)

  return {
    media_generation_runs_ready: false,
    error: error?.message ?? GROWTH_MEDIA_GENERATION_SCHEMA_SETUP_MESSAGE,
  }
}
