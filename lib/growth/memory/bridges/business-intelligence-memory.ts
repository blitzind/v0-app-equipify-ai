/** GE-AIOS-12A — Business Intelligence → memory bridge (no BI fetch). */

import type { AvaNarrativeContext } from "@/lib/growth/ava-home/narrative/narrative-types"
import type { GrowthHomeWorkspaceSummaryPayload } from "@/lib/growth/home/growth-home-workspace-summary-types"
import type { AvaMemoryCorrection, AvaMemoryEvent } from "@/lib/growth/memory/types"

export function buildBusinessIntelligenceMemoryEvents(input: {
  organizationId: string
  generatedAt: string
  workspaceSummary: Pick<GrowthHomeWorkspaceSummaryPayload, "avaConsole">
  narrativeContext: AvaNarrativeContext
}): AvaMemoryEvent[] {
  const events: AvaMemoryEvent[] = []
  const { businessUnderstanding } = input.narrativeContext
  const suggested = input.workspaceSummary.avaConsole.suggestedNextAction?.trim()

  if (businessUnderstanding.hasBusinessResearch) {
    events.push({
      id: `bi:research:${input.generatedAt.slice(0, 10)}`,
      category: "business",
      timestamp: input.generatedAt,
      importance: 3,
      organizationId: input.organizationId,
      entityType: "organization",
      entityId: "business-intelligence",
      source: "business_intelligence",
      summary: "Business understanding updated.",
      metadata: { hasApprovedProfile: businessUnderstanding.hasApprovedProfile },
    })
  }

  if (suggested) {
    events.push({
      id: `bi:suggested:${input.generatedAt.slice(0, 10)}`,
      category: "learning",
      timestamp: input.generatedAt,
      importance: 3,
      organizationId: input.organizationId,
      entityType: "organization",
      entityId: "business-intelligence",
      source: "business_intelligence",
      summary: suggested.endsWith(".") ? suggested : `${suggested}.`,
      metadata: {},
    })
  }

  return events
}

export function buildBusinessIntelligenceCorrections(input: {
  narrativeContext: AvaNarrativeContext
  generatedAt: string
}): AvaMemoryCorrection[] {
  const corrections: AvaMemoryCorrection[] = []
  if (input.narrativeContext.businessUnderstanding.profileIncomplete) {
    corrections.push({
      id: "correction:pricing-unclear",
      summary: "Pricing positioning still needs clarification.",
      capturedAt: input.generatedAt,
    })
  }
  if (!input.narrativeContext.businessUnderstanding.hasBusinessResearch) {
    corrections.push({
      id: "correction:refresh-bi",
      summary: "Business research should be refreshed before expanding outreach.",
      capturedAt: input.generatedAt,
    })
  }
  return corrections
}
