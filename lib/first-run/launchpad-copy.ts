import type { DemoIndustryKey } from "@/lib/demo-seeding/profiles"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"

export function industryLabelForLaunchpad(industryRaw: string | null | undefined): string {
  const k = normalizeIndustryKey(industryRaw ?? undefined)
  return WORKSPACE_INDUSTRY_DEFINITIONS[k]?.label ?? "your sector"
}

/** One-line operational hint for the launchpad intro (customer-facing). */
export function industryOperationalHint(industryRaw: string | null | undefined): string {
  const k = normalizeIndustryKey(industryRaw ?? undefined) as DemoIndustryKey
  switch (k) {
    case "hvac_r":
      return "Rooftop units, refrigerant checks, and PM rounds are great first workflows to try."
    case "electrical":
      return "Panel inspections, service upgrades, and troubleshooting jobs map cleanly here."
    case "plumbing":
      return "Booster pumps, backflow checks, and recurring PM visits work well as first examples."
    case "commercial_equipment":
    case "equipment_service_repair":
      return "Compressors, service intervals, and warranty tracking are common starting points."
    case "fire_security":
      return "Inspection routes, panel tests, and recurring service contracts fit this workspace."
    case "biomedical_medical_equipment":
      return "Clinical assets, PM windows, and compliance-heavy work orders are already illustrated."
    case "property_management":
      return "Building rounds, tenant requests, and shared equipment registers are a natural fit."
    case "garage_door":
      return "Install, balance, and safety-check work orders mirror how teams use Equipify day to day."
    case "locksmith":
      return "Access work, rekeys, and scheduled maintenance visits are easy to model first."
    case "appliance_repair":
      return "In-home repairs, parts usage, and repeat-customer equipment are good first paths."
    case "mep":
      return "Cross-trade jobs, mechanical rounds, and electrical follow-ups are supported out of the box."
    case "field_service":
      return "Dispatch-first teams usually start with a customer, an asset, and a first work order."
    case "specialty_contractors":
      return "Project-style work orders, quotes, and invoices align with how specialty crews operate."
    case "septic":
      return "Pump service, inspections, and route-style maintenance are natural first workflows."
    case "av_installation":
      return "Rack builds, commissioning visits, and follow-up service calls map well to this setup."
    default:
      return "Start with a customer, an asset, and a work order — then layer quotes and billing when ready."
  }
}
