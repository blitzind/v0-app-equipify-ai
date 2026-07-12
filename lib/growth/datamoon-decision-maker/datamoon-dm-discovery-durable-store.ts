/**
 * GE-AIOS-CONTACT-1B — Durable DM discovery state on existing DataMoon audience import runs.
 * No new table: lead/org/idempotency/next_poll live in provider_metadata + run_name.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createDatamoonAudienceImportRun,
  fetchDatamoonAudienceImportRunById,
  updateDatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import type { DatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { DatamoonAudienceFilter } from "@/lib/growth/providers/datamoon/datamoon-types"
import type { DatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"
import {
  DATAMOON_DM_DISCOVERY_CRITERIA_VERSION,
  DATAMOON_DM_DISCOVERY_PURPOSE,
  GROWTH_AIOS_CONTACT_1B_QA_MARKER,
  type DatamoonDmDiscoveryLifecycleStatus,
} from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"

export type DatamoonDmDiscoveryDurableRecord = {
  runId: string
  organizationId: string
  leadId: string
  companyId: string | null
  audienceId: string | null
  idempotencyKey: string
  criteriaFingerprint: string
  status: DatamoonDmDiscoveryLifecycleStatus
  requestedAt: string
  lastPollAt: string | null
  nextPollAt: string | null
  pollAttemptCount: number
  noResultAt: string | null
  failureCode: string | null
  resultCount: number | null
  providerMode: DatamoonAudienceMode
  dryRun: boolean
}

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("datamoon_audience_import_runs")
}

export function buildDatamoonDmDiscoveryRunName(input: {
  organizationId: string
  leadId: string
  criteriaFingerprint: string
}): string {
  const fp = input.criteriaFingerprint.slice(0, 48)
  return `dm-discovery:${input.organizationId}:${input.leadId}:${fp}`
}

export function buildDatamoonDmDiscoveryCriteriaFingerprint(input: {
  organizationId: string
  leadId: string
  companyName: string | null
  companyDomain: string | null
  titleFamilies: string[]
  geography?: string | null
}): string {
  const titles = [...input.titleFamilies].map((t) => t.toLowerCase().trim()).filter(Boolean).sort().join("|")
  const company = (input.companyDomain || input.companyName || "unknown").toLowerCase().trim()
  const geo = (input.geography ?? "").toLowerCase().trim()
  return [
    input.organizationId,
    input.leadId,
    company,
    titles,
    geo,
    "datamoon",
    DATAMOON_DM_DISCOVERY_CRITERIA_VERSION,
  ].join("::")
}

function readMeta(run: DatamoonAudienceImportRun): Record<string, unknown> {
  return run.providerMetadata && typeof run.providerMetadata === "object"
    ? (run.providerMetadata as Record<string, unknown>)
    : {}
}

export function mapAudienceRunToDmDiscoveryRecord(
  run: DatamoonAudienceImportRun,
): DatamoonDmDiscoveryDurableRecord | null {
  const meta = readMeta(run)
  if (meta.purpose !== DATAMOON_DM_DISCOVERY_PURPOSE) return null
  const organizationId = typeof meta.organization_id === "string" ? meta.organization_id : null
  const leadId = typeof meta.lead_id === "string" ? meta.lead_id : null
  const idempotencyKey = typeof meta.idempotency_key === "string" ? meta.idempotency_key : null
  if (!organizationId || !leadId || !idempotencyKey) return null

  let status: DatamoonDmDiscoveryLifecycleStatus = "polling"
  if (run.status === "completed") status = "completed"
  else if (run.status === "failed") {
    status =
      meta.failure_class === "terminal" ? "failed_terminal" : "failed_retryable"
  } else if (meta.lifecycle_status === "no_result") status = "no_result"
  else if (meta.lifecycle_status === "requested") status = "requested"
  else if (run.status === "building" || run.status === "pending_build") status = "polling"

  return {
    runId: run.id,
    organizationId,
    leadId,
    companyId: typeof meta.company_id === "string" ? meta.company_id : null,
    audienceId: run.datamoonAudienceId,
    idempotencyKey,
    criteriaFingerprint:
      typeof meta.criteria_fingerprint === "string" ? meta.criteria_fingerprint : "",
    status,
    requestedAt:
      typeof meta.requested_at === "string" ? meta.requested_at : run.createdAt,
    lastPollAt: run.lastPolledAt,
    nextPollAt: typeof meta.next_poll_at === "string" ? meta.next_poll_at : null,
    pollAttemptCount:
      typeof meta.poll_attempt_count === "number" ? meta.poll_attempt_count : 0,
    noResultAt: typeof meta.no_result_at === "string" ? meta.no_result_at : null,
    failureCode: typeof meta.failure_code === "string" ? meta.failure_code : run.errorMessage,
    resultCount: typeof meta.result_count === "number" ? meta.result_count : run.previewCount,
    providerMode: run.providerMode,
    dryRun: run.dryRun,
  }
}

export async function createDatamoonDmDiscoveryRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    companyId?: string | null
    companyName: string | null
    idempotencyKey: string
    criteriaFingerprint: string
    filters: DatamoonAudienceFilter[]
    titleFamilies: string[]
    providerMode: DatamoonAudienceMode
    dryRun: boolean
    now: string
    nextPollAt: string
  },
): Promise<DatamoonDmDiscoveryDurableRecord | null> {
  const runName = buildDatamoonDmDiscoveryRunName({
    organizationId: input.organizationId,
    leadId: input.leadId,
    criteriaFingerprint: input.criteriaFingerprint,
  })

  const run = await createDatamoonAudienceImportRun(admin, {
    runName,
    providerMode: input.providerMode,
    audienceType: "advanced_search",
    filters: input.filters,
    topicIds: [],
    requestedLimit: 25,
    audienceName: `DM discovery ${input.companyName ?? input.leadId}`.slice(0, 120),
    websiteId: null,
    dryRun: input.dryRun,
    createdBy: null,
  })
  if (!run) return null

  const updated = await updateDatamoonAudienceImportRun(admin, run.id, {
    status: "pending_build",
    providerMetadata: {
      qa_marker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      purpose: DATAMOON_DM_DISCOVERY_PURPOSE,
      organization_id: input.organizationId,
      lead_id: input.leadId,
      company_id: input.companyId ?? null,
      idempotency_key: input.idempotencyKey,
      criteria_fingerprint: input.criteriaFingerprint,
      criteria_version: DATAMOON_DM_DISCOVERY_CRITERIA_VERSION,
      title_families: input.titleFamilies,
      lifecycle_status: "requested",
      requested_at: input.now,
      next_poll_at: input.nextPollAt,
      poll_attempt_count: 0,
      provider: "datamoon",
    },
  })

  return mapAudienceRunToDmDiscoveryRecord(updated ?? run)
}

export async function findDatamoonDmDiscoveryRunByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; idempotencyKey: string },
): Promise<DatamoonDmDiscoveryDurableRecord | null> {
  // Prefer exact metadata match via recent runs for this lead-shaped run_name prefix.
  const prefix = `dm-discovery:${input.organizationId}:${input.leadId}:`
  const { data, error } = await runsTable(admin)
    .select("*")
    .like("run_name", `${prefix}%`)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error || !data) return null

  for (const row of data) {
    const run = await fetchDatamoonAudienceImportRunById(admin, String((row as { id: string }).id))
    if (!run) continue
    const mapped = mapAudienceRunToDmDiscoveryRecord(run)
    if (!mapped) continue
    if (mapped.idempotencyKey === input.idempotencyKey) return mapped
  }
  return null
}

export async function fetchDatamoonDmDiscoveryRunById(
  admin: SupabaseClient,
  runId: string,
): Promise<DatamoonDmDiscoveryDurableRecord | null> {
  const run = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!run) return null
  return mapAudienceRunToDmDiscoveryRecord(run)
}

export async function patchDatamoonDmDiscoveryRun(
  admin: SupabaseClient,
  runId: string,
  patch: {
    audienceId?: string | null
    status?: "pending_build" | "building" | "completed" | "failed"
    lifecycleStatus?: DatamoonDmDiscoveryLifecycleStatus
    lastPollAt?: string | null
    nextPollAt?: string | null
    pollAttemptCount?: number
    noResultAt?: string | null
    failureCode?: string | null
    failureClass?: "retryable" | "terminal" | null
    resultCount?: number | null
    extraMetadata?: Record<string, unknown>
  },
): Promise<DatamoonDmDiscoveryDurableRecord | null> {
  const existing = await fetchDatamoonAudienceImportRunById(admin, runId)
  if (!existing) return null
  const meta = {
    ...readMeta(existing),
    ...(patch.extraMetadata ?? {}),
  }
  if (patch.lifecycleStatus !== undefined) meta.lifecycle_status = patch.lifecycleStatus
  if (patch.nextPollAt !== undefined) meta.next_poll_at = patch.nextPollAt
  if (patch.pollAttemptCount !== undefined) meta.poll_attempt_count = patch.pollAttemptCount
  if (patch.noResultAt !== undefined) meta.no_result_at = patch.noResultAt
  if (patch.failureCode !== undefined) meta.failure_code = patch.failureCode
  if (patch.failureClass !== undefined) meta.failure_class = patch.failureClass
  if (patch.resultCount !== undefined) meta.result_count = patch.resultCount

  const updated = await updateDatamoonAudienceImportRun(admin, runId, {
    datamoonAudienceId: patch.audienceId !== undefined ? patch.audienceId : undefined,
    status: patch.status,
    lastPolledAt: patch.lastPollAt,
    completedAt: patch.status === "completed" ? new Date().toISOString() : undefined,
    errorMessage: patch.failureCode ?? undefined,
    previewCount: patch.resultCount ?? undefined,
    providerMetadata: meta,
  })
  return updated ? mapAudienceRunToDmDiscoveryRecord(updated) : null
}

export async function listDueDatamoonDmDiscoveryRuns(
  admin: SupabaseClient,
  input: { organizationId: string; now: string; limit?: number },
): Promise<DatamoonDmDiscoveryDurableRecord[]> {
  const limit = input.limit ?? 25
  const { data, error } = await runsTable(admin)
    .select("*")
    .like("run_name", `dm-discovery:${input.organizationId}:%`)
    .in("status", ["pending_build", "building"])
    .order("updated_at", { ascending: true })
    .limit(limit * 3)

  if (error || !data) return []

  const due: DatamoonDmDiscoveryDurableRecord[] = []
  const nowMs = Date.parse(input.now)
  for (const row of data) {
    const run = await fetchDatamoonAudienceImportRunById(admin, String((row as { id: string }).id))
    if (!run) continue
    const mapped = mapAudienceRunToDmDiscoveryRecord(run)
    if (!mapped) continue
    if (mapped.organizationId !== input.organizationId) continue
    const nextMs = mapped.nextPollAt ? Date.parse(mapped.nextPollAt) : 0
    if (Number.isFinite(nextMs) && nextMs > nowMs) continue
    due.push(mapped)
    if (due.length >= limit) break
  }
  return due
}
