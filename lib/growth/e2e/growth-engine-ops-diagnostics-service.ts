/** Phase GE-OPS-1 — Persist ops diagnostics to growth.signal_events (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_ENGINE_OPS_QA_MARKER,
  type GrowthEngineOpsReport,
} from "@/lib/growth/e2e/growth-engine-ops-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export async function persistGrowthEngineOpsDiagnostics(
  admin: SupabaseClient,
  input: {
    execution_id: string
    report: Pick<
      GrowthEngineOpsReport,
      | "apollo_readiness"
      | "dataset_certification_matrix"
      | "throughput_metrics"
      | "error_metrics"
      | "review_workflow_metrics"
      | "final_verdict"
    >
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_unavailable" }
  }

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    logGrowthEngine("ops_diagnostics_skipped", {
      qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
      reason: "schema_not_ready",
      execution_id: input.execution_id,
    })
    return { ok: false, error: "schema_not_ready" }
  }

  const now = new Date().toISOString()
  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id,
      event_type: "scored",
      event_payload: {
        qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
        event_name: "growth_engine_ops_diagnostics",
        growth_engine_ops: true,
        execution_id: input.execution_id,
        final_verdict: input.report.final_verdict,
        apollo_readiness: input.report.apollo_readiness,
        dataset_certification_matrix: input.report.dataset_certification_matrix,
        throughput_metrics: input.report.throughput_metrics,
        error_metrics: input.report.error_metrics,
        review_workflow_metrics: input.report.review_workflow_metrics,
        requires_human_review: true,
        autonomous_execution_enabled: false,
        outreach_execution: false,
        enrollment_execution: false,
      },
      occurred_at: now,
    })
    .select("id")
    .single()

  if (error) {
    logGrowthEngine("ops_diagnostics_persist_failed", {
      qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
      execution_id: input.execution_id,
      error: error.message,
    })
    return { ok: false, error: error.message }
  }

  logGrowthEngine("ops_diagnostics_persisted", {
    qa_marker: GROWTH_ENGINE_OPS_QA_MARKER,
    execution_id: input.execution_id,
    audit_event_id: data?.id,
  })

  return { ok: true, audit_event_id: data?.id as string | undefined }
}

export function attachPersistedOpsDiagnostics(
  report: GrowthEngineOpsReport,
  persistResult: { ok: boolean; audit_event_id?: string },
): GrowthEngineOpsReport {
  return {
    ...report,
    persisted_audit_event_id: persistResult.audit_event_id ?? null,
  }
}
