/**
 * Central workspace industry registry (Equipify.ai)
 *
 * This module is the single source of truth for canonical industry keys, human labels,
 * onboarding copy, and default demo-profile primitives (customer types, equipment/WO examples,
 * skill tags). Normalization aliases live in `lib/demo-seeding/profiles.ts`, which merges
 * registry `aliases` with legacy DB/query-string keys so existing organizations keep working.
 *
 * Future: Phase C+ can attach structured presets (equipment taxonomies, WO types, invoice
 * defaults) by extending definitions or linking `preset_id` — without changing onboarding UX.
 */

export const WORKSPACE_INDUSTRY_KEYS = [
  "mep",
  "hvac_r",
  "electrical",
  "plumbing",
  "field_service",
  "garage_door",
  "locksmith",
  "property_management",
  "equipment_service_repair",
  "appliance_repair",
  "commercial_equipment",
  "fire_security",
  "specialty_contractors",
  "septic",
  "av_installation",
  "industrial_equipment",
  "calibration_inspection",
  "facility_maintenance",
  "elevator_service",
  "generator_power",
  "equipment_rental",
  "refrigeration_service",
  "fleet_mobile_equipment",
  "material_handling",
  "biomedical_medical_equipment",
] as const

export type WorkspaceIndustryKey = (typeof WORKSPACE_INDUSTRY_KEYS)[number]

export type WorkspaceEquipmentExample = {
  name: string
  category: string
  manufacturer: string
}

/**
 * Full metadata for one workspace vertical. Used by onboarding UI and to derive lightweight
 * demo industry profiles (see `lib/demo-seeding/profiles.ts`).
 */
export type WorkspaceIndustryDefinition = {
  key: WorkspaceIndustryKey
  /** Short UI title */
  label: string
  /** One-line sector description */
  shortDescription: string
  /**
   * Alternate query-string / legacy spellings (lowercase, hyphen/underscore normalized in code).
   * Do not list the canonical `key` here.
   */
  aliases: string[]
  /** Shown on onboarding workspace step under industry selector */
  sampleSetupCopy: string
  defaultCustomerTypes: string[]
  defaultEquipmentExamples: WorkspaceEquipmentExample[]
  defaultWorkOrderExamples: string[]
  defaultTechnicianSkillTags: string[]
  /** Optional — shown in registry only until settings/service categories consume them */
  defaultServiceCategories?: string[]
  /** Synthetic brand for demo seed profile titles */
  suggestedDemoCompanyName: string
  /** Labels for starter maintenance plan rows in demo profiles */
  defaultMaintenancePlanExampleNames: string[]
}

