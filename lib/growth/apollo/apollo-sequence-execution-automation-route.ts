/** Apollo Sequence Execution Automation production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import { handoffMultichannelApprovedToSequenceExecution } from "@/lib/growth/apollo/apollo-sequence-execution-bridge"
import { certifyApolloSequenceExecutionAutomation } from "@/lib/growth/apollo/apollo-sequence-execution-certification"
import { mapApolloSequenceExecutionCandidateDbRow } from "@/lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import type {
  ApolloSequenceExecutionAutomationReport,
  ApolloSequenceExecutionCertificationReport,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { buildApolloSequenceExecutionFunnelMetrics } from "@/lib/growth/apollo/apollo-sequence-execution-funnel-metrics"
import {
  assertApolloSequenceExecutionAutomationExecuteAllowed,
  buildApolloSequenceExecutionAutomationReadinessPayload,
  redactApolloSequenceExecutionAutomationSecrets,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-route-gates"

export type ApolloSequenceExecutionAutomationExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloSequenceExecutionAutomationReport | null
  certification: ApolloSequenceExecutionCertificationReport | null
  blockers: string[]
  error?:
    | "gates_failed"
    | "multichannel_not_found"
    | "multichannel_not_approved"
    | "automation_failed"
    | "certification_failed"
  message?: string | null
}

export async function buildApolloSequenceExecutionAutomationReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; multichannel_sequence_candidate_id?: string | null },
) {
  return buildApolloSequenceExecutionAutomationReadinessPayload({
    env: input?.env ?? process.env,
    multichannel_sequence_candidate_id: input?.multichannel_sequence_candidate_id ?? null,
  })
}

export async function executeApolloSequenceExecutionAutomationInProduction(
  admin: SupabaseClient,
  input: {
    multichannel_sequence_candidate_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloSequenceExecutionAutomationExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloSequenceExecutionAutomationExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloSequenceExecutionAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const { data: multichannelRow, error: multichannelError } = await admin
    .schema("growth")
    .from("apollo_multichannel_sequence_candidates")
    .select("*")
    .eq("id", input.multichannel_sequence_candidate_id)
    .maybeSingle()

  if (multichannelError) {
    return redactApolloSequenceExecutionAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [multichannelError.message],
      error: "multichannel_not_found",
      message: multichannelError.message,
    })
  }

  if (!multichannelRow) {
    return redactApolloSequenceExecutionAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["multichannel_candidate_not_found"],
      error: "multichannel_not_found",
      message: "Multi-channel sequence candidate not found.",
    })
  }

  const multichannel = mapApolloMultichannelSequenceCandidateDbRow(
    multichannelRow as Record<string, unknown>,
  )
  if (multichannel.status !== "sequence_approved") {
    return redactApolloSequenceExecutionAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["multichannel_not_approved"],
      error: "multichannel_not_approved",
      message: "Multi-channel sequence must be approved before execution materialization.",
    })
  }

  const { data: voiceDropRow } = await admin
    .schema("growth")
    .from("apollo_voice_drop_candidates")
    .select("*")
    .eq("id", multichannel.voice_drop_candidate_id)
    .maybeSingle()

  const voiceDrop = voiceDropRow
    ? mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
    : null

  const handoff = await handoffMultichannelApprovedToSequenceExecution(admin, {
    multichannel_sequence_candidate_id: multichannel.candidate_id,
    voice_drop_candidate_id: multichannel.voice_drop_candidate_id,
    enrollment_candidate_id: multichannel.enrollment_candidate_id,
    company_candidate_id: multichannel.company_candidate_id,
    company_contact_id: multichannel.company_contact_id,
    growth_lead_id: multichannel.growth_lead_id,
    company_name: multichannel.company_name,
    full_name: multichannel.full_name,
    title: multichannel.title,
    email: multichannel.email,
    phone: multichannel.phone,
    qualification_score: multichannel.qualification_score,
    sequence_key: multichannel.sequence_template.sequence_key,
    sequence_label: multichannel.sequence_template.sequence_label,
    channel_order: multichannel.orchestration_result.channel_order,
    scheduling_plan: multichannel.scheduling_plan,
    voice_drop_script_reference: voiceDrop?.voice_drop_script.full_script ?? null,
    source_attribution: multichannel.source_attribution as unknown as Record<string, unknown>,
  })

  const candidates_created =
    handoff.ok && handoff.status === "pending_draft_approval" ? 1 : 0
  const candidates_skipped_duplicate =
    handoff.ok && handoff.candidate_id && candidates_created === 0 ? 1 : 0

  const { data: executionRows } = await admin
    .schema("growth")
    .from("apollo_sequence_execution_candidates")
    .select("*")
    .eq("multichannel_sequence_candidate_id", input.multichannel_sequence_candidate_id)
    .order("created_at", { ascending: false })
    .limit(5)

  const candidates = (executionRows ?? []).map((row) =>
    mapApolloSequenceExecutionCandidateDbRow(row as Record<string, unknown>),
  )

  const funnel_metrics = await buildApolloSequenceExecutionFunnelMetrics(admin)
  const blockers = handoff.error ? [handoff.error] : []

  const report: ApolloSequenceExecutionAutomationReport = {
    qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
    automation_id: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID,
    execution_id,
    multichannel_sequence_candidate_id: input.multichannel_sequence_candidate_id,
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    candidates,
    blockers,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from("apollo_sequence_execution_automation_runs").insert({
    execution_id,
    multichannel_sequence_candidate_id: input.multichannel_sequence_candidate_id,
    status: candidates_created || candidates.length ? "completed" : "partial",
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    blockers,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
    metadata: { qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER },
  })

  let certification: ApolloSequenceExecutionCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyApolloSequenceExecutionAutomation(admin, {
      report,
      approve_test_candidate: true,
    })
  }

  const ok = input.certification_mode
    ? Boolean(certification?.certified)
    : candidates_created > 0 || candidates.length > 0

  return redactApolloSequenceExecutionAutomationSecrets({
    ok,
    execution_id,
    report,
    certification,
    blockers: [...blockers, ...(certification?.blockers ?? [])],
    ...(ok
      ? {}
      : {
          error: input.certification_mode
            ? ("certification_failed" as const)
            : ("automation_failed" as const),
          message: input.certification_mode
            ? certification?.summary ?? "Sequence execution certification failed."
            : "Sequence execution candidate not created.",
        }),
  })
}

export async function loadApolloSequenceExecutionFunnelMetrics(admin: SupabaseClient) {
  return buildApolloSequenceExecutionFunnelMetrics(admin)
}
