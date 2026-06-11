/** Apollo Meeting Candidates funnel metrics. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ApolloMeetingCandidateFunnelMetrics } from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import { APOLLO_MEETING_BRIDGE_QA_MARKER } from "@/lib/growth/apollo/apollo-meeting-bridge-types"

const TABLE = "meeting_candidates"

export async function buildApolloMeetingCandidateFunnelMetrics(
  admin: SupabaseClient,
): Promise<ApolloMeetingCandidateFunnelMetrics> {
  const { data, error } = await admin
    .schema("growth")
    .from(TABLE)
    .select("status, trigger_evidence")

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    status?: string
    trigger_evidence?: { trigger_source?: string }
  }>

  const triggerMix: Record<string, number> = {}
  for (const row of rows) {
    const source = row.trigger_evidence?.trigger_source ?? "unknown"
    triggerMix[source] = (triggerMix[source] ?? 0) + 1
  }

  return {
    qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
    candidates_created: rows.length,
    candidates_approved: rows.filter((row) => row.status === "approved").length,
    candidates_rejected: rows.filter((row) => row.status === "rejected").length,
    meetings_scheduled: rows.filter((row) => row.status === "scheduled").length,
    meetings_completed: rows.filter((row) => row.status === "completed").length,
    trigger_mix: triggerMix,
    computed_at: new Date().toISOString(),
  }
}
