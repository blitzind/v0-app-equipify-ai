import assert from "node:assert/strict"
import {
  decideImportPollAction,
  IMPORT_POLL_STUCK_QUEUED_THRESHOLD,
  normalizeUploadPriceListResponse,
} from "../lib/catalog/import-poll-handling"
import { isInlineExtractionReadyResponse } from "../lib/catalog/import-ready-state"

assert.equal(
  decideImportPollAction({
    httpOk: true,
    hasJob: true,
    job: { status: "queued" },
    queuedPollCount: IMPORT_POLL_STUCK_QUEUED_THRESHOLD - 1,
  }).type,
  "update_progress",
)

assert.equal(
  decideImportPollAction({
    httpOk: true,
    hasJob: true,
    job: { status: "queued" },
    queuedPollCount: IMPORT_POLL_STUCK_QUEUED_THRESHOLD,
  }).type,
  "stop",
)

assert.equal(
  decideImportPollAction({
    httpOk: false,
    hasJob: false,
    job: null,
    queuedPollCount: 0,
  }).type,
  "stop",
)

const normalized = normalizeUploadPriceListResponse({
  ok: true,
  importId: "imp-1",
  jobId: "job-1",
  status: "completed",
  rowCount: 12,
  extractionReady: true,
})
assert.equal(normalized.importId, "imp-1")
assert.equal(normalized.jobId, "job-1")
assert.equal(normalized.extractionReady, true)
assert.equal(normalized.rowCount, 12)
assert.equal(isInlineExtractionReadyResponse(normalized), true)

console.log("test-import-poll-handling: ok")
