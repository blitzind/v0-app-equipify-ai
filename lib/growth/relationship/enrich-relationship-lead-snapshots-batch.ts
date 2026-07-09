/**
 * GE-AIOS-15E — Bounded batch relationship snapshot enrichment for Home lead pool.
 * Fixed query count; uses lead rows already loaded by workspace summary.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { GrowthLead } from "@/lib/growth/types"
import {
  compactRelationshipLeadSnapshot,
  hasRelationshipSnapshotSignal,
  mergeRelationshipLeadSnapshotParts,
  projectRelationshipConversationSnapshot,
  projectRelationshipStateSnapshot,
  type RelationshipLeadStateSourceRow,
} from "@/lib/growth/relationship/relationship-lead-snapshot-projection"
import {
  GROWTH_HOME_LEAD_POOL_BATCH_LIMIT,
  GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT,
  GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
} from "@/lib/growth/relationship/relationship-scale-limits"
import type {
  RelationshipLeadSnapshot,
  RelationshipLeadSnapshotMap,
} from "@/lib/growth/relationship/relationship-lead-snapshot-types"

import type { GrowthHomeRelationshipSnapshotEnrichment } from "@/lib/growth/home/growth-home-workspace-summary-types"
import { GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER } from "@/lib/growth/home/growth-home-workspace-summary-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function growthLeadToStateSourceRow(lead: GrowthLead): RelationshipLeadStateSourceRow {
  return {
    id: lead.id,
    metadata: lead.metadata,
    relationshipStrengthTier: lead.relationshipStrengthTier,
    relationshipLastMeaningfulTouchAt: lead.relationshipLastMeaningfulTouchAt,
    followUpAt: lead.followUpAt,
    nextBestAction: lead.nextBestAction,
    nextBestActionReason: lead.nextBestActionReason,
    workflowHealth: lead.workflowHealth,
    workflowHealthReason: lead.workflowHealthReason,
    relationshipSummary: lead.relationshipSummary,
    conversationSummary: lead.conversationSummary,
    conversationSentiment: lead.conversationSentiment,
    conversationLastMeaningfulConversationAt: lead.conversationLastMeaningfulConversationAt,
  }
}

function indexByLeadId<T extends { lead_id?: unknown }>(
  rows: T[],
): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    const leadId = asString(row.lead_id)
    if (!leadId || map.has(leadId)) continue
    map.set(leadId, row)
  }
  return map
}

function groupTimelineByLeadId(
  rows: Array<Record<string, unknown>>,
): Map<string, Array<{ title: string; summary: string }>> {
  const map = new Map<string, Array<{ title: string; summary: string }>>()
  for (const row of rows) {
    const leadId = asString(row.lead_id)
    if (!leadId) continue
    const bucket = map.get(leadId) ?? []
    if (bucket.length >= 5) continue
    bucket.push({
      title: asString(row.title),
      summary: asString(row.summary),
    })
    map.set(leadId, bucket)
  }
  return map
}

function emptyEnrichment(warning: string | null = null): GrowthHomeRelationshipSnapshotEnrichment {
  return {
    qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
    byLeadId: {},
    meta: {
      attempted: 0,
      enriched: 0,
      degraded: Boolean(warning),
      warning,
      queryCount: 0,
    },
  }
}

/**
 * Enrich relationship snapshots for leads already in the Home pool.
 * Uses a fixed number of bounded batch queries (no per-lead query loop).
 */
