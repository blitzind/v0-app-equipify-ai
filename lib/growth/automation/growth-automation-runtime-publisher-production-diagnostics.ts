import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_PUBLISHER_UI_MODULE_PATHS,
  automationRuntimePublisherSafetyPayload,
} from "@/lib/growth/automation/growth-automation-runtime-publisher-diagnostics"

const FORBIDDEN_EXECUTION_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /emitGrowthNotification/i,
  /dispatchSequenceWake/i,
  /insertGrowthOutreachQueueItem/,
  /createGrowthSequenceEnrollmentDraft/i,
  /runSequenceExecution/i,
] as const

const REQUIRED_WRITE_PATTERNS = [
  /from\(["']sequence_patterns["']\)/,
  /from\(["']sequence_pattern_steps["']\)/,
  /\.insert\(/,
] as const

function probeRuntimePublisherModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_UI_MODULE_PATHS,
  ]) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `runtime_publisher:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_RUNTIME_PUBLISHER_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-runtime-publisher-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-publisher-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-publisher-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-publisher-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_RUNTIME_PUBLISHER_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `runtime_publisher:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const servicePath = "lib/growth/automation/growth-automation-runtime-publisher-service.ts"
  const serviceSource = fs.readFileSync(path.join(cwd, servicePath), "utf8")
  for (const pattern of REQUIRED_WRITE_PATTERNS) {
    checks.push({
      name: `runtime_publisher:required_write:${pattern}`,
      ok: pattern.test(serviceSource),
      error: pattern.test(serviceSource) ? null : "missing SR-3 write path",
    })
  }

  return checks
}

export async function executeGrowthAutomationRuntimePublisherProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeRuntimePublisherModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS)) {
    checks.push({
      name: `runtime_publisher_safety_flags.${key}`,
      ok:
        automationRuntimePublisherSafetyPayload()[
          key as keyof typeof GROWTH_AUTOMATION_RUNTIME_PUBLISHER_SAFETY_FLAGS
        ] === expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
      runtime_publisher_modules_verified: false,
      production_read_only: false,
      sr3_artifact_writes_enabled: true,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationRuntimePublisherSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
    runtime_publisher_modules_verified: true,
    sr3_artifact_writes_enabled: true,
    sequence_execution_enabled: false,
    checks,
    safety_flags: automationRuntimePublisherSafetyPayload(),
  }
}
