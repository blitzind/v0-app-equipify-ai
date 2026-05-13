import type { WorkspaceIndustryKey } from "@/lib/workspace-industry-registry"

/** Keyword scans are substring matches on `work_orders.title` only — not verified field events. */
export type IndustryTitleKeywordSignal = {
  id: string
  /** Case-insensitive: title must include at least one substring (OR). */
  anySubstrings: string[]
}

export type IndustryOperationalProfile = {
  profileId: string
  /** Prompt-only: how to interpret the same snapshot metrics for this vertical. */
  recommendationAngles: string[]
  /** Prompt-only: maintenance-plan page emphasis. */
  maintenanceAngles: string[]
  /** Scanned on recent work order titles for optional deterministic signals. */
  titleKeywordSignals: IndustryTitleKeywordSignal[]
}

const DEFAULT_PROFILE: IndustryOperationalProfile = {
  profileId: "general_field_service",
  recommendationAngles: [
    "Prioritize aging active jobs, missed schedule dates, and unassigned work before adding net-new capacity.",
    "When repeat equipment appears in the snapshot, frame follow-ups as asset reliability, not blame.",
  ],
  maintenanceAngles: [
    "Tie past-due PM plans to customer commitments and technician capacity already shown in the snapshot.",
  ],
  titleKeywordSignals: [],
}

const BY_KEY: Partial<Record<WorkspaceIndustryKey, IndustryOperationalProfile>> = {
  refrigeration_service: {
    profileId: "refrigeration_service",
    recommendationAngles: [
      "Weight `type=emergency` and repeat emergency on the same equipment heavily — cooling continuity risk.",
      "When title keyword signals for refrigerant/leak vocabulary are non-zero, treat them as intake wording cues only; still cite the numeric keyword counts.",
      "Relate past-due PM plans to compressor/rack cadence when counts support it.",
    ],
    maintenanceAngles: [
      "Contrast active emergency volume with past-due PM plans — both are factual counts from the workspace.",
    ],
    titleKeywordSignals: [
      {
        id: "refrigerant_leak_vocab",
        anySubstrings: ["refrigerant", "leak", "leaking", "low charge", "walk-in", "rack", "compressor"],
      },
      { id: "cooling_emergency_vocab", anySubstrings: ["cooling", "warm box", "temperature", "defrost", "ice build"] },
    ],
  },
  equipment_rental: {
    profileId: "equipment_rental",
    recommendationAngles: [
      "Use equipment `status` distribution as a factual readiness proxy (active vs in_repair/out_of_service).",
      "Highlight inspection-type jobs whose scheduled date passed but status is still active — turnaround risk.",
    ],
    maintenanceAngles: [
      "Frame PM plan backlog as rental-fleet availability risk when past-due plan counts are > 0.",
    ],
    titleKeywordSignals: [
      { id: "turnaround_vocab", anySubstrings: ["turnaround", "yard", "rental return", "damage", "walk-around"] },
    ],
  },
  material_handling: {
    profileId: "material_handling",
    recommendationAngles: [
      "Inspection-type backlog plus forklift/battery vocabulary hits should read as compliance + uptime risk.",
      "Repeat work on the same equipment within 90 days is an objective signal from the snapshot.",
    ],
    maintenanceAngles: [
      "Relate past-due PM plans to battery PM programs when PM counts are elevated.",
    ],
    titleKeywordSignals: [
      { id: "forklift_vocab", anySubstrings: ["forklift", "lift truck", "mhe", "reach truck", "pallet jack"] },
      { id: "battery_vocab", anySubstrings: ["battery", "charger", "watering", "industrial truck battery"] },
    ],
  },
  generator_power: {
    profileId: "generator_power",
    recommendationAngles: [
      "Pair inspection backlog with ATS / exercise / load-bank vocabulary hits (title keyword counts only).",
      "Repeat equipment work within 90 days may indicate recurring start or transfer issues — only when counts support it.",
    ],
    maintenanceAngles: [
      "Past-due PM plans should be described as exercise/PM discipline gaps when counts are non-zero.",
    ],
    titleKeywordSignals: [
      { id: "ats_vocab", anySubstrings: ["ats", "transfer switch", "automatic transfer"] },
      { id: "exercise_vocab", anySubstrings: ["exercise", "no-load", "weekly run", "runtime test"] },
      { id: "load_bank_vocab", anySubstrings: ["load bank", "loadbank", "commissioning test"] },
    ],
  },
  hvac_r: {
    profileId: "hvac_r",
    recommendationAngles: [
      "Treat seasonal congestion (`maxJobsSameDaySameAssignee`) and past-due PM plans as HVAC capacity signals.",
      "Emergency + repeat equipment patterns are factual workload indicators.",
    ],
    maintenanceAngles: [
      "Emphasize PM plan lateness vs scheduled field density when both appear in counts.",
    ],
    titleKeywordSignals: [
      { id: "rtu_vocab", anySubstrings: ["rooftop", "rtu", "split", "package unit", "seasonal pm"] },
    ],
  },
  calibration_inspection: {
    profileId: "calibration_inspection",
    recommendationAngles: [
      "Calibration due window counts are factual rows from equipment due sampling — not a certificate determination.",
      "Inspection-type backlog should be framed as compliance scheduling risk.",
    ],
    maintenanceAngles: [
      "Connect calibration due signals with PM plan lateness when both counts are present.",
    ],
    titleKeywordSignals: [
      { id: "calibration_vocab", anySubstrings: ["calibration", "as found", "as left", "nist", "traceable"] },
    ],
  },
}

export function getIndustryOperationalProfile(key: WorkspaceIndustryKey): IndustryOperationalProfile {
  return BY_KEY[key] ?? DEFAULT_PROFILE
}
