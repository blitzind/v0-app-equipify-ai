/** Growth Engine S5-K — automation operator approval diagnostics manifests (client-safe). */

import {
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
} from "@/lib/growth/automation/growth-automation-approval-types"
import { automationApprovalSafetyPayload } from "@/lib/growth/automation/growth-automation-approval-utils"

export { GROWTH_AUTOMATION_APPROVAL_QA_MARKER, GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS }

export const GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS = [
  "lib/growth/automation/growth-automation-approval-types.ts",
  "lib/growth/automation/growth-automation-approval-utils.ts",
  "lib/growth/automation/growth-automation-approval-service.ts",
  "lib/growth/automation/growth-automation-approval-diagnostics.ts",
  "lib/growth/automation/growth-automation-approval-production-diagnostics.ts",
] as const

export const GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS = [
  "app/api/platform/growth/automation/approvals/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/approve/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/reject/route.ts",
  "app/api/platform/growth/automation/approvals/[approvalId]/cancel/route.ts",
  "app/api/platform/growth/automation/[id]/runtime/enrollments/[enrollmentId]/resume/route.ts",
] as const

export const GROWTH_AUTOMATION_APPROVAL_UI_MODULE_PATHS = [
  "components/growth/automation/growth-automation-approval-queue.tsx",
  "components/growth/automation/growth-automation-approval-card.tsx",
  "components/growth/automation/growth-automation-approval-detail-drawer.tsx",
  "components/growth/automation/growth-automation-approval-actions.tsx",
  "components/growth/automation/growth-automation-approval-status-badge.tsx",
] as const

export function automationApprovalApiSafetyPayload(): typeof GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS {
  return automationApprovalSafetyPayload()
}
