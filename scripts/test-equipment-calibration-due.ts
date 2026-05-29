import assert from "node:assert/strict"
import {
  addMonthsToDateYmd,
  applyNextCalibrationDueAutoFill,
  computeNextCalibrationDueYmd,
  normalizeOptionalEquipmentDateInput,
  optionalEquipmentDateFieldError,
} from "../lib/equipment/equipment-date-fields"

assert.equal(normalizeOptionalEquipmentDateInput("2026-05-18"), "2026-05-18")
assert.equal(normalizeOptionalEquipmentDateInput("5/18/2026"), "2026-05-18")
assert.equal(normalizeOptionalEquipmentDateInput("not-a-date"), null)
assert.equal(optionalEquipmentDateFieldError(""), undefined)
assert.equal(optionalEquipmentDateFieldError("bad"), "Use a valid date.")

assert.equal(addMonthsToDateYmd("2026-01-31", 1), "2026-02-28")
assert.equal(addMonthsToDateYmd("2025-06-15", 12), "2026-06-15")

assert.equal(
  computeNextCalibrationDueYmd({ anchorYmd: "2026-03-10", intervalMonths: 12 }),
  "2027-03-10",
)
assert.equal(
  computeNextCalibrationDueYmd({ anchorYmd: "2026-03-10", intervalMonths: null }),
  "2027-03-10",
)
assert.equal(
  computeNextCalibrationDueYmd({ anchorYmd: "2026-03-10", intervalMonths: 6 }),
  "2026-09-10",
)

const auto = applyNextCalibrationDueAutoFill(
  {
    installDate: "2026-03-10",
    calibrationIntervalMonths: "12",
    nextCalibrationDue: "",
  },
  false,
)
assert.equal(auto.nextCalibrationDue, "2027-03-10")

const untouched = applyNextCalibrationDueAutoFill(
  { installDate: "", calibrationIntervalMonths: "12", nextCalibrationDue: "" },
  true,
)
assert.equal(untouched.nextCalibrationDue, "")

console.log("test-equipment-calibration-due: ok")
