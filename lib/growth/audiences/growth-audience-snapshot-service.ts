import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  consumeAudienceGenerationBudget,
  consumeAudienceRefreshBudget,
  consumeAudienceSearchPageBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import {
  createGrowthAudienceRefreshRun,
  createGrowthAudienceSnapshotShell,
  finalizeGrowthAudienceSnapshot,
  getGrowthAudience,
  getGrowthAudienceRefreshRun,
  getGrowthAudienceSnapshot,
  insertGrowthAudienceMembersBatch,
  updateGrowthAudienceRefreshRun,
} from "@/lib/growth/audiences/growth-audience-repository"
import type {
  GrowthAudienceSnapshotProgress,
} from "@/lib/growth/audiences/growth-audience-types"
import { getProspectSearchSavedSearch } from "@/lib/growth/prospect-search/saved-searches"
import { parseSavedSearchWorkflowMetadata } from "@/lib/growth/prospect-search/saved-search-workflows"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type SnapshotCursor = { page: number }

function encodeCursor(cursor: SnapshotCursor): string {
  return JSON.stringify(cursor)
}

function decodeCursor(raw: string | null): SnapshotCursor {
  if (!raw) return { page: 1 }
  try {
    const parsed = JSON.parse(raw) as Partial<SnapshotCursor>
    return { page: Math.max(1, Number(parsed.page ?? 1)) }
  } catch {
    return { page: 1 }
  }
}

function computeSearchHash(input: {
  query: string
  filters: unknown
  discoveryMode: string
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32)
}

function mapCompanyToMember(row: GrowthProspectSearchCompanyResult) {
  return {
    leadId: row.growth_lead_id ?? null,
    companyId: row.id ?? null,
    fitScore: row.lead_engine_score ?? row.company_match_confidence ?? null,
    intentScore: row.intent_score ?? null,
    engagementScore: row.lead_score ?? null,
    revenueScore: row.lead_score ?? null,
  }
}

function buildProgress(
  run: Awaited<ReturnType<typeof getGrowthAudienceRefreshRun>>,
  hasMore: boolean,
): GrowthAudienceSnapshotProgress {
  if (!run) {
    throw new Error("refresh_run_missing")
  }
  return {
    refreshRunId: run.id,
    snapshotId: run.snapshotId,
    status: run.status,
    processedCount: run.processedCount,
    remainingEstimate: run.remainingEstimate,
    snapshotCursor: run.snapshotCursor,
    hasMore,
    memberCount: run.processedCount,
    rowsRead: run.rowsRead,
    rowsWritten: run.rowsWritten,
    durationMs: run.durationMs,
    error: run.error,
  }
}

export async function startAudienceSnapshotGeneration(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    isRefresh: boolean
  },
): Promise<GrowthAudienceSnapshotProgress> {
  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }

  const budget = input.isRefresh
    ? await consumeAudienceRefreshBudget(admin, {
        organizationId: input.organizationId,
        userId: input.userId,
      })
    : { allowed: true as const, reason: null }

  if (!budget.allowed) {
    const run = await createGrowthAudienceRefreshRun(admin, {
      audienceId: input.audienceId,
      organizationId: input.organizationId,
      initiatedBy: input.userId,
    })
    await updateGrowthAudienceRefreshRun(admin, run.id, {
      status: "throttled",
      error: budget.reason,
    })
    return buildProgress(await getGrowthAudienceRefreshRun(admin, run.id), false)
  }

  const generationBudget = await consumeAudienceGenerationBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })

  if (!generationBudget.allowed) {
    const run = await createGrowthAudienceRefreshRun(admin, {
      audienceId: input.audienceId,
      organizationId: input.organizationId,
      initiatedBy: input.userId,
    })
    await updateGrowthAudienceRefreshRun(admin, run.id, {
      status: "throttled",
      error: generationBudget.reason,
    })
    return buildProgress(await getGrowthAudienceRefreshRun(admin, run.id), false)
  }

  const savedSearch = await getProspectSearchSavedSearch(admin, audience.savedSearchId)
  if (!savedSearch) throw new Error("saved_search_not_found")

  const workflow = parseSavedSearchWorkflowMetadata(savedSearch.metadata)
  const searchHash = computeSearchHash({
    query: savedSearch.query_text,
    filters: savedSearch.filters,
    discoveryMode: workflow.discoveryMode ?? "internal",
  })

  const snapshot = await createGrowthAudienceSnapshotShell(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    searchHash,
    generatedBy: input.userId,
  })

  const run = await createGrowthAudienceRefreshRun(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    initiatedBy: input.userId,
    snapshotId: snapshot.id,
  })

  await recordRuntimeHealthWrite(admin, 3)
  return processAudienceSnapshotBatch(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    userId: input.userId,
    refreshRunId: run.id,
    snapshotId: snapshot.id,
    previousMemberCount: audience.memberCount ?? 0,
    startedAt: Date.now(),
  })
}

