import { WORKSPACE_INDUSTRY_KEYS, type WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** One-line operational hint per vertical (launchpad + framing). */
export const OPERATIONAL_HINTS: Record<WorkspaceIndustryKey, string> = {
  mep: "Cross-trade jobs, mechanical rounds, and electrical follow-ups are supported out of the box.",
  hvac_r: "Rooftop units, refrigerant checks, and PM rounds are great first workflows to try.",
  electrical: "Panel inspections, service upgrades, and troubleshooting jobs map cleanly here.",
  plumbing: "Booster pumps, backflow checks, and recurring PM visits work well as first examples.",
  field_service: "Dispatch-first teams usually start with a customer, an asset, and a first work order.",
  garage_door:
    "Install, balance, and safety-check work orders mirror how teams use Equipify day to day.",
  locksmith: "Access work, rekeys, and scheduled maintenance visits are easy to model first.",
  property_management:
    "Building rounds, tenant requests, and shared equipment registers are a natural fit.",
  equipment_service_repair:
    "Compressors, service intervals, and warranty tracking are common starting points.",
  appliance_repair: "In-home repairs, parts usage, and repeat-customer equipment are good first paths.",
  commercial_equipment:
    "Compressors, service intervals, and warranty tracking are common starting points.",
  fire_security:
    "Inspection routes, panel tests, and recurring service contracts fit this workspace.",
  specialty_contractors:
    "Project-style work orders, quotes, and invoices align with how specialty crews operate.",
  septic: "Pump service, inspections, and route-style maintenance are natural first workflows.",
  av_installation:
    "Rack builds, commissioning visits, and follow-up service calls map well to this setup.",
  industrial_equipment:
    "Production assets, downtime risk, and PM windows are easy to model with your first work orders.",
  calibration_inspection:
    "Certificates, traceable assets, and due dates are a natural first path in this workspace.",
  facility_maintenance:
    "Building systems, recurring rounds, and tenant-facing requests map cleanly to work orders.",
  elevator_service:
    "Inspection cycles, callbacks, and compliance-heavy visits are a strong first workflow to try.",
  generator_power:
    "Load tests, PM intervals, and emergency callouts are common starting points here.",
  equipment_rental:
    "Rental readiness, turnaround inspections, and staged assets are great first workflows to try.",
  refrigeration_service:
    "Emergency cooling, rack compressors, and refrigerant-related PM are natural first examples.",
  fleet_mobile_equipment:
    "Road units, preventive intervals, and driver-reported issues map well to your first work orders.",
  material_handling:
    "Forklifts, batteries, and warehouse PM routes are strong first workflows to explore.",
  biomedical_medical_equipment:
    "Clinical assets, PM windows, and compliance-heavy work orders are already illustrated.",
}

function assertFullHints(): void {
  for (const k of WORKSPACE_INDUSTRY_KEYS) {
    if (!OPERATIONAL_HINTS[k]) {
      throw new Error(`Missing operational hint for industry: ${k}`)
    }
  }
}
assertFullHints()
