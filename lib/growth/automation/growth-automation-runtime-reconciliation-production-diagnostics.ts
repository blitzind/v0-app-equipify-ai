import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_UI_MODULE_PATHS,
  automationRuntimeReconciliationSafetyPayload,
} from "@/lib/growth/automation/growth-automation-runtime-reconciliation-diagnostics"

const FORBIDDEN_RUNTIME_WRITE_PATTERNS = [
  /\.from\(["']sequence_patterns["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_steps["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_step_conditions["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_step_edges["']\)\.(insert|update|upsert)/,
  /createSequencePattern/i,
  /publishSequencePattern/i,
  /queueSequenceStepTransportJob/,
  /emitGrowthNotification/i,
  /dispatchSequenceWake/i,
] as const

function probeRuntimeReconciliationModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_UI_MODULE_PATHS,
  ]) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `runtime_reconciliation:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  const forbiddenPatternScanPaths = GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-runtime-reconciliation-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-runtime-reconciliation-production-diagnostics.ts",
  )

  for (const modulePath of [...forbiddenPatternScanPaths, ...GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_RUNTIME_WRITE_PATTERNS) {
      checks.push({
        name: `runtime_reconciliation:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden write pattern" : null,
      })
    }
  }

  return checks
}

export async function executeGrowthAutomationRuntimeReconciliationProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeRuntimeReconciliationModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS)) {
    checks.push({
      name: `runtime_reconciliation_safety_flags.${key}`,
      ok:
        automationRuntimeReconciliationSafetyPayload()[
          key as keyof typeof GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_SAFETY_FLAGS
        ] === expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
      runtime_reconciliation_modules_verified: false,
      production_read_only: true,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationRuntimeReconciliationSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_RUNTIME_RECONCILIATION_QA_MARKER,
    runtime_reconciliation_modules_verified: true,
    production_read_only: true,
    checks,
    safety_flags: automationRuntimeReconciliationSafetyPayload(),
  }
}
