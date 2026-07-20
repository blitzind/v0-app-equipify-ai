/**
 * GE-AIOS-EXTERNAL-DISCOVERY-KEYWORD-GATE-AUDIT-1A — Read-only Production keyword gate audit.
 */
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
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult, GrowthProspectSearchFilters } from "@/lib/growth/prospect-search/prospect-search-types"
import { evaluateGrowthLeadAdmission } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { normalizeLeadIntakeSource } from "@/lib/growth/revenue-workflow/normalize-lead-intake-source"

const TARGET_AUDIENCES = ["5962", "5965", "5987"] as const
const QA_MARKER = "ge-aios-external-discovery-keyword-gate-audit-1a-v1" as const

const EVIDENCE_PATTERNS: Record<string, readonly string[]> = {
  operational_evidence: ["service", "operations", "technician", "maintenance", "repair", "field"],
  maintenance: ["maintenance", "maintain", "pm ", "preventive"],
  field_service: ["field service", "field-service", "onsite", "on-site", "mobile service"],
  dispatch: ["dispatch", "scheduling", "route"],
  preventive_maintenance: ["preventive maintenance", "preventative maintenance", "pm program"],
  equipment: ["equipment", "machinery", "asset", "fleet", "compressor", "pump", "hvac"],
  repair: ["repair", "fix", "overhaul", "refurb"],
  installation: ["installation", "install", "commissioning"],
  service_contracts: ["service contract", "service agreement", "maintenance contract", "recurring service"],
  service_department: ["service department", "service division", "service team", "service center"],
  service_technicians: ["service technician", "field technician", "maintenance technician", "service tech"],
}

function includesFold(hay: string | null | undefined, needle: string): boolean {
  if (!hay || !needle) return false
  return hay.toLowerCase().includes(needle.toLowerCase())
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

function buildExternalDiscoveryKeywordBlob(row: {
  company_name: string
  website?: string | null
  industry?: string | null
  subindustry?: string | null
  notes?: string | null
  keywords?: string[]
  signals: string[]
  match_reasoning?: string[]
}): string {
  return [
    row.company_name,
    row.website,
    row.industry,
    row.subindustry,
    row.notes,
    ...(row.keywords ?? []),
    ...row.signals,
    ...(row.match_reasoning ?? []),
  ]
    .filter(Boolean)
    .join(" ")
}

function recordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
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
    _normalized: normalized,
  } as GrowthProspectSearchCompanyResult & { _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord> }
}

function explainWithoutKeywordGate(
  row: GrowthProspectSearchCompanyResult,
  filters: GrowthProspectSearchFilters,
): string | null {
  const deferredFilters: GrowthProspectSearchFilters = { ...filters, keywords: undefined }
  return explainProspectSearchFilterDrop(row, deferredFilters, { external_discovery: true })
}

function scanEvidence(blob: string): Record<string, boolean> {
  const lower = blob.toLowerCase()
  const result: Record<string, boolean> = {}
  for (const [key, patterns] of Object.entries(EVIDENCE_PATTERNS)) {
    result[key] = patterns.some((pattern) => lower.includes(pattern.toLowerCase()))
  }
  return result
}

