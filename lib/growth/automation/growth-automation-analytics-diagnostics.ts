/** Growth Engine S5-M — automation analytics diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
  GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-analytics-types"
import { automationAnalyticsSafetyPayload } from "@/lib/growth/automation/growth-automation-analytics-utils"

export { GROWTH_AUTOMATION_ANALYTICS_QA_MARKER, GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-analytics-types.ts",
  "lib/growth/automation/growth-automation-analytics-utils.ts",
  "lib/growth/automation/growth-automation-analytics-service.ts",
  "lib/growth/automation/growth-automation-audit-service.ts",
  "lib/growth/automation/growth-automation-analytics-diagnostics.ts",
  "lib/growth/automation/growth-automation-analytics-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/analytics/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/summary/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/branches/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/waits/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/approvals/route.ts",
  "app/api/platform/growth/automation/[id]/analytics/jobs/route.ts",
  "app/api/platform/growth/automation/[id]/audit/route.ts",
] as const

export const GROWTH_AUTOMATION_ANALYTICS_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-analytics-panel.tsx",
  "components/growth/automation/growth-automation-runtime-metrics-grid.tsx",
  "components/growth/automation/growth-automation-branch-analytics.tsx",
  "components/growth/automation/growth-automation-wait-analytics.tsx",
  "components/growth/automation/growth-automation-approval-analytics.tsx",
  "components/growth/automation/growth-automation-job-analytics.tsx",
  "components/growth/automation/growth-automation-audit-timeline.tsx",
] as const

export function automationAnalyticsApiSafetyPayload(): typeof GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS {
  return automationAnalyticsSafetyPayload()
}
