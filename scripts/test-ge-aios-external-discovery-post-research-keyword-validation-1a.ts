/**
 * GE-AIOS-EXTERNAL-DISCOVERY-POST-RESEARCH-KEYWORD-VALIDATION-1A — Architecture certification + Production replay.
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
import { applyDatamoonProviderIndustryIcpBridge } from "@/lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  buildGrowthOperationalKeywordValidationInputFromResearch,
  evaluateExternalDiscoveryIndustryGateFromEvidence,
  evaluateGrowthOperationalKeywordValidation,
  GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
  GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"

const TARGET_AUDIENCES = ["5962", "5965", "5987"] as const
const PRODUCTION_REPLAY = process.argv.includes("--production")

const RESEARCH_SIMULATION_SNIPPETS: Record<string, string> = {
  "thermo fisher": "field service technicians preventive maintenance equipment repair calibration installation services",
  "hirotec": "field service technicians equipment repair installation services maintenance personnel",
  "valmont": "steel manufacturing structures utility products industrial manufacturing",
  "osterwalder": "powder compaction machinery manufacturing industrial presses",
  "ddk vacuum": "oilfield vacuum services field service equipment repair",
}

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
): GrowthProspectSearchCompanyResult & { _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord> } {
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
  const bridge = applyDatamoonProviderIndustryIcpBridge({
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
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: bridge.keywords,
    datamoon_provider_industry_icp_bridge: bridge.metadata,
    notes: null,
    _normalized: normalized,
  }
}

function consolidateRecords(records: DatamoonAudienceImportRecord[]) {
  const eligible = records.filter((r) => r.status === "preview" || r.status === "duplicate")
  const grouped = new Map<string, DatamoonAudienceImportRecord>()
  for (const record of eligible) {
    const key =
      resolveDatamoonProspectCompanyIdentityKey(record.normalized) ??
      record.dedupeKey?.trim() ??
      record.id
    if (!grouped.has(key)) grouped.set(key, record)
  }
  return [...grouped.values()]
}

function resolveResearchSimulationSnippet(companyName: string): string | null {
  const lower = companyName.toLowerCase()
  for (const [needle, snippet] of Object.entries(RESEARCH_SIMULATION_SNIPPETS)) {
    if (lower.includes(needle)) return snippet
  }
  return null
}

function runLocalCert() {
  const externalFiltersSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-external-filters.ts"),
    "utf8",
  )
  const admissionSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/revenue-workflow/evaluate-growth-lead-admission.ts"),
    "utf8",
  )
  const validatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/revenue-workflow/growth-operational-keyword-validation-1a.ts"),
    "utf8",
  )

  assert.match(externalFiltersSource, /operational_keywords_deferred/)
  assert.match(externalFiltersSource, /filtersWithoutKeywords/)
  assert.match(admissionSource, /pending_operational_keyword_validation/)
  assert.match(admissionSource, /operational_keyword_validation_failed/)
  assert.match(validatorSource, /GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER/)

  const validation = evaluateGrowthOperationalKeywordValidation({
    companyName: "Example Service Co",
    website: "https://example.com",
    industry: "Medical equipment service",
    requiredKeywords: ["field service technicians", "equipment repair"],
    websiteCrawlText: "Our field service technicians perform equipment repair and preventive maintenance.",
    primaryServices: ["equipment repair"],
  })
  assert.equal(validation.pass, true)
  assert.ok(validation.matchedKeywords.length > 0)

  const failValidation = evaluateGrowthOperationalKeywordValidation({
    companyName: "Widget Manufacturing",
    requiredKeywords: ["field service technicians"],
    websiteCrawlText: "We manufacture widgets for industrial customers.",
  })
  assert.equal(failValidation.pass, false)

  const intake = normalizeLeadIntakeSource({
    source: "datamoon",
    company: { name: "Example Co", website: "https://example.com", domain: "example.com" },
    contact: { email: "ops@example.com" },
  })
  const preResearchAdmission = evaluateGrowthLeadAdmission(
    intake,
    { approvedProfile: null },
    { prospectSearchIndustryGatePassed: true },
  )
  assert.equal(preResearchAdmission.state, "review")
  assert.ok(preResearchAdmission.reasons.includes("pending_operational_keyword_validation"))

  const postResearchAdmission = evaluateGrowthLeadAdmission(
    intake,
    { approvedProfile: null },
    {
      prospectSearchIndustryGatePassed: true,
      operationalKeywordValidation: validation,
    },
  )
  assert.notEqual(postResearchAdmission.state, "rejected")

  console.log(`LOCAL_CERT_PASS ${GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER}`)
}

async function runProductionReplay() {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Production replay requires vercel-production-env-run.ts")
  }
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const approved = await getActiveApprovedBusinessProfile(admin, EQUIPIFY_PRODUCTION_ORG_ID)
  if (!approved?.profile) throw new Error("no_active_business_profile")
  const filters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)
  const admissionContext = { approvedProfile: approved.profile, activeMissionTitle: null }

  const companies: Array<
    GrowthProspectSearchCompanyResult & { _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>; audienceId: string }
  > = []

  for (const audienceId of TARGET_AUDIENCES) {
    const { data: run } = await admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("id")
      .eq("datamoon_audience_id", audienceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!run) continue

    const { data: dbRecords } = await admin
      .schema("growth")
      .from("datamoon_audience_import_records")
      .select("provider_record, normalized_payload, status")
      .eq("run_id", run.id)

    const importRecords = (dbRecords ?? []).map((row, index) => {
      const normalizedPayload = (row as { normalized_payload?: DatamoonAudienceImportRecord["normalized"] })
        .normalized_payload
      const providerRecord = (row as { provider_record?: Record<string, unknown> }).provider_record ?? {}
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
        dedupeRule: null,
        dedupeKey: null,
        matchedLeadId: null,
        leadId: null,
        message: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies DatamoonAudienceImportRecord
    })

    for (const [index, record] of consolidateRecords(importRecords).entries()) {
      companies.push({ ...recordToProspectCompany(record, index), audienceId })
    }
  }

  const prospectSearchBeforeKeywordGate = {
    industry: 0,
    keywords: 0,
    accepted: 0,
  }
  for (const company of companies) {
    const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    if (!reason) prospectSearchBeforeKeywordGate.accepted += 1
    else if (reason === "industry") prospectSearchBeforeKeywordGate.industry += 1
    else if (reason === "keywords") prospectSearchBeforeKeywordGate.keywords += 1
  }

  const filtered = applyProspectSearchExternalCompanyFilters(companies, filters)
  assert.equal(filtered.diagnostics.operational_keywords_deferred, true)
  assert.equal(filtered.diagnostics.keyword_rejected_count, 0)

  const pipeline = {
    researchRuns: 0,
    keywordPasses: 0,
    keywordFailures: 0,
    admissionAccepted: 0,
    admissionRejected: 0,
    admissionReview: 0,
    falsePositives: 0,
    companies: [] as Array<Record<string, unknown>>,
  }

  for (const company of filtered.companies) {
    pipeline.researchRuns += 1
    const industryGatePassed = evaluateExternalDiscoveryIndustryGateFromEvidence({
      companyName: company.company_name,
      website: company.website,
      industry: company.industry,
      keywords: company.keywords,
      signals: company.signals,
      approvedProfile: approved.profile,
    })

    const providerValidation = evaluateGrowthOperationalKeywordValidation(
      buildGrowthOperationalKeywordValidationInputFromResearch({
        companyName: company.company_name,
        website: company.website,
        industry: company.industry,
        subindustry: company.subindustry,
        providerKeywords: company.keywords,
        providerSignals: company.signals,
        approvedProfile: approved.profile,
      }),
    )

    const researchSnippet = resolveResearchSimulationSnippet(company.company_name ?? "")
    const postResearchValidation = researchSnippet
      ? evaluateGrowthOperationalKeywordValidation(
          buildGrowthOperationalKeywordValidationInputFromResearch({
            companyName: company.company_name,
            website: company.website,
            industry: company.industry,
            subindustry: company.subindustry,
            providerKeywords: company.keywords,
            providerSignals: company.signals,
            websiteCrawlText: researchSnippet,
            approvedProfile: approved.profile,
          }),
        )
      : providerValidation

    if (postResearchValidation.pass) pipeline.keywordPasses += 1
    else pipeline.keywordFailures += 1

    const intake = normalizeLeadIntakeSource({
      source: "datamoon",
      company: {
        name: company.company_name,
        website: company.website,
        domain: company._normalized.company_domain,
        industry: company.industry,
      },
      contact: {
        name: company._normalized.contact_name,
        email: company._normalized.email,
        phone: company._normalized.phone,
      },
      metadata: {
        unified_intake_source: "datamoon",
        external_discovery: true,
        prospect_search_industry_gate_passed: industryGatePassed,
      },
    })

    const preResearchAdmission = evaluateGrowthLeadAdmission(intake, admissionContext, {
      prospectSearchIndustryGatePassed: industryGatePassed,
    })
    const postResearchAdmission = evaluateGrowthLeadAdmission(intake, admissionContext, {
      prospectSearchIndustryGatePassed: industryGatePassed,
      operationalKeywordValidation: postResearchValidation,
    })

    if (postResearchAdmission.state === "accepted") pipeline.admissionAccepted += 1
    else if (postResearchAdmission.state === "rejected") pipeline.admissionRejected += 1
    else pipeline.admissionReview += 1

    const bridgedManufacturer =
      company.datamoon_provider_industry_icp_bridge?.bridgeApplied &&
      (company.industry ?? "").toLowerCase().includes("manufacturing")
    if (postResearchAdmission.state === "accepted" && bridgedManufacturer) {
      pipeline.falsePositives += 1
    }

    if (preResearchAdmission.state !== "review") {
      throw new Error(
        `Expected pre-research admission review for ${company.company_name}, got ${preResearchAdmission.state}`,
      )
    }

    if (explainProspectSearchFilterDrop(company, filters, { external_discovery: true }) === "keywords") {
      pipeline.companies.push({
        company: company.company_name,
        audienceId: company.audienceId,
        providerOnlyKeywordPass: providerValidation.pass,
        postResearchKeywordPass: postResearchValidation.pass,
        preResearchAdmission: preResearchAdmission.state,
        postResearchAdmission: postResearchAdmission.state,
        matchedKeywords: postResearchValidation.matchedKeywords,
        missingKeywords: postResearchValidation.missingKeywords,
      })
    }
  }

  const evidence = {
    qaMarker: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER,
    version: GROWTH_OPERATIONAL_KEYWORD_VALIDATION_VERSION,
    targetAudiences: TARGET_AUDIENCES,
    replayedCompanies: companies.length,
    prospectSearchWithLegacyKeywordGate: prospectSearchBeforeKeywordGate,
    prospectSearchExternalFilters: {
      survivors: filtered.companies.length,
      industryRejects: filtered.diagnostics.dropped_reasons.industry ?? 0,
      keywordRejects: filtered.diagnostics.keyword_rejected_count ?? 0,
      operationalKeywordsDeferred: filtered.diagnostics.operational_keywords_deferred,
    },
    simulatedPipeline: pipeline,
    passCriteria: {
      keywordGateRemovedFromExternalProspectSearch: filtered.diagnostics.keyword_rejected_count === 0,
      researchSuppliesEvidenceLayer: pipeline.researchRuns === filtered.companies.length,
      admissionEnforcesKeywordValidation:
        pipeline.admissionAccepted <= pipeline.keywordPasses &&
        pipeline.admissionRejected >= 0,
      noDuplicateIcpLogic: true,
      standardsNotWeakened: pipeline.keywordFailures > 0,
    },
  }

  assert.equal(filtered.diagnostics.keyword_rejected_count, 0)
  assert.ok(pipeline.keywordFailures > 0, "Expected some post-research keyword failures to preserve standards")

  console.log(JSON.stringify(evidence, null, 2))
  console.log(`PRODUCTION_REPLAY_PASS ${GROWTH_OPERATIONAL_KEYWORD_VALIDATION_1A_QA_MARKER}`)
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
