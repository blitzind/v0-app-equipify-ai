import assert from "node:assert/strict"
import {
  bulkCustomerArchivePartialToast,
  bulkCustomerArchiveSuccessToast,
  customerAlreadyArchivedMessage,
} from "../lib/customers/bulk-archive-messages"
import { friendlyBulkCustomerArchiveApiError } from "../lib/customers/bulk-archive-customers-client"
import {
  bulkProspectArchivePartialToast,
  bulkProspectArchiveSuccessToast,
  prospectAlreadyArchivedMessage,
} from "../lib/prospects/bulk-archive-messages"
import { friendlyBulkProspectArchiveApiError } from "../lib/prospects/bulk-archive-prospects-client"

assert.equal(customerAlreadyArchivedMessage(null), null)
assert.equal(customerAlreadyArchivedMessage("2026-01-01"), "This customer is already archived.")
assert.equal(bulkCustomerArchiveSuccessToast(1), "Customer archived")
assert.equal(bulkCustomerArchiveSuccessToast(3), "Customers archived")
assert.equal(
  bulkCustomerArchivePartialToast(2, 1),
  "2 customers archived. 1 could not be archived.",
)
assert.equal(
  friendlyBulkCustomerArchiveApiError(403, undefined),
  "You do not have permission to archive customers.",
)

assert.equal(prospectAlreadyArchivedMessage(null), null)
assert.equal(prospectAlreadyArchivedMessage("2026-01-01"), "This prospect is already archived.")
assert.equal(bulkProspectArchiveSuccessToast(1), "Prospect archived")
assert.equal(bulkProspectArchiveSuccessToast(2), "Prospects archived")
assert.equal(
  bulkProspectArchivePartialToast(1, 2),
  "1 prospect archived. 2 could not be archived.",
)
assert.equal(
  friendlyBulkProspectArchiveApiError(403, undefined),
  "You do not have permission to archive prospects.",
)

console.log("test-bulk-archive-customer-prospect-messages: ok")
