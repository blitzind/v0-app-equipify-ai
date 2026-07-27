/**
 * AVA-DISCOVERY-NOVEL-LEAD-YIELD-RECOVERY-1A — Production funnel audit (read-only).
 *
 *   pnpm probe:ava-discovery-novel-lead-yield-recovery-1a:production
 */

import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildCanonicalProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-canonical-filters-1k"
import { buildProspectSearchQueryFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import { checkLeadInboxDuplicate } from "@/lib/growth/lead-inbox/lead-inbox-dedupe"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { listDatamoonAudienceImportRecords } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX } from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { loadDatamoonRunProspectCompaniesForPushRevalidation } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { enrichProspectSearchExternalCompanies } from "@/lib/growth/prospect-search/prospect-search-external-enrichment"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { prospectSearchDedupeHash } from "@/lib/growth/prospect-search/prospect-search-index"
import { parseProspectSearchQuery } from "@/lib/growth/prospect-search/prospect-search-query-parser"
import { loadContinuousLeadReplenishmentObservability } from "@/lib/growth/portfolio-manager/growth-continuous-lead-replenishment-observability-1a"

const CERT_ID = "ava-discovery-novel-lead-yield-recovery-1a-v1" as const
const DUPLICATE_RUN_ID = "192a7ced-a1a3-4b50-a33e-a277f79c680e"

