/** GE-AIOS-4A / GE-AIOS-GROWTH-1A — Lead Research Pilot & Growth workflow configuration (client-safe). */

import { GROWTH_LEAD_RESEARCH_WORKFLOW_KEY } from "@/lib/growth/aios/growth/growth-lead-research-workflow-types"

/** Legacy pilot flag — alias for {@link GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG}. */
export const GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG =
  "GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLED" as const

/** Canonical Growth workflow flag — enables {@link GROWTH_LEAD_RESEARCH_WORKFLOW_KEY}. */
export const GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG =
  "GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_ENABLED" as const

export const GROWTH_AIOS_LEAD_RESEARCH_PILOT_AI_EVIDENCE_FLAG =
  "GROWTH_AIOS_LEAD_RESEARCH_PILOT_ENABLE_AI_EVIDENCE" as const

export type LeadResearchPilotConfig = {
  enabled: boolean
  enableAiEvidence: boolean
}

export type GrowthLeadResearchWorkflowConfig = LeadResearchPilotConfig & {
  workflowKey: typeof GROWTH_LEAD_RESEARCH_WORKFLOW_KEY
  /** Legacy alias — same value as `enabled`. */
  pilotEnabled: boolean
}

function resolveEnabled(env: NodeJS.ProcessEnv): boolean {
  const pilotFlag = env[GROWTH_AIOS_LEAD_RESEARCH_PILOT_FEATURE_FLAG]?.trim() === "true"
  const workflowFlag = env[GROWTH_AIOS_GROWTH_LEAD_RESEARCH_WORKFLOW_FEATURE_FLAG]?.trim() === "true"
  return pilotFlag || workflowFlag
}

export function resolveGrowthLeadResearchWorkflowConfig(
  env: NodeJS.ProcessEnv = process.env,
): GrowthLeadResearchWorkflowConfig {
  const enabled = resolveEnabled(env)
  return {
    workflowKey: GROWTH_LEAD_RESEARCH_WORKFLOW_KEY,
    enabled,
    pilotEnabled: enabled,
    enableAiEvidence: env[GROWTH_AIOS_LEAD_RESEARCH_PILOT_AI_EVIDENCE_FLAG]?.trim() === "true",
  }
}

export function resolveLeadResearchPilotConfig(
  env: NodeJS.ProcessEnv = process.env,
): LeadResearchPilotConfig {
  const config = resolveGrowthLeadResearchWorkflowConfig(env)
  return {
    enabled: config.enabled,
    enableAiEvidence: config.enableAiEvidence,
  }
}

export function isGrowthLeadResearchWorkflowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveGrowthLeadResearchWorkflowConfig(env).enabled
}

export function isLeadResearchPilotEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isGrowthLeadResearchWorkflowEnabled(env)
}
