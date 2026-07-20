/** GE-AIOS-DATAMOON-LIVE-SCHEDULER-TICK-VALIDATION-1A — Production evidence poll (read-only). */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const sinceIso = "2026-07-15T16:18:00.000Z"

  const [
    autonomousRuns,
    cronRuns,
    recentLeads,
    outboundRecent,
    killSwitches,
    runRecords,
  ] = await Promise.all([
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("*")
      .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
    admin
      .schema("growth")
      .from("cron_execution_runs")
      .select("id, cron_route, started_at, finished_at, ok, metrics")
      .eq("cron_route", "/api/cron/growth-objective-runtime-scheduler")
      .gte("started_at", sinceIso)
      .order("started_at", { ascending: false })
      .limit(10),
    admin
      .schema("growth")
      .from("leads")
      .select("id, created_at, source_channel, status, metadata")
      .eq("organization_id", orgId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, created_at, channel")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false }),
    getRuntimeKillSwitchStates(admin),
    admin
      .schema("growth")
      .from("datamoon_audience_import_records")
      .select("run_id, status, dedupe_rule, message")
      .gte("created_at", sinceIso),
  ])

  const admission = { accepted: 0, review: 0, rejected: 0, invalid: 0, pending: 0 }
  for (const lead of recentLeads.data ?? []) {
    const state = resolveLeadAdmissionStateFromMetadata(
      (lead as { metadata?: Record<string, unknown> }).metadata,
    )
    if (state === "accepted") admission.accepted += 1
    else if (state === "review") admission.review += 1
    else if (state === "rejected") admission.rejected += 1
    else if (state === "invalid") admission.invalid += 1
    else admission.pending += 1
  }

  const recordStatusCounts: Record<string, number> = {}
  for (const row of runRecords.data ?? []) {
    const status = String((row as { status: string }).status)
    recordStatusCounts[status] = (recordStatusCounts[status] ?? 0) + 1
  }

  console.log(
    JSON.stringify(
      {
        sinceIso,
        killSwitches: {
          autonomy_enabled: killSwitches.autonomy_enabled,
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        cronExecutions: (cronRuns.data ?? []).map((row) => ({
          id: row.id,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          ok: row.ok,
          durationMs: (row.metrics as { metadata?: { duration_ms_observed?: number } })?.metadata
            ?.duration_ms_observed,
          telemetry: row.metrics,
        })),
        autonomousRuns: (autonomousRuns.data ?? []).map((row) => {
          const meta = (row.provider_metadata as Record<string, unknown>) ?? {}
          const autonomous = meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined
          return {
            id: row.id,
            runName: row.run_name,
            status: row.status,
            datamoonAudienceId: row.datamoon_audience_id,
            requestedLimit: row.requested_limit,
            recordCount: row.record_count,
            previewCount: row.preview_count,
            importedCount: row.imported_count,
            duplicateCount: row.duplicate_count,
            skippedCount: row.skipped_count,
            errorCount: row.error_count,
            dryRun: row.dry_run,
            createdAt: row.created_at,
            lastPolledAt: row.last_polled_at,
            completedAt: row.completed_at,
            errorMessage: row.error_message,
            organizationId: (meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined)?.organization_id ?? null,
            targetingSummary: meta.targeting_summary ?? null,
            readOnlyProof: autonomous?.read_only_proof ?? null,
          }
        }),
        importRecordStatusCounts: recordStatusCounts,
        newLeadsInWindow: recentLeads.data?.length ?? 0,
        admission,
        outboundMessagesInWindow: outboundRecent.data?.length ?? 0,
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
