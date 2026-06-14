/** Phase GS-2B — Prospect execution certification + approval persistence (server-only). */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { buildProspectSearchPlan } from "@/lib/growth/prospect-discovery/prospect-search-plan-builder"
import { parseProspectSearchIntent } from "@/lib/growth/prospect-discovery/prospect-search-parser"
import { deriveExecutionPlanId, deriveSearchPlanId } from "@/lib/growth/prospect-discovery/prospect-execution-plan-ids"
import { buildProspectExecutionPlan } from "@/lib/growth/prospect-discovery/prospect-execution-plan-builder"
import {
  buildProspectExecutionReadiness,
  resolveProspectProviderEnvSnapshot,
} from "@/lib/growth/prospect-discovery/prospect-execution-readiness"
import {
  PROSPECT_EXECUTION_EXECUTE_CONFIRM,
  PROSPECT_EXECUTION_QA_MARKER,
  type ProspectExecutionPlan,
  type ProspectExecutionPlanApproval,
} from "@/lib/growth/prospect-discovery/prospect-execution-plan-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"

export { PROSPECT_EXECUTION_EXECUTE_CONFIRM }

export const PROSPECT_EXECUTION_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production.",
  "GS-2B creates execution plans only — no autonomous search, enrollment, or outreach.",
  "Approval persists audit state in growth.signal_events — no provider execution.",
  "Reuses GS-2A ProspectSearchPlan and existing provider env gates.",
  "Human approval required before GS-2C execution.",
] as const

export function assertProspectExecutionExecuteAllowed(env: Record<string, string | undefined>): {
  ok: boolean
  blockers: string[]
} {
  const blockers: string[] = []
  if (env.VERCEL_ENV !== "production" && env.NODE_ENV !== "production") {
    blockers.push("production_environment_required")
  }
  return { ok: blockers.length === 0, blockers }
}

export function buildProspectExecutionReadinessPayload(input?: {
  blockers?: string[]
  gates_ok?: boolean
}): Record<string, unknown> {
  const env = typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}
  const gateCheck = assertProspectExecutionExecuteAllowed(env)
  return {
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    execute_confirm: PROSPECT_EXECUTION_EXECUTE_CONFIRM,
    readiness_checklist: [...PROSPECT_EXECUTION_READINESS_CHECKLIST],
    gates_ok: input?.gates_ok ?? gateCheck.ok,
    blockers: input?.blockers ?? gateCheck.blockers,
    execution_enabled: false,
    requires_human_approval: true,
  }
}

const CERT_QUERIES = {
  biomedical: "Find independent biomedical service companies in the southeast with 10-100 employees servicing hospitals.",
  hvac: "Find HVAC companies in Texas with 20+ technicians and recent hiring signals.",
  salesforce: "Find manufacturing service companies that use Salesforce and recently raised funding.",
} as const

export async function persistProspectExecutionPlanApproval(
  admin: SupabaseClient,
  input: {
    search_plan_id: string
    execution_plan: ProspectExecutionPlan
    approved_by_user_id?: string | null
  },
): Promise<{ ok: boolean; approval?: ProspectExecutionPlanApproval; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, error: "schema_not_ready" }
  }

  const approval_id = randomUUID()
  const execution_plan_id = deriveExecutionPlanId(input.search_plan_id)
  const approved_at = new Date().toISOString()

  const approval: ProspectExecutionPlanApproval = {
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    approval_id,
    search_plan_id: input.search_plan_id,
    execution_plan_id,
    status: "approved",
    approved_at,
    approved_by_user_id: input.approved_by_user_id ?? null,
    execution_enabled: false,
    outreach_enabled: false,
    enrollment_enabled: false,
  }

  const { error } = await admin.schema("growth").from("signal_events").insert({
    signal_id: null,
    organization_id: null,
    event_type: "scored",
    event_payload: {
      qa_marker: PROSPECT_EXECUTION_QA_MARKER,
      prospect_execution_approval: true,
      search_plan_id: input.search_plan_id,
      approval,
      execution_plan_summary: {
        search_plan_id: input.search_plan_id,
        providers: input.execution_plan.providers,
        estimated_companies: input.execution_plan.estimated_companies,
        estimated_credits: input.execution_plan.estimated_credits,
        budget_guardrail: input.execution_plan.budget_guardrail,
      },
      execution_enabled: false,
    },
    occurred_at: approved_at,
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true, approval }
}

export async function loadProspectExecutionPlanApproval(
  admin: SupabaseClient,
  search_plan_id: string,
): Promise<ProspectExecutionPlanApproval | null> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return null

  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload, occurred_at")
    .eq("event_type", "scored")
    .contains("event_payload", {
      qa_marker: PROSPECT_EXECUTION_QA_MARKER,
      prospect_execution_approval: true,
      search_plan_id,
    })
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null
  const payload = (data.event_payload as Record<string, unknown>) ?? {}
  const approval = payload.approval as ProspectExecutionPlanApproval | undefined
  return approval ?? null
}

