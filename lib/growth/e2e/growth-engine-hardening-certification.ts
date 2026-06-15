/** Phase GE-HARDEN-3 — Production hardening certification runner (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { fetchGrowthCommandCenterUnification } from "@/lib/growth/command-center-unification/command-center-unification-service"
import { bootstrapGrowthEngineE2EProductionEnv } from "@/lib/growth/e2e/growth-engine-e2e-production-env"
import { assertCertificationSafetyInvariants } from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import { runGrowthEngineHardeningAudit } from "@/lib/growth/e2e/growth-engine-hardening-audit"
import {
  buildGrowthEngineDiagnosticsSummary,
  detectStaleData,
} from "@/lib/growth/e2e/growth-engine-hardening-diagnostics"
import {
  attachPersistedDiagnostics,
  persistGrowthEngineHardeningDiagnostics,
} from "@/lib/growth/e2e/growth-engine-hardening-diagnostics-service"
import {
  validateGrowthEngineKillSwitches,
  validateProductionSafetyEnv,
} from "@/lib/growth/e2e/growth-engine-hardening-kill-switches"
import {
  GROWTH_ENGINE_HARDENING_QA_MARKER,
  type GrowthEngineHardeningReport,
  type HardeningFinding,
} from "@/lib/growth/e2e/growth-engine-hardening-types"
import { routeGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-router"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { REVENUE_PATH_HENRY_LEAD_ID } from "@/lib/growth/qa/revenue-path-validation-types"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"

export { GROWTH_ENGINE_HARDENING_QA_MARKER }

async function timedFetch<T>(fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = performance.now()
  const result = await fn()
  return { result, duration_ms: Math.round(performance.now() - start) }
}

function countFindings(findings: HardeningFinding[]) {
  return {
    total_findings: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
  }
}

export async function executeGrowthEngineHardeningCertification(
  admin: SupabaseClient,
  input?: { production?: boolean },
): Promise<GrowthEngineHardeningReport> {
  if (input?.production) {
    bootstrapGrowthEngineE2EProductionEnv()
  }

  const execution_id = randomUUID()
  const organization_id = getGrowthEngineAiOrgId()
  const blockers: string[] = []
  const henryLeadId = REVENUE_PATH_HENRY_LEAD_ID

  const audit = runGrowthEngineHardeningAudit()
  const kill_switch_validations = validateGrowthEngineKillSwitches()
  const safetyEnv = validateProductionSafetyEnv()

  if (audit.safety_audit.violations.length > 0) {
    blockers.push(`safety_violations:${audit.safety_audit.violations.length}`)
  }
  if (!safetyEnv.ok) {
    blockers.push(...safetyEnv.failures)
  }

  let fetchErrors = 0

  const commandCenter = await timedFetch(() =>
    fetchGrowthCommandCenterUnification(admin, {
      lead_id: henryLeadId,
      limit: 10,
      persist_audit: false,
    }),
  )
  const agent = await timedFetch(() =>
    fetchGrowthAgentOrchestration(admin, {
      lead_id: henryLeadId,
      limit: 5,
      persist_audit: false,
    }),
  )
  const inbox = await timedFetch(() => fetchOperatorInboxQueue(admin, { limit: 20 }))
  const signalFeed = await timedFetch(() =>
    loadGrowthSignalFeed(admin, { lead_id: henryLeadId, limit: 50 }),
  )

  for (const response of [commandCenter.result, agent.result, inbox.result, signalFeed.result]) {
    const safety = assertCertificationSafetyInvariants(response as unknown as Record<string, unknown>)
    if (!safety.ok) {
      blockers.push(`production_safety:${safety.failures.join(",")}`)
      fetchErrors += 1
    }
  }

  const routeStart = performance.now()
  for (let i = 0; i < 100; i++) {
    routeGrowthRealtimeEvent({
      event_type: "signal_routed",
      source: "signal_feed",
      qa_marker: "growth-signal-feed-gs1d-v1",
      lead_id: henryLeadId,
    })
  }
  const event_routing_ms = Math.round(performance.now() - routeStart)

  const stale_data_detected =
    detectStaleData({ generated_at: commandCenter.result.generated_at }) ||
    detectStaleData({ generated_at: agent.result.generated_at })

  if (stale_data_detected) {
    audit.findings.push({
      finding_id: "stale_production_data",
      severity: "warning",
      category: "observability",
      subsystem_id: "command_center_unification",
      description: "Production workspace data older than 5 minutes",
      remediation: "Trigger refresh or verify realtime subscription health",
    })
  }

  const criticalFindings = audit.findings.filter((f) => f.severity === "critical")
  for (const finding of criticalFindings) {
    blockers.push(`critical:${finding.finding_id}`)
  }

  const failedSubsystems = audit.subsystem_matrix.filter((s) => !s.pass)
  for (const row of failedSubsystems) {
    blockers.push(`subsystem_fail:${row.subsystem_id}`)
  }

  const subsystem_pass_count = audit.subsystem_matrix.filter((s) => s.pass).length
  const allPass = blockers.length === 0

  const diagnostics_summary = buildGrowthEngineDiagnosticsSummary({
    command_center_fetch_ms: commandCenter.duration_ms,
    agent_orchestration_fetch_ms: agent.duration_ms,
    operator_inbox_fetch_ms: inbox.duration_ms,
    signal_feed_fetch_ms: signalFeed.duration_ms,
    event_routing_ms,
    realtime_subscription_mode: "polling",
    polling_fallback_active: true,
    error_count: fetchErrors + criticalFindings.length,
    retry_count: audit.panels_with_retry,
    stale_data_detected,
  })

  let report: GrowthEngineHardeningReport = {
    ok: allPass,
    execution_id,
    qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
    organization_id,
    environment: input?.production ? "production" : "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    subsystem_matrix: audit.subsystem_matrix,
    diagnostics_summary,
    error_metrics: countFindings(audit.findings),
    retry_metrics: {
      panels_with_retry: audit.panels_with_retry,
      panels_missing_retry: audit.panels_missing_retry,
    },
    stale_data_findings: audit.findings.filter((f) => f.description.toLowerCase().includes("stale")),
    ux_findings: audit.findings.filter((f) => f.category === "ux_review"),
    safety_findings: audit.findings.filter((f) => f.category === "safety"),
    all_findings: audit.findings,
    kill_switch_validations,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }

  const persistResult = await persistGrowthEngineHardeningDiagnostics(admin, {
    execution_id,
    diagnostics_summary,
    subsystem_pass_count,
    subsystem_total: audit.subsystem_matrix.length,
    final_verdict: report.final_verdict,
  })

  if (input?.production && !persistResult.ok && persistResult.error !== "schema_not_ready") {
    blockers.push(`diagnostics_persist_failed:${persistResult.error}`)
    report = { ...report, ok: false, final_verdict: "FAIL", blockers: [...new Set(blockers)] }
  }

  return attachPersistedDiagnostics(report, persistResult)
}
