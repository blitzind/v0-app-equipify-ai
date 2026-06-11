/** Apollo Voice Drop funnel metrics — server-only aggregation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
  type ApolloVoiceDropFunnelMetrics,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { summarizeRecommendedChannelMix } from "@/lib/growth/apollo/apollo-multichannel-recommendation-engine"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"

export async function buildApolloVoiceDropFunnelMetrics(
  admin: SupabaseClient,
): Promise<ApolloVoiceDropFunnelMetrics> {
  const [{ data: enrollmentRows }, { data: voiceDropRows }] = await Promise.all([
    admin
      .schema("growth")
      .from("apollo_enrollment_candidates")
      .select("status"),
    admin.schema("growth").from("apollo_voice_drop_candidates").select("*"),
  ])

  const enrollment = enrollmentRows ?? []
  const voiceDrops = (voiceDropRows ?? []).map((row) =>
    mapApolloVoiceDropCandidateDbRow(row as Record<string, unknown>),
  )

  return {
    qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
    enrollment_candidates: enrollment.length,
    enrollment_approvals: enrollment.filter((row) => row.status === "enrollment_approved").length,
    voice_drop_candidates: voiceDrops.length,
    approved_voice_drops: voiceDrops.filter((row) => row.status === "voice_drop_approved").length,
    rejected_voice_drops: voiceDrops.filter((row) => row.status === "voice_drop_rejected").length,
    voice_ready_contacts: voiceDrops.filter((row) => row.channel_availability.voice_drop_capable).length,
    recommended_channel_mix: summarizeRecommendedChannelMix(
      voiceDrops.map((row) => row.multichannel_strategy),
    ),
    computed_at: new Date().toISOString(),
  }
}
