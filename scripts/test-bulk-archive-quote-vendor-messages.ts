import assert from "node:assert/strict"
import {
  bulkQuoteArchivePartialToast,
  bulkQuoteArchiveSuccessToast,
  quoteAlreadyArchivedMessage,
} from "../lib/quotes/bulk-archive-messages"
import { friendlyBulkQuoteArchiveApiError } from "../lib/quotes/bulk-archive-quotes-client"
import {
  bulkVendorArchivePartialToast,
  bulkVendorArchiveSuccessToast,
  vendorAlreadyArchivedMessage,
} from "../lib/vendors/bulk-archive-messages"
import { friendlyBulkVendorArchiveApiError } from "../lib/vendors/bulk-archive-vendors-client"

assert.equal(quoteAlreadyArchivedMessage(null), null)
assert.equal(bulkQuoteArchiveSuccessToast(1), "Quote archived")
assert.equal(bulkQuoteArchiveSuccessToast(2), "Quotes archived")
assert.equal(
  bulkQuoteArchivePartialToast(1, 2),
  "1 quote archived. 2 could not be archived.",
)
assert.equal(friendlyBulkQuoteArchiveApiError(403, undefined), "You do not have permission to archive quotes.")

assert.equal(vendorAlreadyArchivedMessage("2026-01-01"), "This vendor is already archived.")
assert.equal(bulkVendorArchiveSuccessToast(3), "Vendors archived")
assert.equal(
  bulkVendorArchivePartialToast(2, 1),
  "2 vendors archived. 1 could not be archived.",
)
assert.equal(friendlyBulkVendorArchiveApiError(403, undefined), "You do not have permission to archive vendors.")

console.log("test-bulk-archive-quote-vendor-messages: ok")
