/**
 * GE-LEADS-CANONICAL-3C — Revenue Queue detail resolution (legacy inbox id or canonical lead id).
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchLeadInboxById } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID } from "@/lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge"
import { buildLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-builder"
import type { GrowthLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { buildPseudoInboxRowFromGrowthLead } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"

export const GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER =
  "growth-revenue-queue-detail-bridge-v1" as const

export type RevenueQueueDetailSource = "legacy_inbox" | "canonical_lead"

export type RevenueQueueDetailResolution = {
  source: RevenueQueueDetailSource
  growth_lead_id: string | null
  inbox_id: string | null
}

export type RevenueQueueDetailPayload = {
  workspace: GrowthLeadOperatorWorkspacePayload
  resolution: RevenueQueueDetailResolution
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function readGrowthLeadIdFromInboxMetadata(metadata: Record<string, unknown> | undefined): string | null {
  if (!metadata) return null
  return asString(metadata[GROWTH_LEAD_INBOX_METADATA_GROWTH_LEAD_ID]) || null
}

/** Resolve workspace — prefer canonical growth.leads id, then legacy inbox id. */
export async function loadRevenueQueueOperatorWorkspace(
  admin: SupabaseClient,
  leadId: string,
): Promise<RevenueQueueDetailPayload | null> {
  const lead = await fetchGrowthLeadById(admin, leadId)
  if (lead) {
    const pseudoRow = buildPseudoInboxRowFromGrowthLead(lead)
    return {
      workspace: await buildLeadOperatorWorkspacePayload(admin, pseudoRow),
      resolution: {
        source: "canonical_lead",
        growth_lead_id: lead.id,
        inbox_id: null,
      },
    }
  }

  const inboxRow = await fetchLeadInboxById(admin, leadId)
  if (!inboxRow) return null

  return {
    workspace: await buildLeadOperatorWorkspacePayload(admin, inboxRow),
    resolution: {
      source: "legacy_inbox",
      growth_lead_id: readGrowthLeadIdFromInboxMetadata(inboxRow.metadata),
      inbox_id: inboxRow.id,
    },
  }
}

/** Fields unavailable when resolving from canonical lead only (no inbox row / inbox-keyed tables). */
export const REVENUE_QUEUE_CANONICAL_DETAIL_GAPS = [
  "search_intent_signals rows (table keyed by lead_inbox_id)",
  "buying_stage_assessments rows (table keyed by lead_inbox_id)",
  "company_identification_matches rows (table keyed by lead_inbox_id)",
  "intent_pixel visit history (requires site_key + visitor_key on inbox/intake metadata)",
  "inbox-only workflow history (promoted_at, duplicate_reason, inbox status transitions)",
] as const
