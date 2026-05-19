import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"

export type PriceListImportOutcome =
  | {
      ok: true
      importId: string
      jobId: string
      status: "completed"
      rowCount: number
      extractionReady: true
    }
  | {
      ok: false
      importId: string
      jobId: string
      status: "failed" | "queued" | "processing" | "cancelled"
      message: string
    }

export async function readPriceListImportJobOutcome(
  svc: SupabaseClient,
  organizationId: string,
  importId: string,
  jobId: string,
): Promise<PriceListImportOutcome> {
  const [{ data: jobRow }, { data: impRow }] = await Promise.all([
    svc
      .from("ai_jobs")
      .select("status, result_json, error_message")
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    svc
      .from("price_list_imports")
      .select("status, error_message, extracted_json")
      .eq("id", importId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  ])

  const jobStatus = (jobRow?.status as string) ?? "queued"
  const impStatus = (impRow?.status as string) ?? "processing"

  if (jobStatus === "completed") {
    const result = jobRow?.result_json as { rowCount?: number } | null
    const payload = parseStoredPriceListPayload(impRow?.extracted_json)
    const rowCount =
      typeof result?.rowCount === "number"
        ? result.rowCount
        : (payload?.rows.length ?? 0)
    return {
      ok: true,
      importId,
      jobId,
      status: "completed",
      rowCount,
      extractionReady: true,
    }
  }

  if (jobStatus === "failed" || impStatus === "failed") {
    const message =
      (typeof jobRow?.error_message === "string" && jobRow.error_message.trim()) ||
      (typeof impRow?.error_message === "string" && impRow.error_message.trim()) ||
      "Extraction failed."
    return { ok: false, importId, jobId, status: "failed", message }
  }

  if (jobStatus === "cancelled" || impStatus === "cancelled") {
    return {
      ok: false,
      importId,
      jobId,
      status: "cancelled",
      message: "Import was cancelled.",
    }
  }

  const message =
    jobStatus === "processing"
      ? "Extraction is still running."
      : "Extraction did not finish. Try Re-run extraction."

  return {
    ok: false,
    importId,
    jobId,
    status: jobStatus === "processing" ? "processing" : "queued",
    message,
  }
}
