/** GE-AIOS-21A — Client-safe drawer opportunistic research enqueue (non-blocking). */

import {
  hasUsableLeadResearch,
  shouldAutoQueueLeadResearch,
} from "@/lib/growth/research/growth-lead-research-readiness"
import type { GrowthLead } from "@/lib/growth/types"

const inFlightLeadIds = new Set<string>()

export async function enqueueGrowthLeadResearchFromDrawer(lead: GrowthLead): Promise<void> {
  if (!shouldAutoQueueLeadResearch(lead)) return
  if (inFlightLeadIds.has(lead.id)) return

  inFlightLeadIds.add(lead.id)
  try {
    await fetch(`/api/platform/growth/leads/${lead.id}/research/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
  } catch {
    // Non-blocking — drawer remains usable if enqueue fails.
  } finally {
    inFlightLeadIds.delete(lead.id)
  }
}

export function resolveDrawerResearchPrimaryAction(input: {
  lead: GrowthLead
  prospectRunning?: boolean
  hasPersonalization?: boolean
}): {
  label: string
  mode: "researching" | "review_research" | "approve_outreach" | "research_company" | "generate_personalization"
} {
  if (input.prospectRunning) {
    return { label: "Ava is researching", mode: "researching" }
  }

  const researched = hasUsableLeadResearch(input.lead)
  if (!researched) {
    return { label: "Research company", mode: "research_company" }
  }

  if (input.hasPersonalization) {
    return { label: "Approve outreach", mode: "approve_outreach" }
  }

  return { label: "Review research", mode: "review_research" }
}
