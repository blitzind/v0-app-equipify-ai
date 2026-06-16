import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
  GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS,
  GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
  GROWTH_AUTOMATION_ANALYTICS_UI_MODULE_PATHS,
  automationAnalyticsApiSafetyPayload,
} from "@/lib/growth/automation/growth-automation-analytics-diagnostics"

const FORBIDDEN_EXECUTION_PATTERNS = [
  /queueSequenceStepTransportJob/,
  /runSequenceExecutionJob/,
  /emitGrowthNotification/i,
  /confirmGrowthSequenceEnrollment/,
  /materializeGrowthSequenceEnrollmentStep/,
  /approveSequenceExecutionJob/,
] as const

const REQUIRED_ANALYTICS_PATTERNS = [
  /getAutomationAnalytics/,
  /getAutomationAuditTimeline/,
  /aggregateBranchStats/,
  /detectTopBottlenecks/,
  /buildAutomationAuditTimelineFromContext/,
] as const

const SR3_READ_TABLES = [
  "sequence_enrollments",
  "sequence_execution_jobs",
  "sequence_enrollment_step_waits",
  "sequence_branch_decisions",
] as const

function probeAnalyticsModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_ANALYTICS_UI_MODULE_PATHS,
  ]) {
    checks.push({
      name: `analytics:${modulePath}`,
      ok: fs.existsSync(path.join(cwd, modulePath)),
      error: fs.existsSync(path.join(cwd, modulePath)) ? null : "missing",
    })
  }

  const scanPaths = GROWTH_AUTOMATION_ANALYTICS_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-analytics-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-analytics-production-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-analytics-types.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-analytics-utils.ts",
  )

  for (const modulePath of [...scanPaths, ...GROWTH_AUTOMATION_ANALYTICS_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_EXECUTION_PATTERNS) {
      checks.push({
        name: `analytics:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  const analyticsServiceSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-analytics-service.ts"),
    "utf8",
  )
  const auditServiceSource = fs.readFileSync(
    path.join(cwd, "lib/growth/automation/growth-automation-audit-service.ts"),
    "utf8",
  )
  for (const pattern of REQUIRED_ANALYTICS_PATTERNS) {
    const source = pattern.test(analyticsServiceSource) ? analyticsServiceSource : auditServiceSource
    checks.push({
      name: `analytics:required:${pattern}`,
      ok: pattern.test(analyticsServiceSource) || pattern.test(auditServiceSource),
      error: pattern.test(source) ? null : "missing analytics primitive",
    })
  }

  return checks
}

export async function executeGrowthAutomationAnalyticsProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const checks = probeAnalyticsModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS)) {
    checks.push({
      name: `analytics_safety_flags.${key}`,
      ok:
        automationAnalyticsApiSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS] ===
        expected,
      error: null,
    })
  }

  for (const table of SR3_READ_TABLES) {
    const probe = await admin.schema("growth").from(table).select("id").limit(1)
    checks.push({
      name: `analytics:sr3_read:${table}`,
      ok: !probe.error,
      error: probe.error?.message ?? null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
      analytics_modules_verified: false,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
    analytics_modules_verified: true,
    sr3_read_probes_verified: true,
    checks,
    safety_flags: GROWTH_AUTOMATION_ANALYTICS_SAFETY_FLAGS,
  }
}
