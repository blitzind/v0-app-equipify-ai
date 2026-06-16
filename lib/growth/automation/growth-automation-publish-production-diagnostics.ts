import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
  GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS,
  GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS,
  GROWTH_AUTOMATION_PUBLISH_UI_MODULE_PATHS,
  automationPublishSafetyPayload,
} from "@/lib/growth/automation/growth-automation-publish-diagnostics"

const FORBIDDEN_PUBLISH_RUNTIME_PATTERNS = [
  /\.from\(["']sequence_patterns["']\)\.(insert|update|upsert)/,
  /\.from\(["']sequence_pattern_steps["']\)\.(insert|update|upsert)/,
  /createSequencePattern/i,
  /publishSequencePattern/i,
  /queueSequenceStepTransportJob/,
  /emitGrowthNotification/i,
  /dispatchSequenceWake/i,
] as const

function probePublishModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [
    ...GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS,
    ...GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS,
    ...GROWTH_AUTOMATION_PUBLISH_UI_MODULE_PATHS,
  ]) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `publish:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  const forbiddenPatternScanPaths = GROWTH_AUTOMATION_PUBLISH_LIB_MODULE_PATHS.filter(
    (modulePath) =>
      modulePath !== "lib/growth/automation/growth-automation-publish-diagnostics.ts" &&
      modulePath !== "lib/growth/automation/growth-automation-publish-production-diagnostics.ts",
  )

  for (const modulePath of [...forbiddenPatternScanPaths, ...GROWTH_AUTOMATION_PUBLISH_ROUTE_PATHS]) {
    const source = fs.readFileSync(path.join(cwd, modulePath), "utf8")
    for (const pattern of FORBIDDEN_PUBLISH_RUNTIME_PATTERNS) {
      checks.push({
        name: `publish:forbidden:${modulePath}:${pattern}`,
        ok: !pattern.test(source),
        error: pattern.test(source) ? "forbidden runtime pattern" : null,
      })
    }
  }

  return checks
}

export async function executeGrowthAutomationPublishProductionDiagnostics(): Promise<
  Record<string, unknown>
> {
  const checks = probePublishModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS)) {
    checks.push({
      name: `publish_safety_flags.${key}`,
      ok:
        automationPublishSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS] ===
        expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
      publish_modules_verified: false,
      production_read_only: true,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationPublishSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
    publish_modules_verified: true,
    production_read_only: true,
    checks,
    safety_flags: automationPublishSafetyPayload(),
  }
}
