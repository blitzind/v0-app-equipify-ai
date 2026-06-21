/** GS-AI-PLAYBOOK-1A — Canonical growth industry taxonomy (client-safe). */

export const GROWTH_INDUSTRY_IDS = [
  "medical_equipment",
  "hvac_r",
  "electrical",
  "plumbing",
  "field_service",
  "garage_door",
  "locksmith",
  "property_management",
  "appliance_repair",
  "commercial_equipment",
  "fire_security",
  "specialty_contractors",
  "septic",
  "av_installation",
  "mep",
  "commercial_hvac",
  "commercial_kitchen",
  "industrial_equipment",
  "facility_maintenance",
  "biomedical_equipment",
  "generator_power",
  "equipment_rental",
  "fleet_mobile_equipment",
  "material_handling",
  "calibration_inspection",
  "elevator_lift",
  "refrigeration_service",
] as const

export type GrowthIndustryId = (typeof GROWTH_INDUSTRY_IDS)[number]

export type GrowthIndustryTaxonomyEntry = {
  id: GrowthIndustryId
  label: string
  description: string
  aliases: string[]
  keywords: string[]
  naics: string[]
  sic: string[]
}

/** Confidence weights — deterministic resolver only (no AI). */
export const GROWTH_INDUSTRY_RESOLVER_CONFIDENCE = {
  exact_naics: 95,
  exact_sic: 90,
  exact_keyword: 82,
  alias_match: 76,
  company_name_hint: 62,
  research_text_hint: 56,
} as const

export type GrowthIndustryResolverSignalType = keyof typeof GROWTH_INDUSTRY_RESOLVER_CONFIDENCE

