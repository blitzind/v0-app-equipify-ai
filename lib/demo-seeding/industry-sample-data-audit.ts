import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import { DEMO_PROFILE_OVERRIDES, isRichDemoProfileIndustry } from "@/lib/demo-seeding/industry-demo-profile-overrides"

/**
 * Marketing-aligned audit rows (mirrors equipify-site `MARKETING_INDUSTRIES` + legacy slugs).
 * `typicalFormValue` = hyphen slug from marketing / URL query.
 */
export type IndustrySampleDataAuditRow = {
  marketingSlug: string
  displayLabel: string
  typicalFormValue: string
  normalizedWorkspaceKey: WorkspaceIndustryKey
  sampleDataPackKey: WorkspaceIndustryKey
  coverage: "rich-pack" | "registry-starter"
  notes?: string
}

const P = "rich-pack" as const
const R = "registry-starter" as const

/**
 * Expected normalization targets (must match `normalizeIndustryKey` in `profiles.ts`).
 * Coverage is derived in `assertIndustrySampleDataAuditConsistent` from `DEMO_PROFILE_OVERRIDES`.
 */
export const INDUSTRY_SAMPLE_DATA_AUDIT: readonly IndustrySampleDataAuditRow[] = [
  { marketingSlug: "medical-equipment", displayLabel: "Medical Equipment", typicalFormValue: "medical-equipment", normalizedWorkspaceKey: "biomedical_medical_equipment", sampleDataPackKey: "biomedical_medical_equipment", coverage: P },
  { marketingSlug: "hvac-r", displayLabel: "HVAC-R", typicalFormValue: "hvac-r", normalizedWorkspaceKey: "hvac_r", sampleDataPackKey: "hvac_r", coverage: R },
  { marketingSlug: "electrical", displayLabel: "Electrical", typicalFormValue: "electrical", normalizedWorkspaceKey: "electrical", sampleDataPackKey: "electrical", coverage: R },
  { marketingSlug: "plumbing", displayLabel: "Plumbing", typicalFormValue: "plumbing", normalizedWorkspaceKey: "plumbing", sampleDataPackKey: "plumbing", coverage: R },
  { marketingSlug: "field-service", displayLabel: "Field Service", typicalFormValue: "field-service", normalizedWorkspaceKey: "field_service", sampleDataPackKey: "field_service", coverage: R },
  { marketingSlug: "garage-door", displayLabel: "Garage Door", typicalFormValue: "garage-door", normalizedWorkspaceKey: "garage_door", sampleDataPackKey: "garage_door", coverage: R },
  { marketingSlug: "locksmith", displayLabel: "Locksmith", typicalFormValue: "locksmith", normalizedWorkspaceKey: "locksmith", sampleDataPackKey: "locksmith", coverage: R },
  { marketingSlug: "property-management", displayLabel: "Property Management", typicalFormValue: "property-management", normalizedWorkspaceKey: "property_management", sampleDataPackKey: "property_management", coverage: R },
  { marketingSlug: "appliance-repair", displayLabel: "Appliance Repair", typicalFormValue: "appliance-repair", normalizedWorkspaceKey: "appliance_repair", sampleDataPackKey: "appliance_repair", coverage: R },
  { marketingSlug: "commercial-equipment", displayLabel: "Commercial Equipment", typicalFormValue: "commercial-equipment", normalizedWorkspaceKey: "commercial_equipment", sampleDataPackKey: "commercial_equipment", coverage: P },
  { marketingSlug: "fire-security", displayLabel: "Fire & Security", typicalFormValue: "fire-security", normalizedWorkspaceKey: "fire_security", sampleDataPackKey: "fire_security", coverage: R },
  { marketingSlug: "specialty-contractors", displayLabel: "Specialty Contractors", typicalFormValue: "specialty-contractors", normalizedWorkspaceKey: "specialty_contractors", sampleDataPackKey: "specialty_contractors", coverage: R },
  { marketingSlug: "septic", displayLabel: "Septic", typicalFormValue: "septic", normalizedWorkspaceKey: "septic", sampleDataPackKey: "septic", coverage: R },
  { marketingSlug: "av-installation", displayLabel: "A/V Installation", typicalFormValue: "av-installation", normalizedWorkspaceKey: "av_installation", sampleDataPackKey: "av_installation", coverage: R },
  { marketingSlug: "mep", displayLabel: "MEP", typicalFormValue: "mep", normalizedWorkspaceKey: "mep", sampleDataPackKey: "mep", coverage: R },
  { marketingSlug: "calibration-inspection", displayLabel: "Calibration & Inspection", typicalFormValue: "calibration-inspection", normalizedWorkspaceKey: "calibration_inspection", sampleDataPackKey: "calibration_inspection", coverage: P },
  { marketingSlug: "commercial-hvac", displayLabel: "Commercial HVAC", typicalFormValue: "commercial-hvac", normalizedWorkspaceKey: "hvac_r", sampleDataPackKey: "hvac_r", coverage: R, notes: "Marketing slug aliases to hvac_r" },
  { marketingSlug: "commercial-kitchen-equipment", displayLabel: "Commercial Kitchen", typicalFormValue: "commercial-kitchen-equipment", normalizedWorkspaceKey: "commercial_equipment", sampleDataPackKey: "commercial_equipment", coverage: P, notes: "Site may rewrite query to commercial-equipment" },
  { marketingSlug: "industrial-equipment", displayLabel: "Industrial Equipment", typicalFormValue: "industrial-equipment", normalizedWorkspaceKey: "industrial_equipment", sampleDataPackKey: "industrial_equipment", coverage: R },
  { marketingSlug: "facility-maintenance", displayLabel: "Facility Maintenance", typicalFormValue: "facility-maintenance", normalizedWorkspaceKey: "facility_maintenance", sampleDataPackKey: "facility_maintenance", coverage: P },
  { marketingSlug: "biomedical-equipment", displayLabel: "Biomedical Equipment", typicalFormValue: "biomedical-equipment", normalizedWorkspaceKey: "biomedical_medical_equipment", sampleDataPackKey: "biomedical_medical_equipment", coverage: P, notes: "Site may rewrite query to medical-equipment" },
  { marketingSlug: "elevator-service", displayLabel: "Elevator & Lift", typicalFormValue: "elevator-service", normalizedWorkspaceKey: "elevator_service", sampleDataPackKey: "elevator_service", coverage: P },
  { marketingSlug: "generator-power-systems", displayLabel: "Generator & Power", typicalFormValue: "generator-power-systems", normalizedWorkspaceKey: "generator_power", sampleDataPackKey: "generator_power", coverage: P },
  { marketingSlug: "equipment-rental", displayLabel: "Equipment Rental", typicalFormValue: "equipment-rental", normalizedWorkspaceKey: "equipment_rental", sampleDataPackKey: "equipment_rental", coverage: P },
  { marketingSlug: "refrigeration-service", displayLabel: "Refrigeration Service", typicalFormValue: "refrigeration-service", normalizedWorkspaceKey: "refrigeration_service", sampleDataPackKey: "refrigeration_service", coverage: P },
  { marketingSlug: "fleet-mobile-equipment", displayLabel: "Fleet & Mobile Equipment", typicalFormValue: "fleet-mobile-equipment", normalizedWorkspaceKey: "fleet_mobile_equipment", sampleDataPackKey: "fleet_mobile_equipment", coverage: P },
  { marketingSlug: "material-handling", displayLabel: "Material Handling", typicalFormValue: "material-handling", normalizedWorkspaceKey: "material_handling", sampleDataPackKey: "material_handling", coverage: P },
  { marketingSlug: "equipment-service-repair", displayLabel: "Equipment Service & Repair (legacy)", typicalFormValue: "equipment-service-repair", normalizedWorkspaceKey: "commercial_equipment", sampleDataPackKey: "commercial_equipment", coverage: P, notes: "Consolidated mapping" },
  { marketingSlug: "industrial-service", displayLabel: "Industrial Service (legacy)", typicalFormValue: "industrial-service", normalizedWorkspaceKey: "industrial_equipment", sampleDataPackKey: "industrial_equipment", coverage: R, notes: "Consolidated mapping" },
  { marketingSlug: "other", displayLabel: "Other", typicalFormValue: "other", normalizedWorkspaceKey: "commercial_equipment", sampleDataPackKey: "commercial_equipment", coverage: P },
] as const

/** Runtime check: normalization + rich-pack flags stay aligned with this matrix. */
export function assertIndustrySampleDataAuditConsistent(normalizeIndustryKey: (v: string) => WorkspaceIndustryKey): void {
  for (const r of INDUSTRY_SAMPLE_DATA_AUDIT) {
    const nk = normalizeIndustryKey(r.typicalFormValue)
    if (nk !== r.normalizedWorkspaceKey) {
      throw new Error(`Audit drift: ${r.marketingSlug} normalize→${nk} row declares ${r.normalizedWorkspaceKey}`)
    }
    if (nk !== r.sampleDataPackKey) {
      throw new Error(`Audit row pack key mismatch for ${r.marketingSlug}`)
    }
    const expectedCoverage = DEMO_PROFILE_OVERRIDES[nk] ? P : R
    if (r.coverage !== expectedCoverage) {
      throw new Error(`Audit coverage wrong for ${r.marketingSlug}: row=${r.coverage} derived=${expectedCoverage}`)
    }
    if (isRichDemoProfileIndustry(nk) !== (expectedCoverage === "rich-pack")) {
      throw new Error(`Rich flag mismatch for ${r.marketingSlug}`)
    }
  }
}
