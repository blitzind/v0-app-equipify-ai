/**
 * GE-AIOS-FIRST-CUSTOMER-PIPELINE-SCALING-1C — Production pipeline funnel audit (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
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
  resolveDatamoonProviderIndustryIcpBridge,
  applyDatamoonProviderIndustryIcpBridge,
} from "@/lib/growth/lead-sources/datamoon/datamoon-provider-industry-icp-bridge-1a"
import { isLeadInPortfolioOrganizationScope } from "@/lib/growth/portfolio-eligibility/growth-portfolio-eligibility-1a"
import { applyProspectSearchExternalCompanyFilters } from "@/lib/growth/prospect-search/prospect-search-external-filters"
import { explainProspectSearchFilterDrop } from "@/lib/growth/prospect-search/prospect-search-filters"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  analyzeGrowthLeadAdmissionProductionPool,
  loadSuppressedLeadIds,
} from "@/lib/growth/revenue-workflow/growth-lead-admission-production-analysis"
import { loadGrowthLeadAdmissionContext } from "@/lib/growth/revenue-workflow/growth-lead-admission-context"
import {
  evaluateGrowthLeadAdmission,
  resolveLeadAdmissionStateFromMetadata,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import { classifyGrowthLeadAdmissionDrift } from "@/lib/growth/revenue-workflow/growth-lead-admission-drift"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { listOutreachPreparationRunsForLead } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import {
  buildPipelineFunnelStages,
  findLargestDropOff,
  projectWeeklyQualifiedOpportunities,
  assessDailySupervisedSalesReadiness,
  GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER,
} from "@/lib/growth/training/pipeline-scaling-funnel-metrics-1c"

const FUNNEL_STAGE_ORDER = [
  { id: "provider_records", label: "Provider records" },
  { id: "preview_records", label: "Preview records" },
  { id: "normalized_companies", label: "Normalized companies" },
  { id: "after_duplicate_removal", label: "After duplicate removal" },
  { id: "prospect_search_acceptance", label: "Prospect Search acceptance" },
  { id: "leads_created", label: "Leads created" },
  { id: "research_started", label: "Research started" },
  { id: "admission_accepted", label: "Admission accepted" },
  { id: "admission_review", label: "Admission review" },
  { id: "outreach_eligible", label: "Outreach eligible" },
] as const

function buildProviderEvidenceKeywords(
  normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>,
): string[] {
  return [
    normalized.primary_industry,
    normalized.job_title,
    normalized.department,
    ...(normalized.naics_codes ?? []).map((code) => `naics ${code}`),
    ...(normalized.sic_codes ?? []).map((code) => `sic ${code}`),
  ].filter((value): value is string => Boolean(value?.trim()))
}

function resolveImportRecordNormalized(input: {
  normalizedPayload?: DatamoonAudienceImportRecord["normalized"] | null
  providerRecord: Record<string, unknown>
}): DatamoonAudienceImportRecord["normalized"] {
  const baseNormalized =
    Object.keys(input.providerRecord).length > 0
      ? normalizeDatamoonAudienceRecord(input.providerRecord)
      : normalizeDatamoonAudienceRecord({})
  const normalizedPayload = input.normalizedPayload
  if (!normalizedPayload || Object.keys(normalizedPayload).length === 0) {
    return baseNormalized
  }
  return {
    ...baseNormalized,
    ...normalizedPayload,
    naics_codes: normalizedPayload.naics_codes ?? baseNormalized.naics_codes,
    sic_codes: normalizedPayload.sic_codes ?? baseNormalized.sic_codes,
  }
}

function recordToProspectCompany(
  record: DatamoonAudienceImportRecord,
  index: number,
): GrowthProspectSearchCompanyResult {
  const normalized = record.normalized
  const companyGeo = resolveDatamoonCompanyGeography(normalized)
  const providerKeywords = buildProviderEvidenceKeywords(normalized)
  const bridge = applyDatamoonProviderIndustryIcpBridge({
    providerIndustry: normalized.primary_industry,
    keywords: providerKeywords,
    signals: [
      "Discovered via DataMoon audience search",
      ...(normalized.job_title ? [`Contact role: ${normalized.job_title}`] : []),
      ...(normalized.primary_industry ? [`Provider industry: ${normalized.primary_industry}`] : []),
    ],
  })

  return {
    id:
      resolveDatamoonProspectCompanyIdentityKey(normalized) ??
      record.dedupeKey?.trim() ??
      record.id,
    source_type: "external_discovered",
    company_name: resolveDatamoonCompanyName(normalized),
    website: resolveDatamoonCompanyWebsite(normalized),
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
      ...(bridge.metadata.bridgeApplied
        ? [`Provider industry bridge: ${bridge.metadata.mappedSSVAliases.join(", ")}`]
        : []),
    ],
    discovery_provider_type: "datamoon",
    discovery_provider_name: "DataMoon",
    discovery_source_badge: "DataMoon",
    keywords: bridge.keywords,
    notes: null,
  }
}

function consolidateImportRecords(records: DatamoonAudienceImportRecord[]) {
  const eligible = records.filter((row) => row.status === "preview" || row.status === "duplicate")
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
  return { consolidated }
}

export type PipelineRejectionEvidence = {
  company: string
  stage: string
  reason: string
  rejectionCorrect: boolean
  additionalResearchCouldHelp: boolean
  providerLimitation: boolean
  architectureIssue: boolean
  notes: string
  bridgeMappingAvailable: boolean
}

export async function runPipelineScalingProductionAudit(input: {
  admin: SupabaseClient
  organizationId: string
  generatedAt?: string
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const [approved, admissionContext, suppressedLeadIds, killSwitches, admissionPool] =
    await Promise.all([
      getActiveApprovedBusinessProfile(input.admin, input.organizationId),
      loadGrowthLeadAdmissionContext(input.admin, input.organizationId),
      loadSuppressedLeadIds(input.admin),
      getRuntimeKillSwitchStates(input.admin),
      analyzeGrowthLeadAdmissionProductionPool({
        admin: input.admin,
        organizationId: input.organizationId,
        limit: 500,
      }),
    ])

  const profile = approved?.profile ?? null
  if (!profile) throw new Error("no_active_business_profile")
  const filters = buildProspectSearchFiltersFromBusinessProfile(profile)

  const { data: runs } = await input.admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select(
      "id, run_name, status, datamoon_audience_id, record_count, preview_count, duplicate_count, created_at, completed_at, provider_metadata",
    )
    .like("run_name", "ge-aios-autonomous-prospect-search:%")
    .filter(
      "provider_metadata->autonomous_prospect_search_1a->>organization_id",
      "eq",
      input.organizationId,
    )
    .order("created_at", { ascending: false })

  const completedRuns = (runs ?? []).filter((row) => row.status === "completed")
  let providerRecords = 0
  let previewRecords = 0
  let normalizedCompanies = 0
  let afterDuplicateRemoval = 0
  let geographyRejections = 0
  let industryRejections = 0
  let keywordRejections = 0
  let bridgeResolvableRejections = 0
  let prospectSearchAcceptance = 0
  const rejectionEvidence: PipelineRejectionEvidence[] = []

  for (const run of completedRuns) {
    const { data: dbRecords } = await input.admin
      .schema("growth")
      .from("datamoon_audience_import_records")
      .select("provider_record, normalized_payload, status, dedupe_rule, message")
      .eq("run_id", run.id)

    providerRecords += run.record_count ?? dbRecords?.length ?? 0
    previewRecords += run.preview_count ?? 0

    const importRecords: DatamoonAudienceImportRecord[] = (dbRecords ?? []).map((row, index) => {
      const normalizedPayload = (row as { normalized_payload?: DatamoonAudienceImportRecord["normalized"] })
        .normalized_payload
      const providerRecord = (row as { provider_record?: Record<string, unknown> }).provider_record ?? {}
      const normalized = resolveImportRecordNormalized({ normalizedPayload, providerRecord })
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
      }
    })

    const { consolidated } = consolidateImportRecords(importRecords)
    normalizedCompanies += consolidated.length
    afterDuplicateRemoval += consolidated.length

    const companies = consolidated.map((record, index) => recordToProspectCompany(record, index))
    for (const company of companies) {
      const reason = explainProspectSearchFilterDrop(company, filters, { external_discovery: true })
      if (!reason) continue

      const bridge = resolveDatamoonProviderIndustryIcpBridge(company.industry ?? "")
      const bridgeAvailable = bridge.bridgeApplied && bridge.mappedSSVAliases.length > 0

      if (reason === "location" || reason === "territory") geographyRejections += 1
      if (reason === "industry") {
        industryRejections += 1
        if (bridgeAvailable) bridgeResolvableRejections += 1
      }
      if (reason === "keywords") keywordRejections += 1

      rejectionEvidence.push({
        company: company.company_name ?? company.id,
        stage: "prospect_search",
        reason,
        rejectionCorrect:
          reason === "location"
            ? Boolean(company.country && !/united states|usa|us/i.test(String(company.country)))
            : reason === "industry"
              ? !bridgeAvailable
              : true,
        additionalResearchCouldHelp: reason === "keywords",
        providerLimitation: reason === "industry" && bridgeAvailable,
        architectureIssue: false,
        bridgeMappingAvailable: bridgeAvailable,
        notes:
          reason === "industry" && bridgeAvailable
            ? `Bridge available: ${bridge.mappedSSVAliases.join(", ")}`
            : reason === "keywords"
              ? "Post-research operational keyword validation may recover some companies"
              : "",
      })
    }

    const filtered = applyProspectSearchExternalCompanyFilters(companies, filters)
    prospectSearchAcceptance += filtered.companies.length
  }

  const { data: leadRows } = await input.admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, contact_name, contact_email, website, status, metadata, source_channel, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .not("status", "in", '("archived","converted")')
    .order("created_at", { ascending: false })

  let leadsCreated = 0
  let researchStarted = 0
  let admissionAccepted = 0
  let admissionReview = 0
  let admissionRejected = 0
  let outreachEligible = 0
  let packagesReady = 0

  const icpSamples: Array<{
    company: string
    admissionState: string
    outreachEligible: boolean
    classification: "accepted" | "review" | "rejected"
    rootCause?: string
    layer?: string
  }> = []

  for (const lead of leadRows ?? []) {
    const metadata =
      lead.metadata && typeof lead.metadata === "object" ? (lead.metadata as Record<string, unknown>) : {}
    if (
      !isLeadInPortfolioOrganizationScope(
        {
          id: lead.id,
          status: lead.status,
          metadata,
        },
        input.organizationId,
      )
    ) {
      continue
    }

    leadsCreated += 1
    const intake = buildGrowthLeadAdmissionIntakeFromLead({
      id: lead.id,
      company_name: lead.company_name,
      contact_name: lead.contact_name,
      contact_email: lead.contact_email,
      website: lead.website,
      status: lead.status,
      metadata,
      latest_prospect_research_run_id: lead.latest_prospect_research_run_id,
      last_prospect_researched_at: lead.last_prospect_researched_at,
    })
    const evaluation = evaluateGrowthLeadAdmission(intake, admissionContext)
    const storedState = resolveLeadAdmissionStateFromMetadata(metadata)
    const suppressed = suppressedLeadIds.has(lead.id)
    const drift = classifyGrowthLeadAdmissionDrift({
      storedState,
      evaluation,
      currentWebsite: lead.website,
      currentCompanyName: lead.company_name,
      status: lead.status,
      suppressed,
    })

    if (lead.latest_prospect_research_run_id || lead.last_prospect_researched_at) {
      researchStarted += 1
    }
    if (evaluation.state === "accepted") admissionAccepted += 1
    if (evaluation.state === "review") admissionReview += 1
    if (evaluation.state === "rejected") admissionRejected += 1
    if (drift.outreachEligibility) {
      outreachEligible += 1
      const runs = await listOutreachPreparationRunsForLead(
        input.admin,
        input.organizationId,
        lead.id,
      ).catch(() => [])
      if (runs.some((row) => row.approvalPackage?.pendingHumanApproval)) {
        packagesReady += 1
      }
    }

    if (icpSamples.length < 12) {
      icpSamples.push({
        company: lead.company_name ?? lead.id,
        admissionState: evaluation.state,
        outreachEligible: drift.outreachEligibility,
        classification:
          evaluation.state === "accepted"
            ? "accepted"
            : evaluation.state === "review"
              ? "review"
              : "rejected",
        rootCause: evaluation.reasons.join("; "),
        layer: "evaluateGrowthLeadAdmission",
      })
    }
  }

  const funnelCounts: Record<string, number> = {
    provider_records: providerRecords,
    preview_records: previewRecords,
    normalized_companies: normalizedCompanies,
    after_duplicate_removal: afterDuplicateRemoval,
    geography_rejection: geographyRejections,
    industry_rejection: industryRejections,
    provider_bridge_gap: bridgeResolvableRejections,
    keyword_rejection: keywordRejections,
    prospect_search_acceptance: prospectSearchAcceptance,
    leads_created: leadsCreated,
    research_started: researchStarted,
    admission_accepted: admissionAccepted,
    admission_review: admissionReview,
    admission_rejected: admissionRejected,
    outreach_eligible: outreachEligible,
  }

  const funnelStages = buildPipelineFunnelStages(funnelCounts, [...FUNNEL_STAGE_ORDER])
  const largestDropOff = findLargestDropOff(funnelStages)

  const runsPerWeek =
    completedRuns.length >= 2
      ? completedRuns.length /
        Math.max(
          1,
          (Date.parse(completedRuns[0]!.created_at) - Date.parse(completedRuns.at(-1)!.created_at)) /
            (7 * 24 * 60 * 60 * 1000),
        )
      : completedRuns.length

  const outreachPerRun =
    completedRuns.length > 0 ? outreachEligible / completedRuns.length : outreachEligible
  const improvementMultiplier =
    bridgeResolvableRejections > 0
      ? 1 + bridgeResolvableRejections / Math.max(1, prospectSearchAcceptance)
      : 1

  const capacity = projectWeeklyQualifiedOpportunities({
    outreachEligiblePerRun: outreachPerRun,
    completedRunsPerWeek: runsPerWeek,
    expectedImprovementMultiplier: improvementMultiplier,
  })

  const supervisedReadiness = assessDailySupervisedSalesReadiness({
    outreachEligibleLeads: outreachEligible,
    packagesReady,
    minWeeklyQualified: 3,
    currentWeeklyQualified: capacity.currentPerWeek,
  })

  const throughputOpportunities = [
    ...(bridgeResolvableRejections > 0
      ? [
          {
            id: "provider_industry_bridge",
            severity: "high" as const,
            description: `${bridgeResolvableRejections} companies rejected at industry gate but have proven provider→SSV bridge mappings`,
            evidence: "Production replay audiences 5962/5987 — Machinery Manufacturing taxonomy",
            preservesIcp: true,
            expectedLift: `Up to ${bridgeResolvableRejections} additional Prospect Search survivors per run cycle`,
          },
        ]
      : []),
    ...(keywordRejections > 0
      ? [
          {
            id: "post_research_keyword_recovery",
            severity: "medium" as const,
            description: `${keywordRejections} companies failed pre-intake keyword gate — some may pass post-research validation`,
            evidence: "operational-keyword-validation-1a reconciles after research completes",
            preservesIcp: true,
            expectedLift: "Variable — depends on website/research evidence quality",
          },
        ]
      : []),
    ...(prospectSearchAcceptance > leadsCreated * 2
      ? [
          {
            id: "portfolio_intake_gap",
            severity: "high" as const,
            description: `${prospectSearchAcceptance} cumulative Prospect Search survivors vs ${leadsCreated} leads in portfolio — intake/push bottleneck`,
            evidence: `Autonomous portfolio manager pushes batch slices via executeBulkPushToLeadInbox; ${completedRuns.length} completed discovery runs`,
            preservesIcp: true,
            expectedLift: `Closing the ${prospectSearchAcceptance - leadsCreated} survivor→lead gap is the highest-leverage throughput fix without weakening ICP`,
          },
        ]
      : []),
  ]

  return {
    qaMarker: GROWTH_AIOS_FIRST_CUSTOMER_PIPELINE_SCALING_1C_QA_MARKER,
    organizationId: input.organizationId,
    generatedAt,
    outboundKillSwitchEnabled: killSwitches.autonomy_outbound_enabled === true,
    discoveryRuns: {
      total: (runs ?? []).length,
      completed: completedRuns.length,
      recent: (runs ?? []).slice(0, 5).map((row) => ({
        id: row.id,
        audienceId: row.datamoon_audience_id,
        status: row.status,
        recordCount: row.record_count,
        previewCount: row.preview_count,
        duplicateCount: row.duplicate_count,
        createdAt: row.created_at,
      })),
    },
    funnelCounts,
    funnelStages,
    largestDropOff,
    rejectionEvidence: rejectionEvidence.slice(0, 25),
    icpQualitySamples: icpSamples,
    throughputOpportunities,
    capacityProjection: capacity,
    supervisedSalesReadiness: supervisedReadiness,
    admissionPoolSummary: admissionPool.counts,
    packagesReady,
    blockers: [
      ...(outreachEligible < 3
        ? [
            {
              severity: "high" as const,
              description: `Only ${outreachEligible} outreach-eligible lead(s) — insufficient for daily supervised pipeline`,
            },
          ]
        : []),
      ...(completedRuns.length < 3
        ? [
            {
              severity: "medium" as const,
              description: `${completedRuns.length} completed discovery runs — limited production evidence for throughput projection`,
            },
          ]
        : []),
      ...(killSwitches.autonomy_outbound_enabled
        ? [{ severity: "critical" as const, description: "Outbound kill switch is ON — must remain OFF for this milestone" }]
        : []),
    ],
  }
}
