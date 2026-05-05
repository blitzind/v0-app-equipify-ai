export const INDUSTRY_KEYS = [
  "medical_equipment",
  "hvac_r",
  "electrical",
  "plumbing",
  "garage_door",
  "locksmith",
  "property_management",
  "appliance_repair",
  "commercial_equipment",
  "fire_security",
  "septic",
  "av_installation",
] as const

export type DemoIndustryKey = (typeof INDUSTRY_KEYS)[number]

type MaintenancePlanExample = {
  name: string
  intervalValue: number
  intervalUnit: "month" | "year"
}

type DashboardMetricTargets = {
  customers: number
  equipment: number
  workOrders: number
  maintenancePlans: number
}

export type DemoIndustryProfile = {
  industry: DemoIndustryKey
  demoCompanyName: string
  customerTypes: string[]
  equipmentAssetTypes: Array<{ name: string; category: string; manufacturer: string }>
  workOrderTitleExamples: string[]
  maintenancePlanExamples: MaintenancePlanExample[]
  technicianSpecialties: string[]
  dashboardMetricTargets: DashboardMetricTargets
}

const MEDICAL_PROFILE: DemoIndustryProfile = {
  industry: "medical_equipment",
  demoCompanyName: "Precision Biomedical Services",
  customerTypes: [
    "Valley Regional Hospital",
    "Summit Surgical Center",
    "Greenview Family Clinic",
    "Riverstone Imaging Center",
    "Oak Ridge Dental Group",
    "Blue Harbor Rehab Center",
    "Starlight Urgent Care",
    "Northside Pediatrics",
    "Cedar Grove Endoscopy Center",
    "Maple Street Dialysis Clinic",
    "Lakeside Cardiology Associates",
    "Horizon Women's Health Pavilion",
    "Redwood Community Hospital",
    "Clearwater Veterans Clinic",
    "Pinecrest Sleep Disorders Lab",
    "Meadowbrook Outpatient Surgery",
    "Cascade Orthopedic Institute",
    "Silverline Oncology Infusion Center",
    "Pacific Coast Orthopedic Surgery Center",
    "Harborview Community Health Center",
    "Sierra Peak Ambulatory Surgery",
    "Golden State Wound & Hyperbaric",
    "Mission View Imaging Partners",
    "Westgate Medical Plaza",
  ],
  equipmentAssetTypes: [
    { name: "IntelliVue MX750 Patient Monitor", category: "Patient Monitoring", manufacturer: "Philips" },
    { name: "CARESCAPE B850 Monitor", category: "Patient Monitoring", manufacturer: "GE HealthCare" },
    { name: "BeneVision N17 OR Monitor", category: "Patient Monitoring", manufacturer: "Mindray" },
    { name: "AMSCO 400 Steam Sterilizer", category: "Sterilization", manufacturer: "STERIS" },
    { name: "HSG-A 9102 Autoclave", category: "Sterilization", manufacturer: "Getinge" },
    { name: "Alaris 8100 Pump Module", category: "Infusion", manufacturer: "BD" },
    { name: "Plum 360 Large Volume Pump", category: "Infusion", manufacturer: "ICU Medical" },
    { name: "X Series Defibrillator", category: "Emergency Care", manufacturer: "ZOLL" },
    { name: "LIFEPAK 15 Defibrillator", category: "Emergency Care", manufacturer: "Physio-Control" },
    { name: "MAC 5500 HD ECG", category: "Diagnostics", manufacturer: "GE HealthCare" },
    { name: "AT-102 Plus ECG", category: "Diagnostics", manufacturer: "Schiller" },
    { name: "LOGIQ E10 Ultrasound", category: "Imaging", manufacturer: "GE HealthCare" },
  ],
  workOrderTitleExamples: [
    "Annual electrical safety & performance verification",
    "Quarterly infusion pump calibration",
    "Sterilizer chamber temperature variance investigation",
    "Patient monitor arrhythmia alarm verification",
    "Portable X-ray QA detector calibration",
    "Defibrillator battery replacement",
    "Anesthesia machine leak test",
    "ECG lead noise troubleshooting",
  ],
  maintenancePlanExamples: [
    { name: "Annual Electrical Safety Verification", intervalValue: 1, intervalUnit: "year" },
    { name: "Quarterly Infusion Pump PM", intervalValue: 3, intervalUnit: "month" },
    { name: "Monthly Monitor Inspection", intervalValue: 1, intervalUnit: "month" },
    { name: "Semi-Annual Sterilizer QA", intervalValue: 6, intervalUnit: "month" },
  ],
  technicianSpecialties: ["Biomedical Equipment", "Calibration", "Imaging QA", "Sterilization Systems"],
  dashboardMetricTargets: { customers: 24, equipment: 60, workOrders: 36, maintenancePlans: 24 },
}

