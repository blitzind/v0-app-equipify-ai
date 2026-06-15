/** Phase GE-HARDEN-1 — Local E2E harness (client-safe, no Supabase). */

import { randomUUID } from "node:crypto"
import {
  assertReadinessSafetyInvariants,
  runGrowthEngineSafetyAudit,
} from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import {
  GROWTH_ENGINE_E2E_CHAIN,
  GROWTH_ENGINE_E2E_SUBSYSTEMS,
} from "@/lib/growth/e2e/growth-engine-e2e-subsystems"
import {
  GROWTH_ENGINE_E2E_QA_MARKER,
  type GrowthEngineE2ECertificationReport,
} from "@/lib/growth/e2e/growth-engine-e2e-types"

export function runGrowthEngineE2ELocalHarness(): GrowthEngineE2ECertificationReport {
  const safety_audit = runGrowthEngineSafetyAudit()
  const blockers: string[] = []

  if (safety_audit.violations.length > 0) {
    blockers.push(`safety_violations:${safety_audit.violations.length}`)
  }

  const subsystem_matrix = GROWTH_ENGINE_E2E_CHAIN.map((subsystemId) => {
    const def = GROWTH_ENGINE_E2E_SUBSYSTEMS.find((s) => s.subsystem_id === subsystemId)!
    const readiness = def.buildReadiness()
    const readinessSafety = assertReadinessSafetyInvariants(readiness)

    if (!readinessSafety.ok) {
      blockers.push(`${subsystemId}_readiness_safety_failed`)
    }

    return {
      subsystem_id: subsystemId,
      phase: def.phase,
      qa_marker: def.qa_marker,
      readiness_route: def.readiness_route,
      execute_route: def.execute_route,
      readiness_ok: readinessSafety.ok,
      certification_ok: readinessSafety.ok,
      pass_count: readinessSafety.ok ? 1 : 0,
      check_count: 1,
      failed_checks: readinessSafety.failures.map((f) => ({
        id: f,
        hint: `${def.readiness_route} — readiness safety`,
      })),
      safety_invariants_ok: readinessSafety.ok,
    }
  })

  const allPass =
    subsystem_matrix.every((row) => row.readiness_ok && row.safety_invariants_ok) &&
    safety_audit.violations.length === 0

  return {
    ok: allPass,
    execution_id: randomUUID(),
    qa_marker: GROWTH_ENGINE_E2E_QA_MARKER,
    organization_id: null,
    environment: "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    subsystem_matrix,
    safety_audit,
    audit_health: null,
    chain_order: [...GROWTH_ENGINE_E2E_CHAIN],
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }
}
