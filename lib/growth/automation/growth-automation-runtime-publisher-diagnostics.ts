/** Growth Engine S5-H — runtime publisher diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-types"

export { GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER, GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-runtime-publisher-types.ts",
  "lib/growth/automation/growth-automation-runtime-publisher-utils.ts",
  "lib/growth/automation/growth-automation-runtime-publisher-service.ts",
  "lib/growth/automation/growth-automation-runtime-publisher-diagnostics.ts",
  "lib/growth/automation/growth-automation-runtime-publisher-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/runtime-publish/route.ts",
  "app/api/platform/growth/automation/[id]/activate/route.ts",
  "app/api/platform/growth/automation/[id]/pause/route.ts",
  "app/api/platform/growth/automation/[id]/runtime-status/route.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_PUBLISHER_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-runtime-publish-panel.tsx",
  "components/growth/automation/growth-automation-runtime-status-panel.tsx",
  "components/growth/automation/growth-automation-runtime-activation-dialog.tsx",
  "components/growth/automation/growth-automation-runtime-artifact-viewer.tsx",
] as const

export function automationRuntimePublisherSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS }
}
