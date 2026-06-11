/** Apollo Sequence Execution materialization engine — client-safe plan assembly. */

import type {
  ApolloSequenceExecutionMaterializationPlan,
  ApolloSequenceExecutionMultichannelHandoffInput,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  buildApolloSequenceExecutionDraftRecords,
  summarizeApolloSequenceExecutionDrafts,
} from "@/lib/growth/apollo/apollo-sequence-draft-generation"
import {
  buildApolloSequenceExecutionStepPlans,
  summarizeApolloSequenceExecutionSteps,
} from "@/lib/growth/apollo/apollo-sequence-step-generation"

export const APOLLO_SEQUENCE_MATERIALIZATION_ENGINE_QA_MARKER =
  "apollo-sequence-materialization-engine-v1" as const

export function buildApolloSequenceExecutionMaterializationPlan(
  input: ApolloSequenceExecutionMultichannelHandoffInput,
): ApolloSequenceExecutionMaterializationPlan {
  const steps = buildApolloSequenceExecutionStepPlans(input)
  const drafts = buildApolloSequenceExecutionDraftRecords({ handoff: input, steps })

  return {
    plan_version: "v1",
    sequence_key: input.sequence_key,
    sequence_label: input.sequence_label,
    pattern_key: "multichannel_with_voice_drop",
    total_steps: steps.length,
    total_days: input.scheduling_plan.total_days,
    steps,
    drafts,
  }
}

export function buildApolloSequenceExecutionOperatorSummary(input: {
  handoff: ApolloSequenceExecutionMultichannelHandoffInput
  materialization: ApolloSequenceExecutionMaterializationPlan
}): {
  why_materialized: string
  sequence_label: string
  step_summary: string
  draft_summary: string
  execution_queue_summary: string
} {
  const { handoff, materialization } = input
  return {
    why_materialized: `Approved multi-channel sequence ${handoff.sequence_label} materialized into native Growth Engine sequence objects.`,
    sequence_label: materialization.sequence_label,
    step_summary: summarizeApolloSequenceExecutionSteps(materialization.steps),
    draft_summary: summarizeApolloSequenceExecutionDrafts(materialization.drafts),
    execution_queue_summary: `${materialization.total_steps} pending-approval execution job(s) planned — no send.`,
  }
}
