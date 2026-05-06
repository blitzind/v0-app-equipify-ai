import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { runPriceListImportExtractionJob, sanitizeAiJobError } from "@/lib/ai/jobs/process-ai-job"

/**
 * Picks queued catalog extraction jobs (cron / worker). Uses the same runner as HTTP-triggered jobs;
 * runner atomically claims `queued` → `processing`, so this is safe with concurrent schedulers.
 */
export async function processQueuedCatalogExtractionJobs(
  svc: SupabaseClient,
  maxJobs: number,
): Promise<{ ran: number; skipped: number }> {
  let ran = 0
  let skipped = 0

  for (let i = 0; i < maxJobs; i++) {
    const { data: next, error: selErr } = await svc
      .from("ai_jobs")
      .select("id, organization_id")
      .eq("task", "catalog_extraction")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (selErr || !next?.id || !next.organization_id) {
      break
    }

    try {
      await runPriceListImportExtractionJob({
        svc,
        organizationId: next.organization_id as string,
        jobId: next.id as string,
      })
      ran += 1
    } catch (e) {
      skipped += 1
      console.error("[process-ai-job-queue] job error:", next.id, sanitizeAiJobError(e))
    }
  }

  return { ran, skipped }
}
