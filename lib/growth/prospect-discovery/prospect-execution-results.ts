/** Persist and load prospect execution runs + results — server-only. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { deriveExecutionPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import type { ProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import { buildInitialStageStates, computeEstimatedProgressPct } from "@/lib/growth/prospect-discovery/prospect-execution-progress"
import {
  PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
  type ProspectExecutionRun,
  type ProspectExecutionRunResults,
  type ProspectExecutionRunStatus,
} from "@/lib/growth/prospect-discovery/prospect-execution-run-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

const activeRunControls = new Map<string, { paused: boolean; cancelled: boolean }>()

export function getProspectExecutionRunControl(execution_run_id: string) {
  if (!activeRunControls.has(execution_run_id)) {
    activeRunControls.set(execution_run_id, { paused: false, cancelled: false })
  }
  return activeRunControls.get(execution_run_id)!
}

export function setProspectExecutionRunPaused(execution_run_id: string, paused: boolean): void {
  getProspectExecutionRunControl(execution_run_id).paused = paused
}

export function setProspectExecutionRunCancelled(execution_run_id: string): void {
  const control = getProspectExecutionRunControl(execution_run_id)
  control.cancelled = true
  control.paused = false
}

export function clearProspectExecutionRunControl(execution_run_id: string): void {
  activeRunControls.delete(execution_run_id)
}

export function isProspectExecutionRunPaused(execution_run_id: string): boolean {
  return getProspectExecutionRunControl(execution_run_id).paused
}

export function isProspectExecutionRunCancelled(execution_run_id: string): boolean {
  return getProspectExecutionRunControl(execution_run_id).cancelled
}

export async function createProspectExecutionRun(
  admin: SupabaseClient,
  input: {
    execution_plan: ProspectExecutionPlan
    search_plan_id: string
    operator_id?: string | null
  },
): Promise<{ ok: boolean; run?: ProspectExecutionRun; audit_event_id?: string; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const execution_run_id = randomUUID()
  const now = new Date().toISOString()
  const run: ProspectExecutionRun = {
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    execution_run_id,
    execution_plan_id: deriveExecutionPlanId(input.search_plan_id),
    search_plan_id: input.search_plan_id,
    operator_id: input.operator_id ?? null,
    status: "pending",
    current_stage: null,
    completed_stages: [],
    stage_states: buildInitialStageStates(input.execution_plan),
    estimated_progress_pct: 0,
    companies_discovered: 0,
    contacts_discovered: 0,
    credits_consumed: 0,
    warnings: [],
    failures: [],
    discovery_run_id: null,
    company_ids: [],
    qualified_company_ids: [],
    signal_feed_routed_count: 0,
    execution_started_at: null,
    execution_completed_at: null,
    enrollment_enabled: false,
    outreach_enabled: false,
  }

  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: null,
      event_type: "scored",
      event_payload: {
        qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
        prospect_execution_run: true,
        execution_run_id,
        search_plan_id: input.search_plan_id,
        run,
        results_companies: [],
        results_qualified_companies: [],
        enrollment_enabled: false,
        outreach_enabled: false,
      },
      occurred_at: now,
    })
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  getProspectExecutionRunControl(execution_run_id)
  return { ok: true, run, audit_event_id: data?.id as string | undefined }
}

export async function persistProspectExecutionRun(
  admin: SupabaseClient,
  input: {
    audit_event_id: string
    run: ProspectExecutionRun
    results_companies?: GrowthProspectSearchCompanyResult[]
    results_qualified_companies?: GrowthProspectSearchCompanyResult[]
  },
): Promise<{ ok: boolean; error?: string }> {
  const { data, error: fetchError } = await admin
    .schema("growth")
    .from("signal_events")
    .select("event_payload")
    .eq("id", input.audit_event_id)
    .maybeSingle()

  if (fetchError || !data) return { ok: false, error: "run_not_found" }

  const payload = (data.event_payload as Record<string, unknown>) ?? {}
  const updatedRun = {
    ...input.run,
    estimated_progress_pct: computeEstimatedProgressPct(input.run),
  }

  const { error } = await admin
    .schema("growth")
    .from("signal_events")
    .update({
      event_payload: {
        ...payload,
        run: updatedRun,
        results_companies: input.results_companies ?? payload.results_companies ?? [],
        results_qualified_companies:
          input.results_qualified_companies ?? payload.results_qualified_companies ?? [],
        updated_at: new Date().toISOString(),
      },
    })
    .eq("id", input.audit_event_id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function loadProspectExecutionRunById(
  admin: SupabaseClient,
  execution_run_id: string,
): Promise<{ run: ProspectExecutionRun | null; audit_event_id: string | null; results: ProspectExecutionRunResults | null }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { run: null, audit_event_id: null, results: null }
  }

  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload")
    .eq("event_type", "scored")
    .contains("event_payload", {
      qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
      prospect_execution_run: true,
      execution_run_id,
    })
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { run: null, audit_event_id: null, results: null }
  const payload = (data.event_payload as Record<string, unknown>) ?? {}
  const run = payload.run as ProspectExecutionRun | undefined
  if (!run) return { run: null, audit_event_id: data.id as string, results: null }

  const results: ProspectExecutionRunResults = {
    qa_marker: PROSPECT_DISCOVERY_EXECUTION_QA_MARKER,
    execution_run_id,
    companies: (payload.results_companies as GrowthProspectSearchCompanyResult[]) ?? [],
    qualified_companies: (payload.results_qualified_companies as GrowthProspectSearchCompanyResult[]) ?? [],
    discovery_run_id: run.discovery_run_id,
    signal_feed_routed_count: run.signal_feed_routed_count,
  }

  return { run, audit_event_id: data.id as string, results }
}

export function finalizeProspectExecutionRunStatus(
  run: ProspectExecutionRun,
  status: ProspectExecutionRunStatus,
): ProspectExecutionRun {
  return {
    ...run,
    status,
    current_stage:
      status === "completed" || status === "failed" || status === "cancelled" ? null : run.current_stage,
    execution_completed_at:
      status === "completed" || status === "failed" || status === "cancelled"
        ? new Date().toISOString()
        : run.execution_completed_at,
    estimated_progress_pct: status === "completed" ? 100 : computeEstimatedProgressPct(run),
  }
}
