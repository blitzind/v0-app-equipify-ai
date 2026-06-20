import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import {
  createGrowthAudienceEnrollmentPreview,
  getGrowthAudienceEnrollmentPreview,
  insertGrowthAudienceEnrollmentPreviewMembersBatch,
  updateGrowthAudienceEnrollmentPreview,
} from "@/lib/growth/audiences/growth-audience-enrollment-repository"
import { classifyAudienceMemberEnrollmentReadiness } from "@/lib/growth/audiences/growth-audience-enrollment-readiness"
import {
  checkAudiencePreviewEnabled,
  consumeAudiencePreviewBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import {
  getGrowthAudience,
  listGrowthAudienceMembers,
} from "@/lib/growth/audiences/growth-audience-repository"
import type { GrowthAudienceEnrollmentPreviewProgress } from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthAudienceEnrollmentPreviewCategory } from "@/lib/growth/audiences/growth-audience-config"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type PreviewCursor = { offset: number }

function encodePreviewCursor(cursor: PreviewCursor): string {
  return JSON.stringify(cursor)
}

function decodePreviewCursor(raw: string | null): PreviewCursor {
  if (!raw) return { offset: 0 }
  try {
    const parsed = JSON.parse(raw) as Partial<PreviewCursor>
    return { offset: Math.max(0, Number(parsed.offset ?? 0)) }
  } catch {
    return { offset: 0 }
  }
}

function buildPreviewProgress(
  preview: Awaited<ReturnType<typeof getGrowthAudienceEnrollmentPreview>>,
  hasMore: boolean,
): GrowthAudienceEnrollmentPreviewProgress {
  if (!preview) throw new Error("preview_missing")
  return {
    previewId: preview.id,
    status: preview.status,
    totalMembers: preview.totalMembers,
    eligibleCount: preview.eligibleCount,
    alreadyEnrolledCount: preview.alreadyEnrolledCount,
    suppressedCount: preview.suppressedCount,
    missingContactCount: preview.missingContactCount,
    blockedCount: preview.blockedCount,
    processedCount: preview.processedCount,
    hasMore,
    rowsRead: preview.rowsRead,
    rowsWritten: preview.rowsWritten,
    durationMs: preview.durationMs,
    error: preview.error,
  }
}

export async function startAudienceEnrollmentPreview(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    userId: string
    snapshotId: string
    sequencePatternId: string
  },
): Promise<GrowthAudienceEnrollmentPreviewProgress> {
  const enabled = await checkAudiencePreviewEnabled(admin)
  if (!enabled.allowed) {
    throw new Error(enabled.reason ?? "preview_disabled")
  }

  const budget = await consumeAudiencePreviewBudget(admin, {
    organizationId: input.organizationId,
    userId: input.userId,
  })
  if (!budget.allowed) {
    throw new Error(budget.reason ?? "preview_budget_exceeded")
  }

  const audience = await getGrowthAudience(admin, input.audienceId)
  if (!audience || audience.organizationId !== input.organizationId) {
    throw new Error("audience_not_found")
  }

  const { total } = await listGrowthAudienceMembers(admin, {
    snapshotId: input.snapshotId,
    limit: 1,
    offset: 0,
  })

  const cappedTotal = Math.min(total, GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_MEMBERS)
  const preview = await createGrowthAudienceEnrollmentPreview(admin, {
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    snapshotId: input.snapshotId,
    sequencePatternId: input.sequencePatternId,
    totalMembers: cappedTotal,
    initiatedBy: input.userId,
  })

  return processAudienceEnrollmentPreviewBatch(admin, {
    previewId: preview.id,
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    snapshotId: input.snapshotId,
    sequencePatternId: input.sequencePatternId,
    startedAt: Date.now(),
  })
}

export async function continueAudienceEnrollmentPreview(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    previewId: string
    sequencePatternId: string
  },
): Promise<GrowthAudienceEnrollmentPreviewProgress> {
  const preview = await getGrowthAudienceEnrollmentPreview(admin, input.previewId)
  if (!preview || preview.audienceId !== input.audienceId) {
    throw new Error("preview_not_found")
  }
  if (preview.status !== "in_progress") {
    return buildPreviewProgress(preview, false)
  }

  return processAudienceEnrollmentPreviewBatch(admin, {
    previewId: preview.id,
    audienceId: input.audienceId,
    organizationId: input.organizationId,
    snapshotId: preview.snapshotId,
    sequencePatternId: input.sequencePatternId,
    startedAt: Date.now() - (preview.durationMs ?? 0),
  })
}

