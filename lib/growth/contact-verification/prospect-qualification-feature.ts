/**
 * GE-IRE-7B — Prospect qualification feature flags (client-safe).
 */

export const GROWTH_PROSPECT_QUALIFICATION_PANEL_QA_MARKER =
  "prospect-qualification-panel-v1" as const

export function isProspectQualificationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_PROSPECT_QUALIFICATION === "true"
}

export function isProspectQualificationEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_PROSPECT_QUALIFICATION === "true"
}
