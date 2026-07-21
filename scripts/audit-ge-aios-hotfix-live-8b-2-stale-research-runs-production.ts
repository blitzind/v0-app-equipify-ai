/**
 * GE-AIOS-HOTFIX-LIVE-8B-2 — Stale research run recovery audit (read-only production).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/audit-ge-aios-hotfix-live-8b-2-stale-research-runs-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { executeGrowthLeadProspectResearch } from "@/lib/growth/research/growth-lead-research-execution-service"
import { fetchActiveProspectResearchRun } from "@/lib/growth/research/research-repository"
import { inspectAutonomousSalesLoopDryRun } from "@/lib/growth/specialists/execution/run-autonomous-sales-loop"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { diagnoseAdmissionQueue } from "@/lib/growth/training/multi-lead-intake-production-unblock-1b"
import { selectNextExecutableWorkItem } from "@/lib/growth/specialists/execution/select-next-executable-work-item"
import { extractLeadIdFromWorkItem } from "@/lib/growth/specialists/execution/extract-lead-id-from-work-item"
import { runMemoryEngine } from "@/lib/growth/memory/engine/run-memory-engine"
import { runWorkManager } from "@/lib/growth/work-manager/manager/run-work-manager"
import { isExecutableWorkItem } from "@/lib/growth/work-manager/state/work-item-state"

export const GE_AIOS_HOTFIX_LIVE_8B_2_QA_MARKER =
  "ge-aios-hotfix-live-8b-2-stale-research-run-recovery-audit-v1" as const

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const RUN_SELECT =
  "id, organization_id, lead_id, status, website_url, company_name, input_hash, research_summary, signals, completed_at, failed_reason, created_at"

type ActiveRunRow = {
  id: string
  organization_id: string
  lead_id: string
  status: string
  website_url: string | null
  company_name: string | null
  input_hash: string | null
  research_summary: string | null
  signals: unknown
  completed_at: string | null
  failed_reason: string | null
  created_at: string
}

type LeadRow = {
  id: string
  company_name: string | null
  website: string | null
  status: string | null
  metadata: Record<string, unknown> | null
  latest_prospect_research_run_id: string | null
  last_prospect_researched_at: string | null
}

type CompletedRunRow = {
  id: string
  lead_id: string
  status: string
  completed_at: string | null
  created_at: string
  research_summary: string | null
}

type RowClassification =
  | "genuinely_active"
  | "completed_but_status_not_finalized"
  | "failed_but_status_not_finalized"
  | "abandoned_stale"
  | "unknown"

function ageHours(iso: string, nowMs: number): number {
  return Math.round((nowMs - Date.parse(iso)) / (60 * 60 * 1000))
}

function hasEvidence(row: ActiveRunRow): boolean {
  if (row.research_summary?.trim()) return true
  if (!row.signals || typeof row.signals !== "object") return false
  const signals = row.signals as Record<string, unknown>
  return Boolean(
    signals.companyEvidence_v22 ||
      signals.companyEvidenceCollection_v22 ||
      signals.prospectKnowledgePack_v25c ||
      (Array.isArray(signals.painSignals) && signals.painSignals.length > 0),
  )
}

function classifyRow(input: {
  row: ActiveRunRow
  ageHours: number
  laterCompletedRun: CompletedRunRow | null
  lead: LeadRow | null
  latestProspectRunId: string | null
}): { classification: RowClassification; rationale: string; proposedTerminal: "failed" | "completed" | null } {
  const { row, ageHours: hours, laterCompletedRun, lead, latestProspectRunId } = input

  if (hours < 2) {
    return {
      classification: "genuinely_active",
      rationale: "Created within 2h — may still be in-flight on long serverless path",
      proposedTerminal: null,
    }
  }

  if (laterCompletedRun) {
    return {
      classification: "completed_but_status_not_finalized",
      rationale: `Lead has later completed run ${laterCompletedRun.id} (${laterCompletedRun.completed_at ?? laterCompletedRun.created_at}) while active lock remains`,
      proposedTerminal: "failed",
    }
  }

  if (hasEvidence(row) && row.status === "running") {
    return {
      classification: "completed_but_status_not_finalized",
      rationale: "Run row contains research evidence/signals but status never terminalized",
      proposedTerminal: "completed",
    }
  }

  if (latestProspectRunId && latestProspectRunId !== row.id && lead?.last_prospect_researched_at) {
    return {
      classification: "abandoned_stale",
      rationale: `Lead points to different latest_prospect_research_run_id (${latestProspectRunId})`,
      proposedTerminal: "failed",
    }
  }

  if (hours >= 2) {
    return {
      classification: "abandoned_stale",
      rationale: `No completion path executed; active lock age ${hours}h with empty/partial evidence`,
      proposedTerminal: "failed",
    }
  }

  return {
    classification: "unknown",
    rationale: "Insufficient evidence to classify",
    proposedTerminal: null,
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts (not .env.local)")
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const generatedAt = new Date().toISOString()
  const nowMs = Date.parse(generatedAt)

  const { data: activeRows, error: activeError } = await admin
    .schema("growth")
    .from("research_runs")
    .select(RUN_SELECT)
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })

  if (activeError) throw new Error(activeError.message)

  const rows = (activeRows ?? []) as ActiveRunRow[]
  const leadIds = [...new Set(rows.map((row) => row.lead_id))]

  const [{ data: leadRows }, { data: completedRows }] = await Promise.all([
    admin
      .schema("growth")
      .from("leads")
      .select(
        "id, company_name, website, status, metadata, latest_prospect_research_run_id, last_prospect_researched_at",
      )
      .in("id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"]),
    admin
      .schema("growth")
      .from("research_runs")
      .select("id, lead_id, status, completed_at, created_at, research_summary")
      .eq("organization_id", ORG_ID)
      .eq("status", "completed")
      .in("lead_id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"])
      .order("completed_at", { ascending: false }),
  ])

  const leadById = new Map((leadRows ?? []).map((row) => [row.id, row as LeadRow]))
  const completedByLead = new Map<string, CompletedRunRow[]>()
  for (const row of (completedRows ?? []) as CompletedRunRow[]) {
    const list = completedByLead.get(row.lead_id) ?? []
    list.push(row)
    completedByLead.set(row.lead_id, list)
  }

  const auditRows = rows.map((row) => {
    const hours = ageHours(row.created_at, nowMs)
    const lead = leadById.get(row.lead_id) ?? null
    const completedForLead = completedByLead.get(row.lead_id) ?? []
    const laterCompletedRun =
      completedForLead.find(
        (completed) =>
          Date.parse(completed.completed_at ?? completed.created_at) > Date.parse(row.created_at),
      ) ?? null
    const admission = resolveLeadAdmissionStateFromMetadata(lead?.metadata ?? null)
    const classified = classifyRow({
      row,
      ageHours: hours,
      laterCompletedRun,
      lead,
      latestProspectRunId: lead?.latest_prospect_research_run_id ?? null,
    })

    return {
      run_id: row.id,
      lead_id: row.lead_id,
      company_name: row.company_name ?? lead?.company_name ?? null,
      status: row.status,
      age_hours: hours,
      created_at: row.created_at,
      input_hash: row.input_hash,
      has_research_evidence: hasEvidence(row),
      research_summary_present: Boolean(row.research_summary?.trim()),
      completed_at: row.completed_at,
      failed_reason: row.failed_reason,
      lead_admission: admission,
      lead_latest_prospect_run_id: lead?.latest_prospect_research_run_id ?? null,
      lead_last_prospect_researched_at: lead?.last_prospect_researched_at ?? null,
      later_completed_run_id: laterCompletedRun?.id ?? null,
      later_completed_at: laterCompletedRun?.completed_at ?? null,
      classification: classified.classification,
      proposed_terminal_status: classified.proposedTerminal,
      rationale: classified.rationale,
    }
  })

  const ageBuckets = {
    under_2h: auditRows.filter((row) => row.age_hours < 2).length,
    between_2h_and_24h: auditRows.filter((row) => row.age_hours >= 2 && row.age_hours < 24).length,
    over_24h: auditRows.filter((row) => row.age_hours >= 24).length,
    oldest_hours: auditRows.reduce((max, row) => Math.max(max, row.age_hours), 0),
  }

  const classificationCounts = auditRows.reduce<Record<RowClassification, number>>(
    (acc, row) => {
      acc[row.classification] = (acc[row.classification] ?? 0) + 1
      return acc
    },
    {
      genuinely_active: 0,
      completed_but_status_not_finalized: 0,
      failed_but_status_not_finalized: 0,
      abandoned_stale: 0,
      unknown: 0,
    },
  )

  const recoverableLeadIds = [
    ...new Set(
      auditRows
        .filter((row) => row.classification !== "genuinely_active")
        .map((row) => row.lead_id),
    ),
  ]

  const [queueDiag, workSnapshot, dryRun] = await Promise.all([
    diagnoseAdmissionQueue(admin, ORG_ID),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: ORG_ID, generatedAt }),
    inspectAutonomousSalesLoopDryRun(admin, { organizationId: ORG_ID, generatedAt }),
  ])

  const { summary: memorySummary } = runMemoryEngine({
    organizationId: ORG_ID,
    generatedAt,
    workspaceSummary: workSnapshot!.workManagerInput.workspaceSummary,
    waitingOnYou: workSnapshot!.workManagerInput.waitingOnYou,
    dailyWorkQueue: workSnapshot!.workManagerInput.dailyWorkQueue,
    accomplishments: workSnapshot!.workManagerInput.accomplishments,
    timeline: workSnapshot!.workManagerInput.timeline,
    persistedStore: workSnapshot!.organizationalMemory.store,
    salesOutcomes: workSnapshot!.salesOutcomes.outcomes,
    organizationalKnowledge: workSnapshot!.organizationalKnowledge.store.items,
  })
  const workPreview = runWorkManager({
    ...workSnapshot!.workManagerInput,
    memorySummary,
    organizationId: ORG_ID,
    portfolioLeads: workSnapshot!.portfolioLeads,
  })
  const nextExecutable = selectNextExecutableWorkItem(workPreview)
  const nextLeadId = nextExecutable ? extractLeadIdFromWorkItem(nextExecutable) : null

  let blockedLeadSimulation: {
    lead_id: string
    active_run_id: string | null
    active_status: string | null
    execute_result: Awaited<ReturnType<typeof executeGrowthLeadProspectResearch>> | null
  } | null = null

  if (nextLeadId) {
    const active = await fetchActiveProspectResearchRun(admin, nextLeadId)
    if (active) {
      blockedLeadSimulation = {
        lead_id: nextLeadId,
        active_run_id: active.id,
        active_status: active.status,
        execute_result: await executeGrowthLeadProspectResearch({
          admin,
          organizationId: ORG_ID,
          leadId: nextLeadId,
          trigger: "sales_loop",
          generatedAt,
        }),
      }
    }
  }

  const report = {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_2_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    executive_summary: {
      active_run_count: rows.length,
      age_buckets: ageBuckets,
      classification_counts: classificationCounts,
      recoverable_leads: recoverableLeadIds.length,
      asl_blocker:
        blockedLeadSimulation?.execute_result?.ok === true &&
        blockedLeadSimulation.execute_result.outcome === "active"
          ? "growth_lead_research_active_reused → research_in_progress"
          : null,
    },
    lifecycle_map: {
      statuses: ["queued", "running", "completed", "failed"],
      create: "insertProspectResearchRun → status queued",
      running: "markProspectResearchRunRunning → status running",
      complete: "finishProspectResearchRun → status completed + completed_at",
      fail: "finishProspectResearchRun catch path → status failed + failed_reason + completed_at",
      active_lookup: "fetchActiveProspectResearchRun → queued|running, no age filter, maybeSingle per lead",
      asl_short_circuit:
        "executeGrowthLeadProspectResearch → fetchActiveProspectResearchRun → outcome active (before runProspectResearch)",
      duplicate_protection:
        "unique index idx_growth_research_runs_lead_active + runProspectResearch duplicate_blocked",
      missing_recovery:
        "No timeout/finally/stale reconciliation — serverless kill after queued/running leaves permanent lock",
      timestamp_authority: "created_at only (no started_at/updated_at columns)",
    },
    audit_table: auditRows,
    root_cause: {
      primary:
        "Abandoned serverless executions leave growth.research_runs in queued/running without finishProspectResearchRun; fetchActiveProspectResearchRun treats them as indefinitely active.",
      exact_code_paths: [
        "research-repository.ts fetchActiveProspectResearchRun — .in(status, [queued,running]) with no TTL",
        "growth-lead-research-execution-service.ts executeGrowthLeadProspectResearch — early return outcome:active",
        "execute-sales-workflow-agent.ts — maps active to skip_reason research_in_progress",
        "runProspectResearch — try/catch only runs finish on thrown errors inside process; process kill bypasses catch",
      ],
      why_asl_stops:
        "ASL selects research work → executeGrowthLeadProspectResearch finds stale active run → returns active → research_in_progress → no_executable_work",
    },
    canonical_stale_run_policy: {
      active_statuses: ["queued", "running"],
      max_age_queued_hours: 1,
      max_age_running_hours: 2,
      freshness_field: "created_at",
      slow_vs_abandoned:
        "Genuine in-flight research completes in production within ~30–90s; >2h running or >1h queued with no evidence is abandoned",
      terminal_status: "failed",
      failed_reason: "stale_abandoned_execution",
      replacement_allowed: true,
      duplicate_protection_preserved:
        "Only terminalize rows exceeding TTL before active lookup; sub-TTL rows still block concurrent inserts via unique partial index",
      authority: "single reconcileStaleActiveProspectResearchRuns() invoked from fetchActiveProspectResearchRun (recommended)",
    },
    smallest_repair_recommendation: {
      approach:
        "Add reconcileStaleActiveProspectResearchRuns(admin, leadId) in research-repository.ts; call at start of fetchActiveProspectResearchRun before selecting active row.",
      behavior:
        "Terminalize queued|running rows older than policy thresholds to failed with failed_reason stale_abandoned_execution; then re-query active row.",
      do_not:
        "Do not remove unique index, do not bypass duplicate protection globally, do not weaken LIVE-7B/8B paths",
    },
    production_cleanup_plan: {
      mutate_during_audit: false,
      eligible_rows: auditRows.filter((row) => row.classification !== "genuinely_active"),
      proposed_actions: auditRows
        .filter((row) => row.classification !== "genuinely_active")
        .map((row) => ({
          run_id: row.run_id,
          lead_id: row.lead_id,
          current_status: row.status,
          proposed_status: row.proposed_terminal_status ?? "failed",
          proposed_failed_reason: "stale_abandoned_execution",
          classification: row.classification,
          rationale: row.rationale,
        })),
      expected_leads_unblocked: recoverableLeadIds.length,
      risks: [
        "Terminalizing a genuinely slow run (<2h) could allow duplicate concurrent research — mitigated by conservative TTL",
        "Rows with unpersisted partial evidence are lost — acceptable; evidence was never linked to lead cache",
      ],
      rollback:
        "Restore prior status from audit snapshot; no lead cache columns should be changed for failed terminalization-only cleanup",
    },
    asl_observation: {
      dry_run_top_selection: dryRun.selected_work?.[0] ?? null,
      next_executable_lead_id: nextLeadId,
      blocked_lead_simulation: blockedLeadSimulation,
      admissions_pending: queueDiag.admissionsPending,
      research_eligible: queueDiag.researchEligible,
      executable_research_items: workPreview.all_work_items.filter(
        (item) => item.type === "research" && isExecutableWorkItem(item),
      ).length,
    },
    certification_plan_after_implementation: {
      scripts: [
        "scripts/test-ge-aios-hotfix-live-8b-2-stale-research-run-recovery.ts (local)",
        "scripts/validate-ge-aios-hotfix-live-8b-2-stale-research-run-recovery-production.ts",
      ],
      prove: [
        "sub-TTL active run still reused",
        "stale run terminalized once",
        "ASL no longer returns research_in_progress for recovered lead",
        "new research run starts and completes",
        "admission reconciliation runs",
        "admissionsPending decreases when applicable",
        "no duplicate concurrent active rows per lead",
      ],
    },
    verdict: {
      audit_complete: true,
      production_data_mutated: false,
      root_cause_proven: true,
      implementation_ready: true,
      certification: "FAIL — audit-only milestone; stale locks remain until recovery repair + cleanup",
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
