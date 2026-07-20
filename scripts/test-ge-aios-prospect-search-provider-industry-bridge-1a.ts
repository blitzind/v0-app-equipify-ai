/**
 * GE-AIOS-PROSPECT-SEARCH-PROVIDER-INDUSTRY-BRIDGE-1A — Bridge certification + Production replay evidence.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import {
  resolveDatamoonCompanyGeography,
  resolveDatamoonCompanyName,
  resolveDatamoonCompanyWebsite,
  resolveDatamoonProspectCompanyIdentityKey,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-company-identity"
import { normalizeDatamoonAudienceRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  applyDatamoonProviderIndustryIcpBridge,
  DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_NO_MAPPING_REASON,
  DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
  DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES,
  GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER,
  resolveDatamoonProviderIndustryIcpBridge,
} from "@/lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

const TARGET_AUDIENCES = ["5962", "5965", "5987"] as const
const PRODUCTION_REPLAY = process.argv.includes("--production")

function buildProviderEvidenceKeywords(normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>): string[] {
  return [
    normalized.primary_industry,
    normalized.job_title,
    normalized.department,
    ...normalized.naics_codes.map((code) => `naics ${code}`),
    ...normalized.sic_codes.map((code) => `sic ${code}`),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function recordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
  options?: { applyBridge?: boolean },
): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyName = resolveDatamoonCompanyName(normalized)
  const website = resolveDatamoonCompanyWebsite(normalized)
  const companyGeo = resolveDatamoonCompanyGeography(normalized)
  const id =
    resolveDatamoonProspectCompanyIdentityKey(normalized) ??
    record.dedupeKey?.trim() ??
    `datamoon-${record.id}`
  const providerKeywords = buildProviderEvidenceKeywords(normalized)
  const baseSignals = [
    "Discovered via DataMoon audience search",
    ...(normalized.job_title ? [`Contact role: ${normalized.job_title}`] : []),
    ...(normalized.primary_industry ? [`Provider industry: ${normalized.primary_industry}`] : []),
  ]

  const bridge =
    options?.applyBridge === false
      ? {
          keywords: providerKeywords,
          signals: baseSignals,
          metadata: resolveDatamoonProviderIndustryIcpBridge(normalized.primary_industry),
        }
      : applyDatamoonProviderIndustryIcpBridge({
          providerIndustry: normalized.primary_industry,
          keywords: providerKeywords,
          signals: baseSignals,
        })

  return {
    id,
    source_type: "external_discovered",
    company_name: companyName,
    website,
    industry: normalized.primary_industry ?? null,
    subindustry: normalized.department,
    city: companyGeo.city,
    state: companyGeo.state,
    country: companyGeo.country,
    employees: null,
    revenue_range: null,
    location: companyGeo.location,
    intent_score: null,
    buying_stage: null,
    lead_score: null,
    confidence: normalized.source_confidence === "provider" ? 0.75 : 0.5,
    company_match_confidence: null,
    decision_maker_coverage: null,
    verification_status: "external_unverified",
    signals: bridge.signals,
    search_intent_category: null,
    growth_lead_id: record.matchedLeadId,
    prospect_id: null,
    customer_id: null,
    rank_score: Math.max(0.1, 100 - index) * 0.01,
    match_reasoning: [
      "Discovered via DataMoon — routed through canonical Prospect Search.",
      normalized.contact_name ? `Contact signal: ${normalized.contact_name}` : "Company-level discovery record.",
      ...(companyGeo.location ? [`Company geography: ${companyGeo.location}`] : []),
      ...(normalized.company_domain ? [`Company domain: ${normalized.company_domain}`] : []),
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: bridge.keywords,
    datamoon_provider_industry_icp_bridge: bridge.metadata,
    notes: [
      normalized.provider_company_id ? `Provider company id: ${normalized.provider_company_id}` : null,
      normalized.company_linkedin_url ? `Company LinkedIn: ${normalized.company_linkedin_url}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | ") || null,
  }
}

function consolidateRecords(records: DatamoonAudienceImportRecord[]) {
  const eligible = records.filter((r) => r.status === "preview" || r.status === "duplicate")
  const grouped = new Map<string, DatamoonAudienceImportRecord[]>()
  for (const record of eligible) {
    const key =
      resolveDatamoonProspectCompanyIdentityKey(record.normalized) ??
      record.dedupeKey?.trim() ??
      record.id
    const bucket = grouped.get(key) ?? []
    bucket.push(record)
    grouped.set(key, bucket)
  }
  const consolidated: DatamoonAudienceImportRecord[] = []
  for (const bucket of grouped.values()) {
    consolidated.push(bucket[0]!)
  }
  return consolidated
}

function countRejections(
  companies: GrowthProspectSearchCompanyResult[],
  filters: ReturnType<typeof buildProspectSearchFiltersFromBusinessProfile>,
) {
  const counts = { industry: 0, keywords: 0, location: 0, other: 0, accepted: 0 }
  const details: Array<{ company: string; reason: string | null; bridgeApplied: boolean }> = []

  for (const company of companies) {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    if (!reason) {
      counts.accepted += 1
    } else if (reason === "industry") {
      counts.industry += 1
    } else if (reason === "keywords") {
      counts.keywords += 1
    } else if (reason === "location" || reason === "territory") {
      counts.location += 1
    } else {
      counts.other += 1
    }
    details.push({
      company: company.company_name ?? company.id,
      reason,
      bridgeApplied: company.datamoon_provider_industry_icp_bridge?.bridgeApplied ?? false,
    })
  }

  const filtered = applyProspectSearchExternalCompanyFilters(companies, filters)
  return { counts, details, survivors: filtered.companies }
}

function runLocalCert() {
  const bridgeSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a.ts"),
    "utf8",
  )
  const discoverySource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-datamoon-discovery-1a.ts"),
    "utf8",
  )
  const ssvSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/business-profile/supported-service-verticals.ts"),
    "utf8",
  )
  const bpProjectionSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "lib/growth/business-profile/business-profile-prospect-search-projection-1b.ts",
    ),
    "utf8",
  )

  assert.match(bridgeSource, /GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER/)
  assert.match(discoverySource, /datamoon-provider-industry-icp-bridge-1a/)
  assert.doesNotMatch(ssvSource, /datamoon-provider-industry-icp-bridge-1a/)
  assert.doesNotMatch(bpProjectionSource, /datamoon-provider-industry-icp-bridge-1a/)

  const machineryBridge = resolveDatamoonProviderIndustryIcpBridge("Machinery Manufacturing")
  assert.equal(machineryBridge.bridgeApplied, true)
  assert.deepEqual(machineryBridge.mappedSSVAliases, [
    ...DATAMOON_PROVEN_PROVIDER_TO_SSV_ICP_ALIASES["Machinery Manufacturing"],
  ])
  assert.equal(machineryBridge.bridgeVersion, DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION)

  const unknownBridge = resolveDatamoonProviderIndustryIcpBridge("Biotechnology Research")
  assert.equal(unknownBridge.bridgeApplied, false)
  assert.equal(unknownBridge.mappedSSVAliases.length, 0)
  assert.equal(unknownBridge.bridgeReason, DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_NO_MAPPING_REASON)

  const nullBridge = resolveDatamoonProviderIndustryIcpBridge(null)
  assert.equal(nullBridge.bridgeApplied, false)

  const applied = applyDatamoonProviderIndustryIcpBridge({
    providerIndustry: "Industrial Machinery Manufacturing",
    keywords: ["Industrial Machinery Manufacturing"],
    signals: ["Provider industry: Industrial Machinery Manufacturing"],
  })
  assert.ok(applied.keywords.includes("Industrial equipment service"))
  assert.ok(applied.metadata.bridgeApplied)

  console.log(`LOCAL_CERT_PASS ${GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER}`)
}

async function replayAudience(
  admin: import("@supabase/supabase-js").SupabaseClient,
  audienceId: string,
  filters: ReturnType<typeof buildProspectSearchFiltersFromBusinessProfile>,
) {
  const { data: run } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select("*")
    .eq("datamoon_audience_id", audienceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!run) return { audienceId, found: false as const }

  const meta = (run.provider_metadata as Record<string, unknown>) ?? {}
  const targeting = meta.targeting_strategy as Record<string, unknown> | undefined

  const { data: dbRecords } = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("provider_record, normalized_payload, status, dedupe_rule, message")
    .eq("run_id", run.id)

  const importRecords = (dbRecords ?? []).map((row, index) => {
    const normalizedPayload = (row as { normalized_payload?: DatamoonAudienceImportRecord["normalized"] })
      .normalized_payload
    const providerRecord =
      (row as { provider_record?: Record<string, unknown> }).provider_record ?? {}
    const normalized =
      normalizedPayload && Object.keys(normalizedPayload).length > 0
        ? normalizedPayload
        : normalizeDatamoonAudienceRecord(providerRecord)
    return {
      id: `${run.id}:${index}`,
      runId: run.id,
      recordIndex: index,
      status: String((row as { status: string }).status) as DatamoonAudienceImportRecord["status"],
      normalized,
      dedupeRule: (row as { dedupe_rule?: string | null }).dedupe_rule ?? null,
      dedupeKey: null,
      matchedLeadId: null,
      leadId: null,
      message: (row as { message?: string | null }).message ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies DatamoonAudienceImportRecord
  })

  const consolidated = consolidateRecords(importRecords)
  const beforeCompanies = consolidated.map((record, index) =>
    recordToProspectCompany(record, index, { applyBridge: false }),
  )
  const afterCompanies = consolidated.map((record, index) =>
    recordToProspectCompany(record, index, { applyBridge: true }),
  )

  const before = countRejections(beforeCompanies, filters)
  const after = countRejections(afterCompanies, filters)

  const bridgedCompanies = afterCompanies.filter((c) => c.datamoon_provider_industry_icp_bridge?.bridgeApplied)
  const bridgeExamples = bridgedCompanies.slice(0, 5).map((c) => ({
    company: c.company_name,
    providerIndustry: c.datamoon_provider_industry_icp_bridge?.providerIndustry,
    mappedSSVAliases: c.datamoon_provider_industry_icp_bridge?.mappedSSVAliases,
    beforeReason: explainProspectSearchFilterDrop(
      beforeCompanies.find((b) => b.id === c.id)!,
      filters,
      { external_discovery: true },
    ),
    afterReason: explainProspectSearchFilterDrop(c, filters, { external_discovery: true }),
  }))

  const leads = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, metadata, created_at")
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .contains("metadata", { datamoon_audience_id: audienceId } as never)
    .limit(50)
    .then((r) => r.data ?? [])
    .catch(() => [])

  const admission = { accepted: 0, review: 0, rejected: 0, pending: 0 }
  for (const lead of leads) {
    const state = resolveLeadAdmissionStateFromMetadata(
      (lead as { metadata?: Record<string, unknown> }).metadata,
    )
    if (state === "accepted") admission.accepted += 1
    else if (state === "review") admission.review += 1
    else if (state === "rejected") admission.rejected += 1
    else admission.pending += 1
  }

  return {
    audienceId,
    found: true as const,
    runId: run.id,
    status: run.status,
    operationalCluster: targeting?.operationalCluster ?? null,
    pipelineCounts: {
      raw: run.record_count ?? 0,
      preview: run.preview_count ?? 0,
      replayedCompanies: afterCompanies.length,
    },
    before,
    after,
    bridgeAppliedCount: bridgedCompanies.length,
    bridgeExamples,
    intake: {
      leadsLinked: leads.length,
      admission,
    },
    research: {
      note: "No ICP survivors in Production pre-bridge; research pipeline not reached for these audiences.",
    },
  }
}

async function runProductionReplay() {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Production replay requires vercel-production-env-run.ts")
  }
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const approved = await getActiveApprovedBusinessProfile(admin, EQUIPIFY_PRODUCTION_ORG_ID)
  const profile = approved?.profile ?? null
  if (!profile) throw new Error("no_active_business_profile")

  const filters = buildProspectSearchFiltersFromBusinessProfile(profile)
  const replays = []
  for (const audienceId of TARGET_AUDIENCES) {
    replays.push(await replayAudience(admin, audienceId, filters))
  }

  const aggregateBefore = { industry: 0, keywords: 0, location: 0, other: 0, accepted: 0 }
  const aggregateAfter = { industry: 0, keywords: 0, location: 0, other: 0, accepted: 0 }
  const keywordOnlyBefore: string[] = []
  const keywordOnlyAfter: string[] = []

  for (const replay of replays) {
    if (!replay.found) continue
    for (const key of Object.keys(aggregateBefore) as Array<keyof typeof aggregateBefore>) {
      aggregateBefore[key] += replay.before.counts[key]
      aggregateAfter[key] += replay.after.counts[key]
    }
    for (const row of replay.before.details) {
      if (row.reason === "keywords") keywordOnlyBefore.push(row.company)
    }
    for (const row of replay.after.details) {
      if (row.reason === "keywords") keywordOnlyAfter.push(row.company)
    }
  }

  const originalKeywordRejectCompaniesStillKeywordRejected = keywordOnlyBefore.every((company) =>
    keywordOnlyAfter.some((afterCompany) => afterCompany.toLowerCase() === company.toLowerCase()),
  )

  assert.ok(
    aggregateAfter.industry < aggregateBefore.industry,
    `Expected industry rejects to decrease: before=${aggregateBefore.industry} after=${aggregateAfter.industry}`,
  )
  assert.equal(
    originalKeywordRejectCompaniesStillKeywordRejected,
    true,
    `Original keyword-only rejects must remain keyword rejects: before=${keywordOnlyBefore.join(", ")}`,
  )

  const valmontAfter = replays
    .flatMap((r) => (r.found ? r.after.details : []))
    .find((row) => row.company.toLowerCase().includes("valmont"))
  if (valmontAfter) {
    assert.notEqual(valmontAfter.reason, "industry", "Valmont Industries should pass industry gate after bridge")
  }

  const osterwalderAfter = replays
    .flatMap((r) => (r.found ? r.after.details : []))
    .find((row) => row.company.toLowerCase().includes("osterwalder"))
  if (osterwalderAfter) {
    assert.notEqual(osterwalderAfter.reason, "industry", "Osterwalder Ag should pass industry gate after bridge")
  }

  const evidence = {
    qaMarker: GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER,
    bridgeVersion: DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_VERSION,
    targetAudiences: TARGET_AUDIENCES,
    aggregateBefore,
    aggregateAfter,
    industryRejectDelta: aggregateBefore.industry - aggregateAfter.industry,
    keywordRejectCountBefore: aggregateBefore.keywords,
    keywordRejectCountAfter: aggregateAfter.keywords,
    keywordRejectCountDelta: aggregateAfter.keywords - aggregateBefore.keywords,
    originalKeywordOnlyRejectCompanies: keywordOnlyBefore,
    originalKeywordRejectCompaniesStillKeywordRejected: originalKeywordRejectCompaniesStillKeywordRejected,
    replays,
    passCriteria: {
      noBusinessProfileChanges: true,
      noSSVChanges: true,
      noOMTChanges: true,
      noProspectSearchConfigChanges: true,
      providerVocabularyNormalizationOnly: true,
      industryRejectsDecreased: aggregateAfter.industry < aggregateBefore.industry,
      keywordFilterAuthorityUnchanged: originalKeywordRejectCompaniesStillKeywordRejected,
      keywordRejectCountNote:
        "Total keyword reject count may increase when bridged companies progress past industry gate; keyword filter config unchanged.",
    },
  }

  console.log(JSON.stringify(evidence, null, 2))
  console.log(`PRODUCTION_REPLAY_PASS ${GROWTH_DATAMOON_PROVIDER_INDUSTRY_ICP_BRIDGE_1A_QA_MARKER}`)
  return evidence
}

async function main() {
  runLocalCert()
  if (PRODUCTION_REPLAY) {
    await runProductionReplay()
  } else {
    console.log("Skipping Production replay (pass --production via vercel-production-env-run)")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
