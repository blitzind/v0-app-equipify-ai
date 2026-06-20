import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUDIENCE_LIMITS, GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"
import {
  createGrowthAudienceSnapshotDiff,
  insertGrowthAudienceMemberDiffsBatch,
  listSnapshotMemberKeys,
  updateGrowthAudienceSnapshotDiff,
  updateGrowthAudienceSnapshotDiffCounts,
} from "@/lib/growth/audiences/growth-audience-repository"
import {
  checkAudienceDiffEnabled,
  consumeAudienceDiffBudget,
  recordAudienceGuardrailFailure,
} from "@/lib/growth/audiences/growth-audience-guardrails"
import type { GrowthAudienceDiffStatus } from "@/lib/growth/audiences/growth-audience-config"
import { recordRuntimeHealthRead, recordRuntimeHealthWrite } from "@/lib/growth/runtime-guardrails/growth-runtime-health-counter-service"

type DiffPersistCursor = {
  phase: "persist_added" | "persist_removed" | "done"
  addedOffset: number
  removedOffset: number
}

function encodeDiffCursor(cursor: DiffPersistCursor): string {
  return JSON.stringify(cursor)
}

function decodeDiffCursor(raw: string | null): DiffPersistCursor {
  if (!raw) return { phase: "persist_added", addedOffset: 0, removedOffset: 0 }
  try {
    const parsed = JSON.parse(raw) as Partial<DiffPersistCursor>
    return {
      phase: parsed.phase === "persist_removed" || parsed.phase === "done" ? parsed.phase : "persist_added",
      addedOffset: Math.max(0, Number(parsed.addedOffset ?? 0)),
      removedOffset: Math.max(0, Number(parsed.removedOffset ?? 0)),
    }
  } catch {
    return { phase: "persist_added", addedOffset: 0, removedOffset: 0 }
  }
}

async function loadAllMemberKeys(
  admin: SupabaseClient,
  snapshotId: string,
): Promise<{ keys: Set<string>; rowsRead: number }> {
  const keys = new Set<string>()
  let offset = 0
  let rowsRead = 0
  const batch = GROWTH_AUDIENCE_LIMITS.DIFF_MEMBER_BATCH
  const cap = GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_DIFF_MEMBERS

  while (keys.size < cap) {
    const page = await listSnapshotMemberKeys(admin, { snapshotId, limit: batch, offset })
    rowsRead += page.keys.length + +1
    for (const key of page.keys) keys.add(key)
    if (page.keys.length < batch || keys.size >= cap) break
    offset += batch
  }

  return { keys, rowsRead }
}

function computeMemberDiffSets(
  previousKeys: Set<string>,
  currentKeys: Set<string>,
): { added: string[]; removed: string[]; unchanged: number } {
  const added: string[] = []
  const removed: string[] = []

  for (const key of currentKeys) {
    if (!previousKeys.has(key)) added.push(key)
  }
  for (const key of previousKeys) {
    if (!currentKeys.has(key)) removed.push(key)
  }

  const unchanged = [...currentKeys].filter((key) => previousKeys.has(key)).length
  return { added, removed, unchanged }
}