async function processAudienceEnrollmentPreviewBatch(
  admin: SupabaseClient,
  input: {
    previewId: string
    audienceId: string
    organizationId: string
    snapshotId: string
    sequencePatternId: string
    startedAt: number
  },
): Promise<GrowthAudienceEnrollmentPreviewProgress> {
  const preview = await getGrowthAudienceEnrollmentPreview(admin, input.previewId)
  if (!preview) throw new Error("preview_missing")

  if (preview.status === "cancelled") {
    return buildPreviewProgress(preview, false)
  }

  const cursor = decodePreviewCursor(preview.previewCursor)
  const batchSize = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_BATCH
  const cap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_PREVIEW_MEMBERS

  if (preview.processedCount >= cap || preview.processedCount >= preview.totalMembers) {
    const durationMs = Date.now() - input.startedAt
    const completed = await updateGrowthAudienceEnrollmentPreview(admin, input.previewId, {
      status: "completed",
      durationMs,
      generatedAt: new Date().toISOString(),
    })
    return buildPreviewProgress(completed, false)
  }

  const { items: members } = await listGrowthAudienceMembers(admin, {
    snapshotId: input.snapshotId,
    limit: batchSize,
    offset: cursor.offset,
  })

  const counts: Record<GrowthAudienceEnrollmentPreviewCategory, number> = {
    eligible: preview.eligibleCount,
    already_enrolled: preview.alreadyEnrolledCount,
    suppressed: preview.suppressedCount,
    missing_contact: preview.missingContactCount,
    blocked_by_limits: preview.blockedCount,
  }

  let rowsRead = preview.rowsRead
  const entries: Parameters<typeof insertGrowthAudienceEnrollmentPreviewMembersBatch>[1]["entries"] = []

  for (const member of members) {
    if (preview.processedCount + entries.length >= cap) break
    rowsRead += 3
    const classification = await classifyAudienceMemberEnrollmentReadiness(admin, {
      member,
      sequencePatternId: input.sequencePatternId,
    })
    counts[classification.category] += 1
    entries.push({
      audienceMemberId: member.id,
      leadId: classification.leadId,
      category: classification.category,
      reason: classification.reason,
      displayLabel: classification.displayLabel,
    })
  }

  const rowsWritten =
    preview.rowsWritten +
    (entries.length > 0
      ? await insertGrowthAudienceEnrollmentPreviewMembersBatch(admin, {
          previewId: input.previewId,
          snapshotId: input.snapshotId,
          organizationId: input.organizationId,
          entries,
        })
      : 0)

  const processedCount = preview.processedCount + entries.length
  const nextOffset = cursor.offset + members.length
  const hasMore =
    members.length === batchSize &&
    processedCount < preview.totalMembers &&
    processedCount < cap

  const durationMs = Date.now() - input.startedAt
  const updated = await updateGrowthAudienceEnrollmentPreview(admin, input.previewId, {
    status: hasMore ? "in_progress" : "completed",
    eligibleCount: counts.eligible,
    alreadyEnrolledCount: counts.already_enrolled,
    suppressedCount: counts.suppressed,
    missingContactCount: counts.missing_contact,
    blockedCount: counts.blocked_by_limits,
    processedCount,
    previewCursor: encodePreviewCursor({ offset: nextOffset }),
    rowsRead,
    rowsWritten,
    durationMs,
    generatedAt: hasMore ? null : new Date().toISOString(),
  })

  await recordRuntimeHealthRead(admin, rowsRead - preview.rowsRead)
  await recordRuntimeHealthWrite(admin, rowsWritten - preview.rowsWritten)

  logGrowthEngine("audience_enrollment_preview_batch", {
    qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    preview_id: input.previewId,
    processed_count: processedCount,
    eligible: counts.eligible,
    has_more: hasMore,
  })

  return buildPreviewProgress(updated, hasMore)
}

export async function cancelAudienceEnrollmentPreview(
  admin: SupabaseClient,
  input: { previewId: string; audienceId: string },
): Promise<GrowthAudienceEnrollmentPreviewProgress> {
  const preview = await getGrowthAudienceEnrollmentPreview(admin, input.previewId)
  if (!preview || preview.audienceId !== input.audienceId) {
    throw new Error("preview_not_found")
  }

  const updated = await updateGrowthAudienceEnrollmentPreview(admin, input.previewId, {
    status: "cancelled",
    error: "Cancelled by operator.",
  })
  return buildPreviewProgress(updated, false)
}