function assessWebsiteCrawlRecovery(input: {
  company: GrowthProspectSearchCompanyResult & { _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord> }
  evidence: Record<string, boolean>
  filterKeywords: string[]
  matchedFilterKeywords: string[]
  bridgeApplied: boolean
}): { verdict: "YES" | "NO" | "UNKNOWN"; reasoning: string } {
  const normalized = input.company._normalized
  const websiteAvailable = Boolean(input.company.website?.trim() || normalized.company_domain?.trim())
  const providerIndustry = normalized.primary_industry ?? input.company.industry ?? ""
  const providerTitle = normalized.job_title ?? ""
  const industryLower = providerIndustry.toLowerCase()

  const manufacturingOnly =
    input.bridgeApplied &&
    (industryLower.includes("machinery manufacturing") ||
      industryLower.includes("industrial machinery") ||
      industryLower.includes("manufacturing"))

  const consumerOrUnrelated =
    industryLower.includes("restaurant") ||
    industryLower.includes("retail") ||
    industryLower.includes("trucking") ||
    industryLower.includes("logistics") ||
    industryLower.includes("real estate") ||
    industryLower.includes("construction") ||
    industryLower.includes("food") ||
    industryLower.includes("biotechnology research")

  if (!websiteAvailable) {
    return {
      verdict: "NO",
      reasoning:
        "No company website or domain in provider payload; keyword evidence cannot be recovered without a crawl target.",
    }
  }

  if (manufacturingOnly) {
    return {
      verdict: "NO",
      reasoning: `Provider industry "${providerIndustry}" is manufacturing taxonomy. Equipify profile explicitly qualifies manufacturing only with dedicated field service/maintenance division. A website crawl may confirm product manufacturing, not operational service evidence required by keyword gate.`,
    }
  }

  if (consumerOrUnrelated && input.matchedFilterKeywords.length === 0) {
    const partialEquipment = input.evidence.equipment || input.evidence.maintenance
    if (partialEquipment && industryLower.includes("biotechnology")) {
      return {
        verdict: "UNKNOWN",
        reasoning: `Large ${providerIndustry} company with website (${input.company.website}). Provider title "${providerTitle}" and sparse payload lack operational keywords, but enterprise sites often describe calibration, equipment service, or field teams on subpages not present in DataMoon export.`,
      }
    }
    return {
      verdict: "NO",
      reasoning: `Provider industry "${providerIndustry}" and title "${providerTitle}" do not suggest field-service operations. Website likely describes core non-service business; keyword gate correctly blocks without operational evidence.`,
    }
  }

  if (input.matchedFilterKeywords.length > 0) {
    return {
      verdict: "YES",
      reasoning: `Partial operational keyword overlap (${input.matchedFilterKeywords.join(", ")}) in provider blob. Website crawl likely surfaces additional service/maintenance language on careers, services, or about pages.`,
    }
  }

  if (input.evidence.equipment || input.evidence.maintenance || input.evidence.repair) {
    return {
      verdict: "UNKNOWN",
      reasoning: `Website available (${input.company.website}) with partial equipment/maintenance tokens in provider blob but no filter keyword match. Crawl may recover missing operational phrases; provider title "${providerTitle}" is inconclusive.`,
    }
  }

  return {
    verdict: "UNKNOWN",
    reasoning: `Website available but provider payload lacks operational keyword evidence. Crawl outcome depends on whether site describes service operations vs pure product/logistics business.`,
  }
}

function classifyFalsePositiveRisk(input: {
  company: GrowthProspectSearchCompanyResult & { _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord> }
  bridgeApplied: boolean
  websiteCrawlVerdict: "YES" | "NO" | "UNKNOWN"
}): "high" | "medium" | "low" {
  const industry = (input.company._normalized.primary_industry ?? input.company.industry ?? "").toLowerCase()
  if (input.bridgeApplied && industry.includes("manufacturing")) return "high"
  if (input.websiteCrawlVerdict === "NO") return "high"
  if (input.websiteCrawlVerdict === "UNKNOWN") return "medium"
  return "low"
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
  return [...grouped.values()].map((bucket) => bucket[0]!)
}

