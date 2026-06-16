/** Growth Engine S5-D — compiler diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_COMPILER_QA_MARKER,
  GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-compiler-types"

export { GROWTH_AUTOMATION_COMPILER_QA_MARKER, GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_COMPILER_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-compiler-types.ts",
  "lib/growth/automation/growth-automation-compiler-utils.ts",
  "lib/growth/automation/growth-automation-compiler-service.ts",
  "lib/growth/automation/growth-automation-compiler-diagnostics.ts",
  "lib/growth/automation/growth-automation-compiler-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_COMPILER_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/compile/route.ts",
] as const

export const GROWTH_AUTOMATION_COMPILER_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-compiler-panel.tsx",
  "components/growth/automation/growth-automation-compiled-artifact-preview.tsx",
] as const

export function automationCompilerSafetyPayload(): typeof GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_COMPILER_SAFETY_FLAGS }
}
