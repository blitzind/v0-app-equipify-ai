/** GE-AVA-PERSISTENCE-1 — Durable Supabase-backed outreach preparation pilot store (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchOutreachPreparationPilotControlState,
  findOutreachPreparationRunByPackageId,
  insertOutreachPreparationPilotRun,
  listOutreachPreparationPilotRuns,
  listOutreachPreparationPilotRunsForLead,
  markOutreachPreparationPackageApprovalDecision,
  resetOutreachPreparationPilotOrgState,
  upsertOutreachPreparationPilotControlState,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-repository"
import type {
  GrowthAutonomousOutreachPreparationPilotControlState,
  GrowthAutonomousOutreachPreparationRunRecord,
} from "@/lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

export type GrowthAutonomousOutreachPreparationPilotOrgState = {
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  runs: GrowthAutonomousOutreachPreparationRunRecord[]
  updatedAt: string
}

export async function getAutonomousOutreachPreparationPilotOrgState(
  admin: SupabaseClient,
  organizationId: string,
  now: string,
): Promise<GrowthAutonomousOutreachPreparationPilotOrgState> {
  const [control, runs] = await Promise.all([
    fetchOutreachPreparationPilotControlState(admin, organizationId),
    listOutreachPreparationPilotRuns(admin, organizationId),
  ])

  if (!control.updatedAt) {
    return {
      controlState: control.controlState,
      runs,
      updatedAt: now,
    }
  }

  return {
    controlState: control.controlState,
    runs,
    updatedAt: control.updatedAt,
  }
}

export async function setAutonomousOutreachPreparationPilotControlState(input: {
  admin: SupabaseClient
  organizationId: string
  controlState: GrowthAutonomousOutreachPreparationPilotControlState
  now: string
}): Promise<GrowthAutonomousOutreachPreparationPilotOrgState> {
  const control = await upsertOutreachPreparationPilotControlState(input.admin, {
    organizationId: input.organizationId,
    controlState: input.controlState,
    now: input.now,
  })
  const runs = await listOutreachPreparationPilotRuns(input.admin, input.organizationId)

  return {
    controlState: control.controlState,
    runs,
    updatedAt: control.updatedAt,
  }
}

export async function appendAutonomousOutreachPreparationRun(input: {
  admin: SupabaseClient
  organizationId: string
  run: GrowthAutonomousOutreachPreparationRunRecord
  now: string
}): Promise<GrowthAutonomousOutreachPreparationPilotOrgState> {
  await insertOutreachPreparationPilotRun(input.admin, {
    organizationId: input.organizationId,
    run: input.run,
  })

  return getAutonomousOutreachPreparationPilotOrgState(input.admin, input.organizationId, input.now)
}

export async function findAutonomousOutreachPreparationRunByPackageId(
  admin: SupabaseClient,
  organizationId: string,
  packageId: string,
): Promise<GrowthAutonomousOutreachPreparationRunRecord | null> {
  return findOutreachPreparationRunByPackageId(admin, {
    organizationId,
    packageId,
  })
}

export async function listOutreachPreparationRunsForLead(
  admin: SupabaseClient,
  organizationId: string,
  leadId: string,
): Promise<GrowthAutonomousOutreachPreparationRunRecord[]> {
  return listOutreachPreparationPilotRunsForLead(admin, { organizationId, leadId })
}

export async function markAutonomousOutreachPackageApprovalDecision(input: {
  admin: SupabaseClient
  organizationId: string
  packageId: string
  decision: "approved" | "rejected"
  executionRequestId?: string | null
  now: string
}): Promise<GrowthAutonomousOutreachPreparationRunRecord | null> {
  return markOutreachPreparationPackageApprovalDecision(input.admin, {
    organizationId: input.organizationId,
    packageId: input.packageId,
    decision: input.decision,
    executionRequestId: input.executionRequestId,
    now: input.now,
  })
}

export async function resetAutonomousOutreachPreparationPilotOrgState(
  admin: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await resetOutreachPreparationPilotOrgState(admin, organizationId)
}
