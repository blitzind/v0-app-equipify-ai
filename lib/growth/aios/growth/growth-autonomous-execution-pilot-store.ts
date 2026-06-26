/** GE-AIOS-GROWTH-5E — In-memory Autonomous Execution Agent pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousExecutionPilotControlState,
  GrowthAutonomousExecutionRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-execution-pilot-types"

export type GrowthAutonomousExecutionPilotOrgState = {
  controlState: GrowthAutonomousExecutionPilotControlState
  runs: GrowthAutonomousExecutionRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousExecutionPilotOrgState>()

function defaultState(now: string): GrowthAutonomousExecutionPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousExecutionPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousExecutionPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousExecutionPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousExecutionPilotControlState
  now: string
}): GrowthAutonomousExecutionPilotOrgState {
  const state = getAutonomousExecutionPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousExecutionRun(input: {
  organizationId: string
  run: GrowthAutonomousExecutionRunRecord
  now: string
}): GrowthAutonomousExecutionPilotOrgState {
  const state = getAutonomousExecutionPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function resetAutonomousExecutionPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
