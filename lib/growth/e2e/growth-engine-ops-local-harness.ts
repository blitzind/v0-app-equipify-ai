/** Phase GE-OPS-1 — Local operations harness (client-safe, no Supabase). */

import { randomUUID } from "node:crypto"
import {
  apolloReadinessFindings,
  buildApolloReadinessReport,
} from "@/lib/growth/e2e/growth-engine-ops-apollo-audit"
import { runOpsDatasetCertification } from "@/lib/growth/e2e/growth-engine-ops-dataset-cert"
import {
  auditOperatorReadiness,
  buildOperatorRecommendations,
} from "@/lib/growth/e2e/growth-engine-ops-operator-audit"
import { generateOperationalRecommendations } from "@/lib/growth/e2e/growth-engine-ops-recommendations"
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

function countErrors(findings: OpsFinding[]) {
  return {
    total: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    warning: findings.filter((f) => f.severity === "warning").length,
  }
}

export function runGrowthEngineOpsLocalHarness(): GrowthEngineOpsReport {
  const blockers: string[] = []
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

  for (const tier of dataset_certification_matrix.filter((d) => !d.pass)) {
    blockers.push(`dataset_fail:${tier.tier}`)
  }

  for (const finding of allFindings.filter((f) => f.severity === "critical")) {
    blockers.push(`critical:${finding.finding_id}`)
  }

  if (apollo_readiness.integration_points_verified < apollo_readiness.integration_points_total) {
    blockers.push("apollo_integration_incomplete")
  }

  const throughput_metrics: Record<string, number> = {}
  for (const row of dataset_certification_matrix) {
    throughput_metrics[`import_${row.tier}`] = row.import_throughput_ms
    throughput_metrics[`workspace_${row.tier}`] = row.workspace_aggregation_ms
    throughput_metrics[`review_${row.tier}`] = row.review_workflow_ms
  }

  const operational_recommendations = generateOperationalRecommendations({
    apollo: apollo_readiness,
    dataset: dataset_certification_matrix,
    findings: allFindings,
  })

  operational_recommendations.push(...buildOperatorRecommendations(operator_findings))

  const allPass = blockers.length === 0

  return {
    ok: allPass,
    execution_id: randomUUID(),
    qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
    organization_id: null,
    environment: "local",
    final_verdict: allPass ? "PASS" : "FAIL",
    apollo_readiness,
    dataset_certification_matrix,
    throughput_metrics,
    error_metrics: countErrors(allFindings),
    review_workflow_metrics: {
      command_center_fetch_ms: null,
      agent_orchestration_fetch_ms: null,
      operator_inbox_fetch_ms: null,
      signal_feed_fetch_ms: null,
      human_review_required: true,
      approval_queue_items: 0,
    },
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
}