export async function enrichRelationshipLeadSnapshotsBatch(
  admin: SupabaseClient,
  leads: GrowthLead[],
): Promise<GrowthHomeRelationshipSnapshotEnrichment> {
  const pool = leads.slice(0, GROWTH_HOME_LEAD_POOL_BATCH_LIMIT)
  const leadIds = pool.map((lead) => lead.id).filter(Boolean)
  if (leadIds.length === 0) return emptyEnrichment()

  const auxLimit = Math.min(
    GROWTH_HOME_RELATIONSHIP_SNAPSHOT_AUX_ROW_LIMIT,
    GROWTH_RELATIONSHIP_MAX_BATCH_LIMIT,
  )

  let queryCount = 0

  try {
    const [profileRes, relationshipRes, threadRes, replyRes, timelineRes] = await Promise.all([
      admin
        .schema("growth")
        .from("lead_memory_profiles")
        .select("lead_id, relationship_stage, summary, memory_coverage_score")
        .in("lead_id", leadIds)
        .limit(leadIds.length),
      admin
        .schema("growth")
        .from("relationship_context")
        .select("lead_id, relationship_stage, engagement_trend, progression_score, risk_flags")
        .in("lead_id", leadIds)
        .limit(leadIds.length),
      admin
        .schema("growth")
        .from("inbox_threads")
        .select("id, lead_id, thread_status, last_message_at, sla_due_at")
        .in("lead_id", leadIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(auxLimit),
      admin
        .schema("growth")
        .from("outbound_replies")
        .select("lead_id, received_at, intent, classification_v2")
        .in("lead_id", leadIds)
        .order("received_at", { ascending: false })
        .limit(auxLimit),
      admin
        .schema("growth")
        .from("conversation_timeline_events")
        .select("lead_id, title, summary, occurred_at")
        .in("lead_id", leadIds)
        .order("occurred_at", { ascending: false })
        .limit(auxLimit),
    ])
    queryCount = 5

    if (profileRes.error) throw new Error(profileRes.error.message)
    if (relationshipRes.error) throw new Error(relationshipRes.error.message)
    if (threadRes.error) throw new Error(threadRes.error.message)
    if (replyRes.error) throw new Error(replyRes.error.message)
    if (timelineRes.error) throw new Error(timelineRes.error.message)

    const profilesByLeadId = indexByLeadId((profileRes.data ?? []) as Array<{ lead_id: string }>)
    const relationshipByLeadId = indexByLeadId((relationshipRes.data ?? []) as Array<{ lead_id: string }>)
    const threadsByLeadId = indexByLeadId((threadRes.data ?? []) as Array<{ lead_id: string }>)
    const repliesByLeadId = indexByLeadId((replyRes.data ?? []) as Array<{ lead_id: string }>)
    const timelineByLeadId = groupTimelineByLeadId((timelineRes.data ?? []) as Array<Record<string, unknown>>)

    const byLeadId: RelationshipLeadSnapshotMap = {}
    let enriched = 0

    for (const lead of pool) {
      const state = projectRelationshipStateSnapshot({
        lead: growthLeadToStateSourceRow(lead),
        profile: profilesByLeadId.get(lead.id) as Record<string, unknown> | undefined,
        relationshipContext: relationshipByLeadId.get(lead.id) as Record<string, unknown> | undefined,
      })

      const conversation = projectRelationshipConversationSnapshot({
        leadId: lead.id,
        thread: threadsByLeadId.get(lead.id) as Record<string, unknown> | undefined,
        reply: repliesByLeadId.get(lead.id) as Record<string, unknown> | undefined,
        timelineEntries: timelineByLeadId.get(lead.id),
        conversationSummary: lead.conversationSummary,
        conversationSentiment: lead.conversationSentiment,
        conversationLastMeaningfulAt: lead.conversationLastMeaningfulConversationAt,
      })

      const merged = compactRelationshipLeadSnapshot(
        mergeRelationshipLeadSnapshotParts(state, conversation),
      )

      if (hasRelationshipSnapshotSignal(merged)) {
        byLeadId[lead.id] = merged
        enriched += 1
      }
    }

    logGrowthEngine("home_relationship_snapshot_enrichment_completed", {
      attempted: leadIds.length,
      enriched,
      queryCount,
    })

    return {
      qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
      byLeadId,
      meta: {
        attempted: leadIds.length,
        enriched,
        degraded: false,
        warning: null,
        queryCount,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "relationship_snapshot_enrichment_failed"
    logGrowthEngine("home_relationship_snapshot_enrichment_failed", {
      attempted: leadIds.length,
      message,
      queryCount,
    })

    return {
      qaMarker: GROWTH_HOME_RELATIONSHIP_SNAPSHOT_15E_QA_MARKER,
      byLeadId: {},
      meta: {
        attempted: leadIds.length,
        enriched: 0,
        degraded: true,
        warning: message,
        queryCount,
      },
    }
  }
}