function starterProfile(
  industry: DemoIndustryKey,
  demoCompanyName: string,
  customerTypes: string[],
  equipmentAssetTypes: DemoIndustryProfile["equipmentAssetTypes"],
  workOrders: string[],
  maintenancePlans: string[],
  specialties: string[],
): DemoIndustryProfile {
  return {
    industry,
    demoCompanyName,
    customerTypes,
    equipmentAssetTypes,
    workOrderTitleExamples: workOrders,
    maintenancePlanExamples: maintenancePlans.map((name, i) => ({
      name,
      intervalValue: i % 2 === 0 ? 1 : 3,
      intervalUnit: i % 2 === 0 ? "month" : "month",
    })),
    technicianSpecialties: specialties,
    dashboardMetricTargets: { customers: 22, equipment: 56, workOrders: 34, maintenancePlans: 22 },
  }
}

export const DEMO_INDUSTRY_PROFILES: Record<DemoIndustryKey, DemoIndustryProfile> = {
  medical_equipment: MEDICAL_PROFILE,
  hvac_r: starterProfile(
    "hvac_r",
    "Apex HVAC-R Services",
    ["Commercial Office Buildings", "Retail Stores", "Medical Offices", "Restaurants", "Warehouses"],
    [
      { name: "RTU-12 Rooftop Unit", category: "HVAC", manufacturer: "Carrier" },
      { name: "Walk-In Cooler Condensing Unit", category: "Refrigeration", manufacturer: "Copeland" },
    ],
    ["RTU compressor short-cycling", "Low suction pressure diagnosis", "Preventive coil cleaning"],
    ["Quarterly RTU PM", "Monthly Refrigeration Inspection"],
    ["HVAC Diagnostics", "Refrigeration", "Controls"],
  ),
  electrical: starterProfile(
    "electrical",
    "VoltEdge Electrical Services",
    ["Property Managers", "Retail Chains", "Industrial Facilities", "Office Campuses"],
    [{ name: "Main Distribution Panel", category: "Power Distribution", manufacturer: "Square D" }],
    ["Breaker trip investigation", "Lighting circuit retrofit", "Panel thermal hotspot correction"],
    ["Annual Panel PM", "Monthly Emergency Lighting Test"],
    ["Power Quality", "Service Panels", "Lighting Systems"],
  ),
  plumbing: starterProfile(
    "plumbing",
    "FlowGuard Plumbing & Drain",
    ["Apartment Communities", "Restaurants", "Hospitals", "Schools"],
    [{ name: "Booster Pump Station", category: "Pump Systems", manufacturer: "Grundfos" }],
    ["Recurring drain backup", "Water heater combustion fault", "Leak isolation and repair"],
    ["Quarterly Backflow Test", "Monthly Pump PM"],
    ["Hydronic Systems", "Drain Cleaning", "Backflow"],
  ),
  garage_door: starterProfile(
    "garage_door",
    "Overhead Access Pros",
    ["Distribution Centers", "Auto Dealerships", "Municipal Facilities"],
    [{ name: "High-Speed Roll-Up Door", category: "Door Systems", manufacturer: "Rytec" }],
    ["Door operator limit failure", "Safety sensor alignment", "Spring tension correction"],
    ["Monthly Door Safety Inspection", "Quarterly Operator PM"],
    ["Door Operators", "Safety Systems", "Mechanical Repairs"],
  ),
  locksmith: starterProfile(
    "locksmith",
    "SecureKey Commercial Locksmith",
    ["Office Towers", "Retail Franchises", "Healthcare Campuses"],
    [{ name: "Electronic Access Controller", category: "Access Control", manufacturer: "HID" }],
    ["Master keying reconfiguration", "Door strike intermittent unlock", "Credential reader replacement"],
    ["Quarterly Access Control Audit", "Semi-Annual Door Hardware PM"],
    ["Access Control", "Master Key Systems", "Door Hardware"],
  ),
  property_management: starterProfile(
    "property_management",
    "Northline Property Operations",
    ["Class A Offices", "Mixed-Use Buildings", "Multifamily Communities"],
    [{ name: "Building Mechanical Plant", category: "Facility Assets", manufacturer: "Various" }],
    ["Tenant comfort complaint dispatch", "Preventive inspection backlog clearance", "Life safety corrective action"],
    ["Monthly Building PM", "Quarterly Safety Compliance Review"],
    ["Facilities Operations", "Tenant Response", "Preventive Programs"],
  ),
  appliance_repair: starterProfile(
    "appliance_repair",
    "HomeCore Appliance Service",
    ["Residential Homeowners", "Property Turnovers", "Warranty Partners"],
    [{ name: "Front-Load Washer", category: "Laundry", manufacturer: "Whirlpool" }],
    ["Refrigerator no-cool diagnosis", "Dishwasher leak repair", "Dryer thermal fuse replacement"],
    ["Quarterly Rental Appliance Check", "Annual Warranty Tune-Up"],
    ["Laundry Systems", "Refrigeration Appliances", "Kitchen Appliances"],
  ),
  commercial_equipment: starterProfile(
    "commercial_equipment",
    "Summit Commercial Equipment Services",
    ["Food Service Chains", "Warehouses", "Production Facilities", "Retail Sites"],
    [{ name: "Commercial Reach-In Freezer", category: "Commercial Equipment", manufacturer: "True" }],
    ["Compressor replacement", "Control board fault", "Equipment performance baseline check"],
    ["Monthly Equipment PM", "Quarterly Operational Audit"],
    ["Commercial Equipment", "Electrical Diagnostics", "Preventive Maintenance"],
  ),
  fire_security: starterProfile(
    "fire_security",
    "ShieldPoint Fire & Security",
    ["Schools", "Healthcare Facilities", "Office Parks", "Industrial Campuses"],
    [{ name: "Addressable Fire Alarm Panel", category: "Fire Safety", manufacturer: "Notifier" }],
    ["False alarm point investigation", "Access panel communication fault", "Door hardware fail-safe test"],
    ["Monthly Fire Panel Inspection", "Quarterly Access Control Test"],
    ["Fire Alarm Systems", "Access Control", "Life Safety Compliance"],
  ),
  septic: starterProfile(
    "septic",
    "ClearFlow Septic Services",
    ["Residential Properties", "Rural Commercial Sites", "Campgrounds"],
    [{ name: "Lift Station Pump", category: "Wastewater", manufacturer: "Zoeller" }],
    ["High-water alarm response", "Pump failure replacement", "Drainfield performance assessment"],
    ["Quarterly Septic Inspection", "Monthly Pump Station PM"],
    ["Wastewater Systems", "Pumping Equipment", "Field Diagnostics"],
  ),
  av_installation: starterProfile(
    "av_installation",
    "SignalWorks AV Integration",
    ["Corporate Offices", "Education Campuses", "Hospitality Venues"],
    [{ name: "Conference Room DSP Rack", category: "Audio Visual", manufacturer: "QSC" }],
    ["Audio drop-out troubleshooting", "Control system firmware update", "Display alignment and calibration"],
    ["Quarterly AV Health Check", "Monthly Meeting Room QA"],
    ["AV Systems", "Control Programming", "Networked Media"],
  ),
}

