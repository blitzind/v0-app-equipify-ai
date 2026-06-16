/** Growth Engine S5-L — automation runtime observability diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-observability-types"
import { automationObservabilitySafetyPayload } from "@/lib/growth/automation/growth-automation-observability-utils"

export { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER, GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-observability-types.ts",
  "lib/growth/automation/growth-automation-observability-utils.ts",
  "lib/growth/automation/growth-automation-observability-service.ts",
  "lib/growth/automation/growth-automation-observability-diagnostics.ts",
  "lib/growth/automation/growth-automation-observability-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/observability/route.ts",
  "app/api/platform/growth/automation/[id]/health/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/resume/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/kill-switch/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/cancel-safe/route.ts",
] as const

export const GROWTH_AUTOMATION_OBSERVABILITY_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-observability-panel.tsx",
  "components/growth/automation/growth-automation-runtime-health-card.tsx",
  "components/growth/automation/growth-automation-runtime-counts-grid.tsx",
  "components/growth/automation/growth-automation-runtime-activity-feed.tsx",
  "components/growth/automation/growth-automation-stuck-waits-panel.tsx",
  "components/growth/automation/growth-automation-runtime-management-controls.tsx",
] as const

export function automationObservabilityApiSafetyPayload(): typeof GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS {
  return automationObservabilitySafetyPayload()
}
