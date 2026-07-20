/** Read-only Production probe for pre-1M external discovery repair cohort. */
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { discoverPre1mExternalDiscoveryRepairCandidates } from "./repair-ge-aios-pre-1m-external-discovery-admission-1o"

const CUTOFF = process.env.GE_AIOS_1M_DEPLOYMENT_CUTOFF_ISO?.trim() || "2026-07-16T19:20:00.000Z"

async function main() {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const candidates = await discoverPre1mExternalDiscoveryRepairCandidates({
    admin,
    organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
    deploymentCutoffIso: CUTOFF,
  })

  console.log(
    JSON.stringify(
      {
        cutoff: CUTOFF,
        organizationId: EQUIPIFY_PRODUCTION_ORG_ID,
        candidateCount: candidates.length,
        candidates: candidates.map((row) => ({
          leadId: row.id,
          companyName: row.company_name,
          createdAt: row.created_at,
          sourceKind: row.source_kind,
          promotedOrganizationId: row.promoted_organization_id,
          admissionState: (row.metadata as Record<string, unknown> | null)?.admission_state ?? null,
        })),
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
