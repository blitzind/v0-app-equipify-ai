/** GE-AIOS-MEMORY-RESOLVER-1A — Deduped lead-memory writes + evolution (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { rebuildLeadMemoryProfile } from "@/lib/growth/lead-memory/dashboard"
import {
  buildMemoryFingerprint,
  HUMAN_MEMORY_KIND_METADATA_KEY,
  MEMORY_CANONICAL_ENTITY_LABEL_KEY,
  MEMORY_CONFIRMATION_COUNT_KEY,
  MEMORY_EVOLUTION_CHAIN_ID_KEY,
  MEMORY_FINGERPRINT_METADATA_KEY,
  MEMORY_FRESHNESS_EXPIRES_AT_KEY,
  MEMORY_LAST_CONFIRMED_AT_KEY,
  MEMORY_OPERATOR_STATUS_KEY,
  MEMORY_PROTECTED_KEY,
  MEMORY_SUPERSEDED_KEY,
  MEMORY_SUPERSEDES_EVENT_ID_KEY,
  MEMORY_WHY_IT_MATTERS_KEY,
  personalContextFreshnessExpiresAt,
  storageCategoryForHumanKind,
  VOICE_BRIDGE_SOURCE_SYSTEM,
} from "@/lib/growth/lead-memory/canonical-human-memory-metadata"
import type { HumanMemoryKind } from "@/lib/growth/lead-memory/canonical-human-memory-types"
import { sanitizeConclusionForMemory } from "@/lib/growth/lead-memory/canonical-human-memory-constitution"
import { maskLeadMemoryLabel } from "@/lib/growth/lead-memory/memory-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_memory_events")
}

export type CanonicalLeadMemoryWriteInput = {
  leadId: string
  humanMemoryKind: HumanMemoryKind
  conclusion: string
  confidence?: "low" | "medium" | "high" | "verified"
  sourceSystem?: string
  canonicalEntityLabel?: string | null
  whyItMatters?: string | null
  operatorStatus?: "pending" | "approved" | "corrected"
  voiceMemoryEventId?: string | null
  supersedesEventId?: string | null
  evolutionChainId?: string | null
}

export async function writeCanonicalLeadMemoryConclusion(
  admin: SupabaseClient,
  input: CanonicalLeadMemoryWriteInput,
): Promise<{ eventId: string | null; deduped: boolean; confirmationIncremented: boolean }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) throw new Error("lead_not_found")

  const conclusion = sanitizeConclusionForMemory(input.conclusion)
  if (!conclusion) return { eventId: null, deduped: true, confirmationIncremented: false }

  const leadLabel = maskLeadMemoryLabel(input.leadId, lead.companyName)
  const memoryCategory = storageCategoryForHumanKind(input.humanMemoryKind)
  const fingerprint = buildMemoryFingerprint({
    leadId: input.leadId,
    humanMemoryKind: input.humanMemoryKind,
    conclusion,
  })
  const now = new Date().toISOString()

  const { data: existingRows } = await eventsTable(admin)
    .select("id, metadata, confidence, recorded_at")
    .eq("lead_id", input.leadId)
    .eq("memory_category", memoryCategory)
    .contains("metadata", { [MEMORY_FINGERPRINT_METADATA_KEY]: fingerprint })
    .limit(1)

  const existing = (existingRows ?? [])[0] as
    | { id: string; metadata?: Record<string, unknown>; confidence?: string; recorded_at?: string }
    | undefined

  if (existing?.id) {
    const metadata = (existing.metadata ?? {}) as Record<string, unknown>
    if (metadata[MEMORY_PROTECTED_KEY] === true || metadata[MEMORY_OPERATOR_STATUS_KEY] === "protected") {
      return { eventId: existing.id, deduped: true, confirmationIncremented: false }
    }
    const confirmationCount = Number(metadata[MEMORY_CONFIRMATION_COUNT_KEY] ?? 1) + 1
    await eventsTable(admin)
      .update({
        confidence: input.confidence ?? (existing.confidence as string) ?? "medium",
        metadata: {
          ...metadata,
          [MEMORY_CONFIRMATION_COUNT_KEY]: confirmationCount,
          [MEMORY_LAST_CONFIRMED_AT_KEY]: now,
          [MEMORY_OPERATOR_STATUS_KEY]: input.operatorStatus ?? metadata[MEMORY_OPERATOR_STATUS_KEY] ?? "pending",
        },
      })
      .eq("id", existing.id)

    if (input.supersedesEventId) {
      await markLeadMemoryEventSuperseded(admin, {
        eventId: input.supersedesEventId,
        supersededByEventId: existing.id,
      })
    }

    return { eventId: existing.id, deduped: true, confirmationIncremented: true }
  }

  if (input.supersedesEventId) {
    await markLeadMemoryEventSuperseded(admin, {
      eventId: input.supersedesEventId,
      supersededByEventId: null,
    })
  }

  const metadata: Record<string, unknown> = {
    [HUMAN_MEMORY_KIND_METADATA_KEY]: input.humanMemoryKind,
    [MEMORY_FINGERPRINT_METADATA_KEY]: fingerprint,
    [MEMORY_CONFIRMATION_COUNT_KEY]: 1,
    [MEMORY_LAST_CONFIRMED_AT_KEY]: now,
    [MEMORY_OPERATOR_STATUS_KEY]: input.operatorStatus ?? "pending",
    [MEMORY_WHY_IT_MATTERS_KEY]: input.whyItMatters ?? null,
    [MEMORY_CANONICAL_ENTITY_LABEL_KEY]: input.canonicalEntityLabel ?? null,
    [MEMORY_EVOLUTION_CHAIN_ID_KEY]: input.evolutionChainId ?? input.supersedesEventId ?? null,
  }

  if (input.humanMemoryKind === "personal_context") {
    metadata[MEMORY_FRESHNESS_EXPIRES_AT_KEY] = personalContextFreshnessExpiresAt(now)
  }

  if (input.voiceMemoryEventId) {
    metadata.voice_memory_event_id = input.voiceMemoryEventId
  }

  const { data: inserted, error } = await eventsTable(admin)
    .insert({
      lead_id: input.leadId,
      lead_label: leadLabel,
      memory_category: memoryCategory,
      confidence: input.confidence ?? "medium",
      title: conclusion,
      evidence_snippet: conclusion,
      source_system: input.sourceSystem ?? VOICE_BRIDGE_SOURCE_SYSTEM,
      metadata,
    })
    .select("id")
    .maybeSingle()

  if (error) throw error

  const eventId = (inserted as { id?: string } | null)?.id ?? null
  if (input.supersedesEventId && eventId) {
    await markLeadMemoryEventSuperseded(admin, {
      eventId: input.supersedesEventId,
      supersededByEventId: eventId,
    })
  }

  return { eventId, deduped: false, confirmationIncremented: false }
}

export async function markLeadMemoryEventSuperseded(
  admin: SupabaseClient,
  input: { eventId: string; supersededByEventId: string | null },
): Promise<void> {
  const { data: row } = await eventsTable(admin).select("metadata").eq("id", input.eventId).maybeSingle()
  const metadata = ((row as { metadata?: Record<string, unknown> } | null)?.metadata ?? {}) as Record<string, unknown>
  await eventsTable(admin)
    .update({
      metadata: {
        ...metadata,
        [MEMORY_SUPERSEDED_KEY]: true,
        [MEMORY_SUPERSEDES_EVENT_ID_KEY]: input.supersededByEventId,
      },
    })
    .eq("id", input.eventId)
}

export async function writeCanonicalLeadMemoryAndRebuild(
  admin: SupabaseClient,
  input: CanonicalLeadMemoryWriteInput,
): Promise<{ eventId: string | null; deduped: boolean }> {
  const result = await writeCanonicalLeadMemoryConclusion(admin, input)
  if (result.eventId) {
    await rebuildLeadMemoryProfile(admin, input.leadId).catch(() => null)
  }
  return { eventId: result.eventId, deduped: result.deduped }
}
