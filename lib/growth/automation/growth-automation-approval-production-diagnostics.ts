import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
  GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS,
  GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  GROWTH_AUTOMATION_APPROVAL_UI_MODULE_PATHS,
  automationApprovalApiSafetyPayload,
} from "@/lib/growth/automation/growth-automation-approval-diagnostics"

const FORBIDDEN_EXECUTION_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /runSequenceExecutionJob/,
  /emitGrowthNotification/i,
  /emitGrowthApprovalRequiredNotification/,
  /confirmGrowthSequenceEnrollment/,
  /materializeGrowthSequenceEnrollmentStep/,
  /runGrowthAiCopilotGeneration/,
  /insertGrowthOutreachQueueItem/,
  /runApprovedDueSequenceExecutionJobs/,
  /approveSequenceExecutionJob/,
] as const

const REQUIRED_APPROVAL_PATTERNS = [
  /updateSequenceExecutionJob/,
  /advanceGrowthSequenceEnrollmentAfterStep/,
  /extractPendingApprovalsFromEnrollmentMetadata/,
  /resumeAutomationAfterApproval/,
] as const

function probeApprovalModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_APPROVAL_UI_MODULE_PATHS,
  ]) {
    checks.push({
      name: `approval:${modulePath}`,
      ok: fs.existsSync(path.join(cwd, modulePath)),
      error: fs.existsSync(path.join(cwd, modulePath)) ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_APPROVAL_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-approval-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-approval-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-approval-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-approval-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_APPROVAL_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `approval:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const serviceSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-approval-service.ts"),
    "utf8",
  )
  for (const pattern of REQUIRED_APPROVAL_PATTERNS) {
    checks.push({
      name: `approval:required:${pattern}`,
      ok: pattern.test(serviceSource),
      error: pattern.test(serviceSource) ? null : "missing approval primitive",
    })
  }

  return checks
}

export async function executeGrowthAutomationApprovalProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeApprovalModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS)) {
    checks.push({
      name: `approval_safety_flags.${key}`,
      ok:
        automationApprovalApiSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS] ===
        expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
      approval_modules_verified: false,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
    approval_modules_verified: true,
    checks,
    safety_flags: GROWTH_AUTOMATION_APPROVAL_SAFETY_FLAGS,
  }
}