const INDUSTRY_ALIASES: Record<string, DemoIndustryKey> = {
  medical_equipment: "medical_equipment",
  "medical-equipment": "medical_equipment",
  hvac_r: "hvac_r",
  "hvac-r": "hvac_r",
  electrical: "electrical",
  plumbing: "plumbing",
  garage_door: "garage_door",
  "garage-door": "garage_door",
  locksmith: "locksmith",
  property_management: "property_management",
  "property-management": "property_management",
  appliance_repair: "appliance_repair",
  "appliance-repair": "appliance_repair",
  commercial_equipment: "commercial_equipment",
  "equipment-service": "commercial_equipment",
  fire_security: "fire_security",
  septic: "septic",
  av_installation: "av_installation",
}

export function normalizeIndustryKey(value: string | null | undefined): DemoIndustryKey {
  if (!value) return "commercial_equipment"
  const normalized = value.trim().toLowerCase()
  return INDUSTRY_ALIASES[normalized] ?? "commercial_equipment"
}

/** Labels for sample-data import UI (profile bundle title / sector label). */
export function demoIndustrySelectOptions(): { value: DemoIndustryKey; label: string }[] {
  return INDUSTRY_KEYS.map((k) => ({
    value: k,
    label: DEMO_INDUSTRY_PROFILES[k].demoCompanyName,
  }))
}
