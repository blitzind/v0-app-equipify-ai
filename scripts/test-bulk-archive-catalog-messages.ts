import assert from "node:assert/strict"
import {
  bulkCatalogArchivePartialToast,
  bulkCatalogArchiveSuccessToast,
  catalogItemAlreadyArchivedMessage,
} from "../lib/catalog/bulk-archive-messages"
import { friendlyBulkCatalogArchiveApiError } from "../lib/catalog/bulk-archive-catalog-client"

assert.equal(catalogItemAlreadyArchivedMessage(null), null)
assert.equal(catalogItemAlreadyArchivedMessage("2026-01-01"), "This catalog item is already archived.")

assert.equal(bulkCatalogArchiveSuccessToast(1), "Catalog item archived")
assert.equal(bulkCatalogArchiveSuccessToast(4), "Catalog items archived")
assert.equal(
  bulkCatalogArchivePartialToast(2, 1),
  "2 catalog items archived. 1 could not be archived.",
)

assert.equal(friendlyBulkCatalogArchiveApiError(403, undefined), "You do not have permission to archive catalog items.")

console.log("test-bulk-archive-catalog-messages: ok")
