/** GE-AIOS-GROWTH-5B — In-memory Autonomous Research Agent pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousResearchPilotControlState,
  GrowthAutonomousResearchRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-research-pilot-types"

export type GrowthAutonomousResearchPilotOrgState = {
  controlState: GrowthAutonomousResearchPilotControlState
  runs: GrowthAutonomousResearchRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousResearchPilotOrgState>()

function defaultState(now: string): GrowthAutonomousResearchPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousResearchPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousResearchPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousResearchPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousResearchPilotControlState
  now: string
}): GrowthAutonomousResearchPilotOrgState {
  const state = getAutonomousResearchPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousResearchRun(input: {
  organizationId: string
  run: GrowthAutonomousResearchRunRecord
  now: string
}): GrowthAutonomousResearchPilotOrgState {
  const state = getAutonomousResearchPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function resetAutonomousResearchPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
