/**
 * GE-AIOS-HOTFIX-LIVE-8B-2 — One-time stale research run cleanup (production).
 *
 * Dry run (default):
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/reconcile-ge-aios-hotfix-live-8b-2-stale-research-runs-production.ts
 *
 * Execute cleanup:
 *   CONFIRM_GE_AIOS_HOTFIX_LIVE_8B_2_STALE_CLEANUP=1 node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/reconcile-ge-aios-hotfix-live-8b-2-stale-research-runs-production.ts
 */
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
  STALE_ABANDONED_EXECUTION_FAILED_REASON,
  isStaleActiveProspectResearchRun,
  reconcileStaleActiveProspectResearchRuns,
} from "@/lib/growth/research/research-repository"

const ORG_ID = EQUIPIFY_PRODUCTION_ORG_ID
const RUN_SELECT =
  "id, organization_id, lead_id, status, website_url, company_name, research_summary, signals, completed_at, failed_reason, created_at"

type ActiveRunRow = {
  id: string
  organization_id: string
  lead_id: string
  status: string
  company_name: string | null
  research_summary: string | null
  signals: unknown
  completed_at: string | null
  failed_reason: string | null
  created_at: string
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

function ageHours(iso: string, nowMs: number): number {
  return Math.round((nowMs - Date.parse(iso)) / (60 * 60 * 1000))
}

async function countActiveRuns(admin: import("@supabase/supabase-js").SupabaseClient): Promise<number> {
  const { count, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
  if (error) throw new Error(error.message)
  return count ?? 0
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
  const execute = process.env.CONFIRM_GE_AIOS_HOTFIX_LIVE_8B_2_STALE_CLEANUP === "1"

  const beforeCount = await countActiveRuns(admin)

  const { data: activeRows, error } = await admin
    .schema("growth")
    .from("research_runs")
    .select(RUN_SELECT)
    .eq("organization_id", ORG_ID)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  const rows = (activeRows ?? []) as ActiveRunRow[]
  const leadIds = [...new Set(rows.map((row) => row.lead_id))]

  const { data: completedRows } = await admin
    .schema("growth")
    .from("research_runs")
    .select("id, lead_id, completed_at, created_at")
    .eq("organization_id", ORG_ID)
    .eq("status", "completed")
    .in("lead_id", leadIds.length > 0 ? leadIds : ["00000000-0000-0000-0000-000000000000"])

  const completedByLead = new Map<string, Array<{ id: string; completed_at: string | null; created_at: string }>>()
  for (const row of completedRows ?? []) {
    const list = completedByLead.get(row.lead_id) ?? []
    list.push(row)
    completedByLead.set(row.lead_id, list)
  }

  const candidates = rows.map((row) => {
    const laterCompleted =
      (completedByLead.get(row.lead_id) ?? []).find(
        (completed) =>
          Date.parse(completed.completed_at ?? completed.created_at) > Date.parse(row.created_at),
      ) ?? null

    return {
      run_id: row.id,
      lead_id: row.lead_id,
      company_name: row.company_name,
      status: row.status,
      created_at: row.created_at,
      age_hours: ageHours(row.created_at, nowMs),
      stale_by_policy: isStaleActiveProspectResearchRun(row, nowMs),
      has_evidence: hasEvidence(row),
      completed_at: row.completed_at,
      later_completed_run_id: laterCompleted?.id ?? null,
      proposed_result: {
        status: "failed",
        failed_reason: STALE_ABANDONED_EXECUTION_FAILED_REASON,
        completed_at: generatedAt,
      },
    }
  })

  const blocked = candidates.filter(
    (row) =>
      row.has_evidence ||
      row.completed_at != null ||
      row.later_completed_run_id != null,
  )
  const eligible = candidates.filter(
    (row) =>
      row.stale_by_policy &&
      !row.has_evidence &&
      row.completed_at == null &&
      !row.later_completed_run_id,
  )

  if (blocked.length > 0) {
    throw new Error(
      `Aborting: ${blocked.length} active row(s) violate cleanup safety guards: ${blocked
        .map((row) => row.run_id)
        .join(", ")}`,
    )
  }

  let recoveredRunIds: string[] = []
  if (execute) {
    for (const leadId of [...new Set(eligible.map((row) => row.lead_id))]) {
      const result = await reconcileStaleActiveProspectResearchRuns(admin, leadId, { nowMs })
      recoveredRunIds.push(...result.recovered.map((row) => row.runId))
    }
  }

  const afterCount = execute ? await countActiveRuns(admin) : beforeCount

  const report = {
    qa_marker: GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
    generated_at: generatedAt,
    organization_id: ORG_ID,
    mode: execute ? "execute" : "dry_run",
    confirmation_required: "CONFIRM_GE_AIOS_HOTFIX_LIVE_8B_2_STALE_CLEANUP=1",
    totals: {
      active_before: beforeCount,
      active_after: afterCount,
      eligible_for_recovery: eligible.length,
      recovered: recoveredRunIds.length,
    },
    candidates,
    recovered_run_ids: recoveredRunIds,
    note: execute
      ? "Cleanup executed via reconcileStaleActiveProspectResearchRuns per lead."
      : "Dry run only — no rows mutated.",
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
