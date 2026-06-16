/** Growth Engine S5-G — runtime reconciliation diagnostics manifests (client-safe). */

import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-runtime-artifact-types"
import { GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-reconciliation-types"

export {
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
}

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-runtime-artifact-types.ts",
  "lib/growth/automation/growth-automation-runtime-reconciliation-types.ts",
  "lib/growth/automation/growth-automation-runtime-reconciliation-utils.ts",
  "lib/growth/automation/growth-automation-runtime-reconciliation-service.ts",
  "lib/growth/automation/growth-automation-runtime-reconciliation-diagnostics.ts",
  "lib/growth/automation/growth-automation-runtime-reconciliation-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS = [
  "app/api/platform/growth/automation/[id]/runtime-preview/route.ts",
  "app/api/platform/growth/automation/[id]/reconciliation/route.ts",
] as const

export const GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-runtime-preview-panel.tsx",
  "components/growth/automation/growth-automation-runtime-diff-summary.tsx",
  "components/growth/automation/growth-automation-runtime-cleanup-plan.tsx",
  "components/growth/automation/growth-automation-runtime-rollback-plan.tsx",
] as const

export function automationRuntimeReconciliationSafetyPayload(): typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS {
  return { ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS }
}
