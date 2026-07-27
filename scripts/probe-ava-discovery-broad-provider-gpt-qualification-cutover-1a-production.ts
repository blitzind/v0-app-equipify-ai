/**
 * AVA-DISCOVERY-BROAD-PROVIDER-GPT-QUALIFICATION-CUTOVER-1A — Production live proof (read-only).
 *
 *   pnpm probe:ava-discovery-broad-provider-gpt-qualification-cutover-1a:production
 */

import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { prepareDatamoonAudienceImportRequestForBuild } from "@/lib/growth/lead-sources/datamoon/datamoon-b2b-audience-import-prepare"
import {
  AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS,
  GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER,
} from "@/lib/growth/lead-sources/datamoon/datamoon-autonomous-broad-provider-discovery-1a"
import { resolveDatamoonProviderFiltersForImport } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-filter-mapping"
import { selectNextDatamoonDiscoverySearchSlice } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-1a"
import { readDiscoverySearchSliceStateFromPortfolioMemory } from "@/lib/growth/lead-sources/datamoon/growth-datamoon-discovery-search-slice-state-1a"
import { projectApprovedBusinessProfileToLeadDiscovery } from "@/lib/growth/business-profile/business-profile-lead-discovery-projection"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"
import { loadContinuousLeadReplenishmentObservability } from "@/lib/growth/portfolio-manager/growth-continuous-lead-replenishment-observability-1a"
import { buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile } from "@/lib/growth/prospect-search/prospect-search-datamoon-business-profile-projection-1a"
import { parsePortfolioManagerMemoryFromStore } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-memory-1a"
import { AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { isExternalDiscoveryLeadIntakeSource } from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon"

const CERT_ID = GROWTH_DATAMOON_AUTONOMOUS_BROAD_PROVIDER_DISCOVERY_1A_QA_MARKER

function analyzeFilters(filters: DatamoonAudienceFilter[]) {
  const deferred = AUTONOMOUS_BROAD_PROVIDER_QUALIFICATION_FILTER_FIELDS.filter((field) =>
    filters.some((row) => row.field === field),
  )
  return {
    all: filters,
    deferredFieldsPresent: deferred,
    stateSent: filters.some((f) => f.field === "personal_state" || f.field === "state"),
    topicIdCount: 0,
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] production live proof audit`)
  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN =
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")
  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const generatedAt = new Date().toISOString()
  const deployCutoff = process.env.AVA_BROAD_PROVIDER_CUTOVER_DEPLOY_ISO ?? "2026-07-27T22:30:00.000Z"

  const obs = await loadContinuousLeadReplenishmentObservability(admin, { organizationId: orgId, generatedAt })
  const approved = await getActiveApprovedBusinessProfile(admin, orgId)

  const { data: runs } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .gte("created_at", deployCutoff)
    .order("created_at", { ascending: false })
    .limit(10)

  const orgRuns = (runs ?? []).filter((r) => {
    const aps = (r.provider_metadata?.autonomous_prospect_search_1a ?? {}) as Record<string, unknown>
    return aps.organization_id === orgId
  })

  let headProjection = null
  if (approved?.profile) {
    const { data: memoryRow } = await admin
      .schema("growth")
      .from("organization_memory_preferences")
      .select("statement")
      .eq("organization_id", orgId)
      .eq("preference_key", GROWTH_PORTFOLIO_MANAGER_MEMORY_PREFERENCE_KEY)
      .maybeSingle()
    const memory = memoryRow?.statement
      ? parsePortfolioManagerMemoryFromStore(JSON.parse(memoryRow.statement as string))
      : null
    const sliceState = memory
      ? readDiscoverySearchSliceStateFromPortfolioMemory(memory)
      : null
    const nextSlice =
      sliceState != null
        ? selectNextDatamoonDiscoverySearchSlice({
            projection: projectApprovedBusinessProfileToLeadDiscovery(
              approved.profile,
              approved.companyName,
            ),
            state: sliceState,
            generatedAt,
          })
        : null
    const built = buildDatamoonAutonomousDiscoveryRequestFromBusinessProfile({
      profile: approved.profile,
      organizationId: orgId,
      batchSize: 25,
      generatedAt,
      searchSlice: nextSlice,
    })
    const prepared = await prepareDatamoonAudienceImportRequestForBuild(built.request)
    headProjection = prepared.ok
      ? {
          audienceType: prepared.request.audience_type,
          topicIds: prepared.request.topic_ids ?? [],
          providerFilters: resolveDatamoonProviderFiltersForImport(prepared.request),
          filterAnalysis: analyzeFilters(resolveDatamoonProviderFiltersForImport(prepared.request)),
          broadMode: prepared.request.workbench_context?.autonomousBroadProviderDiscovery === true,
          qualificationContext: prepared.request.workbench_context?.discoveryQualificationContext ?? null,
        }
      : { error: prepared.error }
  }

  const { data: newLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website, created_at, metadata, status")
    .eq("promoted_organization_id", orgId)
    .gte("created_at", deployCutoff)
    .order("created_at", { ascending: false })

  const externalLeads = (newLeads ?? []).filter((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    const intake = resolveGrowthLeadAdmissionIntakeSourceFromLeadMetadata(meta)
    return isExternalDiscoveryLeadIntakeSource(intake)
  })

  const funnelRuns = []
  for (const run of orgRuns) {
    const meta = (run.provider_metadata ?? {}) as Record<string, unknown>
    const aps = (meta.autonomous_prospect_search_1a ?? {}) as Record<string, unknown>
    funnelRuns.push({
      id: run.id,
      audienceId: run.datamoon_audience_id,
      status: run.status,
      createdAt: run.created_at,
      completedAt: run.completed_at,
      recordCount: run.record_count,
      previewCount: run.preview_count,
      duplicateCount: run.duplicate_count,
      audienceType: run.audience_type,
      topicIds: run.topic_ids,
      storedFilters: analyzeFilters(Array.isArray(run.filters) ? run.filters : []),
      broadProviderMode: meta.workbench_context
        ? (meta.workbench_context as Record<string, unknown>).autonomousBroadProviderDiscovery === true
        : null,
      intake: {
        selected: aps.intake_selected_count,
        pushed: aps.intake_pushed_count,
        existing: aps.intake_existing_count,
        rejected: aps.intake_rejected_count,
        zeroReason: aps.intake_zero_survivor_reason,
      },
    })
  }

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        auditAt: generatedAt,
        deployCutoffIso: deployCutoff,
        organizationId: orgId,
        headProjection,
        observability: obs,
        postCutoverRuns: funnelRuns,
        newExternalLeads: externalLeads.map((row) => ({
          id: row.id,
          companyName: row.company_name,
          website: row.website,
          createdAt: row.created_at,
          admission: resolveLeadAdmissionStateFromMetadata((row.metadata ?? {}) as Record<string, unknown>),
          admissionReasons: (row.metadata as Record<string, unknown>)?.admission_reasons ?? [],
        })),
        successCriteria: {
          nonZeroProviderRun: funnelRuns.some((row) => (row.recordCount ?? 0) > 0),
          threeNewCompanies: externalLeads.length >= 3,
          broadFiltersOnly: headProjection && "providerFilters" in headProjection
            ? (headProjection.filterAnalysis?.deferredFieldsPresent?.length ?? 0) === 0
            : null,
        },
        invariants: { sentDuringAudit: false, approvedDuringAudit: false },
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
