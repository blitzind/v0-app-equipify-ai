import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
  type GrowthAutomationRuntimeApprovalGate,
} from "@/lib/growth/automation/growth-automation-runtime-execution-types"
import {
  mergeAutomationExecutionMetadata,
  readAutomationExecutionMetadata,
} from "@/lib/growth/automation/growth-automation-runtime-execution-utils"
import {
  fetchGrowthSequenceEnrollmentById,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"

export async function createAutomationApprovalGate(
  admin: SupabaseClient,
  input: {
    flowId: string
    enrollmentId: string
    enrollmentStepId: string
    stepOrder: number
    entryReason?: string
  },
): Promise<GrowthAutomationRuntimeApprovalGate> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("not_found")

  const metadata = enrollment.metadata ?? {}
  if (String(metadata.automation_flow_id ?? "") !== input.flowId) throw new Error("flow_mismatch")

  const executionMeta = readAutomationExecutionMetadata(metadata)
  const existingGates = Array.isArray(executionMeta.approval_gates)
    ? (executionMeta.approval_gates as GrowthAutomationRuntimeApprovalGate[])
    : []
  const existing = existingGates.find((gate) => gate.enrollmentStepId === input.enrollmentStepId)
  if (existing) return existing

  const now = new Date().toISOString()
  const gate: GrowthAutomationRuntimeApprovalGate = {
    gateId: randomUUID(),
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    stepOrder: input.stepOrder,
    status: "pending",
    requiredHumanApproval: true,
    executionEnabled: false,
    entryReason: input.entryReason ?? "Automation approval gate — human review required.",
    createdAt: now,
  }

  await updateGrowthSequenceEnrollmentStep(admin, input.enrollmentStepId, {
    status: "waiting",
  })

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    enrollmentStalled: true,
    metadata: mergeAutomationExecutionMetadata(metadata, {
      execution_run_id: String(executionMeta.execution_run_id ?? randomUUID()),
      last_status: "approval_required",
      approval_gates: [...existingGates, gate],
      qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
    }),
  })

  return gate
}
