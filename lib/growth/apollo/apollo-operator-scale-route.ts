/** Apollo operator scale — server-only data load + report. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  mapEnrollmentRowToQueueItem,
  mapMultichannelRowToQueueItem,
  mapPlaybookRowToQueueItem,
  mapSafeExecutionJobToQueueItem,
  mapSequenceExecutionRowToQueueItem,
  mapVoiceDropRowToQueueItem,
} from "@/lib/growth/apollo/apollo-operator-queue-mapper"
import { buildApolloOperatorScaleReport } from "@/lib/growth/apollo/apollo-operator-scale-report"
import {
  APOLLO_OPERATOR_SCALE_QA_MARKER,
  type ApolloOperatorQueueItem,
  type ApolloOperatorScaleReport,
} from "@/lib/growth/apollo/apollo-operator-scale-types"

export async function loadApolloOperatorQueueItems(admin: SupabaseClient): Promise<ApolloOperatorQueueItem[]> {
  const [
    enrollmentRes,
    playbookRes,
    voiceDropRes,
    multichannelRes,
    executionRes,
    jobsRes,
  ] = await Promise.all([
    admin.schema("growth").from("apollo_enrollment_candidates").select("*"),
    admin.schema("growth").from("account_playbooks").select("*"),
    admin.schema("growth").from("apollo_voice_drop_candidates").select("*"),
    admin.schema("growth").from("apollo_multichannel_sequence_candidates").select("*"),
    admin.schema("growth").from("apollo_sequence_execution_candidates").select("*"),
    admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("*")
      .in("status", ["draft", "pending_approval", "approved", "scheduled", "running", "sent", "blocked", "failed", "skipped"]),
  ])

  const items: ApolloOperatorQueueItem[] = []
  for (const row of enrollmentRes.data ?? []) {
    items.push(mapEnrollmentRowToQueueItem(row as Record<string, unknown>))
  }
  for (const row of playbookRes.data ?? []) {
    items.push(mapPlaybookRowToQueueItem(row as Record<string, unknown>))
  }
  for (const row of voiceDropRes.data ?? []) {
    items.push(mapVoiceDropRowToQueueItem(row as Record<string, unknown>))
  }
  for (const row of multichannelRes.data ?? []) {
    items.push(mapMultichannelRowToQueueItem(row as Record<string, unknown>))
  }
  for (const row of executionRes.data ?? []) {
    items.push(mapSequenceExecutionRowToQueueItem(row as Record<string, unknown>))
  }
  for (const row of jobsRes.data ?? []) {
    items.push(mapSafeExecutionJobToQueueItem(row as Record<string, unknown>))
  }

  return items
}

export async function loadApolloOperatorScaleReport(
  admin: SupabaseClient,
  input?: { baseline_companies?: number; meeting_conversion_pct?: number | null },
): Promise<ApolloOperatorScaleReport> {
  const items = await loadApolloOperatorQueueItems(admin)
  return buildApolloOperatorScaleReport(items, {
    baseline_companies: input?.baseline_companies,
    meeting_conversion_pct: input?.meeting_conversion_pct,
  })
}

export function buildApolloOperatorScaleReadinessPayload(): {
  qa_marker: typeof APOLLO_OPERATOR_SCALE_QA_MARKER
  ready: boolean
  simulation_only: true
  no_auto_approval: true
} {
  return {
    qa_marker: APOLLO_OPERATOR_SCALE_QA_MARKER,
    ready: true,
    simulation_only: true,
    no_auto_approval: true,
  }
}
