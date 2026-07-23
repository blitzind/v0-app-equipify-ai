/** GE-AIOS-LIVE-8B — Revenue queue research candidate selection (client-safe, shared with Ava orchestrator). */

import {
  GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
  GROWTH_AVA_RESEARCH_QUEUE_SECTIONS,
} from "@/lib/growth/ava-home/growth-ava-research-orchestrator-types"
import type { RevenueQueueCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import { applyMissionBalanceToRevenueQueueCards } from "@/lib/growth/mission-balance/growth-mission-balance-1a"
import { shouldAutoQueueLeadResearch } from "@/lib/growth/research/growth-lead-research-readiness"
import { buildRevenueQueueDashboardSectionsFromLeads } from "@/lib/growth/revenue-queue/revenue-queue-section-projection"
import { resolveLeadAdmissionStateFromMetadata } from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import type { GrowthLead } from "@/lib/growth/types"

export const GE_AIOS_LIVE_8B_WORK_MANAGER_RESEARCH_PROJECTION_QA_MARKER =
  "ge-aios-live-8b-work-manager-research-projection-v1" as const

export const GE_AIOS_MISSION_BALANCE_1A_RESEARCH_SELECTION_QA_MARKER =
  "ge-aios-mission-balance-1a-research-selection-v1" as const

function selectFromRevenueQueueSections(
  leads: GrowthLead[],
  maxLeads: number,
  cardFilter: (lead: GrowthLead, card: RevenueQueueCardView) => boolean,
): RevenueQueueCardView[] {
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]))
  const sections = buildRevenueQueueDashboardSectionsFromLeads(leads, "priority")
  const selected: RevenueQueueCardView[] = []
  const seen = new Set<string>()

  for (const sectionId of GROWTH_AVA_RESEARCH_QUEUE_SECTIONS) {
    const section = sections.find((row) => row.id === sectionId)
    if (!section) continue
    for (const card of section.items) {
      if (seen.has(card.id)) continue
      const lead = leadsById.get(card.id)
      if (!lead || !cardFilter(lead, card)) continue
      seen.add(card.id)
      selected.push(card)
      if (selected.length >= maxLeads) return selected
    }
  }

  return selected
}

function applyMissionBalanceResearchOrdering(
  cards: RevenueQueueCardView[],
  leads: GrowthLead[],
): RevenueQueueCardView[] {
  return applyMissionBalanceToRevenueQueueCards(cards, leads)
}

/** Canonical revenue-queue research ordering (section intake → Mission Balance reorder). */
export function selectRevenueQueueResearchCandidates(
  leads: GrowthLead[],
  maxLeads: number = GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
): RevenueQueueCardView[] {
  const selected = selectFromRevenueQueueSections(leads, maxLeads, () => true)
  return applyMissionBalanceResearchOrdering(selected, leads)
}

/** Work Manager projection: review admission + research-ready only, then Mission Balance reorder. */
export function selectRevenueQueueReviewResearchCandidates(
  leads: GrowthLead[],
  maxLeads: number = GROWTH_AVA_RESEARCH_QUEUE_DEFAULT_MAX_LEADS,
): RevenueQueueCardView[] {
  const selected = selectFromRevenueQueueSections(leads, maxLeads, (lead) => {
    if (resolveLeadAdmissionStateFromMetadata(lead.metadata) !== "review") return false
    return shouldAutoQueueLeadResearch(lead)
  })
  return applyMissionBalanceResearchOrdering(selected, leads)
}

export function buildReviewResearchProjectionLeadIds(leads: GrowthLead[]): ReadonlySet<string> {
  return new Set(selectRevenueQueueReviewResearchCandidates(leads).map((card) => card.id))
}
