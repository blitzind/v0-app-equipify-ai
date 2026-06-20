import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import {
  createGrowthAudienceEnrollmentRun,
  getGrowthAudienceEnrollmentPreview,
  getGrowthAudienceEnrollmentRun,
  listEligiblePreviewLeadIds,
  listGrowthAudienceEnrollmentPreviewMembers,
  updateGrowthAudienceEnrollmentRun,
} from "@/lib/growth/audiences/growth-audience-enrollment-repository"
import {
  checkAudienceEnrollmentEnabled,
  consumeAudienceEnrollmentBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import {
  getGrowthAudience,
  listGrowthAudienceMembers,
} from "@/lib/growth/audiences/growth-audience-repository"
import type { GrowthAudienceEnrollmentRunProgress } from "@/lib/growth/audiences/growth-audience-types"
import { bulkEnrollLeadsInGrowthSequence } from "@/lib/growth/sequence-enrollment/bulk-sequence-enrollment"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type RunCursor = { leadOffset: number }

function encodeRunCursor(cursor: RunCursor): string {
  return JSON.stringify(cursor)
}

function decodeRunCursor(raw: string | null): RunCursor {
  if (!raw) return { leadOffset: 0 }
  try {
    const parsed = JSON.parse(raw) as Partial<RunCursor>
    return { leadOffset: Math.max(0, Number(parsed.leadOffset ?? 0)) }
  } catch {
    return { leadOffset: 0 }
  }
}

function buildRunProgress(
  run: Awaited<ReturnType<typeof getGrowthAudienceEnrollmentRun>>,
  hasMore: boolean,
): GrowthAudienceEnrollmentRunProgress {
  if (!run) throw new Error("enrollment_run_missing")
  return {
    runId: run.id,
    status: run.status,
    requestedCount: run.requestedCount,
    enrolledCount: run.enrolledCount,
    skippedCount: run.skippedCount,
    failedCount: run.failedCount,
    processedCount: run.processedCount,
    hasMore,
    rowsRead: run.rowsRead,
    rowsWritten: run.rowsWritten,
    durationMs: run.durationMs,
    error: run.error,
  }
}

async function resolveLeadIdsForRun(
  admin: SupabaseClient,
  input: {
    snapshotId: string
    previewId?: string | null
    memberIds?: string[]
    enrollEligible?: boolean
    enrollAll?: boolean
  },
): Promise<string[]> {
  if (input.previewId && input.enrollEligible) {
    return listEligiblePreviewLeadIds(admin, input.previewId)
  }

  if (input.previewId) {
    const { items } = await listGrowthAudienceEnrollmentPreviewMembers(admin, {
      previewId: input.previewId,
      category: "eligible",
      limit: GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN,
    })
    return [...new Set(items.map((m) => m.leadId).filter(Boolean) as string[])]
  }

  const { items } = await listGrowthAudienceMembers(admin, {
    snapshotId: input.snapshotId,
    limit: input.enrollAll ? GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT : 200,
  })

  let selected = items
  if (input.memberIds?.length) {
    const idSet = new Set(input.memberIds)
    selected = items.filter((m) => idSet.has(m.id))
  }

  return [...new Set(selected.map((m) => m.leadId).filter(Boolean) as string[])]
}

export async function startAudienceEnrollmentRun(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    userEmail: string
    snapshotId: string
    sequencePatternId: string
    previewId?: string | null
    memberIds?: string[]
    enrollEligible?: boolean
    enrollAll?: boolean
    startImmediately?: boolean
    dryRun?: boolean
  },
): Promise<GrowthAudienceEnrollmentRunProgress> {
  const enabled = await checkAudienceEnrollmentEnabled(admin)
  if (!enabled.allowed) {
    throw new Error(enabled.reason ?? "enrollment_disabled")
  }

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }

  if (input.previewId) {
    const preview = await getGrowthAudienceEnrollmentPreview(admin, input.previewId)
    if (!preview || preview.audienceId !== input.audienceId) {
      throw new Error("preview_not_found")
    }
    if (preview.status !== "completed") {
      throw new Error("preview_not_ready")
    }
  }

  const leadIds = await resolveLeadIdsForRun(admin, input)
  const perRunCap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENTS_PER_RUN
  const requestedLeadIds = leadIds.slice(0, perRunCap)

  if (requestedLeadIds.length === 0) {
    throw new Error("no_enrollable_leads")
  }

  const budget = await consumeAudienceEnrollmentBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
    volume: requestedLeadIds.length,
  })
  if (!budget.allowed) {
    throw new Error(budget.reason ?? "enrollment_budget_exceeded")
  }

  const run = await createGrowthAudienceEnrollmentRun(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    snapshotId: input.snapshotId,
    previewId: input.previewId ?? null,
    sequencePatternId: input.sequencePatternId,
    requestedCount: requestedLeadIds.length,
    startImmediately: input.startImmediately ?? false,
    dryRun: input.dryRun ?? false,
    initiatedBy: input.userId,
  })

  return processAudienceEnrollmentRunBatch(admin, {
    runId: run.id,
    leadIds: requestedLeadIds,
    userId: input.userId,
    userEmail: input.userEmail,
    sequencePatternId: input.sequencePatternId,
    startImmediately: input.startImmediately ?? false,
    dryRun: input.dryRun ?? false,
    startedAt: Date.now(),
  })
}

