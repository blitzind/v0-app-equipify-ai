import type { TechSkill, TechStatus } from "@/lib/mock-data"

/** Field status / availability (matches Add Technician). */
export const ALL_STATUSES: TechStatus[] = ["Available", "On Job", "Off", "Vacation"]

export const ALL_SKILLS: TechSkill[] = [
  "HVAC",
  "Electrical",
  "Calibration",
  "Medical Equipment",
  "Industrial Repair",
  "Installations",
  "Refrigeration",
  "Hydraulics",
  "Welding",
  "PLC / Controls",
]

export const ALL_REGIONS = ["Midwest", "Northeast", "Southeast", "Southwest", "West"] as const

/** Job title options (display role on roster). */
export const ALL_ROLES = [
  "Senior Field Technician",
  "Lead Calibration Specialist",
  "Industrial Repair Technician",
  "Field Technician II",
  "Field Technician I",
] as const
