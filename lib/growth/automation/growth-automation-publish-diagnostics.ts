/** Growth Engine S5-F — publish diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
  GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-publish-types"

export { GROWTH_AUTOMATION_PUBLISH_QA_MARKER, GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-publish-types.ts",
  "lib/growth/automation/growth-automation-publish-utils.ts",
  "lib/growth/automation/growth-automation-publish-service.ts",
  "lib/growth/automation/growth-automation-publish-diagnostics.ts",
  "lib/growth/automation/growth-automation-publish-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/publish/route.ts",
  "app/api/platform/growth/automation/[id]/unpublish/route.ts",
  "app/api/platform/growth/automation/[id]/publish-status/route.ts",
  "app/api/platform/growth/automation/[id]/draft-from-published/route.ts",
] as const

export const GROWTH_AUTOMATION_PUBLISH_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-publish-panel.tsx",
  "components/growth/automation/growth-automation-publish-dialog.tsx",
  "components/growth/automation/growth-automation-version-timeline.tsx",
  "components/growth/automation/growth-automation-publish-status-badge.tsx",
] as const

export function automationPublishSafetyPayload(): typeof GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS }
}
