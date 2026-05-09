import "server-only"

import type { DemoIndustryKey } from "@/lib/demo-seeding/profiles"

/**
 * Industry-aware seed-template foundation.
 *
 * Each entry maps an industry key to a small, opinionated set of starter
 * calibration / inspection templates. Templates are inserted with
 * `is_sample = true` during onboarding so admins can see the shape of an
 * industry-specific workflow without committing to it.
 *
 * Canonical keys live in `lib/workspace-industry-registry.ts`. This file maps
 * each key to templates; missing keys at runtime fall back to commercial_equipment
 * templates inside `getStarterTemplatesForIndustry`.
 */

export type IndustryTemplateField = {
  id: string
  type: "section_heading" | "pass_fail" | "checkbox" | "notes" | "number" | "text"
  label: string
  required?: boolean
}

export type IndustryTemplateSeed = {
  name: string
  equipmentCategoryId: string
  fields: IndustryTemplateField[]
}

const ELECTRICAL_SAFETY_FIELDS: IndustryTemplateField[] = [
  { id: "sh_sep", type: "section_heading", label: "Electrical safety (IEC 60601-1)" },
  { id: "pf_g", type: "pass_fail", label: "Ground continuity / resistance", required: true },
  { id: "pf_l", type: "pass_fail", label: "Leakage current — patient connections", required: true },
  { id: "n_doc", type: "notes", label: "As-found / as-left notes" },
]

const PUMP_PM_FIELDS: IndustryTemplateField[] = [
  { id: "sh_pm", type: "section_heading", label: "Preventive maintenance checks" },
  { id: "pf_alarm", type: "pass_fail", label: "Alarm function & limits", required: true },
  { id: "pf_flow", type: "pass_fail", label: "Delivery accuracy / flow verification", required: true },
  { id: "cb_cal", type: "checkbox", label: "NIST-traceable reference used" },
]

const HVAC_PM_FIELDS: IndustryTemplateField[] = [
  { id: "sh_safety", type: "section_heading", label: "Safety & lockout" },
  { id: "pf_lockout", type: "pass_fail", label: "Lock-out / tag-out verified", required: true },
  { id: "pf_disc", type: "pass_fail", label: "Disconnect inspected / labeled" },
  { id: "sh_ref", type: "section_heading", label: "Refrigeration cycle" },
  { id: "n_suction", type: "number", label: "Suction pressure (psig)", required: true },
  { id: "n_head", type: "number", label: "Head pressure (psig)", required: true },
  { id: "pf_oil", type: "pass_fail", label: "Compressor oil level acceptable" },
  { id: "n_doc", type: "notes", label: "Findings & corrective actions" },
]

const BACKFLOW_FIELDS: IndustryTemplateField[] = [
  { id: "sh_test", type: "section_heading", label: "Backflow test record" },
  { id: "t_serial", type: "text", label: "Device serial number", required: true },
  { id: "n_check1", type: "number", label: "Check valve #1 (psid)", required: true },
  { id: "n_check2", type: "number", label: "Check valve #2 (psid)" },
  { id: "pf_relief", type: "pass_fail", label: "Relief valve opens >= 2.0 psid", required: true },
  { id: "n_doc", type: "notes", label: "Tester notes" },
]

