/**
 * Sanity checks for industry-aware equipment form UI (no Jest).
 * Run: pnpm tsx scripts/verify-equipment-form-industry-ui.ts
 */
import { getEquipmentFormIndustryUi } from "../lib/equipment/equipment-form-industry-ui"

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const medical = getEquipmentFormIndustryUi("biomedical_medical_equipment")
assert(!medical.placeholders.name.toLowerCase().includes("rooftop"), "Medical name placeholder should not reference rooftop")
assert(
  !medical.placeholders.manufacturer.toLowerCase().includes("carrier"),
  "Medical manufacturer placeholder should not default to Carrier",
)
assert(medical.equipmentTypes.includes("Patient Monitor"), "Medical should include Patient Monitor")
assert(medical.equipmentTypes.includes("ECG"), "Medical should include ECG")
assert(!medical.equipmentTypes.includes("Rooftop Unit"), "Medical types should not list Rooftop Unit")

const hvac = getEquipmentFormIndustryUi("hvac_r")
assert(hvac.equipmentTypes.includes("Rooftop Unit"), "HVAC should include Rooftop Unit")

const electrical = getEquipmentFormIndustryUi("electrical")
assert(electrical.equipmentTypes.includes("Panel"), "Electrical should include Panel")

const garage = getEquipmentFormIndustryUi("garage_door")
assert(garage.equipmentTypes.includes("Sectional Door"), "Garage should include Sectional Door")

console.log("verify-equipment-form-industry-ui: OK")
