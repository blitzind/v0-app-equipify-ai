/** Growth Engine S5-I — automation enrollment diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-enrollment-types"

export { GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER, GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-enrollment-types.ts",
  "lib/growth/automation/growth-automation-enrollment-utils.ts",
  "lib/growth/automation/growth-automation-trigger-matcher.ts",
  "lib/growth/automation/growth-automation-enrollment-service.ts",
  "lib/growth/automation/growth-automation-enrollment-diagnostics.ts",
  "lib/growth/automation/growth-automation-enrollment-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/enroll/route.ts",
  "app/api/platform/growth/automation/[id]/bulk-enroll/route.ts",
  "app/api/platform/growth/automation/[id]/unenroll/route.ts",
  "app/api/platform/growth/automation/[id]/enrollments/route.ts",
  "app/api/platform/growth/automation/lead/[leadId]/enrollments/route.ts",
  "app/api/platform/growth/automation/trigger-match/route.ts",
] as const

export const GROWTH_AUTOMATION_ENROLLMENT_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-enrollment-panel.tsx",
  "components/growth/automation/growth-automation-enrollment-table.tsx",
  "components/growth/automation/growth-automation-enrollment-detail-drawer.tsx",
  "components/growth/automation/growth-automation-trigger-match-panel.tsx",
  "components/growth/automation/growth-automation-enrollment-status-badge.tsx",
] as const

export function automationEnrollmentSafetyPayload(): typeof GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS }
}
