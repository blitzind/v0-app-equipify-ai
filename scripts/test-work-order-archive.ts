import assert from "node:assert/strict"
import { workOrderAlreadyArchivedMessage, friendlyWorkOrderArchiveApiError } from "../lib/work-orders/archive-work-order-client"

assert.equal(workOrderAlreadyArchivedMessage(null), null)
assert.equal(workOrderAlreadyArchivedMessage(undefined), null)
assert.equal(workOrderAlreadyArchivedMessage(""), null)
assert.equal(workOrderAlreadyArchivedMessage("2026-01-01T00:00:00Z"), "This work order is already archived.")

assert.equal(
  friendlyWorkOrderArchiveApiError(403, "Only workspace owners, admins, and managers can archive or restore records."),
  "Only workspace owners, admins, and managers can archive or restore records.",
)
assert.equal(friendlyWorkOrderArchiveApiError(404, undefined), "Work order not found.")
assert.equal(
  friendlyWorkOrderArchiveApiError(500, "internal"),
  "Could not complete that action. Try again in a moment.",
)

console.log("test-work-order-archive: ok")