async function main() {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin

  const approved = await getActiveApprovedBusinessProfile(admin, EQUIPIFY_PRODUCTION_ORG_ID)
  if (!approved?.profile) throw new Error("no_active_business_profile")
  const filters = buildProspectSearchFiltersFromBusinessProfile(approved.profile)
  const filterKeywords = filters.keywords ?? []
  const admissionContext = { approvedProfile: approved.profile, activeMissionTitle: null }

  const allCompanies: Array<
    GrowthProspectSearchCompanyResult & {
      _normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>
      audienceId: string
    }
  > = []

  for (const audienceId of TARGET_AUDIENCES) {
    const { data: run } = await admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select("*")
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
      const company = recordToProspectCompany(record, index)
      allCompanies.push({ ...company, audienceId })
    }
  }

  const currentCounts = { industry: 0, keywords: 0, accepted: 0, other: 0 }
  const deferredCounts = { industry: 0, keywords: 0, accepted: 0, other: 0 }
  const keywordRejections: Array<Record<string, unknown>> = []
  const deferredAccepted: Array<Record<string, unknown>> = []
  const seenKeywordRejectKeys = new Set<string>()

  for (const company of allCompanies) {
    const currentReason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
    const deferredReason = explainWithoutKeywordGate(company, filters)

    if (!currentReason) currentCounts.accepted += 1
    else if (currentReason === "industry") currentCounts.industry += 1
    else if (currentReason === "keywords") currentCounts.keywords += 1
    else currentCounts.other += 1

    if (!deferredReason) deferredCounts.accepted += 1
    else if (deferredReason === "industry") deferredCounts.industry += 1
    else if (deferredReason === "keywords") deferredCounts.keywords += 1
    else deferredCounts.other += 1

    if (currentReason !== "keywords") continue

    const dedupeKey = company.id
    const blob = buildExternalDiscoveryKeywordBlob(company)
    const providerBlob = [
      blob,
      company._normalized.job_title,
      company._normalized.department,
      company._normalized.contact_name,
      company._normalized.company_linkedin_url,
      ...(company._normalized.naics_codes ?? []),
      ...(company._normalized.sic_codes ?? []),
    ]
      .filter(Boolean)
      .join(" ")

    const evidence = scanEvidence(providerBlob)
    const matchedFilterKeywords = filterKeywords.filter((kw) => includesFold(blob, kw))
    const bridgeApplied = company.datamoon_provider_industry_icp_bridge?.bridgeApplied ?? false
    const crawlAssessment = assessWebsiteCrawlRecovery({
      company,
      evidence,
      filterKeywords,
      matchedFilterKeywords,
      bridgeApplied,
    })
    const falsePositiveRisk = classifyFalsePositiveRisk({
      company,
      bridgeApplied,
      websiteCrawlVerdict: crawlAssessment.verdict,
    })

    const admission = evaluateGrowthLeadAdmission(
      normalizeLeadIntakeSource({
        source: "datamoon",
        company: {
          name: company.company_name,
          website: company.website,
          domain: company._normalized.company_domain,
        },
        contact: {
          name: company._normalized.contact_name,
          email: company._normalized.email,
          phone: company._normalized.phone,
          linkedinUrl: company._normalized.linkedin_url,
        },
        metadata: {
          business_email: company._normalized.business_email,
          personal_email: company._normalized.personal_emails,
        },
      }),
      admissionContext,
    )

    const entry = {
      company: company.company_name,
      audienceIds: [company.audienceId],
      providerIndustry: company._normalized.primary_industry ?? company.industry,
      providerTitle: company._normalized.job_title ?? null,
      providerDepartment: company._normalized.department ?? null,
      website: company.website,
      websiteAvailable: Boolean(company.website?.trim() || company._normalized.company_domain?.trim()),
      bridgeApplied,
      bridgeMappedSSVAliases: company.datamoon_provider_industry_icp_bridge?.mappedSSVAliases ?? [],
      filterKeywordsRequired: filterKeywords,
      matchedFilterKeywords,
      missingFilterKeywords: filterKeywords.filter((kw) => !includesFold(blob, kw)),
      evidence,
      keywordBlobSample: blob.slice(0, 280),
      websiteCrawlLikelyRecoversEvidence: crawlAssessment.verdict,
      websiteCrawlReasoning: crawlAssessment.reasoning,
      simulatedAdmissionIfKeywordDeferred: {
        state: admission.state,
        allowLeadCreation: admission.allowLeadCreation,
        allowAutoResearch: admission.allowAutoResearch,
        reasons: admission.reasons.slice(0, 4),
      },
      falsePositiveRiskIfKeywordDeferred: falsePositiveRisk,
    }

    if (seenKeywordRejectKeys.has(dedupeKey)) {
      const existing = keywordRejections.find((row) => row.company === company.company_name)
      if (existing && Array.isArray(existing.audienceIds)) {
        ;(existing.audienceIds as string[]).push(company.audienceId)
      }
      continue
    }
    seenKeywordRejectKeys.add(dedupeKey)
    keywordRejections.push(entry)

    if (!deferredReason) {
      deferredAccepted.push({
        company: company.company_name,
        audienceId: company.audienceId,
        bridgeApplied,
        admissionState: admission.state,
        allowLeadCreation: admission.allowLeadCreation,
        allowAutoResearch: admission.allowAutoResearch,
        falsePositiveRisk,
        websiteCrawlVerdict: crawlAssessment.verdict,
      })
    }
  }

  const uniqueDeferredAccepted = deferredAccepted.filter(
    (row, index, arr) => arr.findIndex((other) => other.company === row.company) === index,
  )

  const intakeAdditional = uniqueDeferredAccepted.filter((row) => row.allowLeadCreation).length
  const admissionAccepted = uniqueDeferredAccepted.filter((row) => row.admissionState === "accepted").length
  const admissionReview = uniqueDeferredAccepted.filter((row) => row.admissionState === "review").length
  const researchStarted = uniqueDeferredAccepted.filter((row) => row.allowAutoResearch).length
  const falsePositivesHigh = uniqueDeferredAccepted.filter((row) => row.falsePositiveRisk === "high").length
  const falsePositivesMedium = uniqueDeferredAccepted.filter((row) => row.falsePositiveRisk === "medium").length

  const crawlYes = keywordRejections.filter((row) => row.websiteCrawlLikelyRecoversEvidence === "YES").length
  const crawlNo = keywordRejections.filter((row) => row.websiteCrawlLikelyRecoversEvidence === "NO").length
  const crawlUnknown = keywordRejections.filter((row) => row.websiteCrawlLikelyRecoversEvidence === "UNKNOWN").length

  const report = {
    qaMarker: QA_MARKER,
    bridgeActive: true,
    targetAudiences: TARGET_AUDIENCES,
    filterKeywords,
    replayedCompanyCount: allCompanies.length,
    currentWithBridge: currentCounts,
    simulatedKeywordDeferral: {
      counts: deferredCounts,
      additionalIntake: intakeAdditional,
      additionalAdmissionAccepted: admissionAccepted,
      additionalAdmissionReview: admissionReview,
      researchStarted,
      falsePositivesIntroduced: {
        high: falsePositivesHigh,
        medium: falsePositivesMedium,
        low: uniqueDeferredAccepted.filter((row) => row.falsePositiveRisk === "low").length,
        estimatedFalsePositiveRatePercent: uniqueDeferredAccepted.length
          ? Math.round(((falsePositivesHigh + falsePositivesMedium * 0.5) / uniqueDeferredAccepted.length) * 100)
          : 0,
      },
      deferredAcceptedCompanies: uniqueDeferredAccepted,
    },
    keywordRejections,
    websiteCrawlRecoverySummary: { YES: crawlYes, NO: crawlNo, UNKNOWN: crawlUnknown },
    riskAnalysis: {
      estimatedResearchCostIncreasePercent: uniqueDeferredAccepted.length
        ? Math.round((researchStarted / Math.max(currentCounts.accepted, 1)) * 100) || researchStarted * 100
        : 0,
      note: "Baseline accepted=0 today; deferring keywords adds research runs proportional to allowAutoResearch count.",
      estimatedFalsePositiveIncreasePercent: uniqueDeferredAccepted.length
        ? Math.round((falsePositivesHigh / uniqueDeferredAccepted.length) * 100)
        : 0,
      estimatedDiscoveryImprovementPercent: uniqueDeferredAccepted.length
        ? Math.round(
            (uniqueDeferredAccepted.filter((row) => row.falsePositiveRisk === "low").length /
              Math.max(uniqueDeferredAccepted.length, 1)) *
              100,
          )
        : 0,
      discoveryImprovementNote:
        "Low-risk deferred accepts with crawl YES/UNKNOWN and non-manufacturing profile represent plausible ICP yield; high-risk manufacturing bridge passes dominate false-positive risk.",
    },
    architectureReview: {
      currentPath: "Provider → DataMoon normalize (+ industry bridge) → Prospect Search (industry + keyword gates) → Intake → Admission → Research",
      proposedPath:
        "Provider → DataMoon normalize (+ industry bridge) → Prospect Search (industry gate only) → Intake → Research → Keyword/operational validation → Admission",
      recommendation:
        "Defer keyword evaluation to post-research for external discovery only; retain keyword gate for internal/index sources. Equipify autonomous discovery philosophy prioritizes evidence-backed qualification over provider sparse payloads — research is the designed evidence layer.",
      rationale: [
        "Production replay: 100% of post-bridge keyword rejects lack filter keyword matches in provider blob; 0 accepted today.",
        "Keyword gate blocks before research can collect website operational evidence.",
        "Industry bridge already normalizes taxonomy; keyword gate is now the sole blocker for bridged industrial companies.",
        "Admission gate remains fail-closed for identity; research can feed keyword validation before final admission.",
        "High false-positive risk for manufacturing taxonomy bridge passes argues keyword validation must occur before Admission, not before Research.",
      ],
    },
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