export const WORKSPACE_INDUSTRY_DEFINITIONS: Record<WorkspaceIndustryKey, WorkspaceIndustryDefinition> = {
  mep: {
    key: "mep",
    label: "MEP (Mechanical, Electrical & Plumbing)",
    shortDescription: "Integrated mechanical, electrical, and plumbing service for buildings and campuses.",
    aliases: ["m-e-p", "mechanical-electrical-plumbing"],
    sampleSetupCopy:
      "We’ll align work orders, assets, and PM schedules across mechanical, electrical, and plumbing scopes.",
    suggestedDemoCompanyName: "Summit MEP Integrated Services",
    defaultCustomerTypes: [
      "Commercial Offices",
      "Healthcare Campuses",
      "Education Facilities",
      "Industrial Plants",
      "Data Centers",
    ],
    defaultEquipmentExamples: [
      { name: "Building Automation Front End", category: "Controls", manufacturer: "Honeywell" },
      { name: "Primary Chiller Plant Controller", category: "Mechanical", manufacturer: "Trane" },
      { name: "Main Switchgear Section", category: "Electrical", manufacturer: "Schneider" },
    ],
    defaultWorkOrderExamples: [
      "AHU coil leak — ME coordination",
      "Electrical feeder infrared survey",
      "Domestic booster pump vibration check",
      "BAS trend review — comfort complaint",
    ],
    defaultTechnicianSkillTags: ["Mechanical Systems", "Electrical Distribution", "Hydronics", "BAS"],
    defaultServiceCategories: ["Mechanical", "Electrical", "Plumbing", "Controls"],
    defaultMaintenancePlanExampleNames: [
      "Quarterly mechanical rounds",
      "Annual electrical IR scan",
      "Monthly domestic water booster PM",
    ],
  },
  hvac_r: {
    key: "hvac_r",
    label: "HVAC-R",
    shortDescription: "Heating, ventilation, air conditioning, and commercial refrigeration.",
    aliases: ["hvac", "hvac-r", "hvacr", "refrigeration"],
    sampleSetupCopy:
      "We’ll prepare service schedules, equipment history, and recurring maintenance workflows for HVAC-R teams.",
    suggestedDemoCompanyName: "Apex HVAC-R Services",
    defaultCustomerTypes: ["Commercial Office Buildings", "Retail Stores", "Medical Offices", "Restaurants", "Warehouses"],
    defaultEquipmentExamples: [
      { name: "RTU-12 Rooftop Unit", category: "HVAC", manufacturer: "Carrier" },
      { name: "Walk-In Cooler Condensing Unit", category: "Refrigeration", manufacturer: "Copeland" },
    ],
    defaultWorkOrderExamples: [
      "RTU compressor short-cycling",
      "Low suction pressure diagnosis",
      "Preventive coil cleaning",
    ],
    defaultTechnicianSkillTags: ["HVAC Diagnostics", "Refrigeration", "Controls"],
    defaultServiceCategories: ["HVAC", "Refrigeration", "Controls"],
    defaultMaintenancePlanExampleNames: ["Quarterly RTU PM", "Monthly refrigeration inspection"],
  },
  electrical: {
    key: "electrical",
    label: "Electrical",
    shortDescription: "Commercial and industrial electrical service, panels, and lighting.",
    aliases: ["electric", "elec"],
    sampleSetupCopy:
      "We’ll track panels, circuits, thermal scans, and compliance work for electrical contractors.",
    suggestedDemoCompanyName: "VoltEdge Electrical Services",
    defaultCustomerTypes: ["Property Managers", "Retail Chains", "Industrial Facilities", "Office Campuses"],
    defaultEquipmentExamples: [
      { name: "Main Distribution Panel", category: "Power Distribution", manufacturer: "Square D" },
    ],
    defaultWorkOrderExamples: [
      "Breaker trip investigation",
      "Lighting circuit retrofit",
      "Panel thermal hotspot correction",
    ],
    defaultTechnicianSkillTags: ["Power Quality", "Service Panels", "Lighting Systems"],
    defaultServiceCategories: ["Distribution", "Lighting", "Emergency systems"],
    defaultMaintenancePlanExampleNames: ["Annual panel PM", "Monthly emergency lighting test"],
  },
  plumbing: {
    key: "plumbing",
    label: "Plumbing",
    shortDescription: "Commercial plumbing, backflow, pumps, and drain systems.",
    aliases: ["plumber"],
    sampleSetupCopy:
      "We’ll organize customers, equipment, work orders, and recurring service reminders for plumbing teams.",
    suggestedDemoCompanyName: "FlowGuard Plumbing & Drain",
    defaultCustomerTypes: ["Apartment Communities", "Restaurants", "Hospitals", "Schools"],
    defaultEquipmentExamples: [{ name: "Booster Pump Station", category: "Pump Systems", manufacturer: "Grundfos" }],
    defaultWorkOrderExamples: [
      "Recurring drain backup",
      "Water heater combustion fault",
      "Leak isolation and repair",
    ],
    defaultTechnicianSkillTags: ["Hydronic Systems", "Drain Cleaning", "Backflow"],
    defaultServiceCategories: ["Backflow", "Pumps", "Water heaters"],
    defaultMaintenancePlanExampleNames: ["Quarterly backflow test", "Monthly pump PM"],
  },
  field_service: {
    key: "field_service",
    label: "Field Service",
    shortDescription: "General dispatch-heavy field service across mixed equipment and sites.",
    aliases: ["field-service", "fieldservice", "general_field_service"],
    sampleSetupCopy:
      "We’ll set up dispatch-friendly work orders, asset history, and technician workflows for mixed field teams.",
    suggestedDemoCompanyName: "Radius Field Service Co.",
    defaultCustomerTypes: ["Regional Accounts", "Retail Rollouts", "Industrial Sites", "Facilities Programs"],
    defaultEquipmentExamples: [
      { name: "Portable Asset Tag Pool", category: "Operations", manufacturer: "Internal" },
      { name: "Fleet Tool Calibration Kit", category: "Test Equipment", manufacturer: "Fluke" },
    ],
    defaultWorkOrderExamples: [
      "Emergency site response",
      "Scheduled route maintenance",
      "Warranty follow-up visit",
    ],
    defaultTechnicianSkillTags: ["Dispatch", "Mixed Trade", "Customer Site Safety"],
    defaultServiceCategories: ["Service calls", "PM routes", "Warranty"],
    defaultMaintenancePlanExampleNames: ["Monthly route PM", "Quarterly account review"],
  },
  garage_door: {
    key: "garage_door",
    label: "Garage Door",
    shortDescription: "Commercial and industrial doors, operators, and safety systems.",
    aliases: ["garage-door", "overhead_door", "overhead-door"],
    sampleSetupCopy:
      "We’ll track operators, safety devices, and recurring inspections for overhead and high-speed doors.",
    suggestedDemoCompanyName: "Overhead Access Pros",
    defaultCustomerTypes: ["Distribution Centers", "Auto Dealerships", "Municipal Facilities"],
    defaultEquipmentExamples: [{ name: "High-Speed Roll-Up Door", category: "Door Systems", manufacturer: "Rytec" }],
    defaultWorkOrderExamples: [
      "Door operator limit failure",
      "Safety sensor alignment",
      "Spring tension correction",
    ],
    defaultTechnicianSkillTags: ["Door Operators", "Safety Systems", "Mechanical Repairs"],
    defaultServiceCategories: ["Operators", "Springs & hardware", "Safety inspection"],
    defaultMaintenancePlanExampleNames: ["Monthly door safety inspection", "Quarterly operator PM"],
  },
  locksmith: {
    key: "locksmith",
    label: "Locksmith",
    shortDescription: "Commercial locksmithing, access control, and door hardware.",
    aliases: ["locksmithing", "access_control"],
    sampleSetupCopy:
      "We’ll organize master key programs, access hardware, and credential-driven service visits.",
    suggestedDemoCompanyName: "SecureKey Commercial Locksmith",
    defaultCustomerTypes: ["Office Towers", "Retail Franchises", "Healthcare Campuses"],
    defaultEquipmentExamples: [{ name: "Electronic Access Controller", category: "Access Control", manufacturer: "HID" }],
    defaultWorkOrderExamples: [
      "Master keying reconfiguration",
      "Door strike intermittent unlock",
      "Credential reader replacement",
    ],
    defaultTechnicianSkillTags: ["Access Control", "Master Key Systems", "Door Hardware"],
    defaultServiceCategories: ["Access systems", "Locks & cores", "Door hardware"],
    defaultMaintenancePlanExampleNames: ["Quarterly access audit", "Semi-annual door hardware PM"],
  },
  property_management: {
    key: "property_management",
    label: "Property Management",
    shortDescription: "Facilities operations across tenant portfolios and mixed-use assets.",
    aliases: ["property-management", "facilities", "real_estate"],
    sampleSetupCopy:
      "We’ll connect tenant issues, vendor work orders, and preventive rounds for property operators.",
    suggestedDemoCompanyName: "Northline Property Operations",
    defaultCustomerTypes: ["Class A Offices", "Mixed-Use Buildings", "Multifamily Communities"],
    defaultEquipmentExamples: [{ name: "Building Mechanical Plant", category: "Facility Assets", manufacturer: "Various" }],
    defaultWorkOrderExamples: [
      "Tenant comfort complaint dispatch",
      "Preventive inspection backlog clearance",
      "Life safety corrective action",
    ],
    defaultTechnicianSkillTags: ["Facilities Operations", "Tenant Response", "Preventive Programs"],
    defaultServiceCategories: ["Tenant service", "Building rounds", "Vendor coordination"],
    defaultMaintenancePlanExampleNames: ["Monthly building PM", "Quarterly safety compliance review"],
  },
  equipment_service_repair: {
    key: "equipment_service_repair",
    label: "Equipment Service & Repair",
    shortDescription: "Shop and field repair for commercial equipment and capital assets.",
    aliases: [],
    sampleSetupCopy:
      "We’ll structure repair workflows, parts usage, and depot turnaround for equipment service teams.",
    suggestedDemoCompanyName: "Atlas Equipment Service & Repair",
    defaultCustomerTypes: ["Manufacturers", "Dealers", "Fleet Operators", "Facilities"],
    defaultEquipmentExamples: [
      { name: "Bench Calibration Station", category: "Shop", manufacturer: "Internal" },
      { name: "Mobile Service Analyzer", category: "Test Equipment", manufacturer: "Fluke" },
    ],
    defaultWorkOrderExamples: ["Bench repair turnaround", "Field swap-out", "Post-repair QA sign-off"],
    defaultTechnicianSkillTags: ["Bench Repair", "Diagnostics", "QA Documentation"],
    defaultServiceCategories: ["Depot repair", "Field service", "Warranty"],
    defaultMaintenancePlanExampleNames: ["Quarterly depot QA audit"],
  },
  appliance_repair: {
    key: "appliance_repair",
    label: "Appliance Repair",
    shortDescription: "Residential and light commercial appliance service.",
    aliases: ["appliance-repair", "appliances"],
    sampleSetupCopy:
      "We’ll streamline dispatch, warranty tracking, and recurring appliance maintenance programs.",
    suggestedDemoCompanyName: "HomeCore Appliance Service",
    defaultCustomerTypes: ["Residential Homeowners", "Property Turnovers", "Warranty Partners"],
    defaultEquipmentExamples: [{ name: "Front-Load Washer", category: "Laundry", manufacturer: "Whirlpool" }],
    defaultWorkOrderExamples: [
      "Refrigerator no-cool diagnosis",
      "Dishwasher leak repair",
      "Dryer thermal fuse replacement",
    ],
    defaultTechnicianSkillTags: ["Laundry Systems", "Refrigeration Appliances", "Kitchen Appliances"],
    defaultServiceCategories: ["Kitchen", "Laundry", "Warranty"],
    defaultMaintenancePlanExampleNames: ["Quarterly rental appliance check", "Annual warranty tune-up"],
  },
  commercial_equipment: {
    key: "commercial_equipment",
    label: "Commercial Equipment",
    shortDescription: "Broad commercial equipment maintenance across sites and industries.",
    aliases: [
      "commercial-equipment",
      "commercial_equip",
      "commercial-kitchen-equipment",
      "commercial_kitchen_equipment",
      "commercial-kitchen",
      "commercial_kitchen",
      "equipment-service-repair",
      "equipment_service",
      "equipment-repair",
      "equipment_service_and_repair",
      "equipment-service",
    ],
    sampleSetupCopy:
      "We’ll tailor your workspace around commercial equipment assets, jobs, and preventive maintenance.",
    suggestedDemoCompanyName: "Summit Commercial Equipment Services",
    defaultCustomerTypes: ["Food Service Chains", "Warehouses", "Production Facilities", "Retail Sites"],
    defaultEquipmentExamples: [
      { name: "Commercial Reach-In Freezer", category: "Commercial Equipment", manufacturer: "True" },
    ],
    defaultWorkOrderExamples: [
      "Compressor replacement",
      "Control board fault",
      "Equipment performance baseline check",
    ],
    defaultTechnicianSkillTags: ["Commercial Equipment", "Electrical Diagnostics", "Preventive Maintenance"],
    defaultServiceCategories: ["Kitchen equipment", "Cold chain", "Production assets"],
    defaultMaintenancePlanExampleNames: ["Monthly equipment PM", "Quarterly operational audit"],
  },
  fire_security: {
    key: "fire_security",
    label: "Fire & Security",
    shortDescription: "Fire life safety, alarms, and electronic security systems.",
    aliases: ["fire-security", "fire_and_security", "fire-and-security", "fire", "security_systems"],
    sampleSetupCopy:
      "We’ll support inspection cadences, deficiency tracking, and access/security device service.",
    suggestedDemoCompanyName: "ShieldPoint Fire & Security",
    defaultCustomerTypes: ["Schools", "Healthcare Facilities", "Office Parks", "Industrial Campuses"],
    defaultEquipmentExamples: [{ name: "Addressable Fire Alarm Panel", category: "Fire Safety", manufacturer: "Notifier" }],
    defaultWorkOrderExamples: [
      "False alarm point investigation",
      "Access panel communication fault",
      "Door hardware fail-safe test",
    ],
    defaultTechnicianSkillTags: ["Fire Alarm Systems", "Access Control", "Life Safety Compliance"],
    defaultServiceCategories: ["Fire alarm", "Access control", "Inspection / test"],
    defaultMaintenancePlanExampleNames: ["Monthly fire panel inspection", "Quarterly access control test"],
  },
  specialty_contractors: {
    key: "specialty_contractors",
    label: "Specialty Contractors",
    shortDescription: "Niche trade contractors with project and service workflows.",
    aliases: ["specialty-contractors", "specialty_trade", "specialty-trade"],
    sampleSetupCopy:
      "We’ll align estimates, jobs, and asset history for specialty trade crews and subcontractors.",
    suggestedDemoCompanyName: "Keystone Specialty Contractors",
    defaultCustomerTypes: ["General Contractor Partners", "Owners", "Industrial Clients"],
    defaultEquipmentExamples: [
      { name: "Job Trailer Safety Kit", category: "Operations", manufacturer: "Internal" },
      { name: "Fiber Fusion Splicer", category: "Low Voltage", manufacturer: "Corning" },
    ],
    defaultWorkOrderExamples: ["Scope change request", "Punch-list closeout", "Warranty callback"],
    defaultTechnicianSkillTags: ["Specialty Trade", "Jobsite Safety", "QC Documentation"],
    defaultServiceCategories: ["Service", "Projects", "Warranty"],
    defaultMaintenancePlanExampleNames: ["Quarterly safety toolbox audit"],
  },
  septic: {
    key: "septic",
    label: "Septic",
    shortDescription: "Residential and commercial septic, wastewater, and lift stations.",
    aliases: ["septic-system", "wastewater"],
    sampleSetupCopy:
      "We’ll schedule pump-outs, inspections, and emergency responses for septic and wastewater assets.",
    suggestedDemoCompanyName: "ClearFlow Septic Services",
    defaultCustomerTypes: ["Residential Properties", "Rural Commercial Sites", "Campgrounds"],
    defaultEquipmentExamples: [{ name: "Lift Station Pump", category: "Wastewater", manufacturer: "Zoeller" }],
    defaultWorkOrderExamples: [
      "High-water alarm response",
      "Pump failure replacement",
      "Drainfield performance assessment",
    ],
    defaultTechnicianSkillTags: ["Wastewater Systems", "Pumping Equipment", "Field Diagnostics"],
    defaultServiceCategories: ["Septic", "Lift stations", "Emergency"],
    defaultMaintenancePlanExampleNames: ["Quarterly septic inspection", "Monthly lift station PM"],
  },
  av_installation: {
    key: "av_installation",
    label: "AV Installation",
    shortDescription: "Audio-visual integration, conferencing, and digital signage.",
    aliases: ["av-installation", "audio_visual", "audio-visual", "pro_av"],
    sampleSetupCopy:
      "We’ll track racks, displays, control programming, and QA visits for AV integrators.",
    suggestedDemoCompanyName: "SignalWorks AV Integration",
    defaultCustomerTypes: ["Corporate Offices", "Education Campuses", "Hospitality Venues"],
    defaultEquipmentExamples: [{ name: "Conference Room DSP Rack", category: "Audio Visual", manufacturer: "QSC" }],
    defaultWorkOrderExamples: [
      "Audio drop-out troubleshooting",
      "Control system firmware update",
      "Display alignment and calibration",
    ],
    defaultTechnicianSkillTags: ["AV Systems", "Control Programming", "Networked Media"],
    defaultServiceCategories: ["Integration", "Support", "QA"],
    defaultMaintenancePlanExampleNames: ["Quarterly AV health check", "Monthly meeting room QA"],
  },
  industrial_equipment: {
    key: "industrial_equipment",
    label: "Industrial Equipment",
    shortDescription: "Heavy industrial assets, uptime programs, and recurring PM contracts.",
    aliases: [
      "industrial-equipment",
      "industrial_service",
      "industrial-service",
      "industrial",
      "industrial_equipment_service",
    ],
    sampleSetupCopy:
      "We’ll align asset registers, PM intervals, and service history for industrial equipment operators.",
    suggestedDemoCompanyName: "Foundry Industrial Equipment Services",
    defaultCustomerTypes: ["Manufacturing Plants", "Process Industries", "Municipal Utilities", "OEM Field Teams"],
    defaultEquipmentExamples: [
      { name: "Process Pump Skid", category: "Rotating Equipment", manufacturer: "Grundfos" },
      { name: "Motor Control Center Bucket", category: "Electrical", manufacturer: "Allen-Bradley" },
    ],
    defaultWorkOrderExamples: [
      "Bearing temperature excursion",
      "Vibration baseline survey",
      "Scheduled outage PM",
    ],
    defaultTechnicianSkillTags: ["Rotating Equipment", "Predictive Maintenance", "Electrical Safety"],
    defaultServiceCategories: ["PM routes", "Corrective", "Shutdown support"],
    defaultMaintenancePlanExampleNames: ["Monthly rotating equipment PM", "Quarterly MCC inspection"],
  },
  calibration_inspection: {
    key: "calibration_inspection",
    label: "Calibration & Inspection",
    shortDescription: "Instrument calibration, field inspections, and traceable compliance records.",
    aliases: ["calibration-inspection", "calibration", "inspection_services", "metrology"],
    sampleSetupCopy:
      "We’ll track due dates, certificates, and asset traceability for calibration and inspection teams.",
    suggestedDemoCompanyName: "TraceLine Calibration Partners",
    defaultCustomerTypes: ["Labs", "Manufacturing QA", "Healthcare Facilities", "Energy Sites"],
    defaultEquipmentExamples: [
      { name: "Digital Pressure Calibrator", category: "Test Standards", manufacturer: "Fluke" },
      { name: "Torque Wrench Set — NIST Traceable", category: "Mechanical QA", manufacturer: "Snap-on" },
    ],
    defaultWorkOrderExamples: [
      "Annual pressure standard verification",
      "Field gauge calibration visit",
      "Certificate renewal batch",
    ],
    defaultTechnicianSkillTags: ["Metrology", "Field Standards", "Documentation"],
    defaultServiceCategories: ["Lab cal", "Field cal", "Inspection"],
    defaultMaintenancePlanExampleNames: ["Quarterly recall audit", "Monthly standard verification"],
  },
  facility_maintenance: {
    key: "facility_maintenance",
    label: "Facility Maintenance",
    shortDescription: "Building systems, vendors, and preventive maintenance across portfolios.",
    aliases: ["facility-maintenance", "facilities_maintenance", "building_maintenance"],
    sampleSetupCopy:
      "We’ll connect work orders, assets, and vendor visits for facility maintenance organizations.",
    suggestedDemoCompanyName: "Harborline Facility Maintenance",
    defaultCustomerTypes: ["Corporate Campuses", "Healthcare Sites", "Education Districts", "Industrial Parks"],
    defaultEquipmentExamples: [
      { name: "Cooling Tower Cell", category: "HVAC Plant", manufacturer: "BAC" },
      { name: "Building Generator Set", category: "Life Safety", manufacturer: "Cummins" },
    ],
    defaultWorkOrderExamples: [
      "Cooling tower water treatment visit",
      "Generator exercise log review",
      "Vendor corrective work follow-up",
    ],
    defaultTechnicianSkillTags: ["Building Systems", "Vendor Coordination", "PM Programs"],
    defaultServiceCategories: ["HVAC plant", "Electrical", "Life safety"],
    defaultMaintenancePlanExampleNames: ["Monthly building rounds", "Quarterly vendor PM review"],
  },
  elevator_service: {
    key: "elevator_service",
    label: "Elevator & Lift Service",
    shortDescription: "Vertical transportation inspections, certificates, and maintenance contracts.",
    aliases: ["elevator-service", "elevator", "lift_service", "vertical_transportation"],
    sampleSetupCopy:
      "We’ll track unit registers, inspection due dates, and certificate renewals for elevator service teams.",
    suggestedDemoCompanyName: "Summit Vertical Systems",
    defaultCustomerTypes: ["Office Towers", "Hospitals", "Transit Agencies", "Universities"],
    defaultEquipmentExamples: [
      { name: "Traction Elevator Controller", category: "Elevator", manufacturer: "Otis" },
      { name: "Hydraulic Power Unit", category: "Elevator", manufacturer: "ThyssenKrupp" },
    ],
    defaultWorkOrderExamples: [
      "Annual CAT 1 inspection",
      "Door operator adjustment",
      "Governor test documentation",
    ],
    defaultTechnicianSkillTags: ["Conveyance", "Safety Testing", "Controls"],
    defaultServiceCategories: ["Inspection", "Repair", "Modernization support"],
    defaultMaintenancePlanExampleNames: ["Monthly maintenance control program", "Annual safety test"],
  },
  generator_power: {
    key: "generator_power",
    label: "Generator & Power Systems",
    shortDescription: "Standby power, load banking, and recurring generator service programs.",
    aliases: ["generator-power-systems", "generator_power_systems", "generator", "standby_power"],
    sampleSetupCopy:
      "We’ll organize generator assets, PM schedules, and compliance documentation for power systems teams.",
    suggestedDemoCompanyName: "GridGuard Generator Services",
    defaultCustomerTypes: ["Healthcare", "Data Centers", "Industrial Plants", "Critical Facilities"],
    defaultEquipmentExamples: [
      { name: "500kW Diesel Generator", category: "Power Generation", manufacturer: "Kohler" },
      { name: "ATS — Automatic Transfer Switch", category: "Switching", manufacturer: "Asco" },
    ],
    defaultWorkOrderExamples: [
      "Monthly load bank verification",
      "Coolant system leak repair",
      "Battery replacement cycle",
    ],
    defaultTechnicianSkillTags: ["Generator PM", "Electrical Testing", "Fuel Systems"],
    defaultServiceCategories: ["PM", "Emergency", "Testing"],
    defaultMaintenancePlanExampleNames: ["Monthly generator exercise PM", "Annual load bank test"],
  },
  equipment_rental: {
    key: "equipment_rental",
    label: "Equipment Rental",
    shortDescription: "Rental fleet readiness, inspections, turnaround, and maintenance visibility.",
    aliases: ["equipment-rental", "rental_equipment", "tool_rental"],
    sampleSetupCopy:
      "We’ll track rental-ready assets, inspection cycles, and shop turnaround for rental operations.",
    suggestedDemoCompanyName: "BlueRidge Equipment Rental",
    defaultCustomerTypes: ["Construction Contractors", "Industrial Projects", "Event Venues", "Municipal"],
    defaultEquipmentExamples: [
      { name: "Telehandler — 10k", category: "Material Handling", manufacturer: "JLG" },
      { name: "Towable Light Tower", category: "Rental Fleet", manufacturer: "Generac" },
    ],
    defaultWorkOrderExamples: [
      "Post-rental inspection checklist",
      "PM before next dispatch",
      "Damage documentation and repair quote",
    ],
    defaultTechnicianSkillTags: ["Fleet PM", "Inspections", "Turnaround"],
    defaultServiceCategories: ["Turnaround", "PM", "Damage repair"],
    defaultMaintenancePlanExampleNames: ["Every-return inspection", "Monthly fleet PM"],
  },
  refrigeration_service: {
    key: "refrigeration_service",
    label: "Refrigeration Service",
    shortDescription: "Commercial refrigeration service — coolers, racks, and emergency response.",
    aliases: ["refrigeration-service", "commercial_refrigeration", "walk_in_cooler"],
    sampleSetupCopy:
      "We’ll align compressor and condenser assets, PM schedules, and leak-check workflows for refrigeration teams.",
    suggestedDemoCompanyName: "PolarLine Refrigeration Service",
    defaultCustomerTypes: ["Grocery", "Foodservice Distribution", "Cold Storage", "Pharmacy"],
    defaultEquipmentExamples: [
      { name: "Walk-In Evaporator Coil", category: "Refrigeration", manufacturer: "Heatcraft" },
      { name: "Rack Compressor Package", category: "Refrigeration", manufacturer: "Copeland" },
    ],
    defaultWorkOrderExamples: [
      "Low suction diagnosis — walk-in",
      "Scheduled leak inspection",
      "Emergency cooler outage",
    ],
    defaultTechnicianSkillTags: ["Refrigeration", "Leak detection", "Controls"],
    defaultServiceCategories: ["PM", "Emergency", "Retrofit support"],
    defaultMaintenancePlanExampleNames: ["Monthly rack PM", "Quarterly leak inspection"],
  },
  fleet_mobile_equipment: {
    key: "fleet_mobile_equipment",
    label: "Fleet & Mobile Equipment",
    shortDescription: "Service vehicles, trailers, and mobile asset PM — operations visibility without telematics claims.",
    aliases: ["fleet-mobile-equipment", "fleet_mobile", "fleet_service", "mobile_assets"],
    sampleSetupCopy:
      "We’ll track fleet assets, inspections, and recurring PM for vehicles and mobile equipment you maintain.",
    suggestedDemoCompanyName: "RoadLink Fleet Maintenance",
    defaultCustomerTypes: ["Service Fleets", "Contractors", "Utilities", "Rental Operators"],
    defaultEquipmentExamples: [
      { name: "Service Van #214", category: "Fleet", manufacturer: "Ford" },
      { name: "Equipment Trailer — Tilt", category: "Trailers", manufacturer: "PJ Trailers" },
    ],
    defaultWorkOrderExamples: [
      "DOT inspection prep",
      "Trailer brake adjustment",
      "Scheduled PM route",
    ],
    defaultTechnicianSkillTags: ["Fleet PM", "DOT prep", "Trailers"],
    defaultServiceCategories: ["PM", "Inspection", "Repair"],
    defaultMaintenancePlanExampleNames: ["Monthly fleet PM", "Quarterly trailer inspection"],
  },
  material_handling: {
    key: "material_handling",
    label: "Material Handling",
    shortDescription: "Forklifts, conveyors, and loading systems — PM, inspections, and uptime.",
    aliases: ["material-handling", "forklift_service", "warehouse_equipment"],
    sampleSetupCopy:
      "We’ll organize warehouse equipment registers, inspection intervals, and service history for uptime programs.",
    suggestedDemoCompanyName: "LiftPath Material Handling",
    defaultCustomerTypes: ["Distribution Centers", "Manufacturing", "3PL", "Retail DCs"],
    defaultEquipmentExamples: [
      { name: "Sit-Down Forklift — 5k", category: "Forklifts", manufacturer: "Toyota" },
      { name: "Dock Leveler", category: "Loading Systems", manufacturer: "Kelley" },
    ],
    defaultWorkOrderExamples: [
      "Annual lift truck inspection",
      "Hydraulic leak on mast",
      "Conveyor belt tracking adjustment",
    ],
    defaultTechnicianSkillTags: ["Forklifts", "Dock equipment", "Conveyors"],
    defaultServiceCategories: ["Inspection", "Repair", "PM"],
    defaultMaintenancePlanExampleNames: ["Monthly PM route", "Quarterly dock inspection"],
  },
  biomedical_medical_equipment: {
    key: "biomedical_medical_equipment",
    label: "Biomedical / Medical Equipment Service",
    shortDescription: "Clinical engineering, biomedical devices, imaging support, and compliance.",
    aliases: [
      "biomedical",
      "biomedical-medical-equipment",
      "medical_equipment",
      "medical-equipment",
      "medical",
      "clinical_engineering",
      "clinical-engineering",
      "biomed",
    ],
    sampleSetupCopy:
      "We’ll set up equipment tracking, calibration reminders, and service history for medical equipment teams.",
    suggestedDemoCompanyName: "Precision Biomedical Services",
    defaultCustomerTypes: [], // Superseded by rich MEDICAL_PROFILE in profiles.ts when merged
    defaultEquipmentExamples: [],
    defaultWorkOrderExamples: [],
    defaultTechnicianSkillTags: [],
    defaultMaintenancePlanExampleNames: [],
    defaultServiceCategories: ["Patient monitoring", "Sterilization", "Imaging QA", "Compliance"],
  },
}

/** Canonical keys as a Set for O(1) membership checks after alias resolution */
export const WORKSPACE_INDUSTRY_KEY_SET = new Set<string>(WORKSPACE_INDUSTRY_KEYS)

export function isWorkspaceIndustryKey(value: string): value is WorkspaceIndustryKey {
  return WORKSPACE_INDUSTRY_KEY_SET.has(value)
}

export function getWorkspaceIndustryDefinition(key: WorkspaceIndustryKey): WorkspaceIndustryDefinition {
  return WORKSPACE_INDUSTRY_DEFINITIONS[key]
}
