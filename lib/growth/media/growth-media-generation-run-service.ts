import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthMediaGenerationRun,
  GrowthMediaGenerationRunInput,
  GrowthMediaGenerationRunOutput,
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

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function parseRunInput(raw: Record<string, unknown>): GrowthMediaGenerationRunInput {
  const metadataHooksRaw = raw.metadata_hooks
  const metadata_hooks =
    metadataHooksRaw && typeof metadataHooksRaw === "object" && !Array.isArray(metadataHooksRaw)
      ? (metadataHooksRaw as GrowthMediaGenerationRunInput["metadata_hooks"])
      : undefined

  return {
    metadata_hooks: metadata_hooks,
    provider_request: asRecord(raw.provider_request),
    writeback_target:
      raw.writeback_target === "media_asset" || raw.writeback_target === "video_asset"
        ? raw.writeback_target
        : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
  }
}

function parseRunOutput(raw: Record<string, unknown>): GrowthMediaGenerationRunOutput {
  const timelineRaw = raw.progress_timeline
  const progress_timeline = Array.isArray(timelineRaw)
    ? timelineRaw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          step: typeof entry.step === "string" ? entry.step : "progress",
          progress_percent: Number(entry.progress_percent) || 0,
          occurred_at: typeof entry.occurred_at === "string" ? entry.occurred_at : new Date().toISOString(),
          message: typeof entry.message === "string" ? entry.message : null,
        }))
    : []

  const writebackRaw = raw.storage_writeback
  const storage_writeback =
    writebackRaw && typeof writebackRaw === "object" && !Array.isArray(writebackRaw)
      ? (writebackRaw as GrowthMediaGenerationRunOutput["storage_writeback"])
      : null

  return {
    progress_timeline,
    storage_writeback,
    analytics_hooks: asRecord(raw.analytics_hooks),
  }
}

export function mapMediaGenerationRunRow(row: MediaGenerationRunRow): GrowthMediaGenerationRun {
  return {
    id: row.id,
    organizationId: row.organization_id,
    aiJobId: row.ai_job_id,
    generationType: row.generation_type as GrowthMediaGenerationType,
    provider: row.provider,
    status: row.status as GrowthMediaGenerationStatus,
    progressPercent: row.progress_percent,
    input: parseRunInput(asRecord(row.input_json)),
    output: parseRunOutput(asRecord(row.output_json)),
    error: asRecord(row.error_json),
    retryCount: row.retry_count,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function serializeMediaGenerationRunInput(input: GrowthMediaGenerationRunInput): Record<string, unknown> {
  return {
    metadata_hooks: input.metadata_hooks ?? {},
    provider_request: input.provider_request ?? {},
    writeback_target: input.writeback_target ?? null,
    notes: input.notes ?? null,
  }
}

export function serializeMediaGenerationRunOutput(output: GrowthMediaGenerationRunOutput): Record<string, unknown> {
  return {
    progress_timeline: output.progress_timeline ?? [],
    storage_writeback: output.storage_writeback ?? null,
    analytics_hooks: output.analytics_hooks ?? {},
  }
}

export async function getMediaGenerationRunById(
  admin: SupabaseClient,
  input: { organizationId: string; runId: string },
): Promise<GrowthMediaGenerationRun | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)
    .maybeSingle()

  if (error || !data) return null
  return mapMediaGenerationRunRow(data as MediaGenerationRunRow)
}

export async function listMediaGenerationRuns(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthMediaGenerationStatus
    generationType?: GrowthMediaGenerationType
    videoPageId?: string
    limit?: number
  },
): Promise<GrowthMediaGenerationRun[]> {
  let query = admin
    .schema("growth")
    .from("media_generation_runs")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
    .limit(input.limit ?? 100)

  if (input.status) query = query.eq("status", input.status)
  if (input.generationType) query = query.eq("generation_type", input.generationType)
  if (input.videoPageId) {
    query = query.contains("input_json", { metadata_hooks: { video_page_id: input.videoPageId } })
  }

  const { data, error } = await query
  if (error || !data) return []
  return (data as MediaGenerationRunRow[]).map(mapMediaGenerationRunRow)
}

export async function updateMediaGenerationRunRow(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    patch: {
      status?: GrowthMediaGenerationStatus
      progressPercent?: number
      output?: GrowthMediaGenerationRunOutput
      error?: Record<string, unknown>
      retryCount?: number
      startedAt?: string | null
      completedAt?: string | null
    }
  },
): Promise<GrowthMediaGenerationRun> {
  const existing = await getMediaGenerationRunById(admin, {
    organizationId: input.organizationId,
    runId: input.runId,
  })
  if (!existing) throw new Error("not_found")

  const nextOutput = input.patch.output ?? existing.output
  const nextError = input.patch.error ?? existing.error

  const { data, error } = await admin
    .schema("growth")
    .from("media_generation_runs")
    .update({
      status: input.patch.status ?? existing.status,
      progress_percent: input.patch.progressPercent ?? existing.progressPercent,
      output_json: serializeMediaGenerationRunOutput(nextOutput),
      error_json: nextError,
      retry_count: input.patch.retryCount ?? existing.retryCount,
      started_at: input.patch.startedAt !== undefined ? input.patch.startedAt : existing.startedAt,
      completed_at: input.patch.completedAt !== undefined ? input.patch.completedAt : existing.completedAt,
    })
    .eq("organization_id", input.organizationId)
    .eq("id", input.runId)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "update_failed")
  return mapMediaGenerationRunRow(data as MediaGenerationRunRow)
}
