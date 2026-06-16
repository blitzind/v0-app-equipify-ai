import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
  GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS,
  GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS,
  GROWTH_AUTOMATION_SIMULATION_UI_MODULE_PATHS,
  automationSimulationSafetyPayload,
} from "@/lib/growth/automation/growth-automation-simulation-diagnostics"

const FORBIDDEN_SIMULATION_EXECUTION_PATTERNS = [
  /\.from\(["']sequence_patterns["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_steps["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_step_conditions["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_step_edges["']\)\.(insert|update|upsert)/,
  /createSequencePattern/i,
  /publishSequencePattern/i,
  /queueSequenceStepTransportJob/,
  /emitGrowthNotification/,
  /dispatchSequenceWake/i,
  /executeSequenceBranch/i,
  /insertGrowthOutreachQueueItem/,
] as const

function probeSimulationModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_SIMULATION_UI_MODULE_PATHS,
  ]) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `simulation:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  const forbiddenPatternScanPaths = GROWTH_AUTOMATION_SIMULATION_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-simulation-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-simulation-production-diagnostics.ts",
  )

  for (const modulePath of [...forbiddenPatternScanPaths, ...GROWTH_AUTOMATION_SIMULATION_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_SIMULATION_EXECUTION_PATTERNS) {
      checks.push({
        name: `simulation:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden execution pattern" : null,
      })
    }
  }

  return checks
}

export async function executeGrowthAutomationSimulationProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probeSimulationModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS)) {
    checks.push({
      name: `simulation_safety_flags.${key}`,
      ok:
        automationSimulationSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_SIMULATION_SAFETY_FLAGS] ===
        expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
      simulation_modules_verified: false,
      production_read_only: true,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationSimulationSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_SIMULATION_QA_MARKER,
    simulation_modules_verified: true,
    production_read_only: true,
    checks,
    safety_flags: automationSimulationSafetyPayload(),
  }
}
