/** Apollo Meeting Bridge production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  bridgeApolloPipelineToMeetingIntelligence,
  loadApolloMeetingBridgePipelineInputForLead,
} from "@/lib/growth/apollo/apollo-meeting-bridge"
import { certifyApolloMeetingBridge } from "@/lib/growth/apollo/apollo-meeting-bridge-certification"
import { buildApolloMeetingCandidateFunnelMetrics } from "@/lib/growth/apollo/apollo-meeting-candidates-funnel-metrics"
import type {
  ApolloMeetingBridgeAutomationReport,
  ApolloMeetingBridgeCertificationReport,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import {
  APOLLO_MEETING_BRIDGE_ID,
  APOLLO_MEETING_BRIDGE_QA_MARKER,
} from "@/lib/growth/apollo/apollo-meeting-bridge-types"
import {
  assertApolloMeetingBridgeExecuteAllowed,
  buildApolloMeetingBridgeReadinessPayload,
  redactApolloMeetingBridgeSecrets,
} from "@/lib/growth/apollo/apollo-meeting-bridge-route-gates"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"

export type ApolloMeetingBridgeExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloMeetingBridgeAutomationReport | null
  certification: ApolloMeetingBridgeCertificationReport | null
  blockers: string[]
  error?:
    | "gates_failed"
    | "sequence_execution_not_found"
    | "bridge_failed"
    | "certification_failed"
  message?: string | null
}

export async function buildApolloMeetingBridgeReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; sequence_execution_candidate_id?: string | null },
) {
  return buildApolloMeetingBridgeReadinessPayload({
    env: input?.env ?? process.env,
    sequence_execution_candidate_id: input?.sequence_execution_candidate_id ?? null,
  })
}

export async function executeApolloMeetingBridgeInProduction(
  admin: SupabaseClient,
  input: {
    sequence_execution_candidate_id: string
    outbound_reply_id?: string | null
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloMeetingBridgeExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloMeetingBridgeExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloMeetingBridgeSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const { data: sequenceRow, error: sequenceError } = await admin
    .schema("growth")
    .from("apollo_sequence_execution_candidates")
    .select("*")
    .eq("id", input.sequence_execution_candidate_id)
    .maybeSingle()

  if (sequenceError || !sequenceRow) {
    return redactApolloMeetingBridgeSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [sequenceError?.message ?? "sequence_execution_candidate_not_found"],
      error: "sequence_execution_not_found",
      message: "Sequence execution candidate not found.",
    })
  }

  const sequenceCandidate = mapApolloSequenceExecutionCandidateDbRow(
    sequenceRow as Record<string, unknown>,
  )
  const leadId = sequenceCandidate.growth_lead_id
  if (!leadId) {
    return redactApolloMeetingBridgeSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["growth_lead_id_missing"],
      error: "sequence_execution_not_found",
      message: "Sequence execution candidate is missing growth_lead_id.",
    })
  }

  const pipelineInput = await loadApolloMeetingBridgePipelineInputForLead(admin, {
    lead_id: leadId,
    outbound_reply_id: input.outbound_reply_id ?? null,
    sequence_execution_candidate_id: input.sequence_execution_candidate_id,
  })

  if (!pipelineInput) {
    return redactApolloMeetingBridgeSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["pipeline_context_not_found"],
      error: "bridge_failed",
      message: "Unable to load Apollo meeting bridge pipeline context.",
    })
  }

  const bridgeResult = await bridgeApolloPipelineToMeetingIntelligence(admin, pipelineInput)
  const funnelMetrics = await buildApolloMeetingCandidateFunnelMetrics(admin)

  const report: ApolloMeetingBridgeAutomationReport = {
    qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
    automation_id: APOLLO_MEETING_BRIDGE_ID,
    execution_id,
    sequence_execution_candidate_id: input.sequence_execution_candidate_id,
    candidates_created: bridgeResult.meeting_candidate_created ? 1 : 0,
    candidates_skipped_duplicate: bridgeResult.action === "skip_duplicate" ? 1 : 0,
    candidates_skipped_no_trigger: bridgeResult.action === "skip_no_trigger" ? 1 : 0,
    funnel_metrics: funnelMetrics,
    bridge_result: bridgeResult,
    blockers: bridgeResult.ok ? [] : [bridgeResult.error ?? "bridge_failed"],
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from("meeting_candidate_runs").insert({
    execution_id,
    sequence_execution_candidate_id: input.sequence_execution_candidate_id,
    meeting_candidate_id: bridgeResult.candidate_id,
    status: bridgeResult.ok ? "completed" : "failed",
    candidates_created: report.candidates_created,
    candidates_skipped_duplicate: report.candidates_skipped_duplicate,
    candidates_skipped_no_trigger: report.candidates_skipped_no_trigger,
    funnel_metrics: funnelMetrics,
    blockers: report.blockers,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
    metadata: {
      qa_marker: APOLLO_MEETING_BRIDGE_QA_MARKER,
      bridge_action: bridgeResult.action,
    },
  })

  await logGrowthEngine("apollo_meeting_bridge_execute", {
    execution_id,
    sequence_execution_candidate_id: input.sequence_execution_candidate_id,
    candidates_created: report.candidates_created,
    bridge_action: bridgeResult.action,
    outreach_sent: false,
    calendar_written: false,
    meeting_scheduled: false,
  })

  let certification: ApolloMeetingBridgeCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyApolloMeetingBridge(admin, {
      execution_id,
      sequence_execution_candidate_id: input.sequence_execution_candidate_id,
      candidate_id: bridgeResult.candidate_id,
    })
    if (!certification.certified) {
      return redactApolloMeetingBridgeSecrets({
        ok: false,
        execution_id,
        report,
        certification,
        blockers: certification.blockers,
        error: "certification_failed",
        message: "Apollo Meeting Bridge certification failed.",
      })
    }
  }

  return redactApolloMeetingBridgeSecrets({
    ok: bridgeResult.ok,
    execution_id,
    report,
    certification,
    blockers: report.blockers,
  })
}
