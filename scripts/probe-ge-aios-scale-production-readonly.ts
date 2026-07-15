/**
 * GE-AIOS-OPERATOR-STORY-SCALE-VALIDATION-1A — Read-only Production portfolio counts.
 * Run via Vercel Production env only:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ge-aios-scale-production-readonly.ts
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = boot.admin
  const organizationId = getGrowthEngineAiOrgId()

  const leadsTable = admin.schema("growth").from("leads")

  const [totalLeads, activeLeads, archivedLeads, rejectedLeads] = await Promise.all([
    leadsTable.select("*", { count: "exact", head: true }),
    leadsTable.select("*", { count: "exact", head: true }).is("archived_at", null).neq("status", "archived"),
    leadsTable.select("*", { count: "exact", head: true }).not("archived_at", "is", null),
    leadsTable.select("*", { count: "exact", head: true }).in("status", ["rejected", "disqualified", "invalid"]),
  ])

  let pendingHac: number | null = null
  let hacError: string | null = null
  try {
    const hacResult = await admin
      .schema("growth")
      .from("human_approval_items")
      .select("*", { count: "exact", head: true })
      .eq("status", "needs_review")
    pendingHac = hacResult.count ?? null
    hacError = hacResult.error?.message ?? null
  } catch (error) {
    hacError = error instanceof Error ? error.message : "hac_probe_failed"
  }

  let activeObjectives: number | null = null
  let objectivesError: string | null = null
  try {
    const objectivesResult = await admin
      .schema("growth")
      .from("organization_growth_objectives")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
    activeObjectives = objectivesResult.count ?? null
    objectivesError = objectivesResult.error?.message ?? null
  } catch (error) {
    objectivesError = error instanceof Error ? error.message : "objectives_probe_failed"
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: "ge-aios-operator-story-scale-production-readonly-v1",
        organizationId: organizationId || null,
        counts: {
          total_discovered_leads: totalLeads.count ?? null,
          admitted_active_leads: activeLeads.count ?? null,
          archived_leads: archivedLeads.count ?? null,
          rejected_invalid_leads: rejectedLeads.count ?? null,
          pending_hac_items: pendingHac,
          active_objectives: activeObjectives,
        },
        errors: {
          total: totalLeads.error?.message ?? null,
          active: activeLeads.error?.message ?? null,
          hac: hacError,
          objectives: objectivesError,
        },
        readOnly: true,
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
