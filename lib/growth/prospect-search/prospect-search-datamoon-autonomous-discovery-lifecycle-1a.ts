/** GE-AIOS-DATAMOON-AUTONOMOUS-DISCOVERY-CUTOVER-1A — DataMoon job lifecycle for Prospect Search (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchDatamoonAudienceImportRunById,
  updateDatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import {
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY,
  AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX,
  GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER,
  type AutonomousProspectSearchDatamoonRunMetadata,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-autonomous-discovery-types-1a"
import {
  GROWTH_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
  isRunEligibleForIntakePromotion,
  type AutonomousRunIntakeLifecycleFields,
} from "@/lib/growth/prospect-search/prospect-search-datamoon-intake-lifecycle-1f"

const ACTIVE_STATUSES = new Set(["pending_build", "building"])

export function buildAutonomousProspectSearchDatamoonProviderMetadata(
  metadata: AutonomousProspectSearchDatamoonRunMetadata,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(extra ?? {}),
    [AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY]: metadata,
  }
}

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("datamoon_audience_import_runs")
}

export function readAutonomousProspectSearchDatamoonMetadata(
  run: DatamoonAudienceImportRun,
): AutonomousProspectSearchDatamoonRunMetadata | null {
  const raw = run.providerMetadata[AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  const meta = raw as Partial<AutonomousProspectSearchDatamoonRunMetadata>
  if (
    meta.qa_marker !== GROWTH_DATAMOON_AUTONOMOUS_DISCOVERY_CUTOVER_1A_QA_MARKER ||
    typeof meta.organization_id !== "string"
  ) {
    return null
  }
  return meta as AutonomousProspectSearchDatamoonRunMetadata
}

export function readAutonomousRunIntakeLifecycleFields(
  run: DatamoonAudienceImportRun,
): AutonomousRunIntakeLifecycleFields {
  const meta = readAutonomousProspectSearchDatamoonMetadata(run)
  if (!meta) return {}
  return {
    intake_pending: meta.intake_pending,
    intake_pending_at: meta.intake_pending_at ?? null,
    intake_completed: meta.intake_completed,
    intake_completed_at: meta.intake_completed_at ?? null,
    intake_promotion_started_at: meta.intake_promotion_started_at ?? null,
    intake_selected_count: meta.intake_selected_count ?? null,
    intake_durable_disposition_count: meta.intake_durable_disposition_count ?? null,
    intake_pushed_count: meta.intake_pushed_count ?? null,
    intake_existing_count: meta.intake_existing_count ?? null,
    intake_rejected_count: meta.intake_rejected_count ?? null,
    intake_skipped_invalid_count: meta.intake_skipped_invalid_count ?? null,
    intake_error_count: meta.intake_error_count ?? null,
    intake_last_attempt_at: meta.intake_last_attempt_at ?? null,
    intake_zero_survivor_reason: meta.intake_zero_survivor_reason ?? null,
    intake_recovery_audit: meta.intake_recovery_audit ?? null,
    intake_recovery_attempt_count: meta.intake_recovery_attempt_count ?? null,
    intake_recovery_last_attempt_at: meta.intake_recovery_last_attempt_at ?? null,
    intake_enrichment_diagnostic: meta.intake_enrichment_diagnostic ?? null,
  }
}

export async function patchAutonomousRunIntakeMetadataForRecovery(
  admin: SupabaseClient,
  runId: string,
  patch: Partial<AutonomousRunIntakeLifecycleFields>,
): Promise<DatamoonAudienceImportRun | null> {
  return patchAutonomousRunIntakeMetadata(admin, runId, patch)
}

function mapRunRow(row: Record<string, unknown>): DatamoonAudienceImportRun {
  return {
    id: row.id as string,
    runName: row.run_name as string,
    datamoonAudienceId: (row.datamoon_audience_id as string | null) ?? null,
    providerMode: row.provider_mode,
    audienceType: row.audience_type,
    filters: Array.isArray(row.filters) ? row.filters : [],
    topicIds: Array.isArray(row.topic_ids) ? row.topic_ids.map(String) : [],
    requestedLimit: row.requested_limit as number | null,
    audienceName: (row.audience_name as string | null) ?? null,
    websiteId: (row.website_id as string | null) ?? null,
    status: row.status as DatamoonAudienceImportRun["status"],
    recordCount: (row.record_count as number | null) ?? 0,
    loadingCount: (row.loading_count as number | null) ?? 0,
    previewCount: (row.preview_count as number | null) ?? 0,
    importedCount: (row.imported_count as number | null) ?? 0,
    duplicateCount: (row.duplicate_count as number | null) ?? 0,
    skippedCount: (row.skipped_count as number | null) ?? 0,
    errorCount: (row.error_count as number | null) ?? 0,
    providerMetadata: (row.provider_metadata as Record<string, unknown>) ?? {},
    errorMessage: (row.error_message as string | null) ?? null,
    dryRun: row.dry_run === true,
    createdBy: (row.created_by as string | null) ?? null,
    lastPolledAt: (row.last_polled_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    importedAt: (row.imported_at as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

async function patchAutonomousRunIntakeMetadata(
  admin: SupabaseClient,
  runId: string,
  patch: Partial<AutonomousRunIntakeLifecycleFields>,
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const meta = readAutonomousProspectSearchDatamoonMetadata(existing)
  if (!meta) return null

  const nextMeta: AutonomousProspectSearchDatamoonRunMetadata = {
    ...meta,
    ...patch,
  }

  return updateDatamoonAudienceImportRun(admin, runId, {
    providerMetadata: {
      ...existing.providerMetadata,
      [AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY]: nextMeta,
      ge_aios_portfolio_intake_pending_state_1f: GROWTH_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER,
    },
  })
}

export async function markAutonomousRunIntakePending(
  admin: SupabaseClient,
  runId: string,
  generatedAt?: string,
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const intake = readAutonomousRunIntakeLifecycleFields(existing)
  if (intake.intake_completed === true) return existing
  if (intake.intake_pending === true) return existing
  return patchAutonomousRunIntakeMetadata(admin, runId, {
    intake_pending: true,
    intake_pending_at: generatedAt ?? new Date().toISOString(),
  })
}

export async function markAutonomousRunIntakePromotionStarted(
  admin: SupabaseClient,
  runId: string,
  generatedAt?: string,
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const intake = readAutonomousRunIntakeLifecycleFields(existing)
  if (intake.intake_completed === true) return existing
  if (intake.intake_promotion_started_at) return existing
  return patchAutonomousRunIntakeMetadata(admin, runId, {
    intake_promotion_started_at: generatedAt ?? new Date().toISOString(),
  })
}

export async function markAutonomousRunIntakeCompleted(
  admin: SupabaseClient,
  runId: string,
  generatedAt?: string,
  extra?: Partial<AutonomousRunIntakeLifecycleFields>,
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const intake = readAutonomousRunIntakeLifecycleFields(existing)
  if (intake.intake_completed === true) return existing
  return patchAutonomousRunIntakeMetadata(admin, runId, {
    intake_pending: false,
    intake_completed: true,
    intake_completed_at: generatedAt ?? new Date().toISOString(),
    ...extra,
  })
}

export async function recordAutonomousRunIntakePromotionAttempt(
  admin: SupabaseClient,
  runId: string,
  input: {
    generatedAt: string
    selectedCount: number
    durableDispositionCount: number
    pushed: number
    alreadyExists: number
    rejected: number
    skippedInvalid: number
    errors: number
  },
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const intake = readAutonomousRunIntakeLifecycleFields(existing)
  if (intake.intake_completed === true) return existing
  return patchAutonomousRunIntakeMetadata(admin, runId, {
    intake_pending: true,
    intake_selected_count: input.selectedCount,
    intake_durable_disposition_count: input.durableDispositionCount,
    intake_pushed_count: input.pushed,
    intake_existing_count: input.alreadyExists,
    intake_rejected_count: input.rejected,
    intake_skipped_invalid_count: input.skippedInvalid,
    intake_error_count: input.errors,
    intake_last_attempt_at: input.generatedAt,
  })
}

export async function recordAutonomousRunIntakeEnrichmentDiagnostic(
  admin: SupabaseClient,
  runId: string,
  input: {
    generatedAt: string
    normalizedCompanyCount: number
    postFilterSurvivorCount: number
    filterDiagnostics: import("@/lib/growth/prospect-search/prospect-search-external-filters").GrowthProspectSearchExternalFilterDiagnostics | null
    reason: string
  },
): Promise<DatamoonAudienceImportRun | null> {
  return patchAutonomousRunIntakeMetadata(admin, runId, {
    intake_pending: true,
    intake_completed: false,
    intake_enrichment_diagnostic: {
      qa_marker: "ge-aios-external-discovery-keyword-deferral-production-closure-1k-v1",
      recorded_at: input.generatedAt,
      normalized_company_count: input.normalizedCompanyCount,
      post_filter_survivor_count: input.postFilterSurvivorCount,
      filter_diagnostics: input.filterDiagnostics,
      reason: input.reason,
    },
  })
}

export async function findLatestIntakePendingAutonomousProspectSearchDatamoonRun(
  admin: SupabaseClient,
  organizationId: string,
): Promise<DatamoonAudienceImportRun | null> {
  const { data, error } = await runsTable(admin)
    .select("*")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .in("status", ["completed", "imported", "imported_partial"])
    .filter(
      "provider_metadata->autonomous_prospect_search_1a->>organization_id",
      "eq",
      organizationId,
    )
    .order("completed_at", { ascending: false, nullsFirst: false })
    .limit(30)

  if (error || !data) return null

  for (const row of data) {
    const run = mapRunRow(row as Record<string, unknown>)
    const intake = readAutonomousRunIntakeLifecycleFields(run)
    if (
      isRunEligibleForIntakePromotion({
        runStatus: run.status,
        intake,
      })
    ) {
      return run
    }
  }

  return null
}

export { GROWTH_PORTFOLIO_INTAKE_PENDING_STATE_1F_QA_MARKER }

export function isAutonomousProspectSearchDatamoonRun(run: DatamoonAudienceImportRun): boolean {
  return (
    run.runName.startsWith(`${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:`) ||
    readAutonomousProspectSearchDatamoonMetadata(run) != null
  )
}

export async function findActiveAutonomousProspectSearchDatamoonRun(
  admin: SupabaseClient,
  organizationId: string,
): Promise<DatamoonAudienceImportRun | null> {
  const { data, error } = await runsTable(admin)
    .select("*")
    .in("status", [...ACTIVE_STATUSES])
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error || !data) return null

  for (const row of data) {
    const run = mapRunRow(row as Record<string, unknown>)

    const meta = readAutonomousProspectSearchDatamoonMetadata(run)
    if (meta?.organization_id === organizationId) return run
  }

  return null
}

export async function findLatestAutonomousProspectSearchDatamoonRun(
  admin: SupabaseClient,
  organizationId: string,
): Promise<DatamoonAudienceImportRun | null> {
  const { data, error } = await runsTable(admin)
    .select("*")
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error || !data) return null

  for (const row of data) {
    const run = await fetchDatamoonAudienceImportRunById(admin, row.id as string)
    if (!run) continue
    const meta = readAutonomousProspectSearchDatamoonMetadata(run)
    if (meta?.organization_id === organizationId) return run
  }

  return null
}

export async function countAutonomousProspectSearchDatamoonRunsForOrganization(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await runsTable(admin)
    .select("*", { count: "exact", head: true })
    .like("run_name", `${AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_RUN_PREFIX}:%`)
    .filter(
      "provider_metadata->autonomous_prospect_search_1a->>organization_id",
      "eq",
      organizationId,
    )

  if (error || count == null) return 0
  return count
}

export async function attachAutonomousProspectSearchDatamoonMetadata(
  admin: SupabaseClient,
  runId: string,
  metadata: AutonomousProspectSearchDatamoonRunMetadata,
  extra?: Record<string, unknown>,
): Promise<DatamoonAudienceImportRun | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  return updateDatamoonAudienceImportRun(admin, runId, {
    providerMetadata: {
      ...existing.providerMetadata,
      ...extra,
      [AUTONOMOUS_PROSPECT_SEARCH_DATAMOON_METADATA_KEY]: metadata,
    },
  })
}

export const DATAMOON_AUTONOMOUS_DISCOVERY_MAX_POLL_ATTEMPTS = 1 as const

export function isDatamoonAutonomousDiscoveryRunActive(run: DatamoonAudienceImportRun): boolean {
  return ACTIVE_STATUSES.has(run.status)
}

export function isDatamoonAutonomousDiscoveryRunCompleted(run: DatamoonAudienceImportRun): boolean {
  return run.status === "completed" || run.status === "imported" || run.status === "imported_partial"
}

export function isDatamoonAutonomousDiscoveryRunFailed(run: DatamoonAudienceImportRun): boolean {
  return run.status === "failed"
}
