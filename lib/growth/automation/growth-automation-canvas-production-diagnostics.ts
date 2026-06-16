import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUTOMATION_CANVAS_LIB_MODULE_PATHS,
  GROWTH_AUTOMATION_CANVAS_QA_MARKER,
  GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS,
  GROWTH_AUTOMATION_REACT_FLOW_MODULE_PATHS,
  automationCanvasSafetyPayload,
} from "@/lib/growth/automation/growth-automation-canvas-diagnostics"

function probeReactFlowModuleFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const modulePath of [...GROWTH_AUTOMATION_CANVAS_LIB_MODULE_PATHS, ...GROWTH_AUTOMATION_REACT_FLOW_MODULE_PATHS]) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `canvas:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  const reactFlowSource = fs.existsSync(path.join(cwd, "components/growth/automation/growth-automation-react-flow.tsx"))
    ? fs.readFileSync(path.join(cwd, "components/growth/automation/growth-automation-react-flow.tsx"), "utf8")
    : ""
  checks.push({
    name: "reactflow.import",
    ok: reactFlowSource.includes("reactflow"),
    error: reactFlowSource.includes("reactflow") ? null : "missing reactflow import",
  })

  return checks
}

export async function executeGrowthAutomationCanvasProductionDiagnostics(): Promise<Record<string, unknown>> {
  const checks = probeReactFlowModuleFiles()

  for (const [key, expected] of Object.entries(GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS)) {
    checks.push({
      name: `safety_flags.${key}`,
      ok: automationCanvasSafetyPayload()[key as keyof typeof GROWTH_AUTOMATION_CANVAS_SAFETY_FLAGS] === expected,
      error: null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)

  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_CANVAS_QA_MARKER,
      canvas_modules_verified: false,
      production_read_only: true,
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      safety_flags: automationCanvasSafetyPayload(),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_CANVAS_QA_MARKER,
    canvas_modules_verified: true,
    react_flow_modules_verified: true,
    production_read_only: true,
    checks,
    safety_flags: automationCanvasSafetyPayload(),
  }
}
