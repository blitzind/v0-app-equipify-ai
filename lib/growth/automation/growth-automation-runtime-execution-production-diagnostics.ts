import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_UI_MODULE_PATHS,
  automationRuntimeExecutionApiSafetyPayload,
} from "@/lib/growth/automation/growth-automation-runtime-execution-diagnostics"

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
] as const

const REQUIRED_ORCHESTRATOR_PATTERNS = [
  /advanceGrowthSequenceEnrollmentAfterStep/,
  /createSequenceExecutionJob/,
  /createAutomationApprovalGate/,
  /evaluateSequenceBranchAdvanceGate/,
] as const

function probeRuntimeExecutionModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_UI_MODULE_PATHS,
  ]) {
    checks.push({
      name: `runtime_execution:${modulePath}`,
      ok: fs.existsSync(path.join(cwd, modulePath)),
      error: fs.existsSync(path.join(cwd, modulePath)) ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_RUNTIME_EXECUTION_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-runtime-execution-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-execution-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-execution-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-execution-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_RUNTIME_EXECUTION_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `runtime_execution:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const orchestratorSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-runtime-orchestrator.ts"),
    "utf8",
  )
  for (const pattern of REQUIRED_ORCHESTRATOR_PATTERNS) {
    checks.push({
      name: `runtime_execution:required:${pattern}`,
      ok: pattern.test(orchestratorSource),
      error: pattern.test(orchestratorSource) ? null : "missing orchestrator primitive",
    })
  }

  return checks
}

export async function executeGrowthAutomationRuntimeExecutionProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeRuntimeExecutionModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS)) {
    checks.push({
      name: `runtime_execution_safety_flags.${key}`,
      ok:
        automationRuntimeExecutionApiSafetyPayload()[
          key as keyof typeof GROWTH_AUTOMATION_RUNTIME_EXECUTION_SAFETY_FLAGS
        ] === expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
      runtime_execution_modules_verified: false,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationRuntimeExecutionApiSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
    runtime_execution_modules_verified: true,
    message_send_execution_enabled: false,
    checks,
    safety_flags: automationRuntimeExecutionApiSafetyPayload(),
  }
}
