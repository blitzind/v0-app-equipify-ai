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
    const run = {
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
      status: row.status,
      recordCount: row.record_count ?? 0,
      loadingCount: row.loading_count ?? 0,
      previewCount: row.preview_count ?? 0,
      importedCount: row.imported_count ?? 0,
      duplicateCount: row.duplicate_count ?? 0,
      skippedCount: row.skipped_count ?? 0,
      errorCount: row.error_count ?? 0,
      providerMetadata: (row.provider_metadata as Record<string, unknown>) ?? {},
      errorMessage: (row.error_message as string | null) ?? null,
      dryRun: row.dry_run === true,
      createdBy: (row.created_by as string | null) ?? null,
      lastPolledAt: (row.last_polled_at as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      importedAt: (row.imported_at as string | null) ?? null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    } satisfies DatamoonAudienceImportRun

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
