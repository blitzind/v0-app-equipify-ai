import assert from "node:assert/strict"
import {
  catalogImportMissingContextMessage,
  evaluateCatalogImportReviewReadiness,
  isInlineExtractionReadyResponse,
} from "../lib/catalog/import-ready-state"

assert.equal(
  catalogImportMissingContextMessage({ organizationId: null, importId: "imp-1" }),
  "Select an organization before importing a price list.",
)
assert.equal(
  catalogImportMissingContextMessage({ organizationId: "org-1", importId: null }),
  "The import could not be prepared for review. Upload again or refresh the page.",
)

assert.equal(
  evaluateCatalogImportReviewReadiness({
    organizationId: "org-1",
    importId: "imp-1",
    importStatus: "needs_review",
    hasPayload: true,
    payloadRowCount: 5,
  }).ready,
  true,
)

const noRows = evaluateCatalogImportReviewReadiness({
  organizationId: "org-1",
  importId: "imp-1",
  importStatus: "needs_review",
  hasPayload: true,
  payloadRowCount: 0,
})
assert.equal(noRows.ready, false)
if (!noRows.ready) {
  assert.equal(noRows.reason, "no_rows")
  assert.match(noRows.message, /no rows were extracted/i)
}

const processing = evaluateCatalogImportReviewReadiness({
  organizationId: "org-1",
  importId: "imp-1",
  importStatus: "processing",
  activeJobId: "job-1",
})
assert.equal(processing.ready, false)
if (!processing.ready) {
  assert.equal(processing.reason, "still_processing")
}

assert.equal(
  isInlineExtractionReadyResponse({ extractionReady: true, status: "completed", rowCount: 12 }),
  true,
)
assert.equal(
  isInlineExtractionReadyResponse({ status: "queued", rowCount: 0 }),
  false,
)
assert.equal(
  isInlineExtractionReadyResponse({ status: "completed", rowCount: 3 }),
  true,
)

console.log("test-import-ready-state: ok")