export const GROWTH_INDUSTRY_TAXONOMY: Record<GrowthIndustryId, GrowthIndustryTaxonomyEntry> = {
  medical_equipment: {
    id: "medical_equipment",
    label: "Medical Equipment",
    description: "DME dealers, imaging service, hospital equipment sales and service organizations.",
    aliases: ["medical-equipment", "medical_equipment_service", "dme", "imaging service", "clinical equipment"],
    keywords: ["medical equipment", "dme", "imaging service", "hospital equipment", "clinical devices", "medtech"],
    naics: ["423450", "621999"],
    sic: ["5047", "8099"],
  },
  biomedical_equipment: {
    id: "biomedical_equipment",
    label: "Biomedical Equipment Service",
    description: "Clinical engineering, HTM, biomed shops, and in-house biomedical maintenance teams.",
    aliases: [
      "biomedical",
      "biomedical_medical_equipment",
      "biomedical-equipment",
      "biomed",
      "clinical engineering",
      "htm",
      "healthcare technology management",
    ],
    keywords: ["biomedical", "biomed", "clinical engineering", "htm", "patient monitoring", "sterilization", "medtech"],
    naics: ["811219", "541380", "621999"],
    sic: ["7379", "8099"],
  },
  hvac_r: {
    id: "hvac_r",
    label: "HVAC-R",
    description: "Residential and light commercial HVAC plus refrigeration contractors.",
    aliases: ["hvac", "hvac-r", "hvacr", "heating and cooling", "air conditioning"],
    keywords: ["hvac", "heating", "cooling", "air conditioning", "refrigeration", "furnace"],
    naics: ["238220", "811412"],
    sic: ["1711", "7623"],
  },
  commercial_hvac: {
    id: "commercial_hvac",
    label: "Commercial HVAC",
    description: "Rooftop units, BAS-driven comfort, and multi-site commercial mechanical service.",
    aliases: ["commercial hvac", "rtu service", "building hvac", "mechanical service"],
    keywords: ["commercial hvac", "rooftop unit", "rtu", "building automation", "mechanical contractor"],
    naics: ["238220", "238290"],
    sic: ["1711"],
  },
  electrical: {
    id: "electrical",
    label: "Electrical",
    description: "Commercial and industrial electrical contractors and service teams.",
    aliases: ["electric", "electrical contractor", "electrical service"],
    keywords: ["electrical", "electrician", "panel", "switchgear", "lighting"],
    naics: ["238210"],
    sic: ["1731"],
  },
  plumbing: {
    id: "plumbing",
    label: "Plumbing",
    description: "Commercial plumbing, backflow, pumps, and drain service contractors.",
    aliases: ["plumber", "plumbing contractor", "drain service"],
    keywords: ["plumbing", "backflow", "drain", "water heater", "booster pump"],
    naics: ["238220"],
    sic: ["1711"],
  },
  field_service: {
    id: "field_service",
    label: "Field Service",
    description: "Dispatch-heavy mixed-trade and multi-equipment field service operators.",
    aliases: ["field-service", "fieldservice", "general field service", "service contractor"],
    keywords: ["field service", "dispatch", "technician fleet", "service call", "maintenance contract"],
    naics: ["811310", "561790"],
    sic: ["7699"],
  },
  garage_door: {
    id: "garage_door",
    label: "Garage Door",
    description: "Overhead and high-speed door operators, springs, and safety systems.",
    aliases: ["garage-door", "overhead door", "door operator"],
    keywords: ["garage door", "overhead door", "door operator", "high-speed door"],
    naics: ["238290", "811490"],
    sic: ["1791"],
  },
  locksmith: {
    id: "locksmith",
    label: "Locksmith",
    description: "Commercial locksmithing, access control, and door hardware service.",
    aliases: ["locksmithing", "access control", "door hardware"],
    keywords: ["locksmith", "access control", "master key", "door hardware"],
    naics: ["561622", "238290"],
    sic: ["7699"],
  },
  property_management: {
    id: "property_management",
    label: "Property Management",
    description: "Facilities and maintenance operations across tenant portfolios.",
    aliases: ["property-management", "facilities", "building operations"],
    keywords: ["property management", "facilities", "tenant", "building maintenance"],
    naics: ["531311", "531312", "561790"],
    sic: ["6531", "8741"],
  },
  appliance_repair: {
    id: "appliance_repair",
    label: "Appliance Repair",
    description: "Residential and light commercial appliance service organizations.",
    aliases: ["appliance-repair", "appliances", "home appliance"],
    keywords: ["appliance repair", "washer", "dryer", "refrigerator", "dishwasher"],
    naics: ["811412"],
    sic: ["7623"],
  },
  commercial_equipment: {
    id: "commercial_equipment",
    label: "Commercial Equipment",
    description: "Broad commercial equipment maintenance across sites and capital assets.",
    aliases: ["commercial-equipment", "equipment service", "equipment repair"],
    keywords: ["commercial equipment", "capital asset", "equipment maintenance", "service contract"],
    naics: ["811310", "423440"],
    sic: ["7699"],
  },
  commercial_kitchen: {
    id: "commercial_kitchen",
    label: "Commercial Kitchen Equipment",
    description: "Foodservice equipment dealers and kitchen equipment field service.",
    aliases: ["commercial kitchen", "foodservice equipment", "restaurant equipment"],
    keywords: ["commercial kitchen", "foodservice", "restaurant equipment", "walk-in", "cooking line"],
    naics: ["423440", "811412"],
    sic: ["5084"],
  },
  fire_security: {
    id: "fire_security",
    label: "Fire & Security",
    description: "Fire alarm, life safety, and electronic security integrators.",
    aliases: ["fire-security", "fire alarm", "security systems", "life safety"],
    keywords: ["fire alarm", "security", "access control", "inspection", "deficiency"],
    naics: ["561621", "238210"],
    sic: ["7382"],
  },
  specialty_contractors: {
    id: "specialty_contractors",
    label: "Specialty Contractors",
    description: "Niche trade contractors with project and service workflows.",
    aliases: ["specialty contractors", "specialty trade", "subcontractor"],
    keywords: ["specialty contractor", "niche trade", "punch list", "warranty callback"],
    naics: ["238990", "238290"],
    sic: ["1799"],
  },
  septic: {
    id: "septic",
    label: "Septic & Wastewater",
    description: "Septic pump-outs, lift stations, and wastewater service.",
    aliases: ["septic", "wastewater", "lift station"],
    keywords: ["septic", "wastewater", "lift station", "pump-out", "drainfield"],
    naics: ["562991", "237110"],
    sic: ["4959"],
  },
  av_installation: {
    id: "av_installation",
    label: "AV Installation",
    description: "Pro AV integration, conferencing, and digital signage service.",
    aliases: ["av installation", "audio visual", "pro av"],
    keywords: ["av integration", "audio visual", "conferencing", "digital signage"],
    naics: ["238210", "517410"],
    sic: ["1731"],
  },
  mep: {
    id: "mep",
    label: "MEP",
    description: "Integrated mechanical, electrical, and plumbing service for buildings.",
    aliases: ["m-e-p", "mechanical electrical plumbing", "integrated mep"],
    keywords: ["mep", "mechanical", "electrical", "plumbing", "building systems"],
    naics: ["238220", "238210"],
    sic: ["1711"],
  },
  industrial_equipment: {
    id: "industrial_equipment",
    label: "Industrial Equipment",
    description: "Heavy industrial assets, uptime programs, and recurring PM contracts.",
    aliases: ["industrial equipment", "industrial service", "process equipment"],
    keywords: ["industrial equipment", "predictive maintenance", "rotating equipment", "plant outage"],
    naics: ["811310", "333248"],
    sic: ["7699"],
  },
  facility_maintenance: {
    id: "facility_maintenance",
    label: "Facility Maintenance",
    description: "Building systems PM, vendor coordination, and portfolio maintenance.",
    aliases: ["facility maintenance", "facilities maintenance", "building maintenance"],
    keywords: ["facility maintenance", "building rounds", "vendor coordination", "preventive maintenance"],
    naics: ["561790", "531312"],
    sic: ["8741"],
  },
  generator_power: {
    id: "generator_power",
    label: "Generator & Power Systems",
    description: "Standby power, ATS, load banking, and generator PM programs.",
    aliases: ["generator", "standby power", "generator service"],
    keywords: ["generator", "standby power", "load bank", "automatic transfer switch", "ats"],
    naics: ["811310", "335312"],
    sic: ["7699"],
  },
  equipment_rental: {
    id: "equipment_rental",
    label: "Equipment Rental",
    description: "Rental fleet readiness, inspections, and shop turnaround.",
    aliases: ["equipment rental", "rental fleet", "tool rental"],
    keywords: ["equipment rental", "rental-ready", "turnaround", "inspection checklist"],
    naics: ["532412", "532490"],
    sic: ["7353"],
  },
  fleet_mobile_equipment: {
    id: "fleet_mobile_equipment",
    label: "Fleet & Mobile Equipment",
    description: "Service vehicles, trailers, and mobile asset PM programs.",
    aliases: ["fleet service", "mobile equipment", "service fleet"],
    keywords: ["fleet maintenance", "service van", "trailer", "dot inspection"],
    naics: ["811111", "532120"],
    sic: ["7538"],
  },
  material_handling: {
    id: "material_handling",
    label: "Material Handling",
    description: "Forklifts, conveyors, dock equipment, and warehouse uptime service.",
    aliases: ["material handling", "forklift service", "warehouse equipment"],
    keywords: ["forklift", "material handling", "dock leveler", "conveyor", "warehouse"],
    naics: ["811310", "423830"],
    sic: ["7699"],
  },
  calibration_inspection: {
    id: "calibration_inspection",
    label: "Calibration & Inspection",
    description: "Instrument calibration, field inspections, and traceable compliance.",
    aliases: ["calibration", "metrology", "inspection services"],
    keywords: ["calibration", "metrology", "traceability", "certificate", "inspection due"],
    naics: ["541380", "811310"],
    sic: ["8731"],
  },
  elevator_lift: {
    id: "elevator_lift",
    label: "Elevator & Lift Service",
    description: "Vertical transportation inspections, certificates, and maintenance.",
    aliases: ["elevator service", "elevator", "lift service", "vertical transportation"],
    keywords: ["elevator", "lift", "conveyance", "cat 1 inspection", "maintenance control"],
    naics: ["811310", "238290"],
    sic: ["7699"],
  },
  refrigeration_service: {
    id: "refrigeration_service",
    label: "Refrigeration Service",
    description: "Commercial refrigeration racks, walk-ins, and emergency response.",
    aliases: ["refrigeration service", "commercial refrigeration", "walk-in cooler"],
    keywords: ["refrigeration", "walk-in", "rack compressor", "leak check", "cold storage"],
    naics: ["811412", "238220"],
    sic: ["7623"],
  },
}

export function listGrowthIndustryTaxonomy(): GrowthIndustryTaxonomyEntry[] {
  return GROWTH_INDUSTRY_IDS.map((id) => GROWTH_INDUSTRY_TAXONOMY[id])
}

export function getGrowthIndustryTaxonomyEntry(id: GrowthIndustryId): GrowthIndustryTaxonomyEntry {
  return GROWTH_INDUSTRY_TAXONOMY[id]
}

export function isGrowthIndustryId(value: string): value is GrowthIndustryId {
  return (GROWTH_INDUSTRY_IDS as readonly string[]).includes(value)
}
