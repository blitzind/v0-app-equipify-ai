/** GE-AIOS-17F — Home surface consolidation (section audit + presentation constants). */

export const GROWTH_HOME_SURFACE_CONSOLIDATION_17F_QA_MARKER =
  "ge-aios-17f-home-surface-consolidation-v1" as const

export const GROWTH_HOME_ADVANCED_OPERATIONS_TITLE = "Advanced operations" as const
export const GROWTH_HOME_ADVANCED_OPERATIONS_SUBTITLE =
  "Research loop, missions, customer growth, and extended activity." as const

export const GROWTH_HOME_SETUP_DIAGNOSTICS_TITLE = "Setup & diagnostics" as const
export const GROWTH_HOME_SETUP_DIAGNOSTICS_SUBTITLE =
  "Workspace setup, readiness checks, and operator tools." as const

export type GrowthHomeSurfaceSectionKind =
  | "canonical_home"
  | "setup_onboarding"
  | "operational_tool"
  | "legacy_dashboard"
  | "diagnostic_debug"

export type GrowthHomeSurfaceSectionAudit = {
  id: string
  label: string
  kind: GrowthHomeSurfaceSectionKind
  /** When true, section renders above the fold on `/growth`. */
  primary: boolean
}

/** Authoritative section audit for `/growth` Home (presentation order). */
export const GROWTH_HOME_SURFACE_SECTION_AUDIT: GrowthHomeSurfaceSectionAudit[] = [
  { id: "ava-hero", label: "Daily activity report", kind: "canonical_home", primary: true },
  {
    id: "get-ava-ready",
    label: "Get Ava Ready",
    kind: "setup_onboarding",
    primary: true,
  },
  { id: "ava-work", label: "Today's Work", kind: "canonical_home", primary: true },
  { id: "ava-operating-rhythm", label: "Today's Progress", kind: "canonical_home", primary: true },
  { id: "ava-memory", label: "What I've Learned", kind: "canonical_home", primary: true },
  { id: "ava-specialist-team", label: "My Team", kind: "canonical_home", primary: true },
  { id: "waiting-on-you", label: "Waiting on you", kind: "canonical_home", primary: true },
  { id: "executive-snapshot", label: "Where things stand", kind: "canonical_home", primary: true },
  { id: "ava-research-loop", label: "Ava Research Loop", kind: "operational_tool", primary: false },
  { id: "research-growth-strategy", label: "Research & Growth Strategy", kind: "legacy_dashboard", primary: false },
  { id: "customer-growth", label: "Customer Growth", kind: "legacy_dashboard", primary: false },
  { id: "initiatives", label: "Initiatives", kind: "legacy_dashboard", primary: false },
  { id: "ava-accomplished", label: "What I've accomplished", kind: "legacy_dashboard", primary: false },
  { id: "start-ava-setup", label: "Get Ava Ready (legacy)", kind: "setup_onboarding", primary: false },
  { id: "operational-readiness", label: "Operational Readiness", kind: "operational_tool", primary: false },
  { id: "ai-activity", label: "AI Activity", kind: "diagnostic_debug", primary: false },
  { id: "debug-footer", label: "Home debug footer", kind: "diagnostic_debug", primary: false },
]

export const GROWTH_HOME_CANONICAL_SURFACE_SECTION_IDS = GROWTH_HOME_SURFACE_SECTION_AUDIT.filter(
  (row) => row.primary,
).map((row) => row.id)

export const GROWTH_HOME_BELOW_FOLD_SURFACE_SECTION_IDS = GROWTH_HOME_SURFACE_SECTION_AUDIT.filter(
  (row) => !row.primary,
).map((row) => row.id)
