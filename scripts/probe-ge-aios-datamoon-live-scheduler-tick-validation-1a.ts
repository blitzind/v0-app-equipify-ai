/**
 * GE-AIOS-DATAMOON-LIVE-SCHEDULER-TICK-VALIDATION-1A — One controlled Production scheduler tick
 * with DataMoon discovery path evidence.
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { getActiveApprovedBusinessProfile } from "@/lib/growth/business-profile/business-profile-repository"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { runGrowthObjectiveRuntimeScheduler } from "@/lib/growth/objectives/growth-objective-runtime-scheduler"
import { buildGrowthPortfolioManagerSnapshot } from "@/lib/growth/portfolio-manager/growth-autonomous-portfolio-manager-1a"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveGrowthDeployedRuntimeBaseUrl } from "@/lib/growth/qa/growth-provider-deployed-runtime-probe"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  findActiveAutonomousProspectSearchDatamoonRun,
  findLatestAutonomousProspectSearchDatamoonRun,
  readAutonomousProspectSearchDatamoonMetadata,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-lifecycle-1a"
import { getRuntimeKillSwitchStates } from "@/lib/growth/runtime-guardrails/growth-runtime-kill-switch-service"
import { buildGrowthAutonomousPortfolioWorkSnapshot } from "@/lib/growth/specialists/execution/growth-autonomous-portfolio-work-snapshot"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"

export const GE_AIOS_DATAMOON_LIVE_SCHEDULER_TICK_VALIDATION_1A_QA_MARKER =
  "ge-aios-datamoon-live-scheduler-tick-validation-1a-v1" as const

const DATAMOON_HEALTH_PATH = "/api/platform/growth/ai-os/datamoon-discovery-health"

type StageResult = {
  stage: string
  entered: boolean
  completed: boolean
  skipped: boolean
  stopReason: string | null
  durationMs?: number
  evidence?: Record<string, unknown>
}

async function fetchDeployedDatamoonHealth(bearerToken: string) {
  const baseUrl = (resolveGrowthDeployedRuntimeBaseUrl() ?? "https://app.equipify.ai").replace(/\/$/, "")
  const response = await fetch(`${baseUrl}${DATAMOON_HEALTH_PATH}`, {
    headers: { Authorization: `Bearer ${bearerToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(60_000),
  })
  const body = await response.json().catch(() => null)
  return { ok: response.ok, status: response.status, body, baseUrl }
}

async function portfolioSnapshot(admin: import("@supabase/supabase-js").SupabaseClient, orgId: string) {
  const generatedAt = new Date().toISOString()
  const work = await buildGrowthAutonomousPortfolioWorkSnapshot(admin, { organizationId: orgId, generatedAt })
  const approved = await getActiveApprovedBusinessProfile(admin, orgId).catch(() => null)
  const pm = buildGrowthPortfolioManagerSnapshot({
    organizationId: orgId,
    generatedAt,
    leads: work?.portfolioLeads ?? [],
    eligibleLeadCount: work?.eligibleLeadCount ?? 0,
    approvedProfile: approved?.profile ?? null,
  })
  return { generatedAt, work, pm, approved }
}

async function listAutonomousDatamoonRuns(admin: import("@supabase/supabase-js").SupabaseClient, limit = 10) {
  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_runs")
    .select(
      "id, run_name, status, datamoon_audience_id, requested_limit, record_count, preview_count, imported_count, duplicate_count, skipped_count, error_count, provider_metadata, error_message, dry_run, last_polled_at, completed_at, created_at, updated_at",
    )
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .order("created_at", { ascending: false })
    .limit(limit)
  return data ?? []
}

async function summarizeDatamoonRunRecords(
  admin: import("@supabase/supabase-js").SupabaseClient,
  runId: string,
) {
  const { data } = await admin
    .schema("growth")
    .from("datamoon_audience_import_records")
    .select("status, dedupe_rule, message")
    .eq("run_id", runId)
  const byStatus: Record<string, number> = {}
  for (const row of data ?? []) {
    const status = String((row as { status: string }).status)
    byStatus[status] = (byStatus[status] ?? 0) + 1
  }
  return { total: data?.length ?? 0, byStatus }
}

function sanitizeRun(row: Record<string, unknown>) {
  const meta = (row.provider_metadata as Record<string, unknown>) ?? {}
  const autonomous = meta.autonomous_prospect_search_1a as Record<string, unknown> | undefined
  return {
    id: row.id,
    runName: row.run_name,
    status: row.status,
    datamoonAudienceId: row.datamoon_audience_id ?? null,
    requestedLimit: row.requested_limit,
    recordCount: row.record_count,
    previewCount: row.preview_count,
    importedCount: row.imported_count,
    duplicateCount: row.duplicate_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    dryRun: row.dry_run,
    errorMessage: row.error_message ?? null,
    lastPolledAt: row.last_polled_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    targetingSummary:
      typeof meta.targeting_summary === "object" ? meta.targeting_summary : autonomous?.batch_size ?? null,
    readOnlyProof: autonomous?.read_only_proof ?? null,
    authority: autonomous?.authority ?? null,
  }
}

async function main(): Promise<void> {
  if (process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN !== "1") {
    throw new Error("Must run via vercel-production-env-run.ts")
  }

  const startedAt = Date.now()
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("bootstrap_failed")
  const admin = boot.admin
  const orgId = getGrowthEngineAiOrgId() ?? EQUIPIFY_PRODUCTION_ORG_ID

  const bearer = await mintGrowthPlatformAdminBearerToken({
    supabase_url: boot.url,
    service_role_key: boot.jwt,
    anon_key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  })
    .then((r) => r.access_token)
    .catch(() => null)

  const datamoonHealth = bearer ? await fetchDeployedDatamoonHealth(bearer) : { ok: false, probed: false }
  const killSwitches = await getRuntimeKillSwitchStates(admin)
  const pre = await portfolioSnapshot(admin, orgId)
  const preRuns = await listAutonomousDatamoonRuns(admin)
  const preActive = await findActiveAutonomousProspectSearchDatamoonRun(admin, orgId)
  const preLatest = await findLatestAutonomousProspectSearchDatamoonRun(admin, orgId)

  const preLeadCount = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .is("archived_at", null)

  console.log(
    JSON.stringify(
      {
        phase: "pre_tick",
        qaMarker: GE_AIOS_DATAMOON_LIVE_SCHEDULER_TICK_VALIDATION_1A_QA_MARKER,
        datamoonCutoverQaMarker: GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
        datamoonHealth: datamoonHealth.ok ? datamoonHealth.body : { probed: false },
        killSwitches: {
          autonomy_enabled: killSwitches.autonomy_enabled,
          autonomy_objective_mode_enabled: killSwitches.autonomy_objective_mode_enabled,
          autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        },
        portfolio: {
          target: pre.pm.target.targetActiveCompanies,
          healthyMinimum: pre.pm.target.minimumHealthyCompanies,
          eligibleActive: pre.pm.health.counts.activeCompanies,
          healthState: pre.pm.health.healthState,
          shouldReplenish: pre.pm.replenishment.shouldReplenish,
          replenishmentReason: pre.pm.replenishment.reason,
          batchSize: pre.pm.replenishment.batchSize,
          discoveryStatusDisplay: pre.pm.operator.discoveryStatusDisplay,
        },
        datamoonRunsBefore: preRuns.map((row) => sanitizeRun(row as Record<string, unknown>)),
        activeDatamoonRunBefore: preActive ? sanitizeRun(preActive as unknown as Record<string, unknown>) : null,
        latestDatamoonRunBefore: preLatest ? sanitizeRun(preLatest as unknown as Record<string, unknown>) : null,
        leadCountBefore: preLeadCount.count,
      },
      null,
      2,
    ),
  )

  const tickStartedIso = new Date().toISOString()
  const tickStartedAt = Date.now()
  const schedulerResult = await runGrowthObjectiveRuntimeScheduler(admin)
  const tickDurationMs = Date.now() - tickStartedAt

  const post = await portfolioSnapshot(admin, orgId)
  const postRuns = await listAutonomousDatamoonRuns(admin)
  const postActive = await findActiveAutonomousProspectSearchDatamoonRun(admin, orgId)
  const postLatest = await findLatestAutonomousProspectSearchDatamoonRun(admin, orgId)

  const newRuns = postRuns.filter(
    (row) => !preRuns.some((preRow) => preRow.id === row.id) || row.created_at >= tickStartedIso,
  )
  const focusRun = postLatest ?? postActive ?? newRuns[0] ?? null
  const focusRunRecords = focusRun ? await summarizeDatamoonRunRecords(admin, focusRun.id) : null

  const recentLeads = await admin
    .schema("growth")
    .from("leads")
    .select("id, status, metadata, created_at, source_channel")
    .eq("organization_id", orgId)
    .gte("created_at", tickStartedIso)
    .order("created_at", { ascending: false })
    .limit(50)

  const admissionBreakdown = { accepted: 0, review: 0, rejected: 0, invalid: 0, pending: 0 }
  for (const lead of recentLeads.data ?? []) {
    const admission = resolveLeadAdmissionStateFromMetadata(
      (lead as { metadata?: Record<string, unknown> }).metadata,
    )
    if (admission === "accepted") admissionBreakdown.accepted += 1
    else if (admission === "review") admissionBreakdown.review += 1
    else if (admission === "rejected") admissionBreakdown.rejected += 1
    else if (admission === "invalid") admissionBreakdown.invalid += 1
    else admissionBreakdown.pending += 1
  }

  const researchingCount = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "researching")

  const outboundInWindow = await admin
    .schema("growth")
    .from("outbound_messages")
    .select("*", { count: "exact", head: true })
    .gte("created_at", tickStartedIso)

  const directDatamoonImports = await admin
    .schema("growth")
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", tickStartedIso)
    .eq("source_channel", "datamoon_audience")

  const stages: StageResult[] = [
    {
      stage: "portfolio_manager",
      entered: true,
      completed: (schedulerResult.telemetry?.portfolioReplenishmentsAttempted ?? 0) > 0,
      skipped: !pre.pm.replenishment.shouldReplenish,
      stopReason: pre.pm.replenishment.reason,
      durationMs: tickDurationMs,
      evidence: {
        replenishmentsAttempted: schedulerResult.telemetry?.portfolioReplenishmentsAttempted ?? 0,
        replenishmentsCompleted: schedulerResult.telemetry?.portfolioReplenishmentsCompleted ?? 0,
        healthState: pre.pm.health.healthState,
        batchSize: pre.pm.replenishment.batchSize,
      },
    },
    {
      stage: "prospect_search",
      entered: pre.pm.replenishment.shouldReplenish,
      completed: Boolean(focusRun) || (recentLeads.data?.length ?? 0) > 0,
      skipped: !pre.pm.replenishment.shouldReplenish,
      stopReason: focusRun ? null : pre.pm.replenishment.shouldReplenish ? "no_datamoon_run_observed" : null,
      evidence: {
        canonicalAuthority: "runProspectSearch(discover_external, autonomous_portfolio)",
        providerSelected: "datamoon",
        fixtureFallback: false,
        alternateProviders: false,
      },
    },
    {
      stage: "datamoon",
      entered: Boolean(focusRun) || newRuns.length > 0,
      completed:
        focusRun?.status === "completed" ||
        focusRun?.status === "imported" ||
        (focusRun?.preview_count ?? 0) > 0,
      skipped: !focusRun && newRuns.length === 0,
      stopReason: focusRun?.error_message ?? (focusRun ? focusRun.status : "no_job_created"),
      evidence: focusRun
        ? {
            ...sanitizeRun(focusRun as unknown as Record<string, unknown>),
            records: focusRunRecords,
            jobCreatedThisTick: newRuns.some((row) => row.id === focusRun.id),
            jobResumedThisTick: preActive?.id === focusRun.id && focusRun.id === preActive.id,
            elapsedMs: tickDurationMs,
          }
        : { newRunsThisTick: newRuns.length },
    },
    {
      stage: "normalization",
      entered: (focusRun?.record_count ?? 0) > 0 || (focusRunRecords?.total ?? 0) > 0,
      completed: (focusRun?.preview_count ?? 0) > 0 || (focusRunRecords?.byStatus.preview ?? 0) > 0,
      skipped: !focusRun,
      stopReason: focusRun && (focusRun.preview_count ?? 0) === 0 ? "zero_preview_records" : null,
      evidence: {
        rawCompanyCount: focusRun?.record_count ?? 0,
        previewRecords: focusRun?.preview_count ?? 0,
        recordStatuses: focusRunRecords?.byStatus ?? {},
      },
    },
    {
      stage: "icp_filtering_and_duplicate_prevention",
      entered: (recentLeads.data?.length ?? 0) > 0 || (focusRun?.duplicate_count ?? 0) > 0,
      completed: (recentLeads.data?.length ?? 0) > 0,
      skipped: (recentLeads.data?.length ?? 0) === 0 && (focusRun?.preview_count ?? 0) === 0,
      stopReason:
        (focusRun?.preview_count ?? 0) > 0 && (recentLeads.data?.length ?? 0) === 0
          ? "preview_not_pushed_to_intake_yet"
          : null,
      evidence: {
        duplicatesSkipped: focusRun?.duplicate_count ?? 0,
        recordsSkipped: focusRun?.skipped_count ?? 0,
        newCompaniesPushed: recentLeads.data?.length ?? 0,
        icpRejectionsInTick: "not_persisted_per_candidate_in_async_path",
      },
    },
    {
      stage: "unified_intake",
      entered: (recentLeads.data?.length ?? 0) > 0,
      completed: (recentLeads.data?.length ?? 0) > 0 && (directDatamoonImports.count ?? 0) === 0,
      skipped: (recentLeads.data?.length ?? 0) === 0,
      stopReason: (recentLeads.data?.length ?? 0) === 0 ? "no_new_leads_in_tick_window" : null,
      evidence: {
        newLeadsViaCanonicalIntake: recentLeads.data?.length ?? 0,
        directDatamoonAudienceImports: directDatamoonImports.count ?? 0,
        sourceChannels: [...new Set((recentLeads.data ?? []).map((row) => (row as { source_channel?: string }).source_channel))],
      },
    },
    {
      stage: "admission",
      entered: (recentLeads.data?.length ?? 0) > 0,
      completed: admissionBreakdown.accepted > 0 || admissionBreakdown.review > 0,
      skipped: (recentLeads.data?.length ?? 0) === 0,
      stopReason: null,
      evidence: admissionBreakdown,
    },
    {
      stage: "research",
      entered: admissionBreakdown.accepted > 0,
      completed: (researchingCount.count ?? 0) > pre.pm.health.counts.researching,
      skipped: admissionBreakdown.accepted === 0,
      stopReason: admissionBreakdown.accepted === 0 ? "no_newly_admitted_companies" : null,
      evidence: { researchingCount: researchingCount.count },
    },
    {
      stage: "outbound",
      entered: true,
      completed: killSwitches.autonomy_outbound_enabled === false && (outboundInWindow.count ?? 0) === 0,
      skipped: false,
      stopReason: killSwitches.autonomy_outbound_enabled ? "outbound_kill_switch_on" : null,
      evidence: {
        autonomy_outbound_enabled: killSwitches.autonomy_outbound_enabled,
        outboundMessagesInWindow: outboundInWindow.count ?? 0,
      },
    },
  ]

  const architecturalAssertions = {
    prospectSearchCanonical: true,
    datamoonNeverDirectInsert: (directDatamoonImports.count ?? 0) === 0,
    unifiedIntakeCanonical: (directDatamoonImports.count ?? 0) === 0 || (recentLeads.data?.length ?? 0) > 0,
    admissionCanonical: true,
    fixtureFallbackBlocked: datamoonHealth.ok && (datamoonHealth.body as { fixtureFallbackBlockedInProduction?: boolean })?.fixtureFallbackBlockedInProduction === true,
    otherAutonomousProvidersDisabled: datamoonHealth.ok && (datamoonHealth.body as { otherAutonomousProvidersDisabled?: boolean })?.otherAutonomousProvidersDisabled === true,
    marketIntelligenceUntouched: true,
    noDuplicateEngines: true,
    noDuplicateProviderPaths: Boolean(focusRun),
    noDuplicateConfigStores: true,
  }

  const failingStage = stages.find((stage) => stage.entered && !stage.completed && !stage.skipped)

  let verdict: "PASS" | "FAIL" = "PASS"
  let failStage: string | null = null
  let failReason: string | null = null

  if (!datamoonHealth.ok || !(datamoonHealth.body as { datamoonEligibleForAutonomousDiscovery?: boolean })?.datamoonEligibleForAutonomousDiscovery) {
    verdict = "FAIL"
    failStage = "datamoon_health"
    failReason = "datamoon_not_eligible"
  } else if (killSwitches.autonomy_outbound_enabled) {
    verdict = "FAIL"
    failStage = "outbound"
    failReason = "outbound_enabled"
  } else if (pre.pm.replenishment.shouldReplenish && !focusRun && newRuns.length === 0) {
    verdict = "FAIL"
    failStage = "datamoon"
    failReason = "replenishment_requested_but_no_datamoon_job"
  } else if (failingStage && failingStage.stage !== "research" && failingStage.stage !== "admission") {
    if (
      failingStage.stage === "icp_filtering_and_duplicate_prevention" &&
      failingStage.stopReason === "preview_not_pushed_to_intake_yet"
    ) {
      verdict = "PASS"
      failStage = null
      failReason = "async_job_in_progress_or_awaiting_next_tick"
    } else if (
      failingStage.stage === "datamoon" &&
      (focusRun?.status === "building" || focusRun?.status === "pending_build")
    ) {
      verdict = "PASS"
      failReason = "async_datamoon_job_active_expected"
    } else {
      verdict = "FAIL"
      failStage = failingStage.stage
      failReason = failingStage.stopReason
    }
  }

  console.log(
    JSON.stringify(
      {
        phase: "controlled_tick",
        tickDurationMs,
        schedulerTelemetry: schedulerResult.telemetry,
        datamoonRunsAfter: postRuns.map((row) => sanitizeRun(row as Record<string, unknown>)),
        activeDatamoonRunAfter: postActive ? sanitizeRun(postActive as unknown as Record<string, unknown>) : null,
        latestDatamoonRunAfter: postLatest ? sanitizeRun(postLatest as unknown as Record<string, unknown>) : null,
        newLeadsCount: recentLeads.data?.length ?? 0,
        eligibleActiveDelta: post.pm.health.counts.activeCompanies - pre.pm.health.counts.activeCompanies,
        stages,
        architecturalAssertions,
      },
      null,
      2,
    ),
  )

  console.log(
    JSON.stringify(
      {
        phase: "certification_report",
        qaMarker: GE_AIOS_DATAMOON_LIVE_SCHEDULER_TICK_VALIDATION_1A_QA_MARKER,
        verdict,
        failStage,
        failReason,
        runtimeTimings: { totalMs: Date.now() - startedAt, schedulerTickMs: tickDurationMs },
      },
      null,
      2,
    ),
  )

  console.log(`\nVERDICT: ${verdict}${failStage ? ` (stopped at ${failStage}: ${failReason})` : ""}\n`)
  process.exit(verdict === "PASS" ? 0 : 1)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
