/** GE-AIOS-MEMORY-RESOLVER-1B — Operator memory review workflow (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { rebuildLeadMemoryProfile } from "@/lib/growth/lead-memory/dashboard"
import { sanitizeConclusionForMemory } from "@/lib/growth/lead-memory/canonical-human-memory-constitution"
import {
  HUMAN_MEMORY_KIND_METADATA_KEY,
  MEMORY_CONFIRMATION_COUNT_KEY,
  MEMORY_LAST_CONFIRMED_AT_KEY,
  MEMORY_FRESHNESS_EXPIRES_AT_KEY,
  MEMORY_MERGED_INTO_EVENT_ID_KEY,
  MEMORY_MERGED_SOURCE_EVENT_IDS_KEY,
  MEMORY_OPERATOR_DECISION_AT_KEY,
  MEMORY_OPERATOR_DECISION_BY_KEY,
  MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY,
  MEMORY_OPERATOR_OVERRIDE_KEY,
  MEMORY_OPERATOR_STATUS_KEY,
  MEMORY_ORIGINAL_CONCLUSION_KEY,
  MEMORY_ORIGINAL_EVIDENCE_KEY,
  MEMORY_PINNED_KEY,
  MEMORY_PROTECTED_KEY,
  MEMORY_SUPERSEDED_KEY,
  resolveAuthoritativeHumanMemoryKind,
} from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import { humanMemoryKindsAreMergeCompatible } from "@/lib/growth/lead-memory/canonical-human-memory-semantics"
import { resolveAuthoritativeForm } from "@/lib/growth/aios/growth/growth-canonical-display-identity-1b"
import { confidenceRank, type GrowthMemoryConfidence } from "@/lib/growth/lead-memory/memory-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { findAutonomousOutreachPreparationRunByPackageId } from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { resolveCanonicalHumanMemoryForLead } from "@/lib/growth/lead-memory/resolve-canonical-human-memory-for-lead"
import { projectCanonicalMemoryReviewRows } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"
import type { Approvals2AMemoryReviewRow } from "@/lib/growth/aios/approvals/approvals-operator-review-packet"

export type OperatorMemoryReviewAction = "approve" | "correct" | "delete" | "pin" | "protect" | "merge"

export type OperatorMemoryReviewResultCode =
  | "approved"
  | "corrected"
  | "deleted"
  | "pinned"
  | "protected"
  | "merged"
  | "already_applied"
  | "not_found"
  | "invalid_merge"
  | "forbidden"
  | "invalid_correction"

export type OperatorMemoryReviewResult = {
  ok: boolean
  result: OperatorMemoryReviewResultCode
  eventId: string
  mergeTargetEventId?: string | null
  memoryReview: Approvals2AMemoryReviewRow[]
  profileRebuilt: boolean
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_memory_events")
}

function metaRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function strongerConfidence(left: GrowthMemoryConfidence, right: GrowthMemoryConfidence): GrowthMemoryConfidence {
  return confidenceRank(left) >= confidenceRank(right) ? left : right
}

function buildIdempotencyKey(input: {
  action: OperatorMemoryReviewAction
  eventId: string
  correctedConclusion?: string | null
  mergeTargetEventId?: string | null
}): string {
  return [
    input.action,
    input.eventId,
    input.correctedConclusion?.trim() ?? "",
    input.mergeTargetEventId ?? "",
  ].join(":")
}

function actionResultCode(action: OperatorMemoryReviewAction): OperatorMemoryReviewResultCode {
  switch (action) {
    case "approve":
      return "approved"
    case "correct":
      return "corrected"
    case "delete":
      return "deleted"
    case "pin":
      return "pinned"
    case "protect":
      return "protected"
    case "merge":
      return "merged"
  }
}

async function loadOwnedMemoryEvent(
  admin: SupabaseClient,
  input: { organizationId: string; leadId: string; eventId: string },
) {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) return { error: "forbidden" as const, row: null }

  const { data: row } = await eventsTable(admin)
    .select("id, lead_id, title, evidence_snippet, memory_category, confidence, metadata, source_system")
    .eq("id", input.eventId)
    .eq("lead_id", input.leadId)
    .maybeSingle()

  if (!row) return { error: "not_found" as const, row: null }
  return { error: null, row: row as Record<string, unknown> }
}

async function refreshMemoryReviewProjection(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    packageId?: string | null
  },
): Promise<Approvals2AMemoryReviewRow[]> {
  const pkg =
    input.packageId != null
      ? (
          await findAutonomousOutreachPreparationRunByPackageId(
            admin,
            input.organizationId,
            input.packageId,
          )
        )?.approvalPackage ?? null
      : null

  const bundle = await resolveCanonicalHumanMemoryForLead(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    packageSnapshot: pkg,
    skipPackageLoad: pkg == null,
  })

  return projectCanonicalMemoryReviewRows({ canonicalHumanMemory: bundle })
}

export async function applyOperatorMemoryReviewDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    eventId: string
    action: OperatorMemoryReviewAction
    operatorUserId?: string | null
    correctedConclusion?: string | null
    mergeTargetEventId?: string | null
    packageId?: string | null
    idempotencyKey?: string | null
  },
): Promise<OperatorMemoryReviewResult> {
  const owned = await loadOwnedMemoryEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    eventId: input.eventId,
  })

  if (owned.error === "forbidden") {
    return {
      ok: false,
      result: "forbidden",
      eventId: input.eventId,
      memoryReview: [],
      profileRebuilt: false,
    }
  }
  if (owned.error === "not_found" || !owned.row) {
    return {
      ok: false,
      result: "not_found",
      eventId: input.eventId,
      memoryReview: [],
      profileRebuilt: false,
    }
  }

  const row = owned.row
  const metadata = metaRecord(row.metadata)
  const title = asString(row.title)
  const evidence = asString(row.evidence_snippet)
  const idempotencyKey =
    input.idempotencyKey?.trim() ||
    buildIdempotencyKey({
      action: input.action,
      eventId: input.eventId,
      correctedConclusion: input.correctedConclusion,
      mergeTargetEventId: input.mergeTargetEventId,
    })

  const priorIdempotency = asString(metadata[MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY])
  const priorStatus = asString(metadata[MEMORY_OPERATOR_STATUS_KEY])
  if (priorIdempotency === idempotencyKey && priorStatus) {
    const memoryReview = await refreshMemoryReviewProjection(admin, input)
    return {
      ok: true,
      result: "already_applied",
      eventId: input.eventId,
      mergeTargetEventId: input.mergeTargetEventId ?? null,
      memoryReview,
      profileRebuilt: false,
    }
  }

  const now = new Date().toISOString()
  const humanKind = resolveAuthoritativeHumanMemoryKind({
    memoryCategory: asString(row.memory_category) as never,
    title,
    metadata,
  })

  if (input.action === "merge") {
    const mergeTargetEventId = input.mergeTargetEventId?.trim()
    if (!mergeTargetEventId || mergeTargetEventId === input.eventId) {
      return {
        ok: false,
        result: "invalid_merge",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }

    const targetOwned = await loadOwnedMemoryEvent(admin, {
      organizationId: input.organizationId,
      leadId: input.leadId,
      eventId: mergeTargetEventId,
    })
    if (!targetOwned.row) {
      return {
        ok: false,
        result: "invalid_merge",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }

    const targetMetadata = metaRecord(targetOwned.row.metadata)
    const targetKind = resolveAuthoritativeHumanMemoryKind({
      memoryCategory: asString(targetOwned.row.memory_category) as never,
      title: asString(targetOwned.row.title),
      metadata: targetMetadata,
    })

    if (!humanMemoryKindsAreMergeCompatible(humanKind, targetKind)) {
      return {
        ok: false,
        result: "invalid_merge",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }

    const sourceConclusion = asString(targetMetadata[MEMORY_OPERATOR_OVERRIDE_KEY]) || asString(targetOwned.row.title)
    const mergeConclusion = asString(metadata[MEMORY_OPERATOR_OVERRIDE_KEY]) || title
    const normalizedSource = sourceConclusion.toLowerCase()
    const normalizedMerge = mergeConclusion.toLowerCase()
    const similar =
      normalizedSource === normalizedMerge ||
      normalizedSource.includes(normalizedMerge.slice(0, 24)) ||
      normalizedMerge.includes(normalizedSource.slice(0, 24))
    if (!similar) {
      return {
        ok: false,
        result: "invalid_merge",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }

    const mergedConfirmation =
      asNumber(metadata[MEMORY_CONFIRMATION_COUNT_KEY], 1) +
      asNumber(targetMetadata[MEMORY_CONFIRMATION_COUNT_KEY], 1)
    const mergedSources = [
      ...((targetMetadata[MEMORY_MERGED_SOURCE_EVENT_IDS_KEY] as string[] | undefined) ?? []),
      input.eventId,
    ]

    const survivingConclusion =
      asString(targetMetadata[MEMORY_OPERATOR_OVERRIDE_KEY]) ||
      (confidenceRank(asString(targetOwned.row.confidence) as GrowthMemoryConfidence) >=
      confidenceRank(asString(row.confidence) as GrowthMemoryConfidence)
        ? asString(targetOwned.row.title)
        : title)

    await eventsTable(admin)
      .update({
        title: survivingConclusion,
        evidence_snippet: survivingConclusion,
        confidence: strongerConfidence(
          asString(targetOwned.row.confidence) as GrowthMemoryConfidence,
          asString(row.confidence) as GrowthMemoryConfidence,
        ),
        metadata: {
          ...targetMetadata,
          [MEMORY_CONFIRMATION_COUNT_KEY]: mergedConfirmation,
          [MEMORY_LAST_CONFIRMED_AT_KEY]: now,
          [MEMORY_OPERATOR_STATUS_KEY]: targetMetadata[MEMORY_OPERATOR_STATUS_KEY] ?? "approved",
          [MEMORY_MERGED_SOURCE_EVENT_IDS_KEY]: mergedSources,
          [MEMORY_OPERATOR_DECISION_AT_KEY]: now,
          [MEMORY_OPERATOR_DECISION_BY_KEY]: input.operatorUserId ?? null,
          [MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY]: idempotencyKey,
        },
      })
      .eq("id", mergeTargetEventId)

    await eventsTable(admin)
      .update({
        metadata: {
          ...metadata,
          [MEMORY_SUPERSEDED_KEY]: true,
          [MEMORY_MERGED_INTO_EVENT_ID_KEY]: mergeTargetEventId,
          [MEMORY_OPERATOR_STATUS_KEY]: "deleted",
          [MEMORY_OPERATOR_DECISION_AT_KEY]: now,
          [MEMORY_OPERATOR_DECISION_BY_KEY]: input.operatorUserId ?? null,
          [MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY]: idempotencyKey,
        },
      })
      .eq("id", input.eventId)

    await rebuildLeadMemoryProfile(admin, input.leadId).catch(() => null)
    const memoryReview = await refreshMemoryReviewProjection(admin, input)
    return {
      ok: true,
      result: "merged",
      eventId: input.eventId,
      mergeTargetEventId,
      memoryReview,
      profileRebuilt: true,
    }
  }

  const statusMap: Record<OperatorMemoryReviewAction, string> = {
    approve: "approved",
    correct: "corrected",
    delete: "deleted",
    pin: "pinned",
    protect: "protected",
    merge: "deleted",
  }

  const nextMetadata: Record<string, unknown> = {
    ...metadata,
    [MEMORY_OPERATOR_STATUS_KEY]: statusMap[input.action],
    [MEMORY_OPERATOR_DECISION_AT_KEY]: now,
    [MEMORY_OPERATOR_DECISION_BY_KEY]: input.operatorUserId ?? null,
    [MEMORY_OPERATOR_DECISION_IDEMPOTENCY_KEY]: idempotencyKey,
  }

  if (!metadata[MEMORY_ORIGINAL_CONCLUSION_KEY]) {
    nextMetadata[MEMORY_ORIGINAL_CONCLUSION_KEY] = title
    nextMetadata[MEMORY_ORIGINAL_EVIDENCE_KEY] = evidence
  }

  if (input.action === "pin") {
    nextMetadata[MEMORY_PINNED_KEY] = true
    if (humanKind === "personal_context") {
      nextMetadata[MEMORY_FRESHNESS_EXPIRES_AT_KEY] = null
    }
  }
  if (input.action === "protect") nextMetadata[MEMORY_PROTECTED_KEY] = true
  if (input.action === "delete") nextMetadata[MEMORY_SUPERSEDED_KEY] = true

  let corrected: string | null = null
  if (input.action === "correct") {
    const raw = input.correctedConclusion?.trim()
    if (!raw) {
      return {
        ok: false,
        result: "invalid_correction",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }
    corrected = sanitizeConclusionForMemory(resolveAuthoritativeForm(raw))
    if (!corrected) {
      return {
        ok: false,
        result: "invalid_correction",
        eventId: input.eventId,
        memoryReview: await refreshMemoryReviewProjection(admin, input),
        profileRebuilt: false,
      }
    }
    nextMetadata[MEMORY_OPERATOR_OVERRIDE_KEY] = corrected
    if (humanKind) nextMetadata[HUMAN_MEMORY_KIND_METADATA_KEY] = humanKind
  }

  await eventsTable(admin)
    .update({
      title: corrected ?? title,
      evidence_snippet: corrected ?? evidence,
      metadata: nextMetadata,
      confidence:
        input.action === "approve" || input.action === "correct"
          ? "verified"
          : asString(row.confidence) || undefined,
    })
    .eq("id", input.eventId)

  await rebuildLeadMemoryProfile(admin, input.leadId).catch(() => null)
  const memoryReview = await refreshMemoryReviewProjection(admin, input)

  return {
    ok: true,
    result: actionResultCode(input.action),
    eventId: input.eventId,
    memoryReview,
    profileRebuilt: true,
  }
}
