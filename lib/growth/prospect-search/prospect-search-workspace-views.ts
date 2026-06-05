/** Prospect Search operator workspace view definitions (7.PS-FA). Configuration only — no persistence. */

import type {
  ProspectSearchWorkspaceQueueId,
  ProspectSearchWorkspaceViewDefinition,
  ProspectSearchWorkspaceViewId,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { PROSPECT_SEARCH_WORKSPACE_VIEW_IDS } from "@/lib/growth/prospect-search/prospect-search-workspace-types"

export const PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS: ProspectSearchWorkspaceViewDefinition[] =
  [
    {
      id: "outreach_ready",
      label: "Outreach Ready",
      description: "Accounts with PS-D tier ready_for_outreach and canonical company linkage.",
      prioritization_tiers: ["ready_for_outreach"],
      match_mode: "tier_only",
    },
    {
      id: "acquire_humans",
      label: "Acquire Humans",
      description:
        "Canonical accounts without linked humans — acquisition-first queue (7.PS-HA-FIX).",
      queue_ids: ["acquire_humans"],
      match_mode: "any_queue",
    },
    {
      id: "research_queue",
      label: "Research Queue",
      description: "Accounts marked research_first — queue discovery before outreach.",
      prioritization_tiers: ["research_first"],
      match_mode: "tier_only",
    },
    {
      id: "committee_gaps",
      label: "Committee Gaps",
      description: "Missing committee, single-thread risk, or missing economic buyer / champion.",
      queue_ids: ["missing_committee", "single_thread_risk", "no_economic_buyer", "no_champion"],
      match_mode: "any_queue",
    },
    {
      id: "missing_emails",
      label: "Missing Emails",
      description: "Canonical accounts without verified email on any person (7.3).",
      queue_ids: ["missing_verified_email"],
      match_mode: "any_queue",
    },
    {
      id: "missing_phones",
      label: "Missing Phones",
      description: "Canonical accounts without verified phone on any person (7.4).",
      queue_ids: ["missing_verified_phone"],
      match_mode: "any_queue",
    },
    {
      id: "low_coverage",
      label: "Low Coverage",
      description: "Low person linkage or low verified company intelligence category coverage.",
      queue_ids: ["low_person_linkage", "low_company_intelligence_coverage"],
      match_mode: "any_queue",
    },
    {
      id: "unresolved_accounts",
      label: "Unresolved Accounts",
      description: "Unresolved canonical company or unresolved contact linkage (PS-E).",
      queue_ids: ["unresolved_company", "unresolved_contacts"],
      match_mode: "any_queue",
    },
    {
      id: "graph_expansion",
      label: "Graph Expansion",
      description:
        "Accounts with graph growth opportunity — stale evidence, low named-person density, or expansion queue (7.PS-HS).",
      queue_ids: ["low_person_linkage", "missing_company_intelligence"],
      prioritization_tiers: ["research_first"],
      match_mode: "any_queue",
    },
  ]

export function getProspectSearchWorkspaceViewDefinition(
  viewId: ProspectSearchWorkspaceViewId,
): ProspectSearchWorkspaceViewDefinition | undefined {
  return PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS.find((row) => row.id === viewId)
}

export function isProspectSearchWorkspaceViewId(value: string): value is ProspectSearchWorkspaceViewId {
  return (PROSPECT_SEARCH_WORKSPACE_VIEW_IDS as readonly string[]).includes(value)
}

export function prospectSearchWorkspaceViewQueueIds(
  definition: ProspectSearchWorkspaceViewDefinition,
): ProspectSearchWorkspaceQueueId[] {
  return definition.queue_ids ?? []
}
