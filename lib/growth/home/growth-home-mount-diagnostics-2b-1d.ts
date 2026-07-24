/**
 * AVA-GROWTH-HOTFIX-2B-1D — Home mount path diagnostics (client-safe).
 */

export const AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER = "ava-growth-hotfix-2b-1d-home-mount-v1" as const

export type GrowthHomeMountStage =
  | "route_entered"
  | "shell_rendered"
  | "dashboard_body_rendered"
  | "hook_initialized"
  | "critical_effect_registered"
  | "critical_request_started"

export function logGrowthHomeMountStage(
  stage: GrowthHomeMountStage,
  detail?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return
  console.info("[growth_home_mount_stage]", {
    qaMarker: AVA_GROWTH_HOTFIX_2B_1D_QA_MARKER,
    stage,
    ...detail,
  })
}
