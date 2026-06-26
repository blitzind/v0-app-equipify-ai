/** GE-AIOS-GROWTH-5D — In-memory Autonomous Planning Agent pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousPlanningPilotControlState,
  GrowthAutonomousPlanningRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-planning-pilot-types"

export type GrowthAutonomousPlanningPilotOrgState = {
  controlState: GrowthAutonomousPlanningPilotControlState
  runs: GrowthAutonomousPlanningRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousPlanningPilotOrgState>()

function defaultState(now: string): GrowthAutonomousPlanningPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousPlanningPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousPlanningPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousPlanningPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousPlanningPilotControlState
  now: string
}): GrowthAutonomousPlanningPilotOrgState {
  const state = getAutonomousPlanningPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousPlanningRun(input: {
  organizationId: string
  run: GrowthAutonomousPlanningRunRecord
  now: string
}): GrowthAutonomousPlanningPilotOrgState {
  const state = getAutonomousPlanningPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function resetAutonomousPlanningPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
