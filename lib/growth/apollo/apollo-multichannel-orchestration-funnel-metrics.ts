/** Apollo Multi-Channel orchestration funnel metrics — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
  type ApolloMultichannelOrchestrationFunnelMetrics,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"

export async function buildApolloMultichannelOrchestrationFunnelMetrics(
  admin: SupabaseClient,
): Promise<ApolloMultichannelOrchestrationFunnelMetrics> {
  const [{ data: enrollmentRows }, { data: voiceDropRows }, { data: sequenceRows }] =
    await Promise.all([
      admin.schema("growth").from("apollo_enrollment_candidates").select("status"),
      admin.schema("growth").from("apollo_voice_drop_candidates").select("status"),
      admin.schema("growth").from("apollo_multichannel_sequence_candidates").select("*"),
    ])

  const sequences = (sequenceRows ?? []).map((row) =>
    mapApolloMultichannelSequenceCandidateDbRow(row as Record<string, unknown>),
  )

  const channel_mix: Record<string, number> = {}
  const sequence_mix: Record<string, number> = {}
  let confidenceTotal = 0

  for (const row of sequences) {
    for (const channel of row.orchestration_result.channel_order) {
      channel_mix[channel] = (channel_mix[channel] ?? 0) + 1
    }
    const key = row.sequence_template.sequence_key
    sequence_mix[key] = (sequence_mix[key] ?? 0) + 1
    confidenceTotal += row.orchestration_confidence
  }

  return {
    qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
    enrollment_candidates: enrollmentRows?.length ?? 0,
    voice_drop_candidates: voiceDropRows?.length ?? 0,
    sequence_candidates: sequences.length,
    approved_sequences: sequences.filter((r) => r.status === "sequence_approved").length,
    rejected_sequences: sequences.filter((r) => r.status === "sequence_rejected").length,
    channel_mix,
    sequence_mix,
    average_confidence:
      sequences.length > 0 ? Math.round((confidenceTotal / sequences.length) * 10) / 10 : 0,
    computed_at: new Date().toISOString(),
  }
}
