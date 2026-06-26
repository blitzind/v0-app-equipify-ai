/** GE-AIOS-GROWTH-3A — Deterministic internal-only execution step runner (client-safe). */

import type { GrowthLeadResearchExecutionPlanStep } from "@/lib/growth/aios/growth/growth-lead-research-execution-plan"
import {
  buildExecutionMutationId,
  type GrowthLeadResearchExecutionContext,
  type GrowthLeadResearchExecutionContextMutation,
  type GrowthLeadResearchInternalMutationRuntimeWorkflow,
} from "@/lib/growth/aios/growth/growth-lead-research-execution-runtime-types"

export type GrowthLeadResearchExecutionStepRunResult =
  | {
      ok: true
      mutation: GrowthLeadResearchExecutionContextMutation
      context: GrowthLeadResearchExecutionContext
    }
  | {
      ok: false
      error: string
    }

function deterministicPayload(
  workflowType: GrowthLeadResearchInternalMutationRuntimeWorkflow,
  step: GrowthLeadResearchExecutionPlanStep,
): Record<string, unknown> {
  switch (step.stepId) {
    case "assemble_context":
      return {
        contextVersion: "growth-internal-v1",
        workflowType,
        assembledFields: ["lead_profile", "evidence_summary", "execution_plan"],
      }
    case "verify_email":
      return {
        verificationMode: "internal_record_only",
        result: "verified_stub",
        outboundAttempted: false,
      }
    case "record_decision":
      return {
        decisionScope: "growth_internal",
        recorded: true,
        providerInvoked: false,
      }
    case "generate_committee":
      return {
        committeeMembers: [],
        source: "deterministic_stub",
        outboundAttempted: false,
      }
    case "operator_review":
      return {
        checkpoint: "operator_review",
        autoApprovedInRuntimeFoundation: true,
      }
    case "prepare_meeting":
      return {
        briefPrepared: true,
        outboundAttempted: false,
      }
    case "plan_research":
      return {
        researchPlanVersion: "growth-internal-v1",
        providerInvoked: false,
      }
    case "research_company":
      return {
        researchCompleted: true,
        providerInvoked: false,
        coreTouched: false,
      }
    case "requalify":
      return {
        requalified: true,
        providerInvoked: false,
      }
    default:
      return {
        stepId: step.stepId,
        deterministic: true,
      }
  }
}

function mutationTypeForStep(stepId: string): string {
  switch (stepId) {
    case "assemble_context":
      return "growth.context_assembled"
    case "verify_email":
      return "growth.email_verification_recorded"
    case "record_decision":
      return "growth.decision_stub_recorded"
    case "generate_committee":
      return "growth.buying_committee_recorded"
    case "operator_review":
      return "growth.operator_checkpoint_recorded"
    case "prepare_meeting":
      return "growth.meeting_brief_recorded"
    case "plan_research":
      return "growth.research_plan_recorded"
    case "research_company":
      return "growth.company_research_recorded"
    case "requalify":
      return "growth.requalification_recorded"
    default:
      return "growth.internal_step_recorded"
  }
}

export function runDeterministicExecutionStep(input: {
  context: GrowthLeadResearchExecutionContext
  step: GrowthLeadResearchExecutionPlanStep
  now?: string
}): GrowthLeadResearchExecutionStepRunResult {
  const now = input.now ?? new Date().toISOString()
  const mutation: GrowthLeadResearchExecutionContextMutation = {
    mutationId: buildExecutionMutationId(input.context.executionId, input.step.stepId),
    stepId: input.step.stepId,
    mutationType: mutationTypeForStep(input.step.stepId),
    scope: "growth_internal",
    recordedAt: now,
    summary: `${input.step.label} completed (internal mutation only).`,
    payload: deterministicPayload(input.context.workflowType, input.step),
  }

  const nextContext: GrowthLeadResearchExecutionContext = {
    ...input.context,
    internalMutations: [...input.context.internalMutations, mutation],
    outboundActionsAttempted: input.context.outboundActionsAttempted,
    providerCallsAttempted: input.context.providerCallsAttempted,
    coreMutationsAttempted: input.context.coreMutationsAttempted,
  }

  return {
    ok: true,
    mutation,
    context: nextContext,
  }
}
