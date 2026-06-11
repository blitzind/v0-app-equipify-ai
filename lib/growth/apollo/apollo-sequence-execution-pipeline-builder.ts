/** Apollo Sequence Execution pipeline builder — client-safe. */

import {
  buildApolloSequenceExecutionAttributionRecord,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import type { ApolloSequenceExecutionMultichannelHandoffInput } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  buildApolloSequenceExecutionMaterializationPlan,
  buildApolloSequenceExecutionOperatorSummary,
} from "@/lib/growth/apollo/apollo-sequence-materialization-engine"

export const APOLLO_SEQUENCE_EXECUTION_PIPELINE_QA_MARKER =
  "apollo-sequence-execution-pipeline-v1" as const

export function buildSequenceExecutionPipelineFromMultichannelHandoff(
  input: ApolloSequenceExecutionMultichannelHandoffInput,
) {
  const materialization = buildApolloSequenceExecutionMaterializationPlan(input)
  const source_attribution = buildApolloSequenceExecutionAttributionRecord(input.source_attribution)
  const operator_summary = buildApolloSequenceExecutionOperatorSummary({
    handoff: input,
    materialization,
  })

  return {
    materialization,
    source_attribution,
    operator_summary,
  }
}
