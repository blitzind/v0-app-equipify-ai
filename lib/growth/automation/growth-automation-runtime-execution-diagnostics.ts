/** Growth Engine S5-J — automation runtime execution diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import { automationRuntimeExecutionSafetyPayload } from "@/lib/growth/automation/growth-automation-runtime-execution-utils"

export { GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER, GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-runtime-execution-types.ts",
  "lib/growth/automation/growth-automation-runtime-execution-utils.ts",
  "lib/growth/automation/growth-automation-runtime-orchestrator.ts",
  "lib/growth/automation/growth-automation-runtime-approval-gate.ts",
  "lib/growth/automation/growth-automation-runtime-execution-diagnostics.ts",
  "lib/growth/automation/growth-automation-runtime-execution-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/runtime/advance/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/advance-until-blocked/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/cancel/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/status/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/route.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_EXECUTION_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-runtime-execution-panel.tsx",
  "components/growth/automation/growth-automation-runtime-step-timeline.tsx",
  "components/growth/automation/growth-automation-runtime-approval-gate-card.tsx",
  "components/growth/automation/growth-automation-runtime-pending-job-card.tsx",
  "components/growth/automation/growth-automation-runtime-execution-status-badge.tsx",
] as const

export function automationRuntimeExecutionApiSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS {
  return automationRuntimeExecutionSafetyPayload()
}
