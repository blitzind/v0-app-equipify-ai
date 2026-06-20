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
import { computeAndPersistAudienceSnapshotDiff } from "@/lib/growth/audiences/growth-audience-diff-service"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import type { GrowthAudienceResultMode } from "@/lib/growth/audiences/growth-audience-config"
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
import type { GrowthAudienceSnapshotProgress } from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import { getProspectSearchSavedSearch } from "@/lib/growth/prospect-search/saved-searches"
import { parseSavedSearchWorkflowMetadata } from "@/lib/growth/prospect-search/saved-search-workflows"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchPersonResult,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type SnapshotCursor = { page: number; peopleCursor?: string | null }

function encodeCursor(cursor: SnapshotCursor): string {
  return JSON.stringify(cursor)
}

function decodeCursor(raw: string | null): SnapshotCursor {
  if (!raw) return { page: 1, peopleCursor: null }
  try {
    const parsed = JSON.parse(raw) as Partial<SnapshotCursor>
    return {
      page: Math.max(1, Number(parsed.page ?? 1)),
      peopleCursor: parsed.peopleCursor ?? null,
    }
  } catch {
    return { page: 1, peopleCursor: null }
  }
}

function computeSearchHash(input: {
  query: string
  filters: unknown
  discoveryMode: string
  resultMode: GrowthAudienceResultMode
}): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32)
}

function mapCompanyToMember(row: GrowthProspectSearchCompanyResult) {
  const companyId = row.id ?? null
  return {
    memberKey: companyId,
    memberKind: "company" as const,
    leadId: row.growth_lead_id ?? null,
    companyId,
    companyName: row.company_name ?? null,
    companyRelationshipJson: {
      source_type: row.source_type,
      company_id: companyId,
      website: row.website ?? null,
    },
    fitScore: row.lead_engine_score ?? row.company_match_confidence ?? null,
    intentScore: row.intent_score ?? null,
    engagementScore: row.lead_score ?? null,
    revenueScore: row.lead_score ?? null,
  }
}

function mapPersonToMember(
  row: GrowthProspectSearchPeopleResultRow | GrowthProspectSearchPersonResult,
  company?: GrowthProspectSearchCompanyResult,
) {
  const contactId =
    "contact_id" in row && row.contact_id ? row.contact_id : row.id
  const companyId = row.company_id ?? company?.id ?? null
  const sourceType = row.source_type
  const memberKey = `${sourceType}:${companyId}:${contactId}`

  return {
    memberKey,
    memberKind: "person" as const,
    leadId: company?.growth_lead_id ?? null,
    companyId,
    growthPersonId: contactId,
    canonicalPersonId: contactId,
    companyName: row.company_name ?? company?.company_name ?? null,
    personName: row.full_name ?? null,
    personTitle: row.title ?? null,
    companyRelationshipJson: {
      source_type: sourceType,
      company_id: companyId,
      contact_id: contactId,
    },
    fitScore: "rank_score" in row ? row.rank_score : null,
    intentScore: company?.intent_score ?? null,
    engagementScore: company?.lead_score ?? null,
    revenueScore: company?.lead_score ?? null,
  }
}

function buildProgress(
  run: Awaited<ReturnType<typeof getGrowthAudienceRefreshRun>>,
  hasMore: boolean,
  diff?: { addedCount: number; removedCount: number; unchangedCount: number },
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
    addedCount: diff?.addedCount,
    removedCount: diff?.removedCount,
    unchangedCount: diff?.unchangedCount,
  }
}

async function finalizeWithDiff(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    memberCount: number
    generationDurationMs: number
    previousSnapshotId: string | null
    previousMemberCount: number
    refreshPolicy: GrowthAudience["refreshPolicy"]
    resultMode: GrowthAudienceResultMode
  },
): Promise<{ membersAdded: number; membersRemoved: number; unchangedCount: number }> {
  let addedCount: number | undefined
  let removedCount: number | undefined
  let unchangedCount: number | undefined

  if (input.previousSnapshotId && input.previousSnapshotId !== input.snapshotId) {
    const diff = await computeAndPersistAudienceSnapshotDiff(admin, {
      audienceId: input.audienceId,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      previousSnapshotId: input.previousSnapshotId,
      memberKind: input.resultMode === "people" ? "person" : "company",
    })
    if (diff.status === "completed") {
      addedCount = diff.addedCount
      removedCount = diff.removedCount
      unchangedCount = diff.unchangedCount
    }
  }

  const { membersAdded, membersRemoved } = await finalizeGrowthAudienceSnapshot(admin, {
    audienceId: input.audienceId,
    snapshotId: input.snapshotId,
    memberCount: input.memberCount,
    generationDurationMs: input.generationDurationMs,
    previousSnapshotId: input.previousSnapshotId,
    previousMemberCount: input.previousMemberCount,
    addedCount,
    removedCount,
    unchangedCount,
    refreshPolicy: input.refreshPolicy,
  })

  return {
    membersAdded,
    membersRemoved,
    unchangedCount: unchangedCount ?? Math.max(0, input.memberCount - membersAdded),
  }
}

