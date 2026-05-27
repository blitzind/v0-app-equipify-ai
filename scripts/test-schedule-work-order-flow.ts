/**
 * Regression checks for Schedule + Work Order scheduling flow.
 * Run: pnpm test:schedule-work-order-flow
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  addMinutesToTimeHm,
  formatScheduleTimeRange,
  isEndTimeAfterStart,
  SCHEDULE_WORK_ORDER_FLOW_QA_MARKER,
  scheduleTimeRangeError,
} from "../lib/work-orders/schedule-time"
import { workOrderTypeUiLabel } from "../lib/work-orders/work-order-type-labels"

function main(): void {
  assert.equal(SCHEDULE_WORK_ORDER_FLOW_QA_MARKER, "schedule-work-order-flow-v1")
  assert.equal(workOrderTypeUiLabel("PM"), "Calibration")
  assert.equal(workOrderTypeUiLabel("Repair"), "Repair")
  assert.ok(isEndTimeAfterStart("08:00", "10:00"))
  assert.ok(!isEndTimeAfterStart("10:00", "08:00"))
  assert.match(scheduleTimeRangeError("09:00", "08:00") ?? "", /after start/)
  assert.equal(addMinutesToTimeHm("08:00", 120), "10:00")
  assert.match(formatScheduleTimeRange("08:00:00", "10:00:00"), /08:00.*10:00.*2h/)

  const migration = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270328120000_work_orders_scheduled_end_time.sql"),
    "utf8",
  )
  assert.match(migration, /scheduled_end_time/)

  const createModal = fs.readFileSync(
    path.join(process.cwd(), "components/work-orders/create-work-order-modal.tsx"),
    "utf8",
  )
  assert.match(createModal, /scheduled_end_time/)
  assert.match(createModal, /scheduledEndTime/)
  assert.match(createModal, /status.*scheduled/s)
  assert.match(createModal, /CustomerSearchPicker/)
  assert.match(createModal, /workOrderTypeUiLabel/)

  const quickAppt = fs.readFileSync(
    path.join(process.cwd(), "components/dispatch/quick-appointment-dialog.tsx"),
    "utf8",
  )
  assert.match(quickAppt, /scheduled_end_time/)
  assert.match(quickAppt, /endTimeHhMm/)
  assert.match(quickAppt, /CustomerSearchPicker/)

  const schedulePage = fs.readFileSync(
    path.join(process.cwd(), "app/(dashboard)/service-schedule/page.tsx"),
    "utf8",
  )
  assert.match(schedulePage, /assignedScheduleKey/)
  assert.match(schedulePage, /formatScheduleTimeRange/)
  assert.match(schedulePage, /scheduleDate/)

  const customerPicker = fs.readFileSync(
    path.join(process.cwd(), "components/work-orders/customer-search-picker.tsx"),
    "utf8",
  )
  assert.match(customerPicker, /exact match/)
  assert.match(customerPicker, /setOpen\(true\)/)

  console.log("schedule-work-order-flow-v1 checks passed")
}

main()
