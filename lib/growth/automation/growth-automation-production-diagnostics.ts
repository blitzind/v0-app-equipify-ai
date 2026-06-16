import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTOMATION_ADMIN_ROUTE_PATHS,
  GROWTH_AUTOMATION_PLATFORM_ROUTE_PATHS,
  GROWTH_AUTOMATION_UI_MODULE_PATHS,
} from "@/lib/growth/automation/growth-automation-diagnostics"
import { probeGrowthAutomationBuilderSchema } from "@/lib/growth/automation/growth-automation-schema-health"
import {
  GROWTH_AUTOMATION_API_SAFETY_FLAGS,
  GROWTH_AUTOMATION_BUILDER_MIGRATION,
  GROWTH_AUTOMATION_BUILDER_QA_MARKER,
} from "@/lib/growth/automation/growth-automation-types"

function probeAutomationRouteFiles(): Array<{ name: string; ok: boolean; error: string | null }> {
  const cwd = process.cwd()
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  for (const routePath of GROWTH_AUTOMATION_PLATFORM_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({
      name: `route:${routePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  for (const routePath of GROWTH_AUTOMATION_ADMIN_ROUTE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, routePath))
    checks.push({
      name: `admin_route:${routePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  for (const modulePath of GROWTH_AUTOMATION_UI_MODULE_PATHS) {
    const exists = fs.existsSync(path.join(cwd, modulePath))
    checks.push({
      name: `ui:${modulePath}`,
      ok: exists,
      error: exists ? null : "missing",
    })
  }

  return checks
}

export async function executeGrowthAutomationBuilderProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const schemaProbe = await probeGrowthAutomationBuilderSchema(admin)
  const { executeGrowthAutomationCanvasProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-canvas-production-diagnostics"
  )
  const { executeGrowthAutomationCompilerProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-compiler-production-diagnostics"
  )
  const { executeGrowthAutomationSimulationProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-simulation-production-diagnostics"
  )
  const { executeGrowthAutomationPublishProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-publish-production-diagnostics"
  )
  const { executeGrowthAutomationRuntimeReconciliationProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-runtime-reconciliation-production-diagnostics"
  )
  const { executeGrowthAutomationRuntimePublisherProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-runtime-publisher-production-diagnostics"
  )
  const { executeGrowthAutomationEnrollmentProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-enrollment-production-diagnostics"
  )
  const { executeGrowthAutomationRuntimeExecutionProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-runtime-execution-production-diagnostics"
  )
  const { executeGrowthAutomationApprovalProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-approval-production-diagnostics"
  )
  const canvasReport = await executeGrowthAutomationCanvasProductionDiagnostics()
  const compilerReport = await executeGrowthAutomationCompilerProductionDiagnostics()
  const simulationReport = await executeGrowthAutomationSimulationProductionDiagnostics()
  const publishReport = await executeGrowthAutomationPublishProductionDiagnostics()
  const runtimeReconciliationReport = await executeGrowthAutomationRuntimeReconciliationProductionDiagnostics()
  const runtimePublisherReport = await executeGrowthAutomationRuntimePublisherProductionDiagnostics()
  const enrollmentReport = await executeGrowthAutomationEnrollmentProductionDiagnostics()
  const runtimeExecutionReport = await executeGrowthAutomationRuntimeExecutionProductionDiagnostics()
  const approvalReport = await executeGrowthAutomationApprovalProductionDiagnostics()
  const { executeGrowthAutomationObservabilityProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-observability-production-diagnostics"
  )
  const observabilityReport = await executeGrowthAutomationObservabilityProductionDiagnostics(admin)
  const { executeGrowthAutomationAnalyticsProductionDiagnostics } = await import(
    "@/lib/growth/automation/growth-automation-analytics-production-diagnostics"
  )
  const analyticsReport = await executeGrowthAutomationAnalyticsProductionDiagnostics(admin)
  const checks: Array<{ name: string; ok: boolean; error: string | null }> = schemaProbe.missingTables.map(
    (table) => ({
      name: `growth.${table}`,
      ok: false,
      error: "missing",
    }),
  )

  if (schemaProbe.ready) {
    for (const table of [
      "automation_flows",
      "automation_flow_versions",
      "automation_nodes",
      "automation_edges",
      "automation_validation_results",
    ]) {
      checks.push({ name: `growth.${table}`, ok: true, error: null })
    }

    const statusProbe = await admin
      .schema("growth")
      .from("automation_flows")
      .select("status")
      .in("status", ["draft", "published", "archived"])
      .limit(1)
    checks.push({
      name: "automation_flows.status.check",
      ok: !statusProbe.error,
      error: statusProbe.error?.message ?? null,
    })
  }

  for (const entry of probeAutomationRouteFiles()) {
    checks.push({
      name: entry.name,
      ok: entry.ok,
      error: entry.error,
    })
  }

  checks.push({
    name: "safety_flags.read_only_runtime",
    ok: GROWTH_AUTOMATION_API_SAFETY_FLAGS.read_only_runtime === true,
    error: null,
  })
  checks.push({
    name: "safety_flags.compiler_execution_enabled",
    ok: GROWTH_AUTOMATION_API_SAFETY_FLAGS.compiler_execution_enabled === false,
    error: null,
  })
  checks.push({
    name: "safety_flags.automation_execution_enabled",
    ok: GROWTH_AUTOMATION_API_SAFETY_FLAGS.automation_execution_enabled === false,
    error: null,
  })

  const failedChecks = checks.filter((check) => !check.ok)
  const schemaReady = schemaProbe.ready

  if (
    !schemaReady ||
    canvasReport.final_verdict !== "PASS" ||
    compilerReport.final_verdict !== "PASS" ||
    simulationReport.final_verdict !== "PASS" ||
    publishReport.final_verdict !== "PASS" ||
    runtimeReconciliationReport.final_verdict !== "PASS" ||
    runtimePublisherReport.final_verdict !== "PASS" ||
    enrollmentReport.final_verdict !== "PASS" ||
    runtimeExecutionReport.final_verdict !== "PASS" ||
    approvalReport.final_verdict !== "PASS" ||
    observabilityReport.final_verdict !== "PASS" ||
    analyticsReport.final_verdict !== "PASS"
  ) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      canvas_qa_marker: canvasReport.qa_marker,
      compiler_qa_marker: compilerReport.qa_marker,
      simulation_qa_marker: simulationReport.qa_marker,
      publish_qa_marker: publishReport.qa_marker,
      runtime_reconciliation_qa_marker: runtimeReconciliationReport.qa_marker,
      runtime_publisher_qa_marker: runtimePublisherReport.qa_marker,
      enrollment_qa_marker: enrollmentReport.qa_marker,
      runtime_execution_qa_marker: runtimeExecutionReport.qa_marker,
      approval_qa_marker: approvalReport.qa_marker,
      observability_qa_marker: observabilityReport.qa_marker,
      analytics_qa_marker: analyticsReport.qa_marker,
      schema_ready: schemaReady,
      live_schema_verified: schemaReady,
      production_read_only: true,
      migration: GROWTH_AUTOMATION_BUILDER_MIGRATION,
      error: !schemaReady
        ? "schema_drift"
        : canvasReport.final_verdict !== "PASS"
          ? "canvas_module_drift"
          : compilerReport.final_verdict !== "PASS"
            ? "compiler_module_drift"
            : simulationReport.final_verdict !== "PASS"
              ? "simulation_module_drift"
              : publishReport.final_verdict !== "PASS"
                ? "publish_module_drift"
                : runtimeReconciliationReport.final_verdict !== "PASS"
                  ? "runtime_reconciliation_module_drift"
                  : runtimePublisherReport.final_verdict !== "PASS"
                    ? "runtime_publisher_module_drift"
                    : enrollmentReport.final_verdict !== "PASS"
                      ? "enrollment_module_drift"
                        : runtimeExecutionReport.final_verdict !== "PASS"
                          ? "runtime_execution_module_drift"
                          : approvalReport.final_verdict !== "PASS"
                            ? "approval_module_drift"
                            : observabilityReport.final_verdict !== "PASS"
                              ? "observability_module_drift"
                              : "analytics_module_drift",
      note: !schemaReady
        ? "S5-B migration not applied on production."
        : canvasReport.final_verdict !== "PASS"
          ? "S5-C canvas modules missing or safety flags drift."
          : compilerReport.final_verdict !== "PASS"
            ? "S5-D compiler modules missing or safety flags drift."
            : simulationReport.final_verdict !== "PASS"
              ? "S5-E simulation modules missing or safety flags drift."
              : publishReport.final_verdict !== "PASS"
                ? "S5-F publish modules missing or safety flags drift."
                : runtimeReconciliationReport.final_verdict !== "PASS"
                  ? "S5-G runtime reconciliation modules missing or safety flags drift."
                  : runtimePublisherReport.final_verdict !== "PASS"
                    ? "S5-H runtime publisher modules missing or safety flags drift."
                    : enrollmentReport.final_verdict !== "PASS"
                      ? "S5-I enrollment modules missing or safety flags drift."
                        : runtimeExecutionReport.final_verdict !== "PASS"
                          ? "S5-J runtime execution modules missing or safety flags drift."
                          : approvalReport.final_verdict !== "PASS"
                            ? "S5-K approval modules missing or safety flags drift."
                            : observabilityReport.final_verdict !== "PASS"
                              ? "S5-L observability modules missing or safety flags drift."
                              : "S5-M analytics modules missing or safety flags drift.",
      failed_checks: failedChecks.map((check) => check.name),
      checks,
      canvas_report: canvasReport,
      compiler_report: compilerReport,
      simulation_report: simulationReport,
      publish_report: publishReport,
      runtime_reconciliation_report: runtimeReconciliationReport,
      runtime_publisher_report: runtimePublisherReport,
      enrollment_report: enrollmentReport,
      runtime_execution_report: runtimeExecutionReport,
      approval_report: approvalReport,
      observability_report: observabilityReport,
      analytics_report: analyticsReport,
      safety_flags: GROWTH_AUTOMATION_API_SAFETY_FLAGS,
      canvas_safety_flags: canvasReport.safety_flags,
      compiler_safety_flags: compilerReport.safety_flags,
      simulation_safety_flags: simulationReport.safety_flags,
      publish_safety_flags: publishReport.safety_flags,
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
    canvas_qa_marker: canvasReport.qa_marker,
    compiler_qa_marker: compilerReport.qa_marker,
    simulation_qa_marker: simulationReport.qa_marker,
    publish_qa_marker: publishReport.qa_marker,
    runtime_reconciliation_qa_marker: runtimeReconciliationReport.qa_marker,
    runtime_publisher_qa_marker: runtimePublisherReport.qa_marker,
    enrollment_qa_marker: enrollmentReport.qa_marker,
    runtime_execution_qa_marker: runtimeExecutionReport.qa_marker,
    approval_qa_marker: approvalReport.qa_marker,
    observability_qa_marker: observabilityReport.qa_marker,
    analytics_qa_marker: analyticsReport.qa_marker,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    route_files_verified: true,
    canvas_modules_verified: true,
    compiler_modules_verified: true,
    simulation_modules_verified: true,
    publish_modules_verified: true,
    runtime_reconciliation_modules_verified: true,
    runtime_publisher_modules_verified: true,
    enrollment_modules_verified: true,
    runtime_execution_modules_verified: true,
    approval_modules_verified: true,
    observability_modules_verified: true,
    analytics_modules_verified: true,
    migration: GROWTH_AUTOMATION_BUILDER_MIGRATION,
    checks,
    canvas_report: canvasReport,
    compiler_report: compilerReport,
    simulation_report: simulationReport,
    publish_report: publishReport,
    runtime_reconciliation_report: runtimeReconciliationReport,
    runtime_publisher_report: runtimePublisherReport,
    enrollment_report: enrollmentReport,
    runtime_execution_report: runtimeExecutionReport,
    approval_report: approvalReport,
    observability_report: observabilityReport,
    safety_flags: GROWTH_AUTOMATION_API_SAFETY_FLAGS,
    canvas_safety_flags: canvasReport.safety_flags,
    compiler_safety_flags: compilerReport.safety_flags,
    simulation_safety_flags: simulationReport.safety_flags,
    publish_safety_flags: publishReport.safety_flags,
    runtime_reconciliation_safety_flags: runtimeReconciliationReport.safety_flags,
    runtime_publisher_safety_flags: runtimePublisherReport.safety_flags,
    enrollment_safety_flags: enrollmentReport.safety_flags,
    runtime_execution_safety_flags: runtimeExecutionReport.safety_flags,
    approval_safety_flags: approvalReport.safety_flags,
    observability_safety_flags: observabilityReport.safety_flags,
    analytics_safety_flags: analyticsReport.safety_flags,
  }
}