const ELECTRICAL_PANEL_FIELDS: IndustryTemplateField[] = [
  { id: "sh_safety", type: "section_heading", label: "Panel safety" },
  { id: "pf_thermal", type: "pass_fail", label: "Thermal scan — no hotspots", required: true },
  { id: "pf_torque", type: "pass_fail", label: "Lug torque verified" },
  { id: "pf_label", type: "pass_fail", label: "Circuit labels current" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const DOOR_INSPECTION_FIELDS: IndustryTemplateField[] = [
  { id: "sh_safety", type: "section_heading", label: "Door safety inspection" },
  { id: "pf_sensors", type: "pass_fail", label: "Photo-eye sensors aligned & functional", required: true },
  { id: "pf_reverse", type: "pass_fail", label: "Auto-reverse function verified", required: true },
  { id: "pf_spring", type: "pass_fail", label: "Spring tension within spec" },
  { id: "n_doc", type: "notes", label: "Operator findings" },
]

const FIRE_PANEL_FIELDS: IndustryTemplateField[] = [
  { id: "sh_panel", type: "section_heading", label: "Fire alarm panel monthly inspection" },
  { id: "pf_power", type: "pass_fail", label: "Primary power normal", required: true },
  { id: "pf_battery", type: "pass_fail", label: "Battery secondary power within spec" },
  { id: "pf_trouble", type: "pass_fail", label: "No active trouble signals", required: true },
  { id: "n_doc", type: "notes", label: "Observations" },
]

const ACCESS_CONTROL_FIELDS: IndustryTemplateField[] = [
  { id: "sh_audit", type: "section_heading", label: "Access control audit" },
  { id: "pf_locks", type: "pass_fail", label: "Electric locks engage/release on schedule" },
  { id: "pf_credentials", type: "pass_fail", label: "Active credential database current" },
  { id: "pf_failsafe", type: "pass_fail", label: "Fail-safe behavior verified for life-safety doors" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const APPLIANCE_INSPECTION_FIELDS: IndustryTemplateField[] = [
  { id: "sh_inspect", type: "section_heading", label: "Appliance inspection" },
  { id: "t_model", type: "text", label: "Model #" },
  { id: "t_serial", type: "text", label: "Serial #" },
  { id: "pf_visual", type: "pass_fail", label: "Visual / leak inspection passed", required: true },
  { id: "pf_function", type: "pass_fail", label: "Operates within spec" },
  { id: "n_doc", type: "notes", label: "Service notes" },
]

const SEPTIC_INSPECTION_FIELDS: IndustryTemplateField[] = [
  { id: "sh_tank", type: "section_heading", label: "Septic / lift station inspection" },
  { id: "n_sludge", type: "number", label: "Sludge depth (in)" },
  { id: "n_scum", type: "number", label: "Scum thickness (in)" },
  { id: "pf_pump", type: "pass_fail", label: "Pump cycles correctly", required: true },
  { id: "pf_alarm", type: "pass_fail", label: "High-water alarm tested" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const AV_QA_FIELDS: IndustryTemplateField[] = [
  { id: "sh_av", type: "section_heading", label: "AV system QA" },
  { id: "pf_audio", type: "pass_fail", label: "Audio levels within reference", required: true },
  { id: "pf_video", type: "pass_fail", label: "Display calibration verified" },
  { id: "pf_control", type: "pass_fail", label: "Control system connected" },
  { id: "n_firmware", type: "text", label: "Firmware version" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const PROPERTY_INSPECTION_FIELDS: IndustryTemplateField[] = [
  { id: "sh_round", type: "section_heading", label: "Building rounds" },
  { id: "pf_egress", type: "pass_fail", label: "Egress paths & exits clear", required: true },
  { id: "pf_lighting", type: "pass_fail", label: "Emergency lighting functional" },
  { id: "pf_mech", type: "pass_fail", label: "Mechanical room walk-through clear" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const COMMERCIAL_EQUIP_PM_FIELDS: IndustryTemplateField[] = [
  { id: "sh_safety", type: "section_heading", label: "Equipment safety" },
  { id: "pf_lockout", type: "pass_fail", label: "Lockout / tagout verified", required: true },
  { id: "pf_visual", type: "pass_fail", label: "Visual inspection — no damage" },
  { id: "sh_ops", type: "section_heading", label: "Operational baseline" },
  { id: "n_temp", type: "number", label: "Operating temperature (°F)" },
  { id: "pf_alarm", type: "pass_fail", label: "Alarm test passed" },
  { id: "n_doc", type: "notes", label: "Findings" },
]

const MEP_ROUND_FIELDS: IndustryTemplateField[] = [
  { id: "sh_mep", type: "section_heading", label: "MEP combined rounds" },
  { id: "pf_elec", type: "pass_fail", label: "Electrical rooms secure / labeled", required: true },
  { id: "pf_mech", type: "pass_fail", label: "Mechanical assets within normal range" },
  { id: "pf_plumb", type: "pass_fail", label: "Plumbing leaks / domestic pressure OK" },
  { id: "n_doc", type: "notes", label: "Cross-trade notes" },
]

const BIOMEDICAL_TEMPLATE_SEEDS: IndustryTemplateSeed[] = [
  {
    name: "Electrical Safety & Leakage (IEC 60601-1)",
    equipmentCategoryId: "Patient Monitoring",
    fields: ELECTRICAL_SAFETY_FIELDS,
  },
  {
    name: "Infusion / Pump PM & Alarm Verification",
    equipmentCategoryId: "Infusion",
    fields: PUMP_PM_FIELDS,
  },
]

const commercialTemplates: IndustryTemplateSeed[] = [
  {
    name: "Equipment Monthly PM Checklist",
    equipmentCategoryId: "Commercial Equipment",
    fields: COMMERCIAL_EQUIP_PM_FIELDS,
  },
  {
    name: "Operational Audit",
    equipmentCategoryId: "Commercial Equipment",
    fields: COMMERCIAL_EQUIP_PM_FIELDS,
  },
]

const TEMPLATES_BY_INDUSTRY: Record<DemoIndustryKey, IndustryTemplateSeed[]> = {
  biomedical_medical_equipment: BIOMEDICAL_TEMPLATE_SEEDS,
  hvac_r: [
    { name: "RTU Quarterly PM Checklist", equipmentCategoryId: "HVAC", fields: HVAC_PM_FIELDS },
    { name: "Refrigeration Operational Baseline", equipmentCategoryId: "Refrigeration", fields: HVAC_PM_FIELDS },
  ],
  electrical: [
    {
      name: "Distribution Panel Annual PM",
      equipmentCategoryId: "Power Distribution",
      fields: ELECTRICAL_PANEL_FIELDS,
    },
    {
      name: "Emergency Lighting Monthly Test",
      equipmentCategoryId: "Lighting",
      fields: ELECTRICAL_PANEL_FIELDS,
    },
  ],
  plumbing: [
    { name: "Backflow Annual Test Record", equipmentCategoryId: "Backflow", fields: BACKFLOW_FIELDS },
    { name: "Booster Pump Quarterly PM", equipmentCategoryId: "Pump Systems", fields: HVAC_PM_FIELDS },
  ],
  garage_door: [
    { name: "Door Monthly Safety Inspection", equipmentCategoryId: "Door Systems", fields: DOOR_INSPECTION_FIELDS },
    { name: "Operator Quarterly PM", equipmentCategoryId: "Door Operators", fields: DOOR_INSPECTION_FIELDS },
  ],
  locksmith: [
    { name: "Access Control Quarterly Audit", equipmentCategoryId: "Access Control", fields: ACCESS_CONTROL_FIELDS },
    { name: "Door Hardware Semi-Annual PM", equipmentCategoryId: "Door Hardware", fields: ACCESS_CONTROL_FIELDS },
  ],
  property_management: [
    {
      name: "Monthly Building Walk Inspection",
      equipmentCategoryId: "Facility Assets",
      fields: PROPERTY_INSPECTION_FIELDS,
    },
    {
      name: "Quarterly Compliance Review",
      equipmentCategoryId: "Compliance",
      fields: PROPERTY_INSPECTION_FIELDS,
    },
  ],
  appliance_repair: [
    { name: "Appliance Service Visit Form", equipmentCategoryId: "Laundry", fields: APPLIANCE_INSPECTION_FIELDS },
    { name: "Annual Warranty Tune-Up", equipmentCategoryId: "Appliances", fields: APPLIANCE_INSPECTION_FIELDS },
  ],
  commercial_equipment: commercialTemplates,
  fire_security: [
    { name: "Fire Panel Monthly Inspection", equipmentCategoryId: "Fire Safety", fields: FIRE_PANEL_FIELDS },
    { name: "Access Control Quarterly Test", equipmentCategoryId: "Access Control", fields: ACCESS_CONTROL_FIELDS },
  ],
  septic: [
    { name: "Septic Quarterly Inspection", equipmentCategoryId: "Wastewater", fields: SEPTIC_INSPECTION_FIELDS },
    { name: "Lift Station Monthly PM", equipmentCategoryId: "Pumping", fields: SEPTIC_INSPECTION_FIELDS },
  ],
  av_installation: [
    { name: "AV Quarterly Health Check", equipmentCategoryId: "Audio Visual", fields: AV_QA_FIELDS },
    { name: "Meeting Room Monthly QA", equipmentCategoryId: "Audio Visual", fields: AV_QA_FIELDS },
  ],
  mep: [
    { name: "MEP Monthly Combined Rounds", equipmentCategoryId: "MEP", fields: MEP_ROUND_FIELDS },
    { name: "Electrical Room Quarterly Inspection", equipmentCategoryId: "Electrical", fields: ELECTRICAL_PANEL_FIELDS },
  ],
  field_service: commercialTemplates,
  equipment_service_repair: commercialTemplates,
  specialty_contractors: commercialTemplates,
}

export function getStarterTemplatesForIndustry(industry: DemoIndustryKey): IndustryTemplateSeed[] {
  return TEMPLATES_BY_INDUSTRY[industry] ?? TEMPLATES_BY_INDUSTRY.commercial_equipment
}

/**
 * Stable list of all known industry keys with at least one template — useful
 * for admin UIs that need to render template-availability per industry.
 */
export function listIndustriesWithTemplates(): DemoIndustryKey[] {
  return Object.keys(TEMPLATES_BY_INDUSTRY) as DemoIndustryKey[]
}
