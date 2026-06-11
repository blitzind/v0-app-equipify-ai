/** Apollo Sequence Execution funnel metrics — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
  type ApolloSequenceExecutionFunnelMetrics,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"

export async function buildApolloSequenceExecutionFunnelMetrics(
  admin: SupabaseClient,
): Promise<ApolloSequenceExecutionFunnelMetrics> {
  const [{ data: multichannelRows }, { data: executionRows }] = await Promise.all([
    admin
      .schema("growth")
      .from("apollo_multichannel_sequence_candidates")
      .select("status"),
    admin.schema("growth").from("apollo_sequence_execution_candidates").select("*"),
  ])

  const candidates = (executionRows ?? []).map((row) =>
    mapApolloSequenceExecutionCandidateDbRow(row as Record<string, unknown>),
  )

  const channel_mix: Record<string, number> = {}
  let generatedDrafts = 0
  let approvedDrafts = 0
  let rejectedDrafts = 0

  for (const row of candidates) {
    for (const draft of row.materialization.drafts) {
      generatedDrafts += 1
      channel_mix[draft.channel] = (channel_mix[draft.channel] ?? 0) + 1
      if (draft.approval_status === "draft_approved") approvedDrafts += 1
      if (draft.approval_status === "draft_rejected") rejectedDrafts += 1
    }
  }

  return {
    qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
    approved_sequences:
      multichannelRows?.filter((r) => r.status === "sequence_approved").length ?? 0,
    generated_sequences: candidates.length,
    generated_drafts: generatedDrafts,
    approved_drafts: approvedDrafts,
    rejected_drafts: rejectedDrafts,
    execution_ready_sequences: candidates.filter((r) => r.status === "execution_ready").length,
    channel_mix,
    computed_at: new Date().toISOString(),
  }
}