export async function computeAndPersistAudienceSnapshotDiff(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    previousSnapshotId: string
    memberKind?: "company" | "person"
  },
): Promise<{
  diffId: string | null
  addedCount: number
  removedCount: number
  unchangedCount: number
  status: GrowthAudienceDiffStatus
  rowsRead: number
  rowsWritten: number
}> {
  const enabled = await checkAudienceDiffEnabled(admin)
  if (!enabled.allowed) {
    return {
      diffId: null,
      addedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      status: "throttled",
      rowsRead: 0,
      rowsWritten: 0,
    }
  }

  const budget = await consumeAudienceDiffBudget(admin, {
    organizationId: input.organizationId,
  })
  if (!budget.allowed) {
    return {
      diffId: null,
      addedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      status: "throttled",
      rowsRead: 0,
      rowsWritten: 0,
    }
  }

  const startedAt = Date.now()
  let rowsRead = 0
  let rowsWritten = 0

  try {
    const [prev, curr] = await Promise.all([
      loadAllMemberKeys(admin, input.previousSnapshotId),
      loadAllMemberKeys(admin, input.snapshotId),
    ])
    rowsRead += prev.rowsRead + curr.rowsRead

    const totalMembers = prev.keys.size + curr.keys.size
    if (totalMembers > GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_DIFF_MEMBERS) {
      await recordAudienceGuardrailFailure(admin, "audience_diff_member_cap_exceeded")
      return {
        diffId: null,
        addedCount: 0,
        removedCount: 0,
        unchangedCount: 0,
        status: "throttled",
        rowsRead,
        rowsWritten,
      }
    }

    const { added, removed, unchanged } = computeMemberDiffSets(prev.keys, curr.keys)
    const diff = await createGrowthAudienceSnapshotDiff(admin, {
      audienceId: input.audienceId,
      organizationId: input.organizationId,
      snapshotId: input.snapshotId,
      previousSnapshotId: input.previousSnapshotId,
      previousMemberCount: prev.keys.size,
      currentMemberCount: curr.keys.size,
      addedCount: added.length,
      removedCount: removed.length,
      unchangedCount: unchanged,
    })

    const memberKind = input.memberKind ?? "company"
    const batch = GROWTH_AUDIENCE_LIMITS.DIFF_MEMBER_BATCH

    for (let i = 0; i < added.length; i += batch) {
      const chunk = added.slice(i, i + batch)
      const written = await insertGrowthAudienceMemberDiffsBatch(admin, {
        diffId: diff.id,
        snapshotId: input.snapshotId,
        organizationId: input.organizationId,
        entries: chunk.map((memberKey) => ({
          memberKey,
          changeKind: "added" as const,
          memberKind,
          displayLabel: memberKey,
        })),
      })
      rowsWritten += written
    }

    for (let i = 0; i < removed.length; i += batch) {
      const chunk = removed.slice(i, i + batch)
      const written = await insertGrowthAudienceMemberDiffsBatch(admin, {
        diffId: diff.id,
        snapshotId: input.snapshotId,
        organizationId: input.organizationId,
        entries: chunk.map((memberKey) => ({
          memberKey,
          changeKind: "removed" as const,
          memberKind,
          displayLabel: memberKey,
        })),
      })
      rowsWritten += written
    }

    const durationMs = Date.now() - startedAt
    await updateGrowthAudienceSnapshotDiff(admin, diff.id, {
      status: "completed",
      durationMs,
      rowsRead,
      rowsWritten,
    })

    await updateGrowthAudienceSnapshotDiffCounts(admin, {
      snapshotId: input.snapshotId,
      previousSnapshotId: input.previousSnapshotId,
      previousMemberCount: prev.keys.size,
      addedCount: added.length,
      removedCount: removed.length,
      unchangedCount: unchanged,
    })

    await recordRuntimeHealthRead(admin, rowsRead)
    await recordRuntimeHealthWrite(admin, rowsWritten + 3)

    return {
      diffId: diff.id,
      addedCount: added.length,
      removedCount: removed.length,
      unchangedCount: unchanged,
      status: "completed",
      rowsRead,
      rowsWritten,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "audience_diff_failed"
    await recordAudienceGuardrailFailure(admin, message)
    return {
      diffId: null,
      addedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      status: "failed",
      rowsRead,
      rowsWritten,
    }
  }
}

/** Resumable diff persist for large added/removed sets (chunked writes only). */
export async function continueAudienceSnapshotDiffPersist(
  admin: SupabaseClient,
  input: {
    diffId: string
    addedKeys: string[]
    removedKeys: string[]
    snapshotId: string
    organizationId: string
    memberKind?: "company" | "person"
  },
): Promise<{ hasMore: boolean; rowsWritten: number; status: GrowthAudienceDiffStatus }> {
  const diffRow = await admin
    .schema("growth")
    .from("growth_audience_snapshot_diffs")
    .select("diff_cursor, status")
    .eq("id", input.diffId)
    .maybeSingle()

  if (!diffRow.data) {
    return { hasMore: false, rowsWritten: 0, status: "failed" }
  }

  const cursor = decodeDiffCursor(asString(diffRow.data.diff_cursor))
  const batch = GROWTH_AUDIENCE_LIMITS.DIFF_MEMBER_BATCH
  const memberKind = input.memberKind ?? "company"
  let rowsWritten = 0

  if (cursor.phase === "persist_added") {
    const slice = input.addedKeys.slice(cursor.addedOffset, cursor.addedOffset + batch)
    if (slice.length > 0) {
      rowsWritten += await insertGrowthAudienceMemberDiffsBatch(admin, {
        diffId: input.diffId,
        snapshotId: input.snapshotId,
        organizationId: input.organizationId,
        entries: slice.map((memberKey) => ({
          memberKey,
          changeKind: "added" as const,
          memberKind,
          displayLabel: memberKey,
        })),
      })
    }
    const nextOffset = cursor.addedOffset + slice.length
    if (nextOffset < input.addedKeys.length) {
      await updateGrowthAudienceSnapshotDiff(admin, input.diffId, {
        status: "in_progress",
        diffCursor: encodeDiffCursor({ phase: "persist_added", addedOffset: nextOffset, removedOffset: 0 }),
        rowsWritten,
      })
      return { hasMore: true, rowsWritten, status: "in_progress" }
    }
    cursor.phase = "persist_removed"
    cursor.addedOffset = input.addedKeys.length
  }

  if (cursor.phase === "persist_removed") {
    const slice = input.removedKeys.slice(cursor.removedOffset, cursor.removedOffset + batch)
    if (slice.length > 0) {
      rowsWritten += await insertGrowthAudienceMemberDiffsBatch(admin, {
        diffId: input.diffId,
        snapshotId: input.snapshotId,
        organizationId: input.organizationId,
        entries: slice.map((memberKey) => ({
          memberKey,
          changeKind: "removed" as const,
          memberKind,
          displayLabel: memberKey,
        })),
      })
    }
    const nextOffset = cursor.removedOffset + slice.length
    if (nextOffset < input.removedKeys.length) {
      await updateGrowthAudienceSnapshotDiff(admin, input.diffId, {
        status: "in_progress",
        diffCursor: encodeDiffCursor({
          phase: "persist_removed",
          addedOffset: input.addedKeys.length,
          removedOffset: nextOffset,
        }),
        rowsWritten,
      })
      return { hasMore: true, rowsWritten, status: "in_progress" }
    }
  }

  await updateGrowthAudienceSnapshotDiff(admin, input.diffId, {
    status: "completed",
    diffCursor: encodeDiffCursor({ phase: "done", addedOffset: input.addedKeys.length, removedOffset: input.removedKeys.length }),
    rowsWritten,
  })
  return { hasMore: false, rowsWritten, status: "completed" }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}
