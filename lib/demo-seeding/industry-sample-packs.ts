import "server-only"

import type { DemoIndustryKey, DemoIndustryProfile } from "@/lib/demo-seeding/profiles"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"

/** Prefix for generic demo inventory locations (reset matches this pattern). */
export const DEMO_INVENTORY_LOCATION_CODE_PREFIX = "EQ-DEMO-LOC-%"

export type SampleModuleTargets = {
  vendors: number
  catalogItems: number
  quotes: number
  invoices: number
  purchaseOrders: number
  prospects: number
  inventoryLocations: number
  /** Customer-timeline style communication_events rows */
  communications: number
  /** ai_ops_recommendation_lifecycle rows (plus matching events) */
  aiOpsRecommendations: number
  /** Max technician_skill_tags to insert from the industry profile */
  skillTags: number
}

export function getSampleModuleTargets(industry: DemoIndustryKey): SampleModuleTargets {
  if (industry === "biomedical_medical_equipment") {
    return {
      vendors: 12,
      catalogItems: 56,
      quotes: 20,
      invoices: 15,
      purchaseOrders: 12,
      prospects: 20,
      inventoryLocations: 3,
      communications: 16,
      aiOpsRecommendations: 6,
      skillTags: 8,
    }
  }
  return {
    vendors: 8,
    catalogItems: 22,
    quotes: 10,
    invoices: 8,
    purchaseOrders: 5,
    prospects: 12,
    inventoryLocations: 2,
    communications: 10,
    aiOpsRecommendations: 4,
    skillTags: 6,
  }
}

export type DemoVendorRow = {
  name: string
  email: string
  phone: string
  contact: string
}

const BASE_VENDOR_STEMS: DemoVendorRow[] = [
  { name: "Regional Parts Supply Co.", email: "orders@regionalparts-demo.example.com", phone: "(800) 555-0101", contact: "Inside Sales" },
  { name: "OEM Consumables Desk", email: "consumables@oemchannel-demo.example.com", phone: "(800) 555-0102", contact: "Channel Partner" },
  { name: "Fleet Tools & Supplies", email: "fleet@toolingsupply-demo.example.com", phone: "(800) 555-0103", contact: "Account Manager" },
  { name: "Industrial Fasteners West", email: "west@fasteners-demo.example.com", phone: "(800) 555-0104", contact: "Counter Sales" },
  { name: "Controls & Electrical Supply", email: "counter@ctrlsupply-demo.example.com", phone: "(800) 555-0105", contact: "Will-call desk" },
  { name: "HVAC-R Wholesale Partners", email: "orders@hvacwholesale-demo.example.com", phone: "(800) 555-0106", contact: "Branch buyer" },
  { name: "Plumbing & Hydronics Supply", email: "sales@hydronics-demo.example.com", phone: "(800) 555-0107", contact: "Quotations" },
  { name: "Safety & PPE Outfitters", email: "team@safetysupply-demo.example.com", phone: "(800) 555-0108", contact: "Corporate accounts" },
  { name: "Garage Door Systems Supply", email: "parts@doorsystems-demo.example.com", phone: "(800) 555-0109", contact: "Parts desk" },
  { name: "Low-Voltage & Wire Distributors", email: "orders@lowvolt-demo.example.com", phone: "(800) 555-0110", contact: "Project desk" },
  { name: "Commercial Hardware & Locks", email: "sales@comlocks-demo.example.com", phone: "(800) 555-0111", contact: "Spec team" },
  { name: "Refrigeration Components Inc.", email: "parts@refcomponents-demo.example.com", phone: "(800) 555-0112", contact: "Technical sales" },
]

export function getVendorsForIndustry(industry: DemoIndustryKey, count: number): DemoVendorRow[] {
  const label = WORKSPACE_INDUSTRY_DEFINITIONS[industry]?.label ?? "Field service"
  const out: DemoVendorRow[] = []
  for (let i = 0; i < count; i += 1) {
    const base = BASE_VENDOR_STEMS[i % BASE_VENDOR_STEMS.length]!
    out.push({
      ...base,
      name: `${base.name} (${label})`,
    })
  }
  return out
}

export type CatalogPartTemplate = {
  name: string
  itemType: "part" | "accessory" | "service"
  category: string
}

export function getCatalogPartTemplates(profile: DemoIndustryProfile, industry: DemoIndustryKey, count: number): CatalogPartTemplate[] {
  const parts: CatalogPartTemplate[] = []
  const eq =
    profile.equipmentAssetTypes.length > 0 ?
      profile.equipmentAssetTypes
    : [{ name: "Field asset", category: "General", manufacturer: "Various" }]
  const svc = WORKSPACE_INDUSTRY_DEFINITIONS[industry]?.defaultServiceCategories ?? []
  let i = 0
  while (parts.length < count) {
    const t = eq[i % eq.length]!
    const svcName = svc[i % Math.max(svc.length, 1)] ?? "Field service"
    const cycle = i % 5
    if (cycle === 0) {
      parts.push({ name: `${t.name} — filter / consumable kit`, itemType: "part", category: t.category })
    } else if (cycle === 1) {
      parts.push({ name: `${t.category} — common hardware assortment`, itemType: "accessory", category: t.category })
    } else if (cycle === 2) {
      parts.push({ name: `${svcName} — scheduled maintenance bundle`, itemType: "service", category: svcName })
    } else if (cycle === 3) {
      parts.push({ name: `${t.manufacturer} — recommended spare`, itemType: "part", category: t.category })
    } else {
      parts.push({ name: `${t.name} — inspection & test labor (sample)`, itemType: "service", category: t.category })
    }
    i += 1
  }
  return parts.slice(0, count)
}

export function siteLabelsForIndustry(industry: DemoIndustryKey): string[] {
  if (industry === "biomedical_medical_equipment") {
    return ["ICU", "Radiology", "SPD / Sterile Processing", "Infusion Bay", "Emergency", "Lab", "Oncology Suite"]
  }
  if (industry === "property_management") {
    return ["Building A — common areas", "Parking structure", "Central plant", "Tenant suite", "Roof access"]
  }
  if (industry === "hvac_r" || industry === "mep") {
    return ["Mechanical penthouse", "Tenant floor", "RTU roof zone", "Chiller yard", "Controls room"]
  }
  if (industry === "electrical" || industry === "fire_security" || industry === "av_installation") {
    return ["MDF / IDF", "Electrical room", "Ceiling plenum", "Exterior pad", "Security head-end"]
  }
  if (industry === "plumbing" || industry === "septic") {
    return ["Mechanical room", "Restroom core", "Exterior service yard", "Pump station", "Tenant space"]
  }
  if (industry === "garage_door" || industry === "locksmith") {
    return ["Loading dock", "Main entrance", "Service bay", "Warehouse door", "Office entry"]
  }
  return ["Job site", "Shop / warehouse", "Customer facility", "Rooftop / exterior", "Mechanical space"]
}

export function contactRolesForIndustry(industry: DemoIndustryKey): string[] {
  if (industry === "biomedical_medical_equipment") {
    return ["Clinical Engineering", "Facilities", "Imaging Director", "SPD Manager", "Biomed Lead"]
  }
  return [
    "Operations",
    "Facilities",
    "Property Manager",
    "Maintenance Supervisor",
    "Service Coordinator",
    "Plant Engineer",
    "Facilities Director",
  ]
}

export function slugifySkillTag(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}
