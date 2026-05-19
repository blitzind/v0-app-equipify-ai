import assert from "node:assert/strict"
import {
  bulkArchivePartialToast,
  bulkArchiveSuccessToast,
} from "../lib/work-orders/bulk-archive-messages"

assert.equal(bulkArchiveSuccessToast(1), "Work order archived")
assert.equal(bulkArchiveSuccessToast(3), "Work orders archived")
assert.equal(bulkArchivePartialToast(2, 1), "2 work orders archived. 1 could not be archived.")
assert.equal(bulkArchivePartialToast(1, 2), "1 work order archived. 2 could not be archived.")

console.log("test-bulk-archive-messages: ok")
