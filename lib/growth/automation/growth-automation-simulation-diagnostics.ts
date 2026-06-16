/** Growth Engine S5-E — simulation diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
  GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-simulation-types"

export { GROWTH_AUTOMATION_SIMULATION_QA_MARKER, GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-simulation-types.ts",
  "lib/growth/automation/growth-automation-simulation-utils.ts",
  "lib/growth/automation/growth-automation-simulation-service.ts",
  "lib/growth/automation/growth-automation-simulation-diagnostics.ts",
  "lib/growth/automation/growth-automation-simulation-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/simulate/route.ts",
] as const

export const GROWTH_AUTOMATION_SIMULATION_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-simulation-panel.tsx",
  "components/growth/automation/growth-automation-simulation-timeline.tsx",
] as const

export function automationSimulationSafetyPayload(): typeof GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS }
}
