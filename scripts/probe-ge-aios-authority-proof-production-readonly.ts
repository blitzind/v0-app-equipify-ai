/**
 * GE-AIOS-AUTHORITY-PROOF-AUDIT-1A — Read-only production lifecycle mismatch probe.
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
const GE_AIOS_AUTHORITY_PROOF_AUDIT_1A_QA_MARKER = "ge-aios-authority-proof-audit-1a-v1" as const

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId()

  const leads = admin.schema("growth").from("leads")
  const df = admin.schema("growth").from("draft_factory_lead_states")
  const suppressions = admin.schema("growth").from("growth_suppression_entries")
  const opportunities = admin.schema("growth").from("opportunities")
  const seqJobs = admin.schema("growth").from("sequence_execution_jobs")

  const [activeLeads, archivedLeads, disqualifiedLeads, suppressedRows, pausedDf, closedOpps, queuedJobs] =
    await Promise.all([
      leads.select("id, status", { count: "exact", head: true }).eq("status", "in_outreach"),
      leads.select("id, status", { count: "exact", head: true }).eq("status", "archived"),
      leads.select("id, status", { count: "exact", head: true }).eq("status", "disqualified"),
      suppressions.select("id, lead_id, reason", { count: "exact" }).limit(5),
      df.select("lead_id, state, paused_reason", { count: "exact" })
        .eq("state", "paused")
        .limit(10),
      opportunities.select("id, stage_key, lead_id", { count: "exact" })
        .in("stage_key", ["closed_won", "closed_lost"])
        .limit(10),
      seqJobs
        .select("id, lead_id, status", { count: "exact" })
        .in("status", ["queued", "pending", "running"])
        .limit(20),
    ])

  const mismatches: string[] = []
  const suppressedLeadIds = new Set(
    (suppressedRows.data ?? []).map((row) => (row as { lead_id?: string }).lead_id).filter(Boolean),
  )
  const closedLeadIds = new Set(
    (closedOpps.data ?? []).map((row) => (row as { lead_id?: string }).lead_id).filter(Boolean),
  )

  for (const job of queuedJobs.data ?? []) {
    const leadId = (job as { lead_id?: string }).lead_id
    if (!leadId) continue
    if (suppressedLeadIds.has(leadId)) {
      mismatches.push(`queued_sequence_job_on_suppressed_lead:${(job as { id: string }).id}`)
    }
    if (closedLeadIds.has(leadId)) {
      mismatches.push(`queued_sequence_job_on_closed_opportunity_lead:${(job as { id: string }).id}`)
    }
  }

  const activeDfOnTerminal = await df
    .select("lead_id, state")
    .not("state", "in", '("paused","failed","rejected","executed")')
    .limit(50)
    .then((result) => result.data ?? [])
    .catch(() => [])

  for (const row of activeDfOnTerminal) {
    const leadId = (row as { lead_id?: string }).lead_id
    if (leadId && suppressedLeadIds.has(leadId)) {
      mismatches.push(`active_draft_factory_on_suppressed_lead:${leadId}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_AUTHORITY_PROOF_AUDIT_1A_QA_MARKER,
        organizationId,
        readOnly: true,
        counts: {
          active_leads: activeLeads.count,
          archived_leads: archivedLeads.count,
          disqualified_leads: disqualifiedLeads.count,
          suppression_sample: suppressedRows.count,
          paused_draft_factory: pausedDf.count,
          closed_opportunities_sample: closedOpps.count,
          queued_sequence_jobs_sample: queuedJobs.count,
        },
        lifecycle_mismatches_sample: mismatches.slice(0, 20),
        mismatch_count: mismatches.length,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
