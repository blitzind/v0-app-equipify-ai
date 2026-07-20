/** Read-only Production DB snapshot for DataMoon autonomous runs. */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const [runs, recentLeads, outboundRecent] = await Promise.all([
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select(
        "id, run_name, status, datamoon_audience_id, preview_count, duplicate_count, record_count, created_at, completed_at, error_message",
      )
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .schema("growth")
      .from("leads")
      .select("id, created_at, source_channel, status")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .schema("growth")
      .from("outbound_messages")
      .select("id, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const autonomousRuns = (runs.data ?? []).filter((row) =>
    String(row.run_name ?? "").startsWith("ge-aios-autonomous-prospect-search:"),
  )

  console.log(
    JSON.stringify(
      {
        autonomousRuns: autonomousRuns.map((row) => ({
          id: row.id,
          runName: row.run_name,
          status: row.status,
          datamoonAudienceId: row.datamoon_audience_id,
          requestedLimit: row.requested_limit,
          recordCount: row.record_count,
          previewCount: row.preview_count,
          duplicateCount: row.duplicate_count,
          createdAt: row.created_at,
          completedAt: row.completed_at,
          lastPolledAt: row.last_polled_at,
          errorMessage: row.error_message,
        })),
        allDatamoonRunSampleCount: runs.data?.length ?? 0,
        sampleRunNames: (runs.data ?? []).slice(0, 5).map((row) => row.run_name),
        recentEquipifyLeads: recentLeads.data ?? [],
        recentOutboundMessages: outboundRecent.data ?? [],
        errors: {
          runs: runs.error?.message ?? null,
          leads: recentLeads.error?.message ?? null,
        },
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
