import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
  GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS,
  GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  GROWTH_AUTOMATION_OBSERVABILITY_UI_MODULE_PATHS,
  automationObservabilityApiSafetyPayload,
} from "@/lib/growth/automation/growth-automation-observability-diagnostics"

const FORBIDDEN_EXECUTION_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /runSequenceExecutionJob/,
  /emitGrowthNotification/i,
  /confirmGrowthSequenceEnrollment/,
  /materializeGrowthSequenceEnrollmentStep/,
  /runGrowthAiCopilotGeneration/,
  /insertGrowthOutreachQueueItem/,
  /runApprovedDueSequenceExecutionJobs/,
  /approveSequenceExecutionJob/,
] as const

const REQUIRED_OBSERVABILITY_PATTERNS = [
  /getAutomationRuntimeObservability/,
  /calculateRuntimeHealth/,
  /detectStuckWaits/,
  /setAutomationRuntimeKillSwitch/,
  /safeCancelAutomationEnrollment/,
] as const

const SR3_READ_TABLES = [
  "sequence_enrollments",
  "sequence_execution_jobs",
  "sequence_enrollment_step_waits",
] as const

function probeObservabilityModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_OBSERVABILITY_UI_MODULE_PATHS,
  ]) {
    checks.push({
      name: `observability:${modulePath}`,
      ok: fs.existsSync(path.join(cwd, modulePath)),
      error: fs.existsSync(path.join(cwd, modulePath)) ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_OBSERVABILITY_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-observability-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-observability-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-observability-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-observability-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_OBSERVABILITY_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `observability:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const serviceSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-observability-service.ts"),
    "utf8",
  )
  for (const pattern of REQUIRED_OBSERVABILITY_PATTERNS) {
    checks.push({
      name: `observability:required:${pattern}`,
      ok: pattern.test(serviceSource),
      error: pattern.test(serviceSource) ? null : "missing observability primitive",
    })
  }

  return checks
}

export async function executeGrowthAutomationObservabilityProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const checks = probeObservabilityModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS)) {
    checks.push({
      name: `observability_safety_flags.${key}`,
      ok:
        automationObservabilityApiSafetyPayload()[
          key as keyof typeof GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS
        ] === expected,
      error: null,
    })
  }

  for (const table of SR3_READ_TABLES) {
    const probe = await admin.schema("growth").from(table).select("id").limit(1)
    checks.push({
      name: `observability:sr3_read:${table}`,
      ok: !probe.error,
      error: probe.error?.message ?? null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
      observability_modules_verified: false,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
    observability_modules_verified: true,
    sr3_read_probes_verified: true,
    checks,
    safety_flags: GROWTH_AUTOMATION_OBSERVABILITY_SAFETY_FLAGS,
  }
}
