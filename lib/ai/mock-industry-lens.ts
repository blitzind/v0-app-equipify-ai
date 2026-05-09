import "server-only"

import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"
import { WORKSPACE_INDUSTRY_DEFINITIONS } from "@/lib/workspace-industry-registry"

export type IndustryLens = {
  label: string
  /** Short phrase for PM / intervals */
  pmCadence: string
  complianceHook: string
  dispatchAngle: string
  equipmentAngle: string
}

const FALLBACK: IndustryLens = {
  label: "field service",
  pmCadence: "preventive maintenance intervals",
  complianceHook: "documentation and traceability",
  dispatchAngle: "dispatch density and travel efficiency",
  equipmentAngle: "asset uptime and lifecycle planning",
}

/** Narrative hints for trial AI previews — no pricing or regulated claims. */
export function getIndustryLens(industry: WorkspaceIndustryKey | null | undefined): IndustryLens {
  if (!industry || !WORKSPACE_INDUSTRY_DEFINITIONS[industry]) return FALLBACK

  switch (industry) {
    case "hvac_r":
      return {
        label: "HVAC-R",
        pmCadence: "seasonal PM and filter change intervals",
        complianceHook: "refrigerant handling logs and safety checks",
        dispatchAngle: "seasonal surge coverage and route packing",
        equipmentAngle: "AHU/RTU reliability and refrigerant circuit health",
      }
    case "biomedical_medical_equipment":
      return {
        label: "biomedical equipment",
        pmCadence: "PM inspections aligned with OEM and facility protocols",
        complianceHook: "calibration traceability and clinical readiness",
        dispatchAngle: "clinical corridor routing and contamination-sensitive visits",
        equipmentAngle: "patient-connected devices and downtime risk",
      }
    case "electrical":
      return {
        label: "electrical service",
        pmCadence: "infrared scans and breaker exercise programs",
        complianceHook: "NFPA-aligned inspection documentation",
        dispatchAngle: "urgent outage response vs planned maintenance slots",
        equipmentAngle: "switchgear and panel thermal trends",
      }
    case "plumbing":
      return {
        label: "plumbing",
        pmCadence: "backflow testing and domestic booster PM cycles",
        complianceHook: "cross-connection control records",
        dispatchAngle: "same-day leak triage vs planned installs",
        equipmentAngle: "pump stations and domestic pressure zones",
      }
    case "property_management":
      return {
        label: "property management",
        pmCadence: "common-area PM and seasonal inspections",
        complianceHook: "tenant notices and access coordination",
        dispatchAngle: "tenant-request backlog vs preventive rounds",
        equipmentAngle: "shared HVAC assets across buildings",
      }
    case "fire_security":
      return {
        label: "fire & security systems",
        pmCadence: "inspection and test intervals per AHJ expectations",
        complianceHook: "inspection deficiency tracking",
        dispatchAngle: "certification deadlines clustered by geography",
        equipmentAngle: "detector networks and panel reliability",
      }
    default:
      return {
        label: WORKSPACE_INDUSTRY_DEFINITIONS[industry].label.split("(")[0]?.trim() ?? FALLBACK.label,
        pmCadence: FALLBACK.pmCadence,
        complianceHook: FALLBACK.complianceHook,
        dispatchAngle: FALLBACK.dispatchAngle,
        equipmentAngle: FALLBACK.equipmentAngle,
      }
  }
}
