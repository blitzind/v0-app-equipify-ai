import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AiJobInsert } from "@/lib/ai/jobs/types"
import { toSafeAiJobPayload } from "@/lib/ai/redaction"

/** Insert a queued job row (use service role client from API routes). */
export async function insertQueuedAiJob(
  svc: SupabaseClient,
  params: AiJobInsert,
): Promise<{ jobId: string } | { error: string }> {
  const { data, error } = await svc
    .from("ai_jobs")
    .insert({
      organization_id: params.organization_id,
      created_by: params.created_by,
      task: params.task,
      status: params.status ?? "queued",
      input_json: toSafeAiJobPayload(params.input_json as Record<string, unknown>),
      progress_percent: 0,
      source_type: params.source_type ?? null,
      source_id: params.source_id ?? null,
    })
    .select("id")
    .single()

  if (error || !data?.id) {
    return { error: error?.message ?? "Could not create AI job." }
  }
  return { jobId: data.id as string }
}