export async function executeProspectExecutionPlannerCertification(
  admin: SupabaseClient,
  input?: { dry_run?: boolean },
) {
  const execution_id = randomUUID()
  const gateCheck = assertProspectExecutionExecuteAllowed(process.env as Record<string, string | undefined>)
  if (!gateCheck.ok) {
    return {
      ok: false,
      execution_id,
      qa_marker: PROSPECT_EXECUTION_QA_MARKER,
      blockers: gateCheck.blockers,
      final_verdict: "FAIL",
    }
  }

  if (input?.dry_run) {
    return {
      ok: true,
      execution_id,
      qa_marker: PROSPECT_EXECUTION_QA_MARKER,
      dry_run: true,
      final_verdict: "PASS",
      blockers: [],
    }
  }

  const env = resolveProspectProviderEnvSnapshot(process.env as Record<string, string | undefined>)
  const checks: Array<{ id: string; pass: boolean; detail: Record<string, unknown> }> = []

  const biomedicalPlan = buildProspectSearchPlan(parseProspectSearchIntent(CERT_QUERIES.biomedical))
  const biomedicalExec = buildProspectExecutionPlan({ search_plan: biomedicalPlan })

  checks.push({
    id: "provider_selection",
    pass:
      biomedicalExec.providers.includes("real_world_google_places") &&
      biomedicalExec.providers.includes("apollo_people_search"),
    detail: { providers: biomedicalExec.providers },
  })

  checks.push({
    id: "execution_stage_generation",
    pass:
      biomedicalExec.execution_stages.some((s) => s.stage_id === "company_discovery") &&
      biomedicalExec.execution_stages.some((s) => s.stage_id === "qualification"),
    detail: { stages: biomedicalExec.execution_stages.map((s) => s.stage_id) },
  })

  checks.push({
    id: "company_estimation",
    pass: biomedicalExec.estimated_companies >= 10,
    detail: { estimated_companies: biomedicalExec.estimated_companies },
  })

  checks.push({
    id: "contact_estimation",
    pass: biomedicalExec.estimated_contacts >= biomedicalExec.estimated_companies,
    detail: { estimated_contacts: biomedicalExec.estimated_contacts },
  })

  checks.push({
    id: "cost_estimation",
    pass: biomedicalExec.estimated_credits >= 0 && biomedicalExec.cost_breakdown.total_provider_units > 0,
    detail: {
      estimated_credits: biomedicalExec.estimated_credits,
      cost_breakdown: biomedicalExec.cost_breakdown,
    },
  })

  const readiness = buildProspectExecutionReadiness({
    search_plan: biomedicalPlan,
    env,
  })
  checks.push({
    id: "readiness_evaluation",
    pass: ["ready", "partially_ready", "blocked"].includes(readiness.status),
    detail: { status: readiness.status, reasons: readiness.reasons.map((r) => r.code) },
  })

  checks.push({
    id: "warning_generation",
    pass: biomedicalExec.warnings.length >= 2,
    detail: { warnings: biomedicalExec.warnings.slice(0, 4) },
  })

  const search_plan_id = deriveSearchPlanId(biomedicalPlan)
  const approval = await persistProspectExecutionPlanApproval(admin, {
    search_plan_id,
    execution_plan: biomedicalExec,
    approved_by_user_id: null,
  })
  const loaded = await loadProspectExecutionPlanApproval(admin, search_plan_id)
  checks.push({
    id: "approval_persistence",
    pass: approval.ok && loaded?.status === "approved" && loaded.execution_enabled === false,
    detail: { approval_id: approval.approval?.approval_id ?? null },
  })

  const hiringPlan = buildProspectSearchPlan(parseProspectSearchIntent(CERT_QUERIES.hvac))
  const hiringExec = buildProspectExecutionPlan({ search_plan: hiringPlan })
  checks.push({
    id: "signal_provider_selection",
    pass: hiringExec.providers.includes("signal_enrichment"),
    detail: { providers: hiringExec.providers },
  })

  checks.push({
    id: "no_search_execution_possible",
    pass:
      biomedicalExec.execution_enabled === false &&
      biomedicalExec.requires_human_approval === true &&
      (approval.approval?.execution_enabled === false),
    detail: {
      execution_enabled: biomedicalExec.execution_enabled,
      outreach_enabled: approval.approval?.outreach_enabled ?? false,
      enrollment_enabled: approval.approval?.enrollment_enabled ?? false,
    },
  })

  const passCount = checks.filter((c) => c.pass).length
  const certification_pct = checks.length === 0 ? 0 : Math.round((passCount / checks.length) * 1000) / 10

  return {
    ok: passCount === checks.length,
    execution_id,
    qa_marker: PROSPECT_EXECUTION_QA_MARKER,
    certification_pct,
    certification_checks: checks,
    final_verdict: passCount === checks.length ? "PASS" : "FAIL",
    blockers: checks.filter((c) => !c.pass).map((c) => c.id),
    execution_enabled: false,
    requires_human_approval: true,
  }
}