type GrowthAudience = Awaited<ReturnType<typeof getGrowthAudience>>

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
  const resultMode = audience.resultMode ?? "companies"
  const searchHash = computeSearchHash({
    query: savedSearch.query_text,
    filters: savedSearch.filters,
    discoveryMode: workflow.discoveryMode ?? "internal",
    resultMode,
  })

  const previousSnapshotId = input.isRefresh ? audience.lastSnapshotId : null
  const previousMemberCount =
    previousSnapshotId && audience.memberCount != null ? audience.memberCount : 0

  const snapshot = await createGrowthAudienceSnapshotShell(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    searchHash,
    generatedBy: input.userId,
    previousSnapshotId,
    resultMode,
  })

  const run = await createGrowthAudienceRefreshRun(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    initiatedBy: input.userId,
    snapshotId: snapshot.id,
  })

  await recordRuntimeHealthWrite(admin, 3)
  return processAudienceSnapshotBatch(admin, {
    audience,
    organizationId: input.organizationId,
    userId: input.userId,
    refreshRunId: run.id,
    snapshotId: snapshot.id,
    previousSnapshotId,
    previousMemberCount,
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
  if (!audience) throw new Error("audience_not_found")

  const snapshot = await getGrowthAudienceSnapshot(admin, run.snapshotId)
  const previousSnapshotId = snapshot?.previousSnapshotId ?? null
  const previousMemberCount = snapshot?.previousMemberCount ?? 0

  return processAudienceSnapshotBatch(admin, {
    audience,
    organizationId: input.organizationId,
    userId: input.userId,
    refreshRunId: run.id,
    snapshotId: run.snapshotId,
    previousSnapshotId,
    previousMemberCount,
    startedAt: Date.now() - (run.durationMs ?? 0),
  })
}

async function processAudienceSnapshotBatch(
  admin: SupabaseClient,
  input: {
    audience: NonNullable<GrowthAudience>
    organizationId: string
    userId: string
    refreshRunId: string
    snapshotId: string
    previousSnapshotId: string | null
    previousMemberCount: number
    startedAt: number
  },
): Promise<GrowthAudienceSnapshotProgress> {
  const run = await getGrowthAudienceRefreshRun(admin, input.refreshRunId)
  if (!run) throw new Error("refresh_run_not_found")

  const savedSearch = await getProspectSearchSavedSearch(admin, input.audience.savedSearchId)
  if (!savedSearch) throw new Error("saved_search_not_found")

  const workflow = parseSavedSearchWorkflowMetadata(savedSearch.metadata)
  const resultMode = input.audience.resultMode ?? "companies"
  const cursor = decodeCursor(run.snapshotCursor)
  const memberCap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT
  const pageSize = GROWTH_AUDIENCE_LIMITS.SNAPSHOT_SEARCH_PAGE_SIZE

  if (run.processedCount >= memberCap) {
    const durationMs = Date.now() - input.startedAt
    const diff = await finalizeWithDiff(admin, {
      audienceId: input.audience.id,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      memberCount: run.processedCount,
      generationDurationMs: durationMs,
      previousSnapshotId: input.previousSnapshotId,
      previousMemberCount: input.previousMemberCount,
      refreshPolicy: input.audience.refreshPolicy,
      resultMode,
    })
    const completed = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "completed",
      durationMs,
      membersAdded: diff.membersAdded,
      membersRemoved: diff.membersRemoved,
      remainingEstimate: 0,
    })
    return buildProgress(completed, false, {
      addedCount: diff.membersAdded,
      removedCount: diff.membersRemoved,
      unchangedCount: diff.unchangedCount,
    })
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
      result_mode: resultMode,
      people_cursor: cursor.peopleCursor ?? undefined,
      created_by: input.userId,
    })

    const remainingCapacity = memberCap - run.processedCount
    let memberRows: Parameters<typeof insertGrowthAudienceMembersBatch>[1] = []
    let totalEstimate = run.processedCount
    let hasNextPage = false
    let nextCursor: SnapshotCursor = { page: cursor.page + 1, peopleCursor: null }

    if (resultMode === "people") {
      const rawPeople = searchResult.people_rows?.length
        ? searchResult.people_rows
        : (searchResult.people ?? [])
      const companies = searchResult.companies ?? []
      const slice = rawPeople.slice(0, remainingCapacity)

      memberRows = slice.map((row) => {
        const mapped =
          "contact_id" in row
            ? mapPersonToMember(
                row,
                companies.find((c) => c.id === row.company_id) ??
                  ("company" in row ? row.company : undefined),
              )
            : mapPersonToMember(
                row,
                companies.find((c) => c.id === row.company_id),
              )
        return {
          snapshotId: input.snapshotId,
          organizationId: input.organizationId,
          ...mapped,
        }
      })

      totalEstimate = searchResult.total_people ?? memberRows.length + run.processedCount
      hasNextPage =
        Boolean(searchResult.has_next_page || searchResult.people_next_cursor) &&
        run.processedCount + memberRows.length < memberCap &&
        memberRows.length > 0
      nextCursor = {
        page: cursor.page + 1,
        peopleCursor: searchResult.people_next_cursor ?? searchResult.people_cursor ?? null,
      }
    } else {
      const companies = searchResult.companies ?? []
      const slice = companies.slice(0, remainingCapacity)
      memberRows = slice.map((company) => ({
        snapshotId: input.snapshotId,
        organizationId: input.organizationId,
        ...mapCompanyToMember(company),
      }))
      totalEstimate = searchResult.total_companies ?? run.processedCount + slice.length
      hasNextPage =
        Boolean(searchResult.has_next_page) &&
        run.processedCount + slice.length < memberCap &&
        slice.length > 0
      nextCursor = { page: cursor.page + 1, peopleCursor: null }
    }

    const written = await insertGrowthAudienceMembersBatch(admin, memberRows)
    const processedCount = run.processedCount + written
    const remainingEstimate = Math.max(
      0,
      Math.min(totalEstimate - processedCount, memberCap - processedCount),
    )
    hasNextPage = hasNextPage && processedCount < memberCap

    const rowsRead = run.rowsRead + memberRows.length + 3
    const rowsWritten = run.rowsWritten + written

    if (hasNextPage) {
      const updated = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
        snapshotCursor: encodeCursor(nextCursor),
        processedCount,
        remainingEstimate,
        rowsRead,
        rowsWritten,
        status: "in_progress",
      })
      await recordRuntimeHealthWrite(admin, written + 2)
      logGrowthEngine("audience_snapshot_batch", {
        qa_marker: GROWTH_AUDIENCE_QA_MARKER,
        audience_id: input.audience.id,
        refresh_run_id: input.refreshRunId,
        page: cursor.page,
        result_mode: resultMode,
        processed_count: processedCount,
        remaining_estimate: remainingEstimate,
      })
      return buildProgress(updated, true)
    }

    const durationMs = Date.now() - input.startedAt
    const diff = await finalizeWithDiff(admin, {
      audienceId: input.audience.id,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      memberCount: processedCount,
      generationDurationMs: durationMs,
      previousSnapshotId: input.previousSnapshotId,
      previousMemberCount: input.previousMemberCount,
      refreshPolicy: input.audience.refreshPolicy,
      resultMode,
    })

    const completed = await updateGrowthAudienceRefreshRun(admin, input.refreshRunId, {
      status: "completed",
      durationMs,
      membersAdded: diff.membersAdded,
      membersRemoved: diff.membersRemoved,
      snapshotCursor: encodeCursor(nextCursor),
      processedCount,
      remainingEstimate: 0,
      rowsRead,
      rowsWritten,
    })

    await recordRuntimeHealthWrite(admin, written + 4)
    logGrowthEngine("audience_snapshot_completed", {
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      audience_id: input.audience.id,
      snapshot_id: input.snapshotId,
      member_count: processedCount,
      result_mode: resultMode,
      added: diff.membersAdded,
      removed: diff.membersRemoved,
      duration_ms: durationMs,
    })

    return buildProgress(completed, false, {
      addedCount: diff.membersAdded,
      removedCount: diff.membersRemoved,
      unchangedCount: diff.unchangedCount,
    })
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
