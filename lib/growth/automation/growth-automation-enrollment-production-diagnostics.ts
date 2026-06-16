import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
  GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS,
  GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS,
  GROWTH_AUTOMATION_ENROLLMENT_UI_MODULE_PATHS,
  automationEnrollmentSafetyPayload,
} from "@/lib/growth/automation/growth-automation-enrollment-diagnostics"

const FORBIDDEN_EXECUTION_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /emitGrowthNotification/i,
  /confirmGrowthSequenceEnrollment/,
  /materializeGrowthSequenceEnrollmentStep/,
  /runGrowthAiCopilotGeneration/,
  /insertGrowthOutreachQueueItem/,
] as const

const REQUIRED_ENROLLMENT_PATTERNS = [
  /insertGrowthSequenceEnrollment/,
  /insertGrowthSequenceEnrollmentStep/,
  /fetchGrowthSequenceEnrollmentForLeadAndPattern/,
] as const

function probeEnrollmentModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_ENROLLMENT_UI_MODULE_PATHS,
  ]) {
    checks.push({
      name: `enrollment:${modulePath}`,
      ok: fs.existsSync(path.join(cwd, modulePath)),
      error: fs.existsSync(path.join(cwd, modulePath)) ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_ENROLLMENT_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-enrollment-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-enrollment-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-enrollment-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-enrollment-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_ENROLLMENT_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `enrollment:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const serviceSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-enrollment-service.ts"),
    "utf8",
  )
  for (const pattern of REQUIRED_ENROLLMENT_PATTERNS) {
    checks.push({
      name: `enrollment:required:${pattern}`,
      ok: pattern.test(serviceSource),
      error: pattern.test(serviceSource) ? null : "missing enrollment write path",
    })
  }

  return checks
}

export async function executeGrowthAutomationEnrollmentProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeEnrollmentModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS)) {
    checks.push({
      name: `enrollment_safety_flags.${key}`,
      ok:
        automationEnrollmentSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_ENROLLMENT_SAFETY_FLAGS] ===
        expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
      enrollment_modules_verified: false,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationEnrollmentSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
    enrollment_modules_verified: true,
    sequence_execution_enabled: false,
    checks,
    safety_flags: automationEnrollmentSafetyPayload(),
  }
}
