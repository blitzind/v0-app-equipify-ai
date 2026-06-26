/** GE-AIOS-GROWTH-5C — In-memory Autonomous Qualification Agent pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousQualificationPilotControlState,
  GrowthAutonomousQualificationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-qualification-pilot-types"

export type GrowthAutonomousQualificationPilotOrgState = {
  controlState: GrowthAutonomousQualificationPilotControlState
  runs: GrowthAutonomousQualificationRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousQualificationPilotOrgState>()

function defaultState(now: string): GrowthAutonomousQualificationPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousQualificationPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousQualificationPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousQualificationPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousQualificationPilotControlState
  now: string
}): GrowthAutonomousQualificationPilotOrgState {
  const state = getAutonomousQualificationPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousQualificationRun(input: {
  organizationId: string
  run: GrowthAutonomousQualificationRunRecord
  now: string
}): GrowthAutonomousQualificationPilotOrgState {
  const state = getAutonomousQualificationPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function resetAutonomousQualificationPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
