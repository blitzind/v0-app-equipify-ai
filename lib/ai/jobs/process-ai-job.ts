import "server-only"

/**
 * Route handlers schedule work with `after()` from Next.js. When a real queue (worker/cron) exists,
 * enqueue `jobId` there instead and keep this runner as the shared executor.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { PRICE_LIST_IMPORTS_BUCKET } from "@/lib/catalog/constants"
import {
  extractPriceListPayloadFromPdf,
  PriceListExtractConfigError,
} from "@/lib/catalog/extract-price-list-from-pdf"
import type { AiJobStatus } from "@/lib/ai/jobs/types"
import type { PriceListImportJobInput, PriceListImportJobResult } from "@/lib/ai/jobs/types"
import { getPromptForTask, promptMetadataForLog } from "@/lib/ai/prompts"
import { parseStoredPriceListPayload } from "@/lib/catalog/parse-stored-payload"
import { toSafeAiJobPayload } from "@/lib/ai/redaction"

const JOB_PROCESSING_TIMEOUT_MS = 280_000

export function sanitizeAiJobError(err: unknown): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Something went wrong."
  const safe = raw.replace(/\s+/g, " ").trim()
  if (safe.length <= 500) return safe
  return `${safe.slice(0, 497)}…`
}

async function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(timeoutMessage)), ms)
    promise.then(
      (v) => {
        clearTimeout(id)
        resolve(v)
      },
      (e) => {
        clearTimeout(id)
        reject(e)
      },
    )
  })
}

export async function updateAiJobProgress(
  svc: SupabaseClient,
  jobId: string,
  params: { progressPercent: number; currentStep: string | null },
): Promise<void> {
  await svc
    .from("ai_jobs")
    .update({
      progress_percent: Math.min(100, Math.max(0, Math.floor(params.progressPercent))),
      current_step: params.currentStep,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
}

export async function markAiJobStatus(
  svc: SupabaseClient,
  jobId: string,
  status: AiJobStatus,
  patch?: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString()
  const base: Record<string, unknown> = {
    status,
    updated_at: now,
    ...patch,
  }
  if (status === "processing" && base.started_at == null) {
    base.started_at = now
  }
  if (status === "completed" || status === "failed" || status === "cancelled") {
    base.completed_at = now
  }
  await svc.from("ai_jobs").update(base).eq("id", jobId)
}

export async function completeAiJob(
  svc: SupabaseClient,
  jobId: string,
  resultJson: Record<string, unknown>,
): Promise<void> {
  const now = new Date().toISOString()
  await svc
    .from("ai_jobs")
    .update({
      status: "completed",
      progress_percent: 100,
      current_step: null,
      result_json: toSafeAiJobPayload(resultJson),
      error_message: null,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", jobId)
}

export async function failAiJob(svc: SupabaseClient, jobId: string, message: string): Promise<void> {
  const now = new Date().toISOString()
  await svc
    .from("ai_jobs")
    .update({
      status: "failed",
      error_message: message,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", jobId)
}

function parseInput(raw: unknown): PriceListImportJobInput | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const kind = o.kind
  if (kind === "price_list_import_upload") {
    const importId = typeof o.importId === "string" ? o.importId : ""
    const storagePath = typeof o.storagePath === "string" ? o.storagePath : ""
    const fileName = typeof o.fileName === "string" ? o.fileName : "price-list.pdf"
    if (!importId || !storagePath) return null
    const manufacturerName =
      typeof o.manufacturerName === "string" && o.manufacturerName.trim()
        ? o.manufacturerName.trim()
        : null
    const vendorId =
      typeof o.vendorId === "string" && o.vendorId.trim() ? o.vendorId.trim() : null
    return {
      kind: "price_list_import_upload",
      importId,
      storagePath,
      fileName,
      manufacturerName,
      vendorId,
    }
  }
  if (kind === "price_list_import_reextract") {
    const importId = typeof o.importId === "string" ? o.importId : ""
    if (!importId) return null
    return { kind: "price_list_import_reextract", importId }
  }
  return null
}

/**
 * Runs price list AI extraction for a queued job (download PDF → extract → persist).
 * Invoked from `after()` or a future queue worker. Uses service role client.
 */
