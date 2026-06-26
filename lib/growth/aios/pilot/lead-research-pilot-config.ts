/** GE-AIOS-4A — Lead Research Pilot configuration (client-safe). */

export const GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG =
  "GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED" as const

export const GROWTH_AIOS_LEAD_RESEARCH_PILOT_AI_EVIDENCE_FLAG =
  "GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE" as const

export type LeadResearchPilotConfig = {
  enabled: boolean
  enableAiEvidence: boolean
}

export function resolveLeadResearchPilotConfig(
  env: NodeJS.ProcessEnv = process.env,
): LeadResearchPilotConfig {
  return {
    enabled: env[GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]?.trim() === "true",
    enableAiEvidence: env[GROWTH_AIOS_LEAD_RESEARCH_PILOT_AI_EVIDENCE_FLAG]?.trim() === "true",
  }
}

export function isLeadResearchPilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveLeadResearchPilotConfig(env).enabled
}
