import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { pollSignalProvider } from "@/lib/growth/signals/providers/signal-provider-registry"
import {
  enqueueSignalIngestionJob,
  persistGrowthSignalDraft,
  syncDerivedHiringSignals,
} from "@/lib/growth/signals/signal-repository"
import { validateSignalEvidenceRequired } from "@/lib/growth/signals/signal-evidence"
import { GROWTH_SIGNAL_FOUNDATION_QA_MARKER } from "@/lib/growth/signals/signal-types"

export type ProcessSignalIngestionQueueResult = {
  qa_marker: typeof GROWTH_SIGNAL_FOUNDATION_QA_MARKER
  processed: number
  ingested: number
  duplicates: number
  rejected: number
  failed: number
  derived_hires_upserted: number
  errors: string[]
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function processSignalIngestionQueue(
  admin: SupabaseClient,
  limit = 10,
): Promise<ProcessSignalIngestionQueueResult> {
  const result: ProcessSignalIngestionQueueResult = {
    qa_marker: GROWTH_SIGNAL_FOUNDATION_QA_MARKER,
    processed: 0,
    ingested: 0,
    duplicates: 0,
    rejected: 0,
    failed: 0,
    derived_hires_upserted: 0,
    errors: [],
  }

  const { data: jobs, error } = await admin
    .schema("growth")
    .from("signal_ingestion_queue")
    .select("id, provider_key, organization_id, cursor, attempts")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  if (error) {
    result.errors.push(error.message)
    return result
  }

  for (const job of jobs ?? []) {
    const jobId = asString(job.id)
    const providerKey = asString(job.provider_key)
    result.processed += 1

    await admin
      .schema("growth")
      .from("signal_ingestion_queue")
      .update({ status: "running", attempts: (job.attempts ?? 0) + 1 })
      .eq("id", jobId)

    try {
      const poll = await pollSignalProvider(providerKey, {
        organization_id: job.organization_id ?? null,
        cursor:
          job.cursor && typeof job.cursor === "object"
            ? (job.cursor as Record<string, unknown>)
            : {},
        sample_input:
          job.cursor && typeof job.cursor === "object"
            ? (job.cursor as Record<string, unknown>).sample_input
            : undefined,
      })

      if (!poll.ok || poll.status !== "completed") {
        await admin
          .schema("growth")
          .from("signal_ingestion_queue")
          .update({
            status: poll.status === "skipped" ? "completed" : "failed",
            last_error: poll.message ?? null,
          })
          .eq("id", jobId)
        if (poll.status === "failed") result.failed += 1
        continue
      }

      for (const draft of poll.drafts) {
        const evidenceError = validateSignalEvidenceRequired(draft)
        if (evidenceError) {
          result.rejected += 1
          continue
        }

        const persisted = await persistGrowthSignalDraft(admin, draft)
        if (persisted.ok) {
          result.ingested += 1
        } else if (persisted.duplicate) {
          result.duplicates += 1
        } else {
          result.rejected += 1
          if (persisted.reason) result.errors.push(persisted.reason)
        }
      }

      if (providerKey === "job_posting_manual") {
        const derived = await syncDerivedHiringSignals(admin, job.organization_id ?? null)
        result.derived_hires_upserted += derived.upserted
        result.errors.push(...derived.errors)
      }

      await admin
        .schema("growth")
        .from("signal_ingestion_queue")
        .update({ status: "completed", last_error: null })
        .eq("id", jobId)
    } catch (err) {
      result.failed += 1
      const message = err instanceof Error ? err.message : "unknown_error"
      result.errors.push(message)
      await admin
        .schema("growth")
        .from("signal_ingestion_queue")
        .update({ status: "failed", last_error: message })
        .eq("id", jobId)
    }
  }

  return result
}

export async function queueManualImportIngestion(
  admin: SupabaseClient,
  input: {
    sample_input: unknown
    organization_id?: string | null
  },
): Promise<{ ok: boolean; queue_id?: string; reason?: string }> {
  return enqueueSignalIngestionJob(admin, {
    provider_key: "manual_import",
    organization_id: input.organization_id ?? null,
    cursor: { sample_input: input.sample_input },
  })
}

export async function queueNewsManualIngestion(
  admin: SupabaseClient,
  input: {
    sample_input: unknown
    organization_id?: string | null
  },
): Promise<{ ok: boolean; queue_id?: string; reason?: string }> {
  return enqueueSignalIngestionJob(admin, {
    provider_key: "news_manual",
    organization_id: input.organization_id ?? null,
    cursor: { sample_input: input.sample_input },
  })
}

export async function queueJobPostingManualIngestion(
  admin: SupabaseClient,
  input: {
    sample_input: unknown
    organization_id?: string | null
  },
): Promise<{ ok: boolean; queue_id?: string; reason?: string }> {
  return enqueueSignalIngestionJob(admin, {
    provider_key: "job_posting_manual",
    organization_id: input.organization_id ?? null,
    cursor: { sample_input: input.sample_input },
  })
}

export async function queueJobChangeManualIngestion(
  admin: SupabaseClient,
  input: {
    sample_input: unknown
    organization_id?: string | null
  },
): Promise<{ ok: boolean; queue_id?: string; reason?: string }> {
  return enqueueSignalIngestionJob(admin, {
    provider_key: "job_change_manual",
    organization_id: input.organization_id ?? null,
    cursor: { sample_input: input.sample_input },
  })
}
