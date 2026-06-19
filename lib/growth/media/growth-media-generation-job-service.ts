import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { insertQueuedAiJob } from "@/lib/ai/jobs/create-ai-job"
import { toSafeAiJobPayload } from "@/lib/ai/redaction"
import {
  getMediaGenerationRunById,
  listMediaGenerationRuns,
  mapMediaGenerationRunRow,
  serializeMediaGenerationRunInput,
  updateMediaGenerationRunRow,
} from "@/lib/growth/media/growth-media-generation-run-service"
import { recordMediaGenerationProgress } from "@/lib/growth/media/growth-media-generation-progress-service"
import type {
  GrowthMediaGenerationJobSummary,
  GrowthMediaGenerationMetadataHooks,
  GrowthMediaGenerationRun,
  GrowthMediaGenerationRunInput,
  GrowthMediaGenerationStatus,
  GrowthMediaGenerationType,
} from "@/lib/growth/media/growth-media-generation-types"

type MediaGenerationRunRow = {
  id: string
  organization_id: string
  ai_job_id: string
  generation_type: string
  provider: string
  status: string
  progress_percent: number
  input_json: Record<string, unknown> | null
  output_json: Record<string, unknown> | null
  error_json: Record<string, unknown> | null
  retry_count: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

function normalizeMetadataHooks(
  hooks: GrowthMediaGenerationMetadataHooks | undefined,
): GrowthMediaGenerationMetadataHooks {
  return {
    video_page_id: hooks?.video_page_id?.trim() || null,
    video_asset_id: hooks?.video_asset_id?.trim() || null,
    lead_id: hooks?.lead_id?.trim() || null,
    company_candidate_id: hooks?.company_candidate_id?.trim() || null,
    person_candidate_id: hooks?.person_candidate_id?.trim() || null,
    personalization_profile_id: hooks?.personalization_profile_id?.trim() || null,
    sequence_candidate_id: hooks?.sequence_candidate_id?.trim() || null,
    script_version_id: hooks?.script_version_id?.trim() || null,
    voice_media_asset_id: hooks?.voice_media_asset_id?.trim() || null,
  }
}

function buildRunInput(input: {
  metadataHooks?: GrowthMediaGenerationMetadataHooks
  providerRequest?: Record<string, unknown>
  writebackTarget?: "media_asset" | "video_asset" | null
  notes?: string | null
}): GrowthMediaGenerationRunInput {
  return {
    metadata_hooks: normalizeMetadataHooks(input.metadataHooks),
    provider_request: input.providerRequest ?? {},
    writeback_target: input.writebackTarget ?? null,
    notes: input.notes ?? null,
  }
}

function aiTaskForGenerationType(type: GrowthMediaGenerationType): string {
  return `growth_media_generation_${type}`
}

export async function createMediaGenerationJob(
  admin: SupabaseClient,
  input: {
    organizationId: string
    createdBy: string
    generationType: GrowthMediaGenerationType
    provider: string
    metadataHooks?: GrowthMediaGenerationMetadataHooks
    providerRequest?: Record<string, unknown>
    writebackTarget?: "media_asset" | "video_asset" | null
    notes?: string | null
  },
): Promise<GrowthMediaGenerationRun> {
  const runInput = buildRunInput({
    metadataHooks: input.metadataHooks,
    providerRequest: input.providerRequest,
    writebackTarget: input.writebackTarget,
    notes: input.notes,
  })

  const jobInsert = await insertQueuedAiJob(admin, {
    organization_id: input.organizationId,
    created_by: input.createdBy,
    task: aiTaskForGenerationType(input.generationType),
    status: "queued",
    input_json: toSafeAiJobPayload({
      generation_type: input.generationType,
      provider: input.provider,
      ...serializeMediaGenerationRunInput(runInput),
      provider_execution_enabled: false,
      no_media_generation_executed: true,
    }),
    source_type: "growth_media_generation_run",
    source_id: input.generationType,
  })

  if ("error" in jobInsert) {
    throw new Error(jobInsert.error)
  }

  const { data, error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .insert({
      organization_id: input.organizationId,
      ai_job_id: jobInsert.jobId,
      generation_type: input.generationType,
      provider: input.provider,
      status: "queued",
      progress_percent: 0,
      input_json: serializeMediaGenerationRunInput(runInput),
      output_json: { progress_timeline: [] },
      error_json: {},
      retry_count: 0,
    })
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "run_insert_failed")

  await recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: (data as MediaGenerationRunRow).id,
    step: "queued",
    progressPercent: 0,
    message: "Job queued — provider execution disabled in C3 foundation.",
    status: "queued",
  })

  const created = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: (data as MediaGenerationRunRow).id,
  })
  if (!created) throw new Error("run_load_failed")
  return created
}

