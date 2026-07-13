/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Live relationship event ingestion orchestration (server-only).
 * Inbound event → canonical relationship event → material change → Adaptive Loop 1A path.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import { advanceDraftFactoryForLeadLive } from "@/lib/growth/draft-factory/draft-factory-durable-live"
import { appendLeadMemoryTimelineEvent } from "@/lib/growth/lead-memory/memory-events"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  isRelationshipMaterialChange,
  evaluateOutboundEngagementMateriality,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-material-change"
import {
  recordCanonicalRelationshipEvent,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-relationship-event-record"
import {
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_RELATIONSHIP_WAKE_CONDITION,
  type LiveRelationshipEventSource,
  type LiveRelationshipIngestionResult,
  type RelationshipMaterialChangeContext,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1b-types"

export async function ingestLiveRelationshipEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    source: LiveRelationshipEventSource
    event: AdaptiveProspectEvent
    sourceEventId?: string | null
    neverRebuildAloneSource?: string | null
    materialContext?: RelationshipMaterialChangeContext
    scheduleStrategyRefresh?: boolean
  },
): Promise<LiveRelationshipIngestionResult> {
  const materialChange = isRelationshipMaterialChange({
    eventType: input.event.type,
    neverRebuildAloneSource: input.neverRebuildAloneSource,
    context: input.materialContext,
  })

  const recorded = await recordCanonicalRelationshipEvent(admin, {
    leadId: input.leadId,
    event: input.event,
    source: input.source,
    materialChange,
    sourceEventId: input.sourceEventId ?? null,
  })

  if (recorded.recorded && materialChange) {
    await appendLeadMemoryTimelineEvent(admin, {
      eventType: "relationship_stage_changed",
      title: "Relationship evolved",
      summary: input.event.summary,
      leadId: input.leadId,
      metadata: {
        qa_marker: GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
        adaptive_event_type: input.event.type,
        live_source: input.source,
        material_change: true,
      },
    }).catch(() => undefined)
  }

  let strategyRefreshScheduled = false
  let skipReason: string | null = null

  if (!recorded.recorded) {
    skipReason = "event_not_recorded"
  } else if (!materialChange) {
    skipReason = "not_material"
  } else if (input.scheduleStrategyRefresh === false) {
    skipReason = "refresh_disabled"
  } else {
    const lead = await fetchGrowthLeadById(admin, input.leadId).catch(() => null)
    if (!lead?.organizationId && !input.organizationId) {
      skipReason = "organization_missing"
    } else {
      const organizationId = input.organizationId || lead?.organizationId || ""
      const now = input.event.occurredAt
      const advance = await advanceDraftFactoryForLeadLive(admin, {
        organizationId,
        leadId: input.leadId,
        wake: {
          type: "outreach_preparation_wake",
          sourceId: `adaptive-loop-1b:${input.event.type}:${now}`,
        },
        portfolioSelected: true,
        now,
        allowGeneration: true,
      }).catch(() => null)

      strategyRefreshScheduled = Boolean(
        advance &&
          (advance.nextState === "waiting_for_approval" ||
            advance.nextState === "generation_required" ||
            advance.reason?.includes("generation")),
      )

      if (!strategyRefreshScheduled) {
        skipReason = advance?.reason ?? "draft_factory_not_advanced"
      }

      logGrowthEngine("adaptive_loop_1b_relationship_event_ingested", {
        qa_marker: GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
        lead_id: input.leadId,
        event_type: input.event.type,
        live_source: input.source,
        material_change: materialChange,
        strategy_refresh_scheduled: strategyRefreshScheduled,
        wake_condition: GROWTH_AIOS_ADAPTIVE_LOOP_1B_RELATIONSHIP_WAKE_CONDITION,
      })
    }
  }

  return {
    qaMarker: GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
    leadId: input.leadId,
    eventType: input.event.type,
    source: input.source,
    recorded: recorded.recorded,
    materialChange,
    strategyRefreshScheduled,
    skipReason,
  }
}

export async function ingestOutboundEngagementRelationshipEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    engagementType: "email_opened" | "link_clicked"
    occurredAt: string
    subject?: string | null
    priorEngagementOpens?: number
    priorLinkClicks?: number
    sourceEventId?: string | null
  },
): Promise<LiveRelationshipIngestionResult | null> {
  const material = evaluateOutboundEngagementMateriality(input.engagementType, {
    priorEngagementOpens: input.priorEngagementOpens,
    priorLinkClicks: input.priorLinkClicks,
    strategyRelevantSignal: input.engagementType === "link_clicked",
  })
  if (!material) {
    return {
      qaMarker: GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
      leadId: input.leadId,
      eventType: "company_research_updated",
      source: "outbound_tracking",
      recorded: false,
      materialChange: false,
      strategyRefreshScheduled: false,
      skipReason: "engagement_not_material",
    }
  }

  const { mapOutboundEngagementToAdaptiveProspectEvent } = await import(
    "@/lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
  )
  const event = mapOutboundEngagementToAdaptiveProspectEvent({
    eventType: input.engagementType === "email_opened" ? "opened" : "clicked",
    occurredAt: input.occurredAt,
    subject: input.subject,
  })
  if (!event) return null

  return ingestLiveRelationshipEvent(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    source: "outbound_tracking",
    event,
    sourceEventId: input.sourceEventId,
    materialContext: {
      priorEngagementOpens: input.priorEngagementOpens,
      priorLinkClicks: input.priorLinkClicks,
      strategyRelevantSignal: input.engagementType === "link_clicked",
    },
  })
}

export async function ingestBuyingCommitteePromotionForCompany(
  admin: SupabaseClient,
  input: {
    companyId: string
    committeeRole: string
    personLabel?: string | null
    occurredAt: string
    sourceEventId?: string | null
  },
): Promise<void> {
  const { data: leads } = await admin
    .schema("growth")
    .from("leads")
    .select("id, organization_id, metadata")
    .contains("metadata", { canonical_company_id: input.companyId })
    .limit(24)

  const rows = (leads ?? []) as Array<{
    id: string
    organization_id: string | null
    metadata: Record<string, unknown> | null
  }>

  if (!rows.length) return

  const { mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent } = await import(
    "@/lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
  )
  const event = mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent({
    committeeRole: input.committeeRole,
    change: "appeared",
    personLabel: input.personLabel,
    occurredAt: input.occurredAt,
  })
  if (!event) return

  for (const lead of rows) {
    if (!lead.organization_id) continue
    await ingestLiveRelationshipEvent(admin, {
      organizationId: lead.organization_id,
      leadId: lead.id,
      source: "buying_committee",
      event,
      sourceEventId: input.sourceEventId ?? null,
    }).catch(() => undefined)
  }
}
