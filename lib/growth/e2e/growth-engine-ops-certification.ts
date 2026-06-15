/** Phase GE-OPS-1 — Production operations certification runner (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAgentOrchestration } from "@/lib/growth/agent-orchestration/agent-orchestration-service"
import { fetchGrowthCommandCenterUnification } from "@/lib/growth/command-center-unification/command-center-unification-service"
import { bootstrapGrowthEngineE2EProductionEnv } from "@/lib/growth/e2e/growth-engine-e2e-production-env"
import { assertCertificationSafetyInvariants } from "@/lib/growth/e2e/growth-engine-e2e-safety-audit"
import {
  apolloReadinessFindings,
  buildApolloReadinessReport,
} from "@/lib/growth/e2e/growth-engine-ops-apollo-audit"
import { runOpsDatasetCertification } from "@/lib/growth/e2e/growth-engine-ops-dataset-cert"
import {
  attachPersistedOpsDiagnostics,
  persistGrowthEngineOpsDiagnostics,
} from "@/lib/growth/e2e/growth-engine-ops-diagnostics-service"
import {
  auditOperatorReadiness,
  buildOperatorRecommendations,
} from "@/lib/growth/e2e/growth-engine-ops-operator-audit"
import { generateOperationalRecommendations } from "@/lib/growth/e2e/growth-engine-ops-recommendations"
import { OPS_DATASET_THRESHOLDS } from "@/lib/growth/e2e/growth-engine-ops-thresholds"
import {
  GROWTH_ENGINE_OPS_QA_MARKER,
  type GrowthEngineOpsReport,
  type OpsFinding,
} from "@/lib/growth/e2e/growth-engine-ops-types"
import {
  certifyHumanWorkflow,
  verifyWorkflowSafetyInvariants,
} from "@/lib/growth/e2e/growth-engine-ops-workflow-audit"
import { validateProductionSafetyEnv } from "@/lib/growth/e2e/growth-engine-hardening-kill-switches"
import { fetchOperatorInboxQueue } from "@/lib/growth/operator-inbox/operator-inbox-service"
import { REVENUE_PATH_HENRY_LEAD_ID } from "@/lib/growth/qa/revenue-path-validation-types"
import { loadGrowthSignalFeed } from "@/lib/growth/signal-intelligence/signal-feed-repository"

export { GROWTH_ENGINE_OPS_QA_MARKER }

async function timedFetch<T>(fn: () => Promise<T>): Promise<{ result: T; duration_ms: number }> {
  const start = performance.now()
  const result = await fn()
  return { result, duration_ms: Math.round(performance.now() - start) }
}

function countErrors(findings: OpsFinding[]) {
  return {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
  }
}

export async function executeGrowthEngineOpsCertification(
  admin: SupabaseClient,
  input?: { production?: boolean },
): Promise<GrowthEngineOpsReport> {
  if (input?.production) {
    bootstrapGrowthEngineE2EProductionEnv()
  }

  const execution_id = randomUUID()
  const organization_id = getGrowthEngineAiOrgId()
  const blockers: string[] = []
  const henryLeadId = REVENUE_PATH_HENRY_LEAD_ID

  const apollo_readiness = buildApolloReadinessReport()
  const dataset_certification_matrix = runOpsDatasetCertification()
  const workflow = certifyHumanWorkflow()
  const operator_findings = auditOperatorReadiness()

  const apolloFindings = apolloReadinessFindings(apollo_readiness)
  const allFindings = [
    ...apolloFindings,
    ...workflow.safety_findings,
    ...workflow.workflow_findings,
    ...operator_findings,
  ]

  if (!verifyWorkflowSafetyInvariants()) {
    blockers.push("workflow_safety_invariants_failed")
  }

  const safetyEnv = validateProductionSafetyEnv()
  if (!safetyEnv.ok) {
    blockers.push(...safetyEnv.failures)
  }

  let productionFetchSlow = false
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

  if (commandCenter.duration_ms > OPS_DATASET_THRESHOLDS.production_command_center_fetch_ms) {
    productionFetchSlow = true
  }

  for (const response of [commandCenter.result, agent.result, inbox.result, signalFeed.result]) {
    const safety = assertCertificationSafetyInvariants(response as unknown as Record<string, unknown>)
    if (!safety.ok) {
      blockers.push(`production_safety:${safety.failures.join(",")}`)
      fetchErrors += 1
    }
  }

  const inboxSafetyItems = inbox.result.items.filter(
    (i) => i.requires_human_review === true && i.autonomous_execution_enabled === false,
  )
  if (inbox.result.items.length > 0 && inboxSafetyItems.length !== inbox.result.items.length) {
    blockers.push("inbox_item_safety_invariant_failed")
  }

  for (const tier of dataset_certification_matrix.filter((d) => !d.pass)) {
    blockers.push(`dataset_fail:${tier.tier}`)
  }

  for (const finding of allFindings.filter((f) => f.severity === "critical")) {
    blockers.push(`critical:${finding.finding_id}`)
  }

  if (apollo_readiness.integration_points_verified < apollo_readiness.integration_points_total) {
    blockers.push("apollo_integration_incomplete")
  }

  const throughput_metrics: Record<string, number> = {
    production_command_center_ms: commandCenter.duration_ms,
    production_agent_ms: agent.duration_ms,
    production_inbox_ms: inbox.duration_ms,
    production_signal_feed_ms: signalFeed.duration_ms,
  }
  for (const row of dataset_certification_matrix) {
    throughput_metrics[`import_${row.tier}`] = row.import_throughput_ms
    throughput_metrics[`workspace_${row.tier}`] = row.workspace_aggregation_ms
    throughput_metrics[`review_${row.tier}`] = row.review_workflow_ms
  }

  const review_workflow_metrics = {
    command_center_fetch_ms: commandCenter.duration_ms,
    agent_orchestration_fetch_ms: agent.duration_ms,
    operator_inbox_fetch_ms: inbox.duration_ms,
    signal_feed_fetch_ms: signalFeed.duration_ms,
    human_review_required: true as const,
    approval_queue_items: inbox.result.items.filter((i) => i.status === "new").length,
  }

  const operational_recommendations = generateOperationalRecommendations({
    apollo: apollo_readiness,
    dataset: dataset_certification_matrix,
    findings: allFindings,
    production_fetch_slow: productionFetchSlow,
  })
  operational_recommendations.push(...buildOperatorRecommendations(operator_findings))

  const allPass = blockers.length === 0 && fetchErrors === 0

  let report: GrowthEngineOpsReport = {
    ok: allPass,
    execution_id,
    qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
    organization_id,
    environment: input?.production ? "production" : "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    apollo_readiness,
    dataset_certification_matrix,
    throughput_metrics,
    error_metrics: {
      ...countErrors(allFindings),
      total: countErrors(allFindings).total + fetchErrors,
    },
    review_workflow_metrics,
    safety_findings: workflow.safety_findings,
    workflow_findings: workflow.workflow_findings,
    operator_findings,
    operational_recommendations: [...new Set(operational_recommendations)],
    persisted_audit_event_id: null,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    blockers: [...new Set(blockers)],
  }

  const persistResult = await persistGrowthEngineOpsDiagnostics(admin, {
    execution_id,
    report,
  })

  if (input?.production && !persistResult.ok && persistResult.error !== "schema_not_ready") {
    blockers.push(`diagnostics_persist_failed:${persistResult.error}`)
    report = {
      ...report,
      ok: false,
      final_verdict: "FAIL",
      blockers: [...new Set(blockers)],
    }
  }

  return attachPersistedOpsDiagnostics(report, persistResult)
}
