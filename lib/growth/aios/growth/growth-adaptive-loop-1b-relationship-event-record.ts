/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Canonical relationship events via existing lead_memory_events (server-only).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { maskLeadMemoryLabel } from "@/lib/growth/lead-memory/memory-types"
import type { GrowthLeadMemoryCategory } from "@/lib/growth/lead-memory/memory-types"
import {
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM,
  type CanonicalRelationshipEventRecord,
  type LiveRelationshipEventSource,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-types"

function memoryCategoryForEvent(type: AdaptiveProspectEvent["type"]): GrowthLeadMemoryCategory {
  if (
    type === "objection" ||
    type === "budget_objection" ||
    type === "timing_objection" ||
    type === "already_have_software" ||
    type === "competitor_mentioned" ||
    type === "relationship_deterioration"
  ) {
    return "objection"
  }
  if (type === "meeting_booked" || type === "meeting_completed") return "meeting_signal"
  if (
    type === "champion_identified" ||
    type === "buying_committee_expansion" ||
    type === "executive_engagement" ||
    type === "decision_maker_changed" ||
    type === "contact_changed"
  ) {
    return "committee_member"
  }
  if (type === "pricing_discussion" || type === "proposal_requested") return "budget_signal"
  if (type === "unsubscribe" || type === "ghosting") return "risk_signal"
  if (type === "competitor_mentioned") return "competitor_signal"
  if (type === "reply_received" || type === "referral") return "buying_signal"
  return "engagement_pattern"
}

function mapStoredRow(row: Record<string, unknown>): CanonicalRelationshipEventRecord | null {
  const metadata = (row.metadata as Record<string, unknown> | null) ?? {}
  const event = metadata.adaptive_event as AdaptiveProspectEvent | undefined
  if (!event?.type) return null
  return {
    id: String(row.id ?? ""),
    leadId: String(row.lead_id ?? ""),
    event,
    source: (metadata.live_source as LiveRelationshipEventSource) ?? "reply_intelligence",
    materialChange: metadata.material_change === true,
    processedForStrategy: metadata.processed_for_strategy === true,
    recordedAt: String(row.recorded_at ?? row.created_at ?? ""),
  }
}

export async function recordCanonicalRelationshipEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    event: AdaptiveProspectEvent
    source: LiveRelationshipEventSource
    materialChange: boolean
    sourceEventId?: string | null
  },
): Promise<{ recorded: boolean; eventId: string | null }> {
  const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
  if (!lead) return { recorded: false, eventId: null }

  const leadLabel = maskLeadMemoryLabel(input.leadId, lead.companyName)
  const evidence = (input.event.detail ?? input.event.summary).slice(0, 500)
  const fingerprint = `${GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM}:${input.event.type}:${input.event.occurredAt}`

  const { data: existing } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .select("id")
    .eq("lead_id", input.leadId)
    .eq("source_system", GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM)
    .contains("metadata", { fingerprint })
    .maybeSingle()

  if (existing?.id) {
    return { recorded: true, eventId: String(existing.id) }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .insert({
      lead_id: input.leadId,
      lead_label: leadLabel,
      memory_category: memoryCategoryForEvent(input.event.type),
      confidence: input.materialChange ? "high" : "medium",
      title: input.event.summary.slice(0, 200),
      evidence_snippet: evidence,
      source_system: GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM,
      source_event_id: input.sourceEventId ?? null,
      recorded_at: input.event.occurredAt,
      metadata: {
        qa_marker: GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
        fingerprint,
        adaptive_event: input.event,
        live_source: input.source,
        material_change: input.materialChange,
        processed_for_strategy: false,
      },
    })
    .select("id")
    .maybeSingle()

  if (error || !data?.id) return { recorded: false, eventId: null }
  return { recorded: true, eventId: String(data.id) }
}

export async function loadPendingAdaptiveEventsForLead(
  admin: SupabaseClient,
  leadId: string,
  limit = 24,
): Promise<AdaptiveProspectEvent[]> {
  const { data } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .select("id, lead_id, recorded_at, metadata")
    .eq("lead_id", leadId)
    .eq("source_system", GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM)
    .order("recorded_at", { ascending: true })
    .limit(limit * 2)

  const rows = (data ?? []) as Array<Record<string, unknown>>
  const pending = rows
    .map(mapStoredRow)
    .filter((row): row is CanonicalRelationshipEventRecord => Boolean(row))
    .filter((row) => !row.processedForStrategy && row.materialChange)

  return pending.slice(-limit).map((row) => row.event)
}

export async function markAdaptiveEventsProcessedForLead(
  admin: SupabaseClient,
  leadId: string,
  processedAt: string,
): Promise<void> {
  const { data } = await admin
    .schema("growth")
    .from("lead_memory_events")
    .select("id, metadata")
    .eq("lead_id", leadId)
    .eq("source_system", GROWTH_AIOS_ADAPTIVE_LOOP_1B_SOURCE_SYSTEM)
    .order("recorded_at", { ascending: false })
    .limit(48)

  const rows = (data ?? []) as Array<{ id: string; metadata: Record<string, unknown> }>
  for (const row of rows) {
    if (row.metadata?.processed_for_strategy === true) continue
    await admin
      .schema("growth")
      .from("lead_memory_events")
      .update({
        metadata: {
          ...row.metadata,
          processed_for_strategy: true,
          processed_at: processedAt,
        },
      })
      .eq("id", row.id)
  }
}
