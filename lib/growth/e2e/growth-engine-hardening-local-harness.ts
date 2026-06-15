/** Phase GE-HARDEN-3 — Local hardening harness (client-safe, no Supabase). */

import { randomUUID } from "node:crypto"
import { GROWTH_ENGINE_EMPTY_STATE_KINDS } from "@/lib/growth/e2e/growth-engine-hardening-empty-states"
import { runGrowthEngineHardeningAudit } from "@/lib/growth/e2e/growth-engine-hardening-audit"
import { buildGrowthEngineDiagnosticsSummary } from "@/lib/growth/e2e/growth-engine-hardening-diagnostics"
import {
  validateGrowthEngineKillSwitches,
  validateProductionSafetyEnv,
} from "@/lib/growth/e2e/growth-engine-hardening-kill-switches"
import {
  GROWTH_ENGINE_HARDENING_QA_MARKER,
  type GrowthEngineHardeningReport,
  type HardeningFinding,
} from "@/lib/growth/e2e/growth-engine-hardening-types"

function countFindings(findings: HardeningFinding[]) {
  return {
    total_findings: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
  }
}

export function runGrowthEngineHardeningLocalHarness(): GrowthEngineHardeningReport {
  const blockers: string[] = []
  const audit = runGrowthEngineHardeningAudit()
  const kill_switch_validations = validateGrowthEngineKillSwitches()
  const safetyEnv = validateProductionSafetyEnv()

  if (audit.safety_audit.violations.length > 0) {
    blockers.push(`safety_violations:${audit.safety_audit.violations.length}`)
  }

  if (!safetyEnv.ok) {
    blockers.push(...safetyEnv.failures)
  }

  const criticalFindings = audit.findings.filter((f) => f.severity === "critical")
  for (const finding of criticalFindings) {
    blockers.push(`critical:${finding.finding_id}`)
  }

  const failedSubsystems = audit.subsystem_matrix.filter((s) => !s.pass)
  for (const row of failedSubsystems) {
    blockers.push(`subsystem_fail:${row.subsystem_id}`)
  }

  if (GROWTH_ENGINE_EMPTY_STATE_KINDS.length < 9) {
    blockers.push("empty_state_kinds_incomplete")
  }

  const ux_findings = audit.findings.filter((f) => f.category === "ux_review")
  const safety_findings = audit.findings.filter((f) => f.category === "safety")
  const stale_data_findings = audit.findings.filter((f) =>
    f.description.toLowerCase().includes("stale"),
  )

  const allPass = blockers.length === 0

  return {
    ok: allPass,
    execution_id: randomUUID(),
    qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
    organization_id: null,
    environment: "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    subsystem_matrix: audit.subsystem_matrix,
    diagnostics_summary: buildGrowthEngineDiagnosticsSummary({
      polling_fallback_active: true,
      realtime_subscription_mode: "polling",
      error_count: criticalFindings.length,
      retry_count: audit.panels_with_retry,
    }),
    error_metrics: countFindings(audit.findings),
    retry_metrics: {
      panels_with_retry: audit.panels_with_retry,
      panels_missing_retry: audit.panels_missing_retry,
    },
    stale_data_findings,
    ux_findings,
    safety_findings,
    all_findings: audit.findings,
    kill_switch_validations,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }
}
