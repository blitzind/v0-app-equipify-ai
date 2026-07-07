/** GE-AIOS-GROWTH-5F — In-memory Autonomous Outreach Preparation pilot store (server-only). */

import "server-only"

import type {
  GrowthAutonomousOutreachPreparationPilotControlState,
  GrowthAutonomousOutreachPreparationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export type GrowthAutonomousOutreachPreparationPilotOrgState = {
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  updatedAt: string
}

const orgStateById = new Map<string, GrowthAutonomousOutreachPreparationPilotOrgState>()

function defaultState(now: string): GrowthAutonomousOutreachPreparationPilotOrgState {
  return {
    controlState: "disabled",
    runs: [],
    updatedAt: now,
  }
}

export function getAutonomousOutreachPreparationPilotOrgState(
  organizationId: string,
  now: string,
): GrowthAutonomousOutreachPreparationPilotOrgState {
  const existing = orgStateById.get(organizationId)
  if (existing) return existing
  const created = defaultState(now)
  orgStateById.set(organizationId, created)
  return created
}

export function setAutonomousOutreachPreparationPilotControlState(input: {
  organizationId: string
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  now: string
}): GrowthAutonomousOutreachPreparationPilotOrgState {
  const state = getAutonomousOutreachPreparationPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    controlState: input.controlState,
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function appendAutonomousOutreachPreparationRun(input: {
  organizationId: string
  run: GrowthAutonomousOutreachPreparationRunRecord
  now: string
}): GrowthAutonomousOutreachPreparationPilotOrgState {
  const state = getAutonomousOutreachPreparationPilotOrgState(input.organizationId, input.now)
  const next = {
    ...state,
    runs: [...state.runs, input.run].slice(-500),
    updatedAt: input.now,
  }
  orgStateById.set(input.organizationId, next)
  return next
}

export function findAutonomousOutreachPreparationRunByPackageId(
  organizationId: string,
  packageId: string,
): GrowthAutonomousOutreachPreparationRunRecord | null {
  const state = orgStateById.get(organizationId)
  if (!state) return null
  return (
    state.runs.find(
      (run) => run.packageId === packageId || run.approvalPackage?.packageId === packageId,
    ) ?? null
  )
}

export function markAutonomousOutreachPackageApprovalDecision(input: {
  organizationId: string
  packageId: string
  decision: "approved" | "rejected"
  executionRequestId?: string | null
  now: string
}): GrowthAutonomousOutreachPreparationRunRecord | null {
  const state = orgStateById.get(input.organizationId)
  if (!state) return null

  let updatedRun: GrowthAutonomousOutreachPreparationRunRecord | null = null
  const runs = state.runs.map((run) => {
    const matches =
      run.packageId === input.packageId || run.approvalPackage?.packageId === input.packageId
    if (!matches) return run
    updatedRun = {
      ...run,
      approvalPackage: run.approvalPackage
        ? {
            ...run.approvalPackage,
            packageApprovalDecision: input.decision,
            executionRequestId: input.executionRequestId ?? null,
          }
        : null,
    }
    return updatedRun
  })

  if (!updatedRun) return null

  orgStateById.set(input.organizationId, {
    ...state,
    runs,
    updatedAt: input.now,
  })
  return updatedRun
}

export function resetAutonomousOutreachPreparationPilotOrgState(organizationId: string): void {
  orgStateById.delete(organizationId)
}
