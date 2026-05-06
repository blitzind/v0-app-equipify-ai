import "server-only"

import { after } from "next/server"
import { waitUntil } from "@vercel/functions"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  failAiJob,
  runPriceListImportExtractionJob,
  sanitizeAiJobError,
} from "@/lib/ai/jobs/process-ai-job"

/**
 * Durable background execution on Vercel via `waitUntil`; falls back to Next `after()` locally
 * or when `waitUntil` is unavailable (returns undefined outside Vercel runtime).
 */
export function scheduleCatalogExtractionProcessing(params: {
  organizationId: string
  jobId: string
  /** Upload flow: pass so catastrophic failures can mark the import failed */
  importIdForCleanup?: string
}): void {
  const { organizationId, jobId, importIdForCleanup } = params

  const execute = async () => {
    let sr
    try {
      sr = createServiceRoleSupabaseClient()
    } catch (e) {
      console.error("[catalog extraction] service role unavailable:", e)
      return
    }
    try {
      await runPriceListImportExtractionJob({ svc: sr, organizationId, jobId })
    } catch (e) {
      console.error("[catalog extraction] unexpected failure:", e)
      const msg = sanitizeAiJobError(e)
      try {
        await failAiJob(sr, jobId, msg)
        let imp = importIdForCleanup ?? null
        if (!imp) {
          const { data: jr } = await sr.from("ai_jobs").select("input_json").eq("id", jobId).maybeSingle()
          const raw = jr?.input_json as { importId?: unknown } | null
          imp = typeof raw?.importId === "string" ? raw.importId : null
        }
        if (imp) {
          await sr
            .from("price_list_imports")
            .update({
              status: "failed",
              error_message: msg,
              updated_at: new Date().toISOString(),
            })
            .eq("id", imp)
            .eq("organization_id", organizationId)
        }
      } catch (inner) {
        console.error("[catalog extraction] cleanup failed:", inner)
      }
    }
  }

  const promise = execute()
  const w = waitUntil(promise)
  if (w === undefined) {
    after(() => promise)
  }
}
