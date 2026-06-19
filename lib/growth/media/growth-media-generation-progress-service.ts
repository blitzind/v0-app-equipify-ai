import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getMediaGenerationRunById,
  serializeMediaGenerationRunOutput,
  updateMediaGenerationRunRow,
} from "@/lib/growth/media/growth-media-generation-run-service"
import type {
  GrowthMediaGenerationProgressEvent,
  GrowthMediaGenerationRun,
  GrowthMediaGenerationRunOutput,
  GrowthMediaGenerationStatus,
} from "@/lib/growth/media/growth-media-generation-types"

const TERMINAL_STATUSES = new Set<GrowthMediaGenerationStatus>(["completed", "failed", "cancelled"])

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

async function syncAiJobProgress(
  admin: SupabaseClient,
  input: {
    aiJobId: string
    organizationId: string
    status: GrowthMediaGenerationStatus
    progressPercent: number
    errorMessage?: string | null
  },
): Promise<void> {
  const aiStatus =
    input.status === "preparing" || input.status === "processing"
      ? "processing"
      : input.status === "completed"
        ? "completed"
        : input.status === "failed"
          ? "failed"
          : input.status === "cancelled"
            ? "cancelled"
            : "queued"

  await admin
    .from("ai_jobs")
    .update({
      status: aiStatus,
      progress_percent: clampProgress(input.progressPercent),
      error_message: input.errorMessage ?? null,
      completed_at: TERMINAL_STATUSES.has(input.status) ? new Date().toISOString() : null,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.aiJobId)
}

export async function recordMediaGenerationProgress(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    step: string
    progressPercent: number
    message?: string | null
    status?: GrowthMediaGenerationStatus
  },
): Promise<GrowthMediaGenerationRun> {
  const existing = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!existing) throw new Error("not_found")

  const event: GrowthMediaGenerationProgressEvent = {
    step: input.step,
    progress_percent: clampProgress(input.progressPercent),
    occurred_at: new Date().toISOString(),
    message: input.message ?? null,
  }

  const timeline = [...(existing.output.progress_timeline ?? []), event]
  const nextOutput: GrowthMediaGenerationRunOutput = {
    ...existing.output,
    progress_timeline: timeline,
  }

  const nextStatus = input.status ?? existing.status
  const startedAt =
    existing.startedAt ??
    (nextStatus === "preparing" || nextStatus === "processing" ? event.occurred_at : null)

  const updated = await updateMediaGenerationRunRow(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    patch: {
      status: nextStatus,
      progressPercent: event.progress_percent,
      output: nextOutput,
      startedAt,
      completedAt: TERMINAL_STATUSES.has(nextStatus) ? event.occurred_at : existing.completedAt,
    },
  })

  await syncAiJobProgress(admin, {
    aiJobId: updated.aiJobId,
    organizationId: input.organizationId,
    status: updated.status,
    progressPercent: updated.progressPercent,
    errorMessage:
      updated.status === "failed" && typeof updated.error.message === "string"
        ? updated.error.message
        : null,
  })

  return updated
}

export async function incrementMediaGenerationRetry(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    reason?: string | null
  },
): Promise<GrowthMediaGenerationRun> {
  const existing = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!existing) throw new Error("not_found")

  const retryCount = existing.retryCount + 1
  const nextError = {
    ...existing.error,
    last_retry_reason: input.reason ?? "manual_retry",
    last_retry_at: new Date().toISOString(),
  }

  return recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "retry_scheduled",
    progressPercent: existing.progressPercent,
    message: input.reason ?? `Retry #${retryCount}`,
    status: "queued",
  }).then(async (run) =>
    updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: {
        retryCount,
        error: nextError,
        completedAt: null,
      },
    }),
  )
}

export async function appendMediaGenerationProgressTimelineOnly(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    event: GrowthMediaGenerationProgressEvent
  },
): Promise<GrowthMediaGenerationRunOutput> {
  const existing = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!existing) throw new Error("not_found")

  const nextOutput: GrowthMediaGenerationRunOutput = {
    ...existing.output,
    progress_timeline: [...(existing.output.progress_timeline ?? []), input.event],
  }

  await admin
    .schema("growth")
    .from("media_generation_runs")
    .update({ output_json: serializeMediaGenerationRunOutput(nextOutput) })
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)

  return nextOutput
}
