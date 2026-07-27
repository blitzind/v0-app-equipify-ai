/**
 * AVA-PORTFOLIO-MEMORY-PERSISTENCE-HOTFIX-1A — Production portfolio memory persistence probe.
 *
 *   pnpm probe:ava-portfolio-memory-persistence-hotfix-1a:production
 *
 * Bounded schema write proof (portfolio preference only, no leads/approval/send):
 *   AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_EXECUTE=true pnpm probe:ava-portfolio-memory-persistence-hotfix-1a:production
 */

import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  recordDatamoonDiscoverySearchSliceOutcome,
  selectNextDatamoonDiscoverySearchSlice,
} from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { emptyDatamoonDiscoverySearchSliceState } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a-types"
import { mergeDiscoverySearchSliceIntoPortfolioMemory } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-state-1a"
import { loadContinuousLeadReplenishmentObservability } from "@/lib/growth/portfolio-manager/growth-continuous-lead-replenishment-observability-1a"
import { emptyPortfolioManagerMemory } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { persistPortfolioManagerMemoryPreferences } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-persistence-1a"
import { GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

const CERT_ID = "ava-portfolio-memory-persistence-hotfix-1a-v1" as const

async function loadPortfolioPreferenceRow(
  admin: Awaited<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>["admin"],
  organizationId: string,
) {
  const { data } = await admin!
    .schema("growth")
    .from("organization_memory_preferences")
    .select("preference_key, captured_at, importance, statement")
    .eq("organization_id", organizationId)
    .eq("preference_key", GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY)
    .maybeSingle()
  return data
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] portfolio memory persistence probe`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN =
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")
  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const execute = process.env.AVA_PORTFOLIO_MEMORY_PERSISTENCE_HOTFIX_1A_EXECUTE === "true"

  const beforePreference = await loadPortfolioPreferenceRow(admin, orgId)
  const beforeObs = await loadContinuousLeadReplenishmentObservability(admin, {
    organizationId: orgId,
    generatedAt,
  })

  let persistResult = null
  if (execute) {
    const projection = projectApprovedBusinessProfileToLeadDiscovery(
      buildLive1bEquipifyCompanyProfileContent(),
      "Equipify",
    )
    const selection = selectNextDatamoonDiscoverySearchSlice({
      projection,
      state: emptyDatamoonDiscoverySearchSliceState(),
      generatedAt,
    })
    const sliceState = recordDatamoonDiscoverySearchSliceOutcome({
      state: emptyDatamoonDiscoverySearchSliceState(),
      selection: {
        sliceKey: selection.sliceKey,
        clusterId: selection.clusterId,
        geoBucketId: selection.geoBucketId,
        topicVariantIndex: selection.topicVariantIndex,
      },
      generatedAt,
      selectedCount: 0,
      pushedCount: 0,
      existingCount: 0,
      rawCompanyCount: 0,
    })
    let memory = mergeDiscoverySearchSliceIntoPortfolioMemory(emptyPortfolioManagerMemory(), sliceState)
    memory = {
      ...memory,
      lastDiscoverySearchSliceSelection: selection,
    }
    persistResult = await persistPortfolioManagerMemoryPreferences(admin, {
      organizationId: orgId,
      memory,
      generatedAt,
      reason: "verification_probe",
    })
  }

  const afterPreference = await loadPortfolioPreferenceRow(admin, orgId)
  const afterObs = await loadContinuousLeadReplenishmentObservability(admin, {
    organizationId: orgId,
    generatedAt,
  })

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        organizationId: orgId,
        executeRequested: execute,
        before: {
          portfolioPreference: beforePreference,
          discoverySearchSlice: beforeObs.discoverySearchSlice,
        },
        persistResult,
        after: {
          portfolioPreference: afterPreference
            ? {
                preferenceKey: afterPreference.preference_key,
                capturedAt: afterPreference.captured_at,
                importance: afterPreference.importance,
                statementPreview: String(afterPreference.statement ?? "").slice(0, 240),
              }
            : null,
          discoverySearchSlice: afterObs.discoverySearchSlice,
        },
        invariants: {
          sentDuringProbe: false,
          approvedDuringProbe: false,
          mutatedProduction: execute,
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
