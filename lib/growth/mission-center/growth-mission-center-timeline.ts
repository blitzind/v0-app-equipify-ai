/** GE-AVA-MISSION-CENTER-1A — Timeline aggregation (no duplicate storage). */

import type { GrowthObjective } from "@/lib/growth/objectives/growth-objective-types"
import type { GrowthRevenueDirectorCommandCenterSnapshot } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import type { GrowthWorkspaceDashboardViewModel } from "@/lib/growth/workspace/growth-workspace-dashboard-types"
import type { GrowthHomeMissionTimelineItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  buildMissionTimeline,
  type GrowthHomeRevenueMissionInput,
} from "@/lib/growth/workspace/executive-briefing/growth-home-revenue-mission-synthesizer"
import type { GrowthHomeRevenueMission } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import {
  avaActivityForPresentationStage,
  mapRuntimeStageToPresentationStage,
  presentationStageLabel,
} from "@/lib/growth/mission-center/growth-mission-center-stage-mapper"

function isToday(iso: string): boolean {
  const date = new Date(iso)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function objectiveHistoryToTimeline(objective: GrowthObjective): GrowthHomeMissionTimelineItem[] {
  const items: GrowthHomeMissionTimelineItem[] = []
  for (const entry of objective.executionHistory.slice(-6).reverse()) {
    const stage = mapRuntimeStageToPresentationStage(entry.stageId)
    items.push({
      id: `obj-history-${objective.id}-${entry.id}`,
      summary: `Ava ${entry.outcome === "success" ? "completed" : entry.outcome === "blocked" ? "paused on" : "worked on"} ${presentationStageLabel(stage).toLowerCase()}.`,
      occurredAt: entry.ts,
      missionId: objective.id,
    })
  }
  for (const signal of objective.recentSignals.slice(-3).reverse()) {
    items.push({
      id: `obj-signal-${objective.id}-${signal.id}`,
      summary: `Ava recorded ${signal.type.replaceAll("_", " ")} activity.`,
      occurredAt: signal.receivedAt,
      missionId: objective.id,
    })
  }
  return items
}

export function buildMissionCenterTimeline(input: {
  dashboard: GrowthWorkspaceDashboardViewModel
  objectives: GrowthObjective[]
  revenueDirectorSnapshot?: GrowthRevenueDirectorCommandCenterSnapshot | null
  revenueMissions?: GrowthHomeRevenueMission[]
}): GrowthHomeMissionTimelineItem[] {
  const merged: GrowthHomeMissionTimelineItem[] = []

  for (const objective of input.objectives) {
    merged.push(...objectiveHistoryToTimeline(objective))
    const stage = mapRuntimeStageToPresentationStage(objective.runtime?.currentStageId)
    merged.push({
      id: `obj-current-${objective.id}`,
      summary: avaActivityForPresentationStage(stage),
      occurredAt: objective.runtime?.lastTickAt ?? objective.updatedAt,
      missionId: objective.id,
    })
  }

  const revenueInput: GrowthHomeRevenueMissionInput = {
    dashboard: input.dashboard,
    revenueDirectorSnapshot: input.revenueDirectorSnapshot ?? undefined,
  }
  if (input.revenueMissions?.length) {
    merged.push(...buildMissionTimeline(revenueInput, input.revenueMissions))
  }

  return merged
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
    .slice(0, 12)
}

export function buildCompletedTodayFromObjective(objective: GrowthObjective): string[] {
  const completed: string[] = []
  for (const entry of objective.executionHistory) {
    if (entry.outcome !== "success" || !isToday(entry.ts)) continue
    const stage = mapRuntimeStageToPresentationStage(entry.stageId)
    if (stage === "lead_discovery") completed.push("Found new lead sources")
    if (stage === "research") completed.push("Researched companies")
    if (stage === "qualification") completed.push("Qualified accounts")
    if (stage === "opportunity") completed.push("Identified opportunities")
    if (stage === "outreach_preparation") completed.push("Prepared outreach drafts")
    if (stage === "execution") completed.push("Executed approved outreach")
  }
  for (const signal of objective.recentSignals) {
    if (!isToday(signal.receivedAt)) continue
    if (signal.type === "reply") completed.push("Processed replies")
    if (signal.type === "meeting_booked" || signal.type === "booking_completed") {
      completed.push("Booked meetings")
    }
    if (signal.type === "opportunity_created") completed.push("Created opportunities")
  }
  return [...new Set(completed)].slice(0, 5)
}