async function analyzeDuplicateRun192a7ced(
  admin: NonNullable<Awaited<ReturnType<typeof bootstrapGrowthOperatorNotificationsCertEnv>>["admin"]>,
  organizationId: string,
) {
  const approved = await getActiveApprovedBusinessProfile(admin, organizationId)
  if (!approved?.profile) return { error: "no_profile" }
  const query = buildProspectSearchQueryFromBusinessProfile(approved.profile, null)
  const filters = await buildCanonicalProspectSearchFiltersFromBusinessProfile(admin, {
    profile: approved.profile,
    query,
  })
  const parsed = parseProspectSearchQuery(query)
  const reloaded = await loadDatamoonRunProspectCompaniesForPushRevalidation(admin, {
    organizationId,
    datamoonRunId: DUPLICATE_RUN_ID,
    filters,
  })
  if (!reloaded) return { error: "run_not_found" }

  const strictFiltered = applyProspectSearchExternalCompanyFilters(reloaded.companies, filters)
  const autonomousEnriched = await enrichProspectSearchExternalCompanies(admin, reloaded.companies, {
    query,
    filters,
    parsed,
    discovery_authority: "autonomous_portfolio",
  })

  const top5 = strictFiltered.companies.slice(0, 5)
  const existingDetails = []
  for (const company of top5) {
    const dedupe_hash = prospectSearchDedupeHash([
      "prospect_search",
      company.source_type,
      company.id,
      company.website ?? "",
    ])
    const duplicate = await checkLeadInboxDuplicate(admin, {
      dedupe_hash,
      intent_session_id: `prospect-search-${company.id}`,
      domain: company.website,
    })
    const lead = duplicate.existing_growth_lead_id
      ? await fetchGrowthLeadById(admin, duplicate.existing_growth_lead_id).catch(() => null)
      : null
    existingDetails.push({
      company: company.company_name,
      website: company.website,
      industry: company.industry,
      duplicateReasons: duplicate.reasons,
      existingLeadId: duplicate.existing_growth_lead_id,
      matchedLead: lead
        ? {
            id: lead.id,
            companyName: lead.companyName,
            website: lead.website,
            createdAt: lead.createdAt,
          }
        : null,
    })
  }

  return {
    normalizedCompanies: reloaded.companies.length,
    strictSurvivors: strictFiltered.companies.length,
    strictDroppedReasons: strictFiltered.diagnostics.dropped_reasons,
    autonomousSurvivors: autonomousEnriched.companies.length,
    top5ExistingMatches: existingDetails,
  }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] novel lead yield funnel audit`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN =
    process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")
  const admin = cert.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID
  const since = new Date(Date.now() - 48 * 3600000).toISOString()
  const generatedAt = new Date().toISOString()

  const obs = await loadContinuousLeadReplenishmentObservability(admin, {
    organizationId: orgId,
    generatedAt,
  })

  const { data: runs } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20)

  const orgRuns = (runs ?? []).filter((r) => {
    const aps = (r.provider_metadata?.autonomous_prospect_search_1a ?? {}) as Record<string, unknown>
    return aps.organization_id === orgId
  })

  const funnel = []
  for (const run of orgRuns.slice(0, 12)) {
    const meta = (run.provider_metadata ?? {}) as Record<string, unknown>
    const aps = (meta.autonomous_prospect_search_1a ?? {}) as Record<string, unknown>
    const slice = meta.discovery_search_slice ?? meta.targeting_summary?.discoverySearchSlice
    const records = await listDatamoonAudienceImportRecords(admin, run.id)
    const byStatus = records.reduce(
      (acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
      },
      {} as Record<string, number>,
    )
    funnel.push({
      id: run.id,
      audience: meta.provider_audience_id,
      status: run.status,
      createdAt: run.created_at,
      completedAt: run.completed_at,
      previewCount: run.preview_count,
      duplicateCount: run.duplicate_count,
      skippedCount: run.skipped_count,
      importedCount: run.imported_count,
      recordCount: run.record_count,
      loadingCount: run.loading_count,
      slice,
      intake: {
        selected: aps.intake_selected_count,
        pushed: aps.intake_pushed_count,
        existing: aps.intake_existing_count,
        zeroReason: aps.intake_zero_survivor_reason,
        enrichment: aps.intake_enrichment_diagnostic,
      },
      recordStatusBreakdown: byStatus,
      targeting: meta.targeting_strategy ?? meta.targeting_summary?.targetingStrategy,
      requestFilters: meta.request_filters ?? meta.filters,
      topicIds: meta.topic_ids ?? meta.resolved_topic_ids,
      fetchAudit: meta.fetch_audit ?? meta.zero_preview_diagnostics,
      buildMessage: meta.build_message,
      pollStatus: meta.poll_status,
      fetchStatus: meta.fetch_status,
      errorMessage: run.error_message,
    })
  }

  const zeroRuns = orgRuns.filter((r) => (r.preview_count ?? 0) === 0)
  const zeroMidwest = zeroRuns.filter((r) => {
    const zm = r.provider_metadata as Record<string, unknown>
    const sliceKey =
      (zm.discovery_search_slice as Record<string, unknown> | undefined)?.sliceKey ??
      (zm.targeting_summary as Record<string, unknown> | undefined)?.discoverySearchSlice
    return String(sliceKey ?? "").includes("commercial_kitchen_fleet:us_midwest")
  })

  const { data: recentLeads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website, created_at, metadata")
    .eq("promoted_organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(10)

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        organizationId: orgId,
        since,
        observability: {
          velocity: obs.newCompaniesVelocity,
          discoverySearchSlice: obs.discoverySearchSlice,
          lastNewCompany: obs.lastNewCompanyIngested,
          lastSuccessfulDataMoonRun: obs.lastSuccessfulDataMoonRun,
        },
        funnel,
        duplicateRun192a7cedAnalysis: await analyzeDuplicateRun192a7ced(admin, orgId),
        zeroPreviewRuns: zeroRuns.map((r) => ({
          id: r.id,
          createdAt: r.created_at,
          slice: (r.provider_metadata as Record<string, unknown>)?.discovery_search_slice,
          recordCount: r.record_count,
          loadingCount: r.loading_count,
          fetchAudit: (r.provider_metadata as Record<string, unknown>)?.fetch_audit,
          targeting: (r.provider_metadata as Record<string, unknown>)?.targeting_strategy,
        })),
        zeroMidwestCount: zeroMidwest.length,
        recentLeads: recentLeads?.map((l) => ({
          id: l.id,
          company: l.company_name,
          website: l.website,
          createdAt: l.created_at,
          source: (l.metadata as Record<string, unknown>)?.source_type,
        })),
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
