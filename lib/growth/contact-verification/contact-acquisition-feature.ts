/**
 * GE-IRE-7A — Contact acquisition feature flags (client-safe).
 */

export const GROWTH_CONTACT_ACQUISITION_PANEL_QA_MARKER =
  "contact-acquisition-panel-v1" as const

export function isContactAcquisitionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GROWTH_CONTACT_ACQUISITION === "true"
}

export function isContactAcquisitionEnabledClient(): boolean {
  return process.env.NEXT_PUBLIC_GROWTH_CONTACT_ACQUISITION === "true"
}
