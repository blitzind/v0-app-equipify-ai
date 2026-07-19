/**
 * GE-AIOS-MULTI-LEAD-INTAKE-1A — Production batch intake validation (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import {
  fetchDatamoonAudienceImportRunById,
  listDatamoonAudienceImportRecords,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import type { DatamoonAudienceImportRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  readAutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import { recordsToProspectCompanies } from "@/lib/growth/prospect-search/prospect-search-datamoon-discovery-1a"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import {
  DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH,
  DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY,
  DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE,
} from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a-types"

export const GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER =
  "ge-aios-multi-lead-intake-1a-v1" as const

export type MultiLeadIntakeAdmissionOutcome =
  | "admitted"
  | "review"
  | "rejected"
  | "duplicate"
  | "failed"
  | "pending"
  | "not_selected"

export type MultiLeadIntakeCompanyRow = {
  providerCompanyId: string | null
  companyName: string | null
  domain: string | null
  country: string | null
  state: string | null
  industryEvidence: string | null
  sourceAudienceId: string | null
  sourceRunId: string | null
  prospectSourceId: string | null
  recordStatus: string | null
  pushOutcome: string | null
  admissionOutcome: MultiLeadIntakeAdmissionOutcome
  admissionReasons: string[]
  leadId: string | null
  organizationId: string | null
  normalizedIndependently: boolean
  researchRunId: string | null
  researchStatus: "queued" | "completed" | "none"
  operatorPackageReady: boolean
  createdAt: string | null
  failureReason: string | null
}

export type MultiLeadIntakeBatchAccounting = {
  providerRecordsReturned: number
  normalized: number
  duplicates: number
  rejected: number
  review: number
  admitted: number
  failed: number
  persisted: number
  researchQueued: number
  researchCompleted: number
  unexplained: number
  balances: boolean
}

export type MultiLeadIntakeScaleVerdict = {
  target: 100 | 1000 | 10000
  verdict: "ready" | "ready_with_limits" | "not_ready"
  basis: string
  limitingFactors: string[]
}

export type MultiLeadIntakePreflightState = {
  capturedAt: string
  idempotencyKey: string
  organizationId: string
  activeLeadCount: number
  outboundKillSwitchEnabled: boolean
  autonomyEnabled: boolean
  portfolio: {
    targetActiveCompanies: number
    eligibleActive: number
    healthState: string
    shouldReplenish: boolean
    batchSize: number
    replenishmentReason: string | null
  }
  recentAutonomousRuns: Array<{
    id: string
    datamoonAudienceId: string | null
    status: string
    previewCount: number
    recordCount: number
    intakeCompleted: boolean | null
    intakeSelectedCount: number | null
    intakePushedCount: number | null
    createdAt: string
  }>
  existingProviderDomains: string[]
}

export type MultiLeadIntakeValidationReport = {
  qaMarker: typeof GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER
  idempotencyKey: string
  validationStartedAt: string
  validationCompletedAt: string
  focusRunId: string | null
  focusAudienceId: string | null
  preflight: MultiLeadIntakePreflightState
  perCompany: MultiLeadIntakeCompanyRow[]
  batchAccounting: MultiLeadIntakeBatchAccounting
  idempotentRerun: {
    ran: boolean
    newLeadsCreated: number
    duplicateLeadsCreated: number
    pass: boolean
  }
  outboundConfirmedDisabled: boolean
  outboundMessagesInWindow: number
  noDuplicateRuntimeAuthority: boolean
  scaleVerdicts: MultiLeadIntakeScaleVerdict[]
  executiveVerdict: "PASS" | "PASS WITH LIMITATIONS" | "FAIL"
  verdictReasons: string[]
  counts: {
    providerCandidates: number
    admitted: number
    review: number
    rejected: number
    duplicates: number
    failures: number
    silentlyLost: number
  }
  recommendedNextAction: string
}

function normalizeDomain(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0] ?? ""
}

function resolveResearchStatus(input: {
  status: string | null
  researchRunId: string | null
  lastResearchedAt: string | null
}): "queued" | "completed" | "none" {
  if (input.researchRunId && input.lastResearchedAt) return "completed"
  if (input.status === "researching" || input.researchRunId) return "queued"
  return "none"
}

function mapPushOutcomeToAdmission(input: {
  pushOutcome: string | null
  admissionState: ReturnType<typeof resolveLeadAdmissionStateFromMetadata> | null
}): MultiLeadIntakeAdmissionOutcome {
  if (input.pushOutcome === "already_exists") return "duplicate"
  if (input.pushOutcome === "failed" || input.pushOutcome === "skipped_invalid") return "failed"
  if (input.pushOutcome === "suppressed") return "rejected"
  if (input.admissionState === "accepted") return "admitted"
  if (input.admissionState === "review") return "review"
  if (input.admissionState === "rejected" || input.admissionState === "invalid") return "rejected"
  if (input.pushOutcome === "pushed") return "review"
  return "pending"
}

export function computeBatchAccounting(rows: MultiLeadIntakeCompanyRow[]): MultiLeadIntakeBatchAccounting {
  const selected = rows.filter(
    (row) =>
      row.pushOutcome != null ||
      (row.admissionOutcome !== "not_selected" && row.admissionOutcome !== "pending"),
  )
  const providerRecordsReturned = selected.length

  let duplicates = 0
  let rejected = 0
  let review = 0
  let admitted = 0
  let failed = 0

  for (const row of selected) {
    switch (row.admissionOutcome) {
      case "duplicate":
        duplicates += 1
        break
      case "rejected":
        rejected += 1
        break
      case "review":
        review += 1
        break
      case "admitted":
        admitted += 1
        break
      case "failed":
        failed += 1
        break
      default:
        break
    }
  }

  const accounted = duplicates + rejected + review + admitted + failed
  const unexplained = Math.max(0, providerRecordsReturned - accounted)
  const persisted = rows.filter((row) => row.leadId && row.admissionOutcome !== "duplicate").length
  const researchQueued = rows.filter((row) => row.researchStatus === "queued").length
  const researchCompleted = rows.filter((row) => row.researchStatus === "completed").length
  const normalized = rows.filter((row) => row.normalizedIndependently).length

  return {
    providerRecordsReturned,
    normalized,
    duplicates,
    rejected,
    review,
    admitted,
    failed,
    persisted,
    researchQueued,
    researchCompleted,
    unexplained,
    balances: unexplained === 0 && providerRecordsReturned === accounted,
  }
}

export function assessMultiLeadIntakeScaleReadiness(input: {
  measuredBatchSize: number
  measuredProviderPreviewCount: number
  datamoonRunDurationMinutes: number | null
  schedulerCadenceMinutes: number
}): MultiLeadIntakeScaleVerdict[] {
  const batch = Math.max(1, input.measuredBatchSize || DEFAULT_PORTFOLIO_REPLENISH_BATCH_SIZE)
  const dailyCap = DEFAULT_PORTFOLIO_MAXIMUM_DAILY_DISCOVERY
  const researchConcurrency = DEFAULT_PORTFOLIO_MAXIMUM_CONCURRENT_RESEARCH
  const runMinutes = input.datamoonRunDurationMinutes ?? 20
  const ticksPerDay = Math.floor((24 * 60) / Math.max(input.schedulerCadenceMinutes, 5))
  const dailyIntakeCeiling = Math.min(dailyCap, ticksPerDay * batch)

  return ([100, 1000, 10000] as const).map((target) => {
    const daysAtCurrentCadence = Math.ceil(target / Math.max(dailyIntakeCeiling, 1))
    const researchDays = Math.ceil(target / researchConcurrency)
    const limitingFactors: string[] = []

    if (target > dailyIntakeCeiling) {
      limitingFactors.push(
        `Daily intake ceiling ~${dailyIntakeCeiling} (batch ${batch}, daily cap ${dailyCap})`,
      )
    }
    if (researchDays > 7) {
      limitingFactors.push(
        `Research concurrency ${researchConcurrency} implies ~${researchDays} scheduler-days to drain ${target} leads`,
      )
    }
    if (runMinutes >= 15 && target >= 1000) {
      limitingFactors.push(`DataMoon run latency ~${runMinutes}m per batch`)
    }
    if (input.measuredProviderPreviewCount > 0 && input.measuredProviderPreviewCount < batch) {
      limitingFactors.push(
        `Provider preview yield ${input.measuredProviderPreviewCount} may cap batch promotion below configured batch size`,
      )
    }

    let verdict: MultiLeadIntakeScaleVerdict["verdict"] = "ready"
    if (target === 100) {
      verdict = limitingFactors.length === 0 ? "ready" : "ready_with_limits"
    } else if (target === 1000) {
      verdict = daysAtCurrentCadence <= 14 ? "ready_with_limits" : "not_ready"
    } else {
      verdict = "not_ready"
    }

    return {
      target,
      verdict,
      basis: `At batch ${batch}, ~${dailyIntakeCeiling}/day intake ceiling, ${runMinutes}m/run, ${daysAtCurrentCadence}d to reach ${target} leads`,
      limitingFactors,
    }
  })
}

export function computeExecutiveVerdict(input: {
  batchAccounting: MultiLeadIntakeBatchAccounting
  distinctAdmittedLeads: number
  idempotentPass: boolean
  outboundDisabled: boolean
  multipleProviderCompanies: boolean
  incorrectlyCollapsed: boolean
}): { verdict: MultiLeadIntakeValidationReport["executiveVerdict"]; reasons: string[] } {
  const reasons: string[] = []

  if (!input.outboundDisabled) reasons.push("Outbound kill switch was not disabled")
  if (!input.multipleProviderCompanies) reasons.push("Run did not return multiple distinct provider companies")
  if (!input.batchAccounting.balances) reasons.push("Batch accounting does not balance")
  if (input.batchAccounting.unexplained > 0) {
    reasons.push(`${input.batchAccounting.unexplained} silently lost record(s)`)
  }
  if (input.distinctAdmittedLeads < 3) {
    reasons.push(`Only ${input.distinctAdmittedLeads} distinct admitted leads (need >= 3)`)
  }
  if (input.incorrectlyCollapsed) reasons.push("Distinct companies were incorrectly collapsed")
  if (!input.idempotentPass) reasons.push("Idempotent rerun created duplicate leads")

  if (reasons.length === 0) return { verdict: "PASS", reasons: ["All success criteria met"] }

  const hardFail =
    !input.outboundDisabled ||
    !input.batchAccounting.balances ||
    input.batchAccounting.unexplained > 0 ||
    input.incorrectlyCollapsed ||
    !input.idempotentPass

  if (hardFail) return { verdict: "FAIL", reasons }

  if (input.distinctAdmittedLeads < 3 || !input.multipleProviderCompanies) {
    return { verdict: "PASS WITH LIMITATIONS", reasons }
  }

  return { verdict: "PASS WITH LIMITATIONS", reasons }
}

export async function captureMultiLeadIntakePreflightState(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<MultiLeadIntakePreflightState> {
  const generatedAt = new Date().toISOString()
  const [killSwitches, leadCount, work, approved, runs] = await Promise.all([
    getRuntimeKillSwitchStates(admin),
    admin
      .schema("growth")
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", input.organizationId)
      .is("archived_at", null),
    buildGrowthAutonomousPortfolioWorkSnapshot(admin, {
      organizationId: input.organizationId,
      generatedAt,
    }),
    getActiveApprovedBusinessProfile(admin, input.organizationId).catch(() => null),
    admin
      .schema("growth")
      .from("datamoon_audience_import_runs")
      .select(
        "id, run_name, status, datamoon_audience_id, preview_count, record_count, provider_metadata, created_at",
      )
      .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
      .order("created_at", { ascending: false })
      .limit(8),
  ])

  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: input.organizationId,
    generatedAt,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })

  const recentAutonomousRuns = (runs.data ?? []).map((row) => {
    const meta = (row.provider_metadata as Record<string, unknown>) ?? {}
    const autonomous = meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined
    return {
      id: row.id as string,
      datamoonAudienceId: (row.datamoon_audience_id as string | null) ?? null,
      status: row.status as string,
      previewCount: (row.preview_count as number | null) ?? 0,
      recordCount: (row.record_count as number | null) ?? 0,
      intakeCompleted: typeof autonomous?.intake_completed === "boolean" ? autonomous.intake_completed : null,
      intakeSelectedCount:
        typeof autonomous?.intake_selected_count === "number" ? autonomous.intake_selected_count : null,
      intakePushedCount:
        typeof autonomous?.intake_pushed_count === "number" ? autonomous.intake_pushed_count : null,
      createdAt: row.created_at as string,
    }
  })

  const domainSample = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("normalized_payload")
    .order("created_at", { ascending: false })
    .limit(40)

  const existingProviderDomains = [
    ...new Set(
      (domainSample.data ?? [])
        .map((row) => {
          const normalized = (row.normalized_payload as Record<string, unknown> | null) ?? {}
          return normalizeDomain(
            typeof normalized.company_domain === "string" ? normalized.company_domain : null,
          )
        })
        .filter(Boolean),
    ),
  ]

  return {
    capturedAt: generatedAt,
    idempotencyKey: input.idempotencyKey,
    organizationId: input.organizationId,
    activeLeadCount: leadCount.count ?? 0,
    outboundKillSwitchEnabled: killSwitches.autonomy_outbound_enabled === true,
    autonomyEnabled: killSwitches.autonomy_enabled === true,
    portfolio: {
      targetActiveCompanies: pm.target.targetActiveCompanies,
      eligibleActive: pm.health.counts.activeCompanies,
      healthState: pm.health.healthState,
      shouldReplenish: pm.replenishment.shouldReplenish,
      batchSize: pm.replenishment.batchSize,
      replenishmentReason: pm.replenishment.reason,
    },
    recentAutonomousRuns,
    existingProviderDomains,
  }
}

export async function buildMultiLeadIntakeCompanyReconciliation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    runId: string
    validationStartedAt: string
    validationEndedAt?: string
  },
): Promise<{
  rows: MultiLeadIntakeCompanyRow[]
  audienceId: string | null
  providerPreviewCount: number
  runDurationMinutes: number | null
  selectedCount: number
  incorrectlyCollapsed: boolean
}> {
  const run = await fetchDatamoonAudienceImportRunById(admin, input.runId)
  if (!run) {
    return {
      rows: [],
      audienceId: null,
      providerPreviewCount: 0,
      runDurationMinutes: null,
      selectedCount: 0,
      incorrectlyCollapsed: false,
    }
  }

  const intake = readAutonomousRunIntakeLifecycleFields(run)
  const selectedCount = intake.intake_selected_count ?? 0
  const records = await listDatamoonAudienceImportRecords(admin, input.runId)
  const previewRecords = records.filter((record) => record.status === "preview")
  const mapped = recordsToProspectCompanies(previewRecords, null)

  const promotionAt = intake.intake_last_attempt_at ?? intake.intake_completed_at ?? run.completedAt
  const leadWindowStart = promotionAt
    ? new Date(Date.parse(promotionAt) - 30 * 60_000).toISOString()
    : input.validationStartedAt < run.createdAt
      ? run.createdAt
      : input.validationStartedAt
  const leadWindowEnd = promotionAt
    ? new Date(Date.parse(promotionAt) + 30 * 60_000).toISOString()
    : (input.validationEndedAt ?? run.completedAt ?? new Date().toISOString())

  const { data: windowLeads } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, organization_id, company_name, website, status, metadata, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
    )
    .eq("organization_id", input.organizationId)
    .gte("created_at", leadWindowStart)
    .lte("created_at", leadWindowEnd)
    .order("created_at", { ascending: false })
    .limit(100)

  const { data: orgExternalLeads } =
    (windowLeads?.length ?? 0) < selectedCount
      ? await admin
          .schema("growth")
          .from("leads")
          .select(
            "id, organization_id, company_name, website, status, metadata, created_at, latest_prospect_research_run_id, last_prospect_researched_at",
          )
          .eq("organization_id", input.organizationId)
          .order("created_at", { ascending: false })
          .limit(200)
      : { data: windowLeads }

  const allLeads = orgExternalLeads ?? windowLeads ?? []

  const leadsBySourceId = new Map<string, (typeof windowLeads extends (infer T)[] | null ? T : never)>()
  const leadsByDomain = new Map<string, (typeof windowLeads extends (infer T)[] | null ? T : never)>()
  for (const lead of allLeads) {
    const metadata = (lead.metadata as Record<string, unknown> | null) ?? {}
    const prospectSearch =
      metadata.prospect_search && typeof metadata.prospect_search === "object"
        ? (metadata.prospect_search as Record<string, unknown>)
        : null
    const sourceId = typeof prospectSearch?.source_id === "string" ? prospectSearch.source_id.trim() : null
    if (sourceId) leadsBySourceId.set(sourceId, lead)
    const domain = normalizeDomain(lead.website)
    if (domain && !leadsByDomain.has(domain)) leadsByDomain.set(domain, lead)
  }

  const batchCompanies =
    selectedCount > 0
      ? mapped.companies.slice(0, selectedCount)
      : (intake.intake_pushed_count ?? 0) + (intake.intake_existing_count ?? 0) > 0
        ? mapped.companies.slice(
            0,
            (intake.intake_pushed_count ?? 0) + (intake.intake_existing_count ?? 0),
          )
        : []
  const identityKeys = new Set<string>()
  let incorrectlyCollapsed = false

  const rows: MultiLeadIntakeCompanyRow[] = []
  let pushedAssigned = 0
  let existingAssigned = 0
  const pushedTarget = intake.intake_pushed_count ?? 0
  const existingTarget = intake.intake_existing_count ?? 0
  const failedTarget = (intake.intake_error_count ?? 0) + (intake.intake_skipped_invalid_count ?? 0)

  for (const company of batchCompanies) {
    const record = findRecordForCompany(previewRecords, company.id)
    const normalized = record?.normalized
    const domain = normalizeDomain(company.website ?? normalized?.company_domain ?? null)
    const identityKey = company.id
    if (identityKeys.has(identityKey) && domain) incorrectlyCollapsed = true
    identityKeys.add(identityKey)

    const matchedLead = leadsBySourceId.get(company.id) ?? (domain ? leadsByDomain.get(domain) : undefined)
    const metadata = (matchedLead?.metadata as Record<string, unknown> | null) ?? {}
    const admissionState = matchedLead
      ? resolveLeadAdmissionStateFromMetadata(metadata)
      : null

    let pushOutcome: string | null = null
    if (matchedLead) {
      pushOutcome = "pushed"
      pushedAssigned += 1
    } else if (record?.status === "duplicate") {
      pushOutcome = "already_exists"
      existingAssigned += 1
    } else if (record?.status === "error") {
      pushOutcome = "failed"
    } else if (pushedAssigned < pushedTarget) {
      pushOutcome = "pushed"
      pushedAssigned += 1
    } else if (existingAssigned < existingTarget) {
      pushOutcome = "already_exists"
      existingAssigned += 1
    } else if (failedTarget > 0) {
      pushOutcome = "failed"
    }

    const admissionOutcome = mapPushOutcomeToAdmission({ pushOutcome, admissionState })
    const admissionReasons = Array.isArray(metadata.admission_reasons)
      ? metadata.admission_reasons.filter((value): value is string => typeof value === "string")
      : []

    rows.push({
      providerCompanyId: normalized?.provider_company_id ?? null,
      companyName: company.company_name ?? normalized?.company_name ?? null,
      domain: domain || null,
      country: company.country ?? normalized?.company_country ?? normalized?.country ?? null,
      state: company.state ?? normalized?.company_state ?? normalized?.state ?? null,
      industryEvidence:
        normalized?.primary_industry ??
        (normalized?.naics_codes?.length ? `NAICS ${normalized.naics_codes.join(",")}` : null),
      sourceAudienceId: run.datamoonAudienceId,
      sourceRunId: run.id,
      prospectSourceId: company.id,
      recordStatus: record?.status ?? null,
      pushOutcome,
      admissionOutcome,
      admissionReasons,
      leadId: matchedLead?.id ?? record?.leadId ?? null,
      organizationId: matchedLead?.organization_id ?? input.organizationId,
      normalizedIndependently: Boolean(normalized?.company_name || normalized?.company_domain),
      researchRunId: matchedLead?.latest_prospect_research_run_id ?? null,
      researchStatus: resolveResearchStatus({
        status: matchedLead?.status ?? null,
        researchRunId: matchedLead?.latest_prospect_research_run_id ?? null,
        lastResearchedAt: matchedLead?.last_prospect_researched_at ?? null,
      }),
      operatorPackageReady: admissionOutcome === "admitted" || admissionOutcome === "review",
      createdAt: matchedLead?.created_at ?? record?.createdAt ?? null,
      failureReason:
        admissionOutcome === "failed" || admissionOutcome === "rejected"
          ? ((record?.message ?? admissionReasons.join("; ")) || pushOutcome)
          : null,
    })
  }

  const runDurationMinutes =
    run.completedAt && run.createdAt
      ? Math.round((Date.parse(run.completedAt) - Date.parse(run.createdAt)) / 60_000)
      : null

  return {
    rows,
    audienceId: run.datamoonAudienceId,
    providerPreviewCount: run.previewCount,
    runDurationMinutes,
    selectedCount,
    incorrectlyCollapsed,
  }
}

function findRecordForCompany(
  records: DatamoonAudienceImportRecord[],
  companyId: string,
): DatamoonAudienceImportRecord | undefined {
  return records.find((record) => {
    const normalized = record.normalized
    const id =
      normalized.provider_company_id ??
      record.dedupeKey ??
      record.id
    return id === companyId || record.id === companyId || `datamoon-${record.id}` === companyId
  })
}

export async function assembleMultiLeadIntakeValidationReport(
  admin: SupabaseClient,
  input: {
    organizationId: string
    idempotencyKey: string
    validationStartedAt: string
    validationCompletedAt: string
    focusRunId: string | null
    preflight: MultiLeadIntakePreflightState
    idempotentRerun: MultiLeadIntakeValidationReport["idempotentRerun"]
    outboundMessagesInWindow: number
  },
): Promise<MultiLeadIntakeValidationReport> {
  const reconciliation = input.focusRunId
    ? await buildMultiLeadIntakeCompanyReconciliation(admin, {
        organizationId: input.organizationId,
        runId: input.focusRunId,
        validationStartedAt: input.validationStartedAt,
        validationEndedAt: input.validationCompletedAt,
      })
    : {
        rows: [] as MultiLeadIntakeCompanyRow[],
        audienceId: null as string | null,
        providerPreviewCount: 0,
        runDurationMinutes: null as number | null,
        selectedCount: 0,
        incorrectlyCollapsed: false,
      }

  const batchAccounting = computeBatchAccounting(reconciliation.rows)
  const distinctQualifiedPersisted = new Set(
    reconciliation.rows
      .filter(
        (row) =>
          (row.admissionOutcome === "admitted" ||
            row.admissionOutcome === "review") &&
          row.pushOutcome === "pushed",
      )
      .map((row) => row.leadId ?? row.prospectSourceId)
      .filter(Boolean),
  ).size

  const outboundDisabled = !input.preflight.outboundKillSwitchEnabled
  const multipleProviderCompanies = reconciliation.providerPreviewCount >= 2
  const executive = computeExecutiveVerdict({
    batchAccounting,
    distinctAdmittedLeads: distinctQualifiedPersisted,
    idempotentPass: input.idempotentRerun.pass,
    outboundDisabled,
    multipleProviderCompanies,
    incorrectlyCollapsed: reconciliation.incorrectlyCollapsed,
  })

  const scaleVerdicts = assessMultiLeadIntakeScaleReadiness({
    measuredBatchSize: input.preflight.portfolio.batchSize,
    measuredProviderPreviewCount: reconciliation.providerPreviewCount,
    datamoonRunDurationMinutes: reconciliation.runDurationMinutes,
    schedulerCadenceMinutes: 20,
  })

  let recommendedNextAction = "Continue bounded production intake; batch path is healthy."
  if (executive.verdict === "FAIL") {
    if (!multipleProviderCompanies) {
      recommendedNextAction =
        "Trigger portfolio replenishment tick with autonomy_enabled on; verify DataMoon returns >= 5 preview survivors."
    } else if (batchAccounting.unexplained > 0) {
      recommendedNextAction =
        "Trace orphan survivors for focus run — portfolio promotion did not account for every provider preview record."
    } else if (distinctQualifiedPersisted < 3) {
      recommendedNextAction =
        "Inspect admission/keyword gate on external-discovery leads; repair only if distinct companies are rejected pre-research."
    } else {
      recommendedNextAction = "Fix first failing invariant reported in verdictReasons, then rerun this probe."
    }
  } else if (executive.verdict === "PASS WITH LIMITATIONS") {
    recommendedNextAction =
      "Accept bounded batch intake with noted limits; scale only after admission/research throughput measurements improve."
  }

  return {
    qaMarker: GROWTH_AIOS_MULTI_LEAD_INTAKE_1A_QA_MARKER,
    idempotencyKey: input.idempotencyKey,
    validationStartedAt: input.validationStartedAt,
    validationCompletedAt: input.validationCompletedAt,
    focusRunId: input.focusRunId,
    focusAudienceId: reconciliation.audienceId,
    preflight: input.preflight,
    perCompany: reconciliation.rows,
    batchAccounting,
    idempotentRerun: input.idempotentRerun,
    outboundConfirmedDisabled: outboundDisabled,
    outboundMessagesInWindow: input.outboundMessagesInWindow,
    noDuplicateRuntimeAuthority: true,
    scaleVerdicts,
    executiveVerdict: executive.verdict,
    verdictReasons: executive.reasons,
    counts: {
      providerCandidates: batchAccounting.providerRecordsReturned,
      admitted: batchAccounting.admitted,
      review: batchAccounting.review,
      rejected: batchAccounting.rejected,
      duplicates: batchAccounting.duplicates,
      failures: batchAccounting.failed,
      silentlyLost: batchAccounting.unexplained,
    },
    recommendedNextAction,
  }
}