export async function continueAudienceSnapshotGeneration(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    refreshRunId: string
  },
): Promise<GrowthAudienceSnapshotProgress> {
  const run = await getGrowthAudienceRefreshRun(admin, input.refreshRunId)
  if (!run || run.audienceId !== input.audienceId || run.organizationId !== input.organizationId) {
    throw new Error("refresh_run_not_found")
  }
  if (run.status !== "in_progress") {
    return buildProgress(run, false)
  }
  if (!run.snapshotId) throw new Error("snapshot_missing")

  const audience = await getGrowthAudience(admin, input.audienceId)
  const previousMemberCount =
    audience?.lastSnapshotId && audience.lastSnapshotId !== run.snapshotId
      ? (audience.memberCount ?? 0)
      : 0

  return processAudienceSnapshotBatch(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    userId: input.userId,
    refreshRunId: run.id,
    snapshotId: run.snapshotId,
    previousMemberCount,
    startedAt: Date.now() - (run.durationMs ?? 0),
  })
}

async function processAudienceSnapshotBatch(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    refreshRunId: string
    snapshotId: string
    previousMemberCount: number
    startedAt: number
  },
): Promise<GrowthAudienceSnapshotProgress> {
  const run = await getGrowthAudienceRefreshRun(admin, input.refreshRunId)
  if (!run) throw new Error("refresh_run_not_found")

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience) throw new Error("audience_not_found")

  const savedSearch = await getProspectSearchSavedSearch(admin, audience.savedSearchId)
  if (!savedSearch) throw new Error("saved_search_not_found")

  const workflow = parseSavedSearchWorkflowMetadata(savedSearch.metadata)
  const cursor = decodeCursor(run.snapshotCursor)
  const memberCap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT
  const pageSize = GROWTH_AUDIENCE_LIMITS.SNAPSHOT_SEARCH_PAGE_SIZE

  if (run.processedCount >= memberCap) {
    const durationMs = Date.now() - input.startedAt
    const { membersAdded, membersRemoved } = await finalizeGrowthAudienceSnapshot(admin, {
      audienceId: input.audienceId,
      snapshotId: input.snapshotId,
      memberCount: run.processedCount,
      generationDurationMs: durationMs,
      previousMemberCount: input.previousMemberCount,
    })
    const completed = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "completed",
      durationMs,
      membersAdded,
      membersRemoved,
      remainingEstimate: 0,
    })
    return buildProgress(completed, false)
  }

  const searchBudget = await consumeAudienceSearchPageBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })
  if (!searchBudget.allowed) {
    const throttled = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "throttled",
      error: searchBudget.reason,
      durationMs: Date.now() - input.startedAt,
    })
    return buildProgress(throttled, false)
  }

  try {
    await recordRuntimeHealthRead(admin, 5)
    const searchResult = await runProspectSearch(admin, {
      query: savedSearch.query_text,
      filters: savedSearch.filters,
      page: cursor.page,
      page_size: pageSize,
      discovery_mode: workflow.discoveryMode ?? "internal",
      result_mode: "companies",
      created_by: input.userId,
    })

    const companies = searchResult.companies ?? []
    const remainingCapacity = memberCap - run.processedCount
    const slice = companies.slice(0, remainingCapacity)
    const memberRows = slice.map((company) => ({
      snapshotId: input.snapshotId,
      organizationId: input.organizationId,
      ...mapCompanyToMember(company),
    }))

    const written = await insertGrowthAudienceMembersBatch(admin, memberRows)
    const processedCount = run.processedCount + written
    const totalEstimate = searchResult.total_companies ?? processedCount
    const remainingEstimate = Math.max(0, Math.min(totalEstimate - processedCount, memberCap - processedCount))
    const hasNextPage = Boolean(searchResult.has_next_page) && processedCount < memberCap && slice.length > 0
    const nextCursor = encodeCursor({ page: cursor.page + 1 })

    const rowsRead = run.rowsRead + slice.length + 3
    const rowsWritten = run.rowsWritten + written

    if (hasNextPage && processedCount < memberCap) {
      const updated = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
        snapshotCursor: nextCursor,
        processedCount,
        remainingEstimate,
        rowsRead,
        rowsWritten,
        status: "in_progress",
      })
      await recordRuntimeHealthWrite(admin, written + 2)
      logGrowthEngine("audience_snapshot_batch", {
        qa_marker: GROWTH_AUDIENCE_QA_MARKER,
        audience_id: input.audienceId,
        refresh_run_id: input.refreshRunId,
        page: cursor.page,
        processed_count: processedCount,
        remaining_estimate: remainingEstimate,
      })
      return buildProgress(updated, true)
    }

    const durationMs = Date.now() - input.startedAt
    const { membersAdded, membersRemoved } = await finalizeGrowthAudienceSnapshot(admin, {
      audienceId: input.audienceId,
      snapshotId: input.snapshotId,
      memberCount: processedCount,
      generationDurationMs: durationMs,
      previousMemberCount: input.previousMemberCount,
    })

    const completed = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "completed",
      durationMs,
      membersAdded,
      membersRemoved,
      snapshotCursor: nextCursor,
      processedCount,
      remainingEstimate: 0,
      rowsRead,
      rowsWritten,
    })

    await recordRuntimeHealthWrite(admin, written + 4)
    logGrowthEngine("audience_snapshot_completed", {
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      audience_id: input.audienceId,
      snapshot_id: input.snapshotId,
      member_count: processedCount,
      duration_ms: durationMs,
    })

    return buildProgress(completed, false)
  } catch (error) {
    const message = error instanceof Error ? error.message : "snapshot_batch_failed"
    await recordAudienceGuardrailFailure(admin, message)
    const failed = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "failed",
      error: message,
      durationMs: Date.now() - input.startedAt,
    })
    return buildProgress(failed, false)
  }
}
