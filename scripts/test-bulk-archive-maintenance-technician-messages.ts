import assert from "node:assert/strict"
import {
  bulkMaintenancePlanArchivePartialToast,
  bulkMaintenancePlanArchiveSuccessToast,
  maintenancePlanAlreadyArchivedMessage,
} from "../lib/maintenance-plans/bulk-archive-messages"
import {
  isMaintenancePlanBulkArchiveEligible,
  maintenancePlanBulkArchiveBlockMessage,
} from "../lib/maintenance-plans/bulk-archive-eligibility"
import { friendlyBulkMaintenancePlanArchiveApiError } from "../lib/maintenance-plans/bulk-archive-maintenance-plans-client"
import {
  bulkTechnicianDeactivatePartialToast,
  bulkTechnicianDeactivateSuccessToast,
  technicianAlreadyDeactivatedMessage,
} from "../lib/technicians/bulk-deactivate-messages"
import {
  isTechnicianBulkDeactivateEligible,
  technicianBulkDeactivateBlockMessage,
} from "../lib/technicians/bulk-deactivate-eligibility"
import { friendlyBulkTechnicianDeactivateApiError } from "../lib/technicians/bulk-deactivate-technicians-client"

assert.equal(maintenancePlanAlreadyArchivedMessage(null), null)
assert.equal(bulkMaintenancePlanArchiveSuccessToast(1), "Maintenance plan archived")
assert.equal(bulkMaintenancePlanArchiveSuccessToast(2), "Maintenance plans archived")
assert.equal(
  bulkMaintenancePlanArchivePartialToast(1, 2),
  "1 maintenance plan archived. 2 could not be archived.",
)
assert.equal(
  friendlyBulkMaintenancePlanArchiveApiError(403, undefined),
  "You do not have permission to archive maintenance plans.",
)

assert.equal(isMaintenancePlanBulkArchiveEligible({ isArchived: false }), true)
assert.equal(isMaintenancePlanBulkArchiveEligible({ isArchived: true }), false)
assert.equal(
  maintenancePlanBulkArchiveBlockMessage({ archivedAt: "2026-01-01" }),
  "This maintenance plan is already archived.",
)

assert.equal(technicianAlreadyDeactivatedMessage("active"), null)
assert.equal(technicianAlreadyDeactivatedMessage("suspended"), "This technician is already deactivated.")
assert.equal(bulkTechnicianDeactivateSuccessToast(1), "Technician deactivated")
assert.equal(bulkTechnicianDeactivateSuccessToast(3), "Technicians deactivated")
assert.equal(
  bulkTechnicianDeactivatePartialToast(2, 1),
  "2 technicians deactivated. 1 could not be deactivated.",
)
assert.equal(
  friendlyBulkTechnicianDeactivateApiError(403, undefined),
  "You do not have permission to deactivate technicians.",
)

assert.equal(
  isTechnicianBulkDeactivateEligible({
    targetUserId: "a",
    actorUserId: "b",
    targetRole: "tech",
    targetStatus: "active",
    actorIsOwner: true,
    actorIsAdmin: false,
    activeOwnerCount: 1,
  }),
  true,
)
assert.equal(
  technicianBulkDeactivateBlockMessage({
    targetUserId: "same",
    actorUserId: "same",
    targetRole: "tech",
    targetStatus: "active",
    actorIsOwner: true,
    actorIsAdmin: false,
    activeOwnerCount: 1,
  }),
  "You cannot deactivate your own account.",
)
assert.equal(
  technicianBulkDeactivateBlockMessage({
    targetUserId: "owner-id",
    actorUserId: "admin-id",
    targetRole: "owner",
    targetStatus: "active",
    actorIsOwner: false,
    actorIsAdmin: true,
    activeOwnerCount: 1,
  }),
  "Admins cannot deactivate owners.",
)
assert.equal(
  technicianBulkDeactivateBlockMessage({
    targetUserId: "owner-id",
    actorUserId: "owner-id-2",
    targetRole: "owner",
    targetStatus: "active",
    actorIsOwner: true,
    actorIsAdmin: false,
    activeOwnerCount: 1,
  }),
  "Cannot deactivate the last owner.",
)

console.log("test-bulk-archive-maintenance-technician-messages: ok")
