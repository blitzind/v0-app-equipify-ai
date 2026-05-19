/** Client-side helpers for catalog import job polling — testable without React. */

export type ImportJobPollSnapshot = {
  status: string
  progressPercent?: number
  currentStep?: string | null
  errorMessage?: string | null
}

export type ImportPollAction =
  | { type: "continue" }
  | { type: "stop"; reason: "completed" | "failed" | "cancelled" | "missing" | "stuck_queued" | "http_error" }
  | { type: "update_progress"; progressPercent: number; currentStep: string | null }

export const IMPORT_POLL_STUCK_QUEUED_THRESHOLD = 8

export function decideImportPollAction(args: {
  httpOk: boolean
  hasJob: boolean
  job: ImportJobPollSnapshot | null
  queuedPollCount: number
  httpMessage?: string
}): ImportPollAction {
  if (!args.httpOk) {
    return { type: "stop", reason: "http_error" }
  }
  if (!args.hasJob || !args.job) {
    return { type: "stop", reason: "missing" }
  }

  const st = args.job.status
  if (st === "completed") return { type: "stop", reason: "completed" }
  if (st === "failed") return { type: "stop", reason: "failed" }
  if (st === "cancelled") return { type: "stop", reason: "cancelled" }

  if (st === "queued" && args.queuedPollCount >= IMPORT_POLL_STUCK_QUEUED_THRESHOLD) {
    return { type: "stop", reason: "stuck_queued" }
  }

  const pct =
    typeof args.job.progressPercent === "number" && Number.isFinite(args.job.progressPercent)
      ? args.job.progressPercent
      : 0

  return {
    type: "update_progress",
    progressPercent: pct,
    currentStep: args.job.currentStep ?? null,
  }
}

export function friendlyImportPollStopMessage(reason: ImportPollAction & { type: "stop" }["reason"], detail?: string): string {
  switch (reason) {
    case "missing":
      return "Extraction job was not found. Try uploading again."
    case "http_error":
      return detail?.trim() || "Could not check extraction status. Refresh the page or try again."
    case "stuck_queued":
      return "Extraction did not start. Click Re-run extraction or upload the file again."
    case "failed":
      return detail?.trim() || "Extraction failed."
    default:
      return detail?.trim() || "Extraction stopped."
  }
}

export type UploadPriceListResponse = {
  ok?: boolean
  importId?: string
  jobId?: string
  status?: "queued" | "completed" | "failed"
  rowCount?: number
  extractionReady?: boolean
  message?: string
  error?: string
}

export function normalizeUploadPriceListResponse(raw: UploadPriceListResponse): {
  importId: string | null
  jobId: string | null
  extractionReady: boolean
  rowCount: number | null
  failed: boolean
  message: string | null
} {
  const importId = typeof raw.importId === "string" ? raw.importId : null
  const jobId = typeof raw.jobId === "string" ? raw.jobId : null
  const extractionReady = raw.extractionReady === true || raw.status === "completed"
  const rowCount = typeof raw.rowCount === "number" ? raw.rowCount : null
  const failed = raw.ok === false || raw.status === "failed"
  const message =
    typeof raw.message === "string" && raw.message.trim()
      ? raw.message.trim()
      : typeof raw.error === "string" && raw.error.trim()
        ? raw.error.trim()
        : null
  return { importId, jobId, extractionReady, rowCount, failed, message }
}
