/** Apollo Multi-Channel Orchestration production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import { handoffVoiceDropApprovedToMultichannelOrchestration } from "@/lib/growth/apollo/apollo-multichannel-orchestration-bridge"
import { certifyApolloMultichannelOrchestration } from "@/lib/growth/apollo/apollo-multichannel-orchestration-certification"
import { mapApolloMultichannelSequenceCandidateDbRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import type {
  ApolloMultichannelOrchestrationCertificationReport,
  ApolloMultichannelOrchestrationReport,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_ID,
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import { buildApolloMultichannelOrchestrationFunnelMetrics } from "@/lib/growth/apollo/apollo-multichannel-orchestration-funnel-metrics"
import {
  assertApolloMultichannelOrchestrationExecuteAllowed,
  buildApolloMultichannelOrchestrationReadinessPayload,
  redactApolloMultichannelOrchestrationSecrets,
} from "@/lib/growth/apollo/apollo-multichannel-orchestration-route-gates"

export type ApolloMultichannelOrchestrationExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloMultichannelOrchestrationReport | null
  certification: ApolloMultichannelOrchestrationCertificationReport | null
  blockers: string[]
  error?:
    | "gates_failed"
    | "voice_drop_not_found"
    | "voice_drop_not_approved"
    | "automation_failed"
    | "certification_failed"
  message?: string | null
}

export async function buildApolloMultichannelOrchestrationReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; voice_drop_candidate_id?: string | null },
) {
  return buildApolloMultichannelOrchestrationReadinessPayload({
    env: input?.env ?? process.env,
    voice_drop_candidate_id: input?.voice_drop_candidate_id ?? null,
  })
}

export async function executeApolloMultichannelOrchestrationInProduction(
  admin: SupabaseClient,
  input: {
    voice_drop_candidate_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloMultichannelOrchestrationExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloMultichannelOrchestrationExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloMultichannelOrchestrationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const { data: voiceDropRow, error: voiceDropError } = await admin
    .schema("growth")
    .from("apollo_voice_drop_candidates")
    .select("*")
    .eq("id", input.voice_drop_candidate_id)
    .maybeSingle()

  if (voiceDropError) {
    return redactApolloMultichannelOrchestrationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [voiceDropError.message],
      error: "voice_drop_not_found",
      message: voiceDropError.message,
    })
  }

  if (!voiceDropRow) {
    return redactApolloMultichannelOrchestrationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["voice_drop_candidate_not_found"],
      error: "voice_drop_not_found",
      message: "Voice drop candidate not found.",
    })
  }

  const voiceDrop = mapApolloVoiceDropCandidateDbRow(voiceDropRow as Record<string, unknown>)
  if (voiceDrop.status !== "voice_drop_approved") {
    return redactApolloMultichannelOrchestrationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["voice_drop_not_approved"],
      error: "voice_drop_not_approved",
      message: "Voice drop candidate must be approved before multi-channel orchestration.",
    })
  }

  const handoff = await handoffVoiceDropApprovedToMultichannelOrchestration(admin, {
    voice_drop_candidate_id: voiceDrop.candidate_id,
    enrollment_candidate_id: voiceDrop.enrollment_candidate_id,
    company_candidate_id: voiceDrop.company_candidate_id,
    company_contact_id: voiceDrop.company_contact_id,
    growth_lead_id: voiceDrop.growth_lead_id,
    company_name: voiceDrop.company_name,
    full_name: voiceDrop.full_name,
    title: voiceDrop.title,
    email: voiceDrop.email,
    phone: voiceDrop.phone,
    qualification_score: voiceDrop.qualification_score,
    fit_score: null,
    voice_drop_score: voiceDrop.voice_drop_score,
    channel_availability: voiceDrop.channel_availability,
    channel_confidence: voiceDrop.recommendation_confidence,
    multichannel_strategy_key: voiceDrop.multichannel_strategy.strategy_key,
    source_attribution: voiceDrop.source_attribution as unknown as Record<string, unknown>,
    operator_intelligence: {
      company_summary: voiceDrop.voice_drop_intelligence.intelligence_summary,
      buying_committee_summary: voiceDrop.channel_recommendations.recommended_sequence_strategy,
    },
  })

  const candidates_created =
    handoff.ok && handoff.status === "pending_sequence_approval" ? 1 : 0
  const candidates_skipped_duplicate =
    handoff.ok && handoff.candidate_id && candidates_created === 0 ? 1 : 0

  const { data: sequenceRows } = await admin
    .schema("growth")
    .from("apollo_multichannel_sequence_candidates")
    .select("*")
    .eq("voice_drop_candidate_id", input.voice_drop_candidate_id)
    .order("created_at", { ascending: false })
    .limit(5)

  const candidates = (sequenceRows ?? []).map((row) =>
    mapApolloMultichannelSequenceCandidateDbRow(row as Record<string, unknown>),
  )

  const funnel_metrics = await buildApolloMultichannelOrchestrationFunnelMetrics(admin)
  const blockers = handoff.error ? [handoff.error] : []

  const report: ApolloMultichannelOrchestrationReport = {
    qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
    automation_id: APOLLO_MULTICHANNEL_ORCHESTRATION_ID,
    execution_id,
    voice_drop_candidate_id: input.voice_drop_candidate_id,
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    candidates,
    blockers,
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from("apollo_multichannel_orchestration_runs").insert({
    execution_id,
    voice_drop_candidate_id: input.voice_drop_candidate_id,
    status: candidates_created || candidates.length ? "completed" : "partial",
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    blockers,
    outreach_sent: false,
    voice_drop_sent: false,
    draft_created: false,
    jobs_scheduled: false,
    metadata: { qa_marker: APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER },
  })

  let certification: ApolloMultichannelOrchestrationCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyApolloMultichannelOrchestration(admin, {
      report,
      approve_test_candidate: true,
    })
  }

  const ok = input.certification_mode
    ? Boolean(certification?.certified)
    : candidates_created > 0 || candidates.length > 0

  return redactApolloMultichannelOrchestrationSecrets({
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
            ? certification?.summary ?? "Multi-channel certification failed."
            : "Multi-channel sequence candidate not created.",
        }),
  })
}

export async function loadApolloMultichannelOrchestrationFunnelMetrics(admin: SupabaseClient) {
  return buildApolloMultichannelOrchestrationFunnelMetrics(admin)
}
