/** Phase GE-HARDEN-3 — Persist hardening diagnostics to growth.signal_events (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngineAiOrgId, logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_ENGINE_HARDENING_QA_MARKER,
  type GrowthEngineDiagnosticsSummary,
  type GrowthEngineHardeningReport,
} from "@/lib/growth/e2e/growth-engine-hardening-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export async function persistGrowthEngineHardeningDiagnostics(
  admin: SupabaseClient,
  input: {
    execution_id: string
    diagnostics_summary: GrowthEngineDiagnosticsSummary
    subsystem_pass_count: number
    subsystem_total: number
    final_verdict: "PASS" | "FAIL"
  },
): Promise<{ ok: boolean; audit_event_id?: string; error?: string }> {
  const organization_id = getGrowthEngineAiOrgId()
  if (!organization_id) {
    return { ok: false, error: "organization_id_unavailable" }
  }

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    logGrowthEngine("hardening_diagnostics_skipped", {
      qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
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
        qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
        event_name: "growth_engine_hardening_diagnostics",
        growth_engine_hardening: true,
        execution_id: input.execution_id,
        final_verdict: input.final_verdict,
        subsystem_pass_count: input.subsystem_pass_count,
        subsystem_total: input.subsystem_total,
        diagnostics: input.diagnostics_summary,
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
    logGrowthEngine("hardening_diagnostics_persist_failed", {
      qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
      execution_id: input.execution_id,
      error: error.message,
    })
    return { ok: false, error: error.message }
  }

  logGrowthEngine("hardening_diagnostics_persisted", {
    qa_marker: GROWTH_ENGINE_HARDENING_QA_MARKER,
    execution_id: input.execution_id,
    audit_event_id: data?.id,
  })

  return { ok: true, audit_event_id: data?.id as string | undefined }
}

export function attachPersistedDiagnostics(
  report: GrowthEngineHardeningReport,
  persistResult: { ok: boolean; audit_event_id?: string },
): GrowthEngineHardeningReport {
  return {
    ...report,
    diagnostics_summary: {
      ...report.diagnostics_summary,
      persisted_audit_event_id: persistResult.audit_event_id ?? null,
    },
  }
}