export async function runPriceListImportExtractionJob(params: {
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

  if (loadErr || !jobRow) {
    return
  }
  if ((jobRow.status as string) === "cancelled") {
    return
  }

  const input = parseInput(jobRow.input_json)
  if (!input) {
    await failAiJob(svc, jobId, "Invalid job payload.")
    return
  }

  await markAiJobStatus(svc, jobId, "processing", {
    progress_percent: 5,
    current_step: "Starting extraction…",
    error_message: null,
  })

  const importId = input.importId

  const { data: imp0, error: impErr } = await svc
    .from("price_list_imports")
    .select("id, file_name, file_url, manufacturer_name, extracted_json, vendor_id")
    .eq("id", importId)
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (impErr || !imp0?.file_url) {
    await failAiJob(svc, jobId, "Import record or stored PDF was not found.")
    await svc
      .from("price_list_imports")
      .update({
        status: "failed",
        error_message: "Import or PDF missing.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)
    return
  }

  let buffer: Buffer
  let fileName = (imp0.file_name as string) || "price-list.pdf"

  if (input.kind === "price_list_import_upload") {
    await updateAiJobProgress(svc, jobId, {
      progressPercent: 15,
      currentStep: "Loading uploaded PDF…",
    })
    const path = input.storagePath
    const { data: bin, error: dlErr } = await svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).download(path)
    if (dlErr || !bin) {
      const msg = sanitizeAiJobError(dlErr ?? new Error("Download failed."))
      await failAiJob(svc, jobId, msg)
      await svc
        .from("price_list_imports")
        .update({
          status: "failed",
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId)
      return
    }
    buffer = Buffer.from(await bin.arrayBuffer())
    fileName = input.fileName || fileName
  } else {
    await updateAiJobProgress(svc, jobId, {
      progressPercent: 15,
      currentStep: "Loading PDF from storage…",
    })
    const path = imp0.file_url as string
    const { data: bin, error: dlErr } = await svc.storage.from(PRICE_LIST_IMPORTS_BUCKET).download(path)
    if (dlErr || !bin) {
      const msg = sanitizeAiJobError(dlErr ?? new Error("Download failed."))
      await failAiJob(svc, jobId, msg)
      await svc
        .from("price_list_imports")
        .update({
          status: "failed",
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", importId)
      return
    }
    buffer = Buffer.from(await bin.arrayBuffer())
  }

  await svc
    .from("price_list_imports")
    .update({ status: "processing", error_message: null, updated_at: new Date().toISOString() })
    .eq("id", importId)

  let payload: Awaited<ReturnType<typeof extractPriceListPayloadFromPdf>>
  try {
    await updateAiJobProgress(svc, jobId, {
      progressPercent: 35,
      currentStep: "Running AI extraction (this may take a few minutes)…",
    })

    const extraction = extractPriceListPayloadFromPdf({
      buffer,
      fileName,
      organizationId,
    })

    payload = await withTimeout(
      extraction,
      JOB_PROCESSING_TIMEOUT_MS,
      "Extraction timed out. Try a smaller PDF or retry.",
    )

    await updateAiJobProgress(svc, jobId, {
      progressPercent: 85,
      currentStep: "Saving extracted rows…",
    })
  } catch (e) {
    const msg =
      e instanceof PriceListExtractConfigError
        ? e.message
        : e instanceof Error
          ? e.message
          : sanitizeAiJobError(e)
    const safe = sanitizeAiJobError(msg)
    await failAiJob(svc, jobId, safe)
    await svc
      .from("price_list_imports")
      .update({
        status: "failed",
        error_message: safe,
        updated_at: new Date().toISOString(),
      })
      .eq("id", importId)
    return
  }

  const prev = parseStoredPriceListPayload(imp0.extracted_json)
  const mergedMfg =
    input.kind === "price_list_import_upload"
      ? (payload.manufacturerName ?? input.manufacturerName)
      : (payload.manufacturerName ?? (imp0.manufacturer_name as string | null))
  payload.manufacturerName = mergedMfg ?? null

  if (input.kind === "price_list_import_reextract" && prev?.rows?.length) {
    const prevByPart = new Map(
      prev.rows.map((r) => [`${r.partNumber.trim().toLowerCase()}::${r.name.trim().toLowerCase()}`, r.selected]),
    )
    payload.rows = payload.rows.map((r) => ({
      ...r,
      selected: prevByPart.get(`${r.partNumber.trim().toLowerCase()}::${r.name.trim().toLowerCase()}`) ?? true,
    }))
  }

  await svc
    .from("price_list_imports")
    .update({
      extracted_json: payload as unknown as Record<string, unknown>,
      manufacturer_name: mergedMfg ?? (imp0.manufacturer_name as string | null),
      status: "needs_review",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", importId)

  const pr = getPromptForTask("catalog_extraction")
  const pm = promptMetadataForLog(pr)
  const result: PriceListImportJobResult = {
    kind: "price_list_import",
    importId,
    rowCount: payload.rows.length,
    warningCount: payload.warnings?.length ?? 0,
    promptId: pm.promptId,
    promptVersion: pm.promptVersion,
    schemaVersion: pm.schemaVersion,
  }

  await completeAiJob(svc, jobId, result as unknown as Record<string, unknown>)
}