export async function continueAudienceEnrollmentRun(
  admin: SupabaseClient,
  input: {
    audienceId: string
    runId: string
    userId: string
    userEmail: string
  },
): Promise<GrowthAudienceEnrollmentRunProgress> {
  const run = await getGrowthAudienceEnrollmentRun(admin, input.runId)
  if (!run || run.audienceId !== input.audienceId) {
    throw new Error("enrollment_run_not_found")
  }
  if (run.status !== "in_progress") {
    return buildRunProgress(run, false)
  }

  const allLeadIds = await resolveLeadIdsForRun(admin, {
    snapshotId: run.snapshotId,
    previewId: run.previewId,
    enrollEligible: Boolean(run.previewId),
  })

  return processAudienceEnrollmentRunBatch(admin, {
    runId: run.id,
    leadIds: allLeadIds.slice(0, run.requestedCount),
    userId: input.userId,
    userEmail: input.userEmail,
    sequencePatternId: run.sequencePatternId,
    startImmediately: run.startImmediately,
    dryRun: run.dryRun,
    startedAt: Date.now() - (run.durationMs ?? 0),
    accum: {
      enrolled: run.enrolledCount,
      skipped: run.skippedCount,
      failed: run.failedCount,
      rowsRead: run.rowsRead,
      rowsWritten: run.rowsWritten,
      cursor: decodeRunCursor(run.runCursor),
    },
  })
}

async function processAudienceEnrollmentRunBatch(
  admin: SupabaseClient,
  input: {
    runId: string
    leadIds: string[]
    userId: string
    userEmail: string
    sequencePatternId: string
    startImmediately: boolean
    dryRun: boolean
    startedAt: number
    accum?: {
      enrolled: number
      skipped: number
      failed: number
      rowsRead: number
      rowsWritten: number
      cursor: RunCursor
    }
  },
): Promise<GrowthAudienceEnrollmentRunProgress> {
  const run = await getGrowthAudienceEnrollmentRun(admin, input.runId)
  if (!run) throw new Error("enrollment_run_missing")
  if (run.status === "cancelled") {
    return buildRunProgress(run, false)
  }

  const cursor = input.accum?.cursor ?? decodeRunCursor(run.runCursor)
  const batchSize = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_ENROLLMENT_BATCH
  const slice = input.leadIds.slice(cursor.leadOffset, cursor.leadOffset + batchSize)

  let enrolled = input.accum?.enrolled ?? run.enrolledCount
  let skipped = input.accum?.skipped ?? run.skippedCount
  let failed = input.accum?.failed ?? run.failedCount
  let rowsRead = input.accum?.rowsRead ?? run.rowsRead
  let rowsWritten = input.accum?.rowsWritten ?? run.rowsWritten

  if (slice.length > 0) {
    rowsRead += slice.length + 2
    try {
      const bulk = await bulkEnrollLeadsInGrowthSequence(admin, {
        leadIds: slice,
        sequencePatternId: input.sequencePatternId,
        ownerUserId: input.userId,
        actingUserId: input.userId,
        actingUserEmail: input.userEmail,
        startImmediately: input.startImmediately,
        dryRun: input.dryRun,
      })
      enrolled += bulk.enrolled.length
      skipped += bulk.skippedAlreadyEnrolled.length + bulk.skippedBlocked.length
      failed += bulk.failed.length
      rowsWritten += bulk.enrolled.length + 2
    } catch (error) {
      const message = error instanceof Error ? error.message : "enrollment_batch_failed"
      await recordAudienceGuardrailFailure(admin, message)
      failed += slice.length
    }
  }

  const processedCount = enrolled + skipped + failed
  const nextOffset = cursor.leadOffset + slice.length
  const hasMore = nextOffset < input.leadIds.length && slice.length === batchSize

  const durationMs = Date.now() - input.startedAt
  const updated = await updateGrowthAudienceEnrollmentRun(admin, input.runId, {
    status: hasMore ? "in_progress" : "completed",
    enrolledCount: enrolled,
    skippedCount: skipped,
    failedCount: failed,
    processedCount,
    runCursor: encodeRunCursor({ leadOffset: nextOffset }),
    rowsRead,
    rowsWritten,
    durationMs,
  })

  await recordRuntimeHealthRead(admin, rowsRead - (input.accum?.rowsRead ?? run.rowsRead))
  await recordRuntimeHealthWrite(admin, rowsWritten - (input.accum?.rowsWritten ?? run.rowsWritten))

  logGrowthEngine("audience_enrollment_run_batch", {
    qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    run_id: input.runId,
    enrolled,
    skipped,
    failed,
    has_more: hasMore,
  })

  return buildRunProgress(updated, hasMore)
}

export async function cancelAudienceEnrollmentRun(
  admin: SupabaseClient,
  input: { runId: string; audienceId: string },
): Promise<GrowthAudienceEnrollmentRunProgress> {
  const run = await getGrowthAudienceEnrollmentRun(admin, input.runId)
  if (!run || run.audienceId !== input.audienceId) {
    throw new Error("enrollment_run_not_found")
  }

  const updated = await updateGrowthAudienceEnrollmentRun(admin, input.runId, {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    error: "Cancelled by operator.",
  })
  return buildRunProgress(updated, false)
}
