/** GE-AIOS-GROWTH-5G — In-memory Autonomous Meeting pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousMeetingPilotControlState,
  GrowthAutonomousMeetingRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-meeting-pilot-types"

export type GrowthAutonomousMeetingPilotOrgState = {
  controlState: GrowthAutonomousMeetingPilotControlState
  runs: GrowthAutonomousMeetingRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousMeetingPilotOrgState>()

function defaultState(now: string): GrowthAutonomousMeetingPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousMeetingPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousMeetingPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousMeetingPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousMeetingPilotControlState
  now: string
}): GrowthAutonomousMeetingPilotOrgState {
  const state = getAutonomousMeetingPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousMeetingRun(input: {
  organizationId: string
  run: GrowthAutonomousMeetingRunRecord
  now: string
}): GrowthAutonomousMeetingPilotOrgState {
  const state = getAutonomousMeetingPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function resetAutonomousMeetingPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