export async function getMediaGenerationJobById(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<GrowthMediaGenerationRun | null> {
  return getMediaGenerationRunById(admin, input)
}

export async function listMediaGenerationJobs(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthMediaGenerationStatus
    generationType?: GrowthMediaGenerationType
    videoPageId?: string
    limit?: number
  },
): Promise<GrowthMediaGenerationRun[]> {
  return listMediaGenerationRuns(admin, input)
}

export async function summarizeMediaGenerationJobs(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthMediaGenerationJobSummary> {
  const { data, error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .select("status")
    .eq("organization_id", organizationId)

  const summary: GrowthMediaGenerationJobSummary = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  }

  if (error || !data) return summary

  for (const row of data as Array<{ status: string }>) {
    switch (row.status) {
      case "queued":
        summary.queued += 1
        break
      case "preparing":
      case "processing":
        summary.processing += 1
        break
      case "completed":
        summary.completed += 1
        break
      case "failed":
        summary.failed += 1
        break
      case "cancelled":
        summary.cancelled += 1
        break
      default:
        break
    }
  }

  return summary
}

export async function patchMediaGenerationJob(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    status?: GrowthMediaGenerationStatus
    progressPercent?: number
    error?: Record<string, unknown>
    retry?: boolean
    retryReason?: string | null
  },
): Promise<GrowthMediaGenerationRun> {
  const existing = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!existing) throw new Error("not_found")

  if (input.retry) {
    const retryCount = existing.retryCount + 1
    return recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: "retry_scheduled",
      progressPercent: 0,
      message: input.retryReason ?? `Retry #${retryCount}`,
      status: "queued",
    }).then(() =>
      updateMediaGenerationRunRow(admin, {
        organizationId: input.organizationId,
        runId: input.runId,
        patch: {
          retryCount,
          error: {
            ...existing.error,
            last_retry_reason: input.retryReason ?? "manual_retry",
            last_retry_at: new Date().toISOString(),
          },
          completedAt: null,
        },
      }),
    )
  }

  if (input.status || input.progressPercent !== undefined) {
    return recordMediaGenerationProgress(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      step: input.status ?? existing.status,
      progressPercent: input.progressPercent ?? existing.progressPercent,
      message: typeof input.error?.message === "string" ? input.error.message : null,
      status: input.status ?? existing.status,
    }).then(async (run) => {
      if (!input.error) return run
      return updateMediaGenerationRunRow(admin, {
        organizationId: input.organizationId,
        runId: input.runId,
        patch: { error: input.error },
      })
    })
  }

  if (input.error) {
    return updateMediaGenerationRunRow(admin, {
      organizationId: input.organizationId,
      runId: input.runId,
      patch: { error: input.error },
    })
  }

  return existing
}

export async function cancelMediaGenerationJob(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string; reason?: string | null },
): Promise<GrowthMediaGenerationRun> {
  return recordMediaGenerationProgress(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
    step: "cancelled",
    progressPercent: 0,
    message: input.reason ?? "Cancelled by operator.",
    status: "cancelled",
  })
}

export function mapMediaGenerationRunRows(rows: MediaGenerationRunRow[]): GrowthMediaGenerationRun[] {
  return rows.map(mapMediaGenerationRunRow)
}
