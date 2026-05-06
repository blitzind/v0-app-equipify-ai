import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { completeAiJob, failAiJob, sanitizeAiJobError } from "@/lib/ai/jobs/process-ai-job"
import { runOperationalAssistant } from "@/lib/ai/operational-assistants/run"
import { isOperationalAssistantId } from "@/lib/ai/operational-assistants/types"

/** Queued `ai_jobs.task` value — drained by `/api/cron/process-ai-jobs`. */
export const OPERATIONAL_ASSISTANT_REFRESH_TASK = "operational_assistant_refresh"

/**
 * Claims a queued operational-assistant job and persists structured results to `result_json`.
 */
export async function runOperationalAssistantRefreshJob(params: {
  svc: SupabaseClient
  organizationId: string
  jobId: string
}): Promise<void> {
  const { svc, organizationId, jobId } = params

  const { data: jobRow, error: loadErr } = await svc
    .from("ai_jobs")
    .select("id, organization_id, status, input_json")
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (loadErr || !jobRow) return
  const st = jobRow.status as string
  if (st !== "queued") return

  const now = new Date().toISOString()
  const { data: claimed, error: claimErr } = await svc
    .from("ai_jobs")
    .update({
      status: "processing",
      started_at: now,
      progress_percent: 6,
      current_step: "Running operational assistant…",
      error_message: null,
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("id, input_json")
    .maybeSingle()

  if (claimErr || !claimed) return

  const raw = claimed.input_json as Record<string, unknown>
  const assistantId = typeof raw.assistantId === "string" ? raw.assistantId : ""
  if (!isOperationalAssistantId(assistantId)) {
    await failAiJob(svc, jobId, "Invalid assistantId in job payload.")
    return
  }

  try {
    const result = await runOperationalAssistant(svc, organizationId, assistantId)
    if (!result.ok) {
      await failAiJob(svc, jobId, sanitizeAiJobError(result.error))
      return
    }
    await completeAiJob(svc, jobId, {
      assistantId,
      card: result.output as Record<string, unknown>,
      meta: {
        task: result.meta.task,
        model: result.meta.model,
        provider: result.meta.provider,
        cacheHit: result.meta.cacheHit ?? false,
        durationMs: result.meta.durationMs,
      },
    })
  } catch (e) {
    await failAiJob(svc, jobId, sanitizeAiJobError(e))
  }
}
