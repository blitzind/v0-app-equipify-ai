/** GE-AIOS-23 — Canonical mission runtime ownership (client-safe). */

export const GROWTH_CANONICAL_MISSION_RUNTIME_QA_MARKER = "ge-aios-23-canonical-mission-runtime-v1" as const

/**
 * Production mission runtime chain:
 *
 * Objectives Runtime (growth-objective-runtime-service)
 *   → Mission Context (loadGrowthLeadAdmissionContext / objective binding)
 *   → Decision Engine (buildDecisionContext + runDecisionEngine)
 *
 * Mission Center = presentation + operator launch UX only.
 * Mission Framework Engine = internal agent planning — not production tick owner.
 */
export const GROWTH_CANONICAL_MISSION_RUNTIME_CHAIN = [
  "growth-objective-runtime-service",
  "loadGrowthLeadAdmissionContext",
  "buildDecisionContext",
  "runDecisionEngine",
] as const

export const GROWTH_MISSION_PRESENTATION_ONLY = [
  "growth-mission-runtime-orchestrator",
  "growth-mission-center-synthesizer",
] as const

export const GROWTH_MISSION_INTERNAL_PLANNING_ONLY = [
  "growth-mission-framework-engine",
  "ai-executive-mission-planning-service",
] as const
