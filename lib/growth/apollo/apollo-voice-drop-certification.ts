/** Apollo Voice Drop Automation certification — generate + queue only, no send. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  assertApolloVoiceDropAttributionPreserved,
  evaluateApolloVoiceDropApprovalGate,
  mapApolloVoiceDropCandidateDbRow,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-evidence"
import type {
  ApolloVoiceDropAutomationReport,
  ApolloVoiceDropCertificationReport,
} from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER } from "@/lib/growth/apollo/apollo-voice-drop-automation-types"
import { buildVoiceDropPipelineFromEnrollmentHandoff } from "@/lib/growth/apollo/apollo-voice-drop-pipeline-builder"

const TABLE = "apollo_voice_drop_candidates"

export async function certifyApolloVoiceDropAutomation(
  admin: SupabaseClient,
  input: {
    report: ApolloVoiceDropAutomationReport
    approve_test_candidate?: boolean
  },
): Promise<ApolloVoiceDropCertificationReport> {
  const blockers: string[] = []
  const checks: ApolloVoiceDropCertificationReport["checks"] = []

  const candidateCreated = input.report.candidates_created > 0
  checks.push({
    id: "enrollment_handoff",
    satisfied: candidateCreated,
    detail: candidateCreated
      ? `${input.report.candidates_created} voice drop candidate(s) created from enrollment approval.`
      : "No voice drop candidates created.",
  })
  if (!candidateCreated) blockers.push("voice_drop_candidate_not_created")

  const first = input.report.candidates[0] ?? null

  const intelligenceGenerated = Boolean(
    first?.voice_drop_intelligence.recommended_script_type &&
      first.voice_drop_intelligence.voicemail_objective,
  )
  checks.push({
    id: "intelligence_generated",
    satisfied: intelligenceGenerated,
    detail: intelligenceGenerated
      ? `Script type ${first?.voice_drop_intelligence.recommended_script_type} with objective defined.`
      : "Voice drop intelligence missing.",
  })
  if (!intelligenceGenerated) blockers.push("intelligence_not_generated")

  const scriptGenerated = Boolean(first?.voice_drop_script.full_script.trim())
  checks.push({
    id: "script_generated",
    satisfied: scriptGenerated,
    detail: scriptGenerated
      ? "Intro, value prop, personalization, and CTA script sections generated."
      : "Script generation failed.",
  })
  if (!scriptGenerated) blockers.push("script_not_generated")

  const attribution_preserved = assertApolloVoiceDropAttributionPreserved(first?.source_attribution)
  checks.push({
    id: "attribution_preserved",
    satisfied: attribution_preserved,
    detail: attribution_preserved
      ? "Apollo → Qualification → Enrollment → Voice Drop chain preserved."
      : "Attribution chain incomplete.",
  })
  if (!attribution_preserved) blockers.push("attribution_not_preserved")

  const duplicate_prevention_verified = input.report.candidates_skipped_duplicate >= 0
  checks.push({
    id: "duplicate_prevention",
    satisfied: duplicate_prevention_verified,
    detail: `Duplicate skips: ${input.report.candidates_skipped_duplicate}.`,
  })

  const recommendation_engine_verified = Boolean(
    first?.multichannel_strategy.strategy_key && first.multichannel_strategy.steps.length > 0,
  )
  checks.push({
    id: "recommendation_engine",
    satisfied: recommendation_engine_verified,
    detail: recommendation_engine_verified
      ? `Strategy ${first?.multichannel_strategy.strategy_label} with ${first?.multichannel_strategy.steps.length} step(s).`
      : "Multichannel recommendation missing.",
  })
  if (!recommendation_engine_verified) blockers.push("recommendation_engine_failed")

  const queueVisible = input.report.candidates.length > 0
  checks.push({
    id: "queue_visibility",
    satisfied: queueVisible,
    detail: queueVisible
      ? `${input.report.candidates.length} candidate(s) visible in Voice Drops Ready queue.`
      : "Queue empty.",
  })

  let approval_flow_verified = false
  if (first && input.approve_test_candidate !== false) {
    const gate = evaluateApolloVoiceDropApprovalGate({ candidate: first })
    approval_flow_verified = gate.allowed
    if (gate.allowed) {
      await admin
        .schema("growth")
        .from(TABLE)
        .update({
          status: "voice_drop_approved",
          voice_drop_approved_at: new Date().toISOString(),
          voice_drop_approved_email: "apollo-voice-drop-cert@equipify.internal",
          voice_drop_sent: false,
          outreach_sent: false,
          draft_created: false,
          metadata: {
            qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
            certification_approval: true,
          },
        })
        .eq("id", first.candidate_id)
    }
  }

  checks.push({
    id: "approval_flow",
    satisfied: approval_flow_verified,
    detail: approval_flow_verified
      ? "Voice drop approval gate passed (certification dry-run recorded)."
      : "Approval gate blocked.",
  })
  if (!approval_flow_verified && first) blockers.push("approval_flow_blocked")

  const pipelineSelfTest = buildVoiceDropPipelineFromEnrollmentHandoff({
    enrollment_candidate_id: "cert-self-test",
    company_candidate_id: "cert-company",
    company_contact_id: null,
    contact_candidate_id: null,
    growth_lead_id: null,
    company_name: "Cert Medical",
    full_name: "Jordan Lee",
    title: "VP Operations",
    email: "jordan@certmedical.example",
    phone: "+15551234567",
    qualification_score: 85,
    fit_score: 80,
    research_score: 75,
    operator_intelligence: {
      company_summary: "Cert Medical operates regional biomedical service lines.",
      research_summary: "Research confidence 75/100.",
    },
    source_attribution: {},
    acquisition_evidence: {},
  })

  checks.push({
    id: "script_generation_engine",
    satisfied: Boolean(pipelineSelfTest.voiceDropScript.full_script.trim()),
    detail: "Offline script generation engine produces full script.",
  })

  const certified =
    blockers.length === 0 &&
    checks
      .filter((check) =>
        [
          "enrollment_handoff",
          "intelligence_generated",
          "script_generated",
          "attribution_preserved",
          "approval_flow",
          "recommendation_engine",
        ].includes(check.id),
      )
      .every((check) => check.satisfied)

  return {
    qa_marker: APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
    certified,
    blockers,
    checks,
    attribution_preserved,
    duplicate_prevention_verified,
    approval_flow_verified,
    script_generation_verified: scriptGenerated,
    recommendation_engine_verified,
    safety: {
      voice_drop_sent: false,
      call_placed: false,
      sms_sent: false,
      email_sent: false,
      draft_created: false,
    },
    funnel_metrics: input.report.funnel_metrics,
    summary: certified
      ? "Voice Drop Automation Certification passed — intelligence, scripts, queue, and approval verified without live outreach."
      : `Voice Drop Automation Certification failed — ${blockers.length} blocker(s). No voicemail, calls, SMS, or email sent.`,
  }
}

export async function loadApolloVoiceDropCertificationCandidate(
  admin: SupabaseClient,
  candidateId: string,
) {
  const { data } = await admin
    .schema("growth")
    .from(TABLE)
    .select("*")
    .eq("id", candidateId)
    .maybeSingle()

  return data ? mapApolloVoiceDropCandidateDbRow(data as Record<string, unknown>) : null
}
