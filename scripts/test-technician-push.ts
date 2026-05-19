import assert from "node:assert/strict"

import {
  buildTechnicianPushMessage,
  technicianPushIdempotencyKey,
} from "../lib/push/technician-push-messages"
import { isTechnicianPushAlertType, TECHNICIAN_PUSH_ALERT_TYPES } from "../lib/push/technician-push-alert-types"
import {
  isValidExpoPushToken,
  normalizePushDevicePlatform,
} from "../lib/push/push-device-validation"

assert.equal(TECHNICIAN_PUSH_ALERT_TYPES.length, 5)
assert.equal(isTechnicianPushAlertType("work_assigned"), true)
assert.equal(isTechnicianPushAlertType("marketing"), false)

const assigned = buildTechnicianPushMessage({
  alertType: "work_assigned",
  workOrderTitle: "RTU maintenance",
  customerName: "Volunteer Valley Roofing",
})
assert.match(assigned.title, /assigned/i)
assert.match(assigned.body, /Volunteer Valley Roofing/)

const schedule = buildTechnicianPushMessage({
  alertType: "schedule_changed",
  workOrderTitle: "PM visit",
  scheduledLabel: "Tue 2:00 PM",
})
assert.match(schedule.body, /2:00 PM/)

assert.equal(
  isValidExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"),
  true,
)
assert.equal(isValidExpoPushToken("not-a-token"), false)

assert.equal(normalizePushDevicePlatform("ios"), "ios")
assert.equal(normalizePushDevicePlatform("ANDROID"), "android")
assert.equal(normalizePushDevicePlatform(null), "unknown")

const key = technicianPushIdempotencyKey({
  alertType: "signature_needed",
  organizationId: "00000000-0000-4000-8000-000000000001",
  recipientUserId: "00000000-0000-4000-8000-000000000002",
  relatedEntityId: "00000000-0000-4000-8000-000000000003",
})
assert.match(key, /^tech_push:signature_needed:/)

console.log("test-technician-push.ts: all assertions passed")
