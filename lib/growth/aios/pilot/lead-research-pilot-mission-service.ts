/** GE-AIOS-4A — Lead Research Pilot mission binding (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildInitialObjectiveRuntimeStageRecords,
  transitionObjectiveRuntimeStage,
} from "@/lib/growth/objectives/growth-objective-stage-state-machine"
import {
  getGrowthObjective,
  insertGrowthObjective,
  listGrowthObjectives,
  updateGrowthObjective,
} from "@/lib/growth/objectives/growth-objective-repository"
import type {
  GrowthObjective,
  GrowthObjectiveRecentSignal,
  GrowthObjectiveStageId,
} from "@/lib/growth/objectives/growth-objective-types"
import { GROWTH_OBJECTIVE_RUNTIME_QA_MARKER } from "@/lib/growth/objectives/growth-objective-types"
import {
  LEAD_RESEARCH_PILOT_MISSION_TITLE,
} from "@/lib/growth/aios/pilot/lead-research-pilot-types"

function isLeadResearchPilotObjective(objective: GrowthObjective): boolean {
  return objective.title === LEAD_RESEARCH_PILOT_MISSION_TITLE
}

function buildResearchStageRuntime(): GrowthObjective["runtime"] {
  const stageStates = buildInitialObjectiveRuntimeStageRecords()
  const researchStageId: GrowthObjectiveStageId = "research"
  stageStates[researchStageId] = transitionObjectiveRuntimeStage(stageStates[researchStageId], "running", {
    progress: 25,
  })

  return {
    qa_marker: GROWTH_OBJECTIVE_RUNTIME_QA_MARKER,
    currentStageId: researchStageId,
    stageStates,
    startedAt: new Date().toISOString(),
    lastTickAt: null,
    stoppedAt: null,
    estimatedCompletionDate: null,
    running: true,
    lastSignalAt: null,
    lastProgressAt: null,
    stalledSince: null,
    lastSchedulerAt: null,
  }
}

export async function ensureLeadResearchPilotMission(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthObjective> {
  const existing = (await listGrowthObjectives(admin, organizationId)).find(isLeadResearchPilotObjective)
  if (existing) {
    if (existing.runtime?.currentStageId === "research" && existing.runtime.running) {
      return existing
    }
    return updateGrowthObjective(admin, organizationId, existing.id, {
      status: "active",
      runtime: buildResearchStageRuntime(),
    })
  }

  const created = await insertGrowthObjective(admin, organizationId, {
    title: LEAD_RESEARCH_PILOT_MISSION_TITLE,
    description: "GE-AIOS-4A autonomous lead research pilot mission container.",
    objectiveType: "custom",
    targetValue: 1000,
    priority: "medium",
    autonomyLevel: "objective",
    safetyMode: "strict",
  })

  return updateGrowthObjective(admin, organizationId, created.id, {
    status: "active",
    runtime: buildResearchStageRuntime(),
  })
}

export async function bindLeadToLeadResearchPilotMission(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; leadId: string },
): Promise<GrowthObjective> {
  const objective = await getGrowthObjective(admin, input.organizationId, input.missionId)
  if (!objective) throw new Error("lead_research_pilot_mission_not_found")

  const signal: GrowthObjectiveRecentSignal = {
    id: crypto.randomUUID(),
    type: "automation_event",
    leadId: input.leadId,
    receivedAt: new Date().toISOString(),
    payload: {
      source: "ge-aios-4a-lead-research-pilot",
      event: "prospect_created",
    },
  }

  const recentSignals = [signal, ...(objective.recentSignals ?? [])].slice(0, 20)
  return updateGrowthObjective(admin, input.organizationId, objective.id, {
    recentSignals,
    runtime: objective.runtime ?? buildResearchStageRuntime(),
    status: "active",
  })
}
