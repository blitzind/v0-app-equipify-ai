/** Apollo Voice Drop Automation production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapApolloEnrollmentCandidateDbRow } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { handoffEnrollmentApprovedToVoiceDropPipeline } from "@/lib/growth/apollo/apollo-voice-drop-bridge"
import { certifyApolloVoiceDropAutomation } from "@/lib/growth/apollo/apollo-voice-drop-certification"
import { mapApolloVoiceDropCandidateDbRow } from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import type {
  ApolloVoiceDropAutomationReport,
  ApolloVoiceDropCertificationReport,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  APOLLO_VOICE_DROP_AUTOMATION_ID,
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { buildApolloVoiceDropFunnelMetrics } from "@/lib/growth/apollo/apollo-voice-drop-funnel-metrics"
import {
  assertApolloVoiceDropAutomationExecuteAllowed,
  buildApolloVoiceDropAutomationReadinessPayload,
  redactApolloVoiceDropAutomationSecrets,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-route-gates"

export type ApolloVoiceDropAutomationExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloVoiceDropAutomationReport | null
  certification: ApolloVoiceDropCertificationReport | null
  blockers: string[]
  error?: "gates_failed" | "enrollment_not_found" | "enrollment_not_approved" | "automation_failed" | "certification_failed"
  message?: string | null
}

export async function buildApolloVoiceDropAutomationReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; enrollment_candidate_id?: string | null },
) {
  return buildApolloVoiceDropAutomationReadinessPayload({
    env: input?.env ?? process.env,
    enrollment_candidate_id: input?.enrollment_candidate_id ?? null,
  })
}

export async function executeApolloVoiceDropAutomationInProduction(
  admin: SupabaseClient,
  input: {
    enrollment_candidate_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloVoiceDropAutomationExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloVoiceDropAutomationExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloVoiceDropAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: gates.blockers,
      error: "gates_failed",
      message: gates.error,
    })
  }

  const { data: enrollmentRow, error: enrollmentError } = await admin
    .schema("growth")
    .from("apollo_enrollment_candidates")
    .select("*")
    .eq("id", input.enrollment_candidate_id)
    .maybeSingle()

  if (enrollmentError) {
    return redactApolloVoiceDropAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [enrollmentError.message],
      error: "enrollment_not_found",
      message: enrollmentError.message,
    })
  }

  if (!enrollmentRow) {
    return redactApolloVoiceDropAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["enrollment_candidate_not_found"],
      error: "enrollment_not_found",
      message: "Enrollment candidate not found.",
    })
  }

  const enrollment = mapApolloEnrollmentCandidateDbRow(enrollmentRow as Record<string, unknown>)
  if (enrollment.status !== "enrollment_approved") {
    return redactApolloVoiceDropAutomationSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["enrollment_not_approved"],
      error: "enrollment_not_approved",
      message: "Enrollment candidate must be approved before voice drop automation.",
    })
  }

  const handoff = await handoffEnrollmentApprovedToVoiceDropPipeline(admin, {
    enrollment_candidate_id: enrollment.candidate_id,
    company_candidate_id: enrollment.company_candidate_id,
    company_contact_id: enrollment.company_contact_id,
    contact_candidate_id: enrollment.contact_candidate_id,
    growth_lead_id: enrollment.growth_lead_id,
    company_name: enrollment.company_name,
    full_name: enrollment.full_name,
    title: enrollment.title,
    email: enrollment.email,
    phone: enrollment.phone,
    qualification_score: enrollment.qualification_score,
    fit_score: enrollment.fit_score,
    research_score: enrollment.research_score,
    operator_intelligence: enrollment.operator_intelligence as unknown as Record<string, unknown>,
    source_attribution: enrollment.source_attribution as unknown as Record<string, unknown>,
    acquisition_evidence: enrollment.acquisition_evidence,
    env,
  })

  const candidates_created = handoff.ok && handoff.status === "pending_voice_drop_approval" ? 1 : 0
  const candidates_skipped_duplicate =
    handoff.ok && handoff.candidate_id && candidates_created === 0 ? 1 : 0

  const { data: voiceDropRows } = await admin
    .schema("growth")
    .from("apollo_voice_drop_candidates")
    .select("*")
    .eq("enrollment_candidate_id", input.enrollment_candidate_id)
    .order("created_at", { ascending: false })
    .limit(5)

  const candidates = (voiceDropRows ?? []).map((row) =>
    mapApolloVoiceDropCandidateDbRow(row as Record<string, unknown>),
  )

  const funnel_metrics = await buildApolloVoiceDropFunnelMetrics(admin)
  const blockers = handoff.error ? [handoff.error] : []

  const report: ApolloVoiceDropAutomationReport = {
    qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
    automation_id: APOLLO_VOICE_DROP_AUTOMATION_ID,
    execution_id,
    enrollment_candidate_id: input.enrollment_candidate_id,
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    candidates,
    blockers,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from("apollo_voice_drop_automation_runs").insert({
    execution_id,
    enrollment_candidate_id: input.enrollment_candidate_id,
    status: candidates_created || candidates.length ? "completed" : "partial",
    candidates_created,
    candidates_skipped_duplicate,
    funnel_metrics,
    blockers,
    voice_drop_sent: false,
    outreach_sent: false,
    draft_created: false,
    metadata: { qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER },
  })

  let certification: ApolloVoiceDropCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyApolloVoiceDropAutomation(admin, {
      report,
      approve_test_candidate: true,
    })
  }

  const ok = input.certification_mode
    ? Boolean(certification?.certified)
    : candidates_created > 0 || candidates.length > 0

  return redactApolloVoiceDropAutomationSecrets({
    ok,
    execution_id,
    report,
    certification,
    blockers: [...blockers, ...(certification?.blockers ?? [])],
    ...(ok
      ? {}
      : {
          error: input.certification_mode ? ("certification_failed" as const) : ("automation_failed" as const),
          message: input.certification_mode
            ? certification?.summary ?? "Voice drop certification failed."
            : "Voice drop candidate not created.",
        }),
  })
}

export async function loadApolloVoiceDropFunnelMetrics(admin: SupabaseClient) {
  return buildApolloVoiceDropFunnelMetrics(admin)
}
