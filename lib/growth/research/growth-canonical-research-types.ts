/** GE-AIOS-23 — Canonical research routing types (client-safe). */

export const GROWTH_CANONICAL_RESEARCH_23_QA_MARKER = "ge-aios-23-runtime-canonicalization-v1" as const

export const GROWTH_CANONICAL_RESEARCH_PHASE = "GE-AIOS-23" as const

/** Single production research execution chain. */
export const GROWTH_CANONICAL_RESEARCH_EXECUTION_CHAIN = [
  "executeGrowthLeadProspectResearch",
  "runProspectResearch",
] as const

/** Deprecated entry points — must delegate to the facade. */
export const GROWTH_DEPRECATED_RESEARCH_ENTRY_POINTS = [
  "runGrowthLeadResearch",
  "POST /api/platform/growth/leads/[leadId]/research",
  "POST /api/platform/growth/leads/[leadId]/research/rebuild (direct orchestrator)",
  "scheduleLeadResearchPilotForProspect (execution)",
  "lead-research-agent-executor LLM path",
] as const
