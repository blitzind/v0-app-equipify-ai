/** Apollo Full Pipeline Production Certification route gates — client-safe. */

import { redactApolloEnrichmentCertProductionSecrets } from "@/lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
  APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN,
} from "@/lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  assertApolloSequenceExecutionAutomationExecuteAllowed,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-route-gates"
import { isApolloScale2ProductionRuntime } from "@/lib/growth/apollo/apollo-scale-2-production-route-gates"

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER =
  "apollo-full-pipeline-production-certification-route-v1" as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM =
  "RUN_APOLLO_FULL_PIPELINE_CERTIFICATION" as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST = [
  "Platform admin session on Vercel Production (not preview).",
  "GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED=true and GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK=1",
  "GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED=true and GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK=1",
  "GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED=true and GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK=1",
  "GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED=true and GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK=1",
  "GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED=true and GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK=1",
  "VOICE_COMPLIANCE_ORCHESTRATION_ENABLED=true and GROWTH_VOICE_DROP_VD4_LIVE_CERTIFIED=1",
  "Known Apollo sequence-ready company_candidate_id with mapped contact + growth_lead_id.",
  "No active conflicting sequence enrollment for the target lead.",
] as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES = [
  "Certification creates real queue rows and a draft sequence_enrollment — it does not send outreach.",
  "To rollback: cancel draft sequence_enrollment, then delete or reject apollo_sequence_execution_candidates, apollo_multichannel_sequence_candidates, apollo_voice_drop_candidates, account_playbooks, and apollo_enrollment_candidates for the test company.",
  "Pending-approval sequence_execution_jobs can be skipped or deleted; none should reach sent status during certification.",
  "Re-run is idempotent when prior candidates are rejected or removed — duplicate prevention may return existing pending rows.",
] as const

export const APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET = `// Apollo Full Pipeline Production Certification — end-to-end queue/materialization only
await fetch("/api/platform/growth/apollo-full-pipeline-certification/readiness", { credentials: "include" })
  .then((r) => r.json())
  .then((payload) => {
    console.log("readiness_checklist", payload.readiness_checklist)
    console.log("gates_ok", payload.gates_ok, "blockers", payload.blockers)
    return payload
  })

await fetch("/api/platform/growth/apollo-full-pipeline-certification/execute", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    confirm: "${APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM}",
    companyCandidateId: "<sequence-ready-company-candidate-id>",
    enrollmentCandidateId: null,
  }),
})
  .then((r) => r.json())
  .then((payload) => {
    console.log("certified", payload.certification?.certified)
    console.log("stage_ids", payload.certification?.stage_ids)
    console.log("materialization_evidence", payload.certification?.materialization_evidence)
    console.log("template_override", {
      used: payload.certification?.materialization_evidence?.certification_sequence_template_override_used,
      original: payload.certification?.materialization_evidence?.original_sequence_key,
      materialized: payload.certification?.materialization_evidence?.materialized_sequence_key,
      email_present: payload.certification?.materialization_evidence?.contact_email_present,
      available_channels: payload.certification?.materialization_evidence?.available_channels,
      templates_considered: payload.certification?.materialization_evidence?.templates_considered,
      rejection_reasons: payload.certification?.materialization_evidence?.template_rejection_reasons,
    })
    console.log("attribution_chain", payload.certification?.attribution_chain)
    console.log("safety", payload.certification?.safety)
    console.log("safety_violations", payload.certification?.safety_violations)
    console.log("checks", payload.certification?.checks)
    console.log("blockers", payload.certification?.blockers)
    return payload
  })`

export function assertApolloFullPipelineProductionCertificationAllowed(
  env: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof assertApolloSequenceExecutionAutomationExecuteAllowed> {
  const blockers: string[] = []
  const base = assertApolloSequenceExecutionAutomationExecuteAllowed(env)

  if (env.GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK !== "1") {
    blockers.push("GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK must be 1")
  }

  return {
    ...base,
    ok: base.ok && blockers.length === 0,
    blockers: [...blockers, ...base.blockers],
    error: blockers[0] ?? base.error,
    company_limit: base.company_limit,
  }
}

export function validateApolloFullPipelineProductionCertificationConfirmation(body: unknown): {
  ok: boolean
  error: string | null
  company_candidate_id: string | null
  enrollment_candidate_id: string | null
} {
  if (!body || typeof body !== "object") {
    return {
      ok: false,
      error: `Request body must include confirm: "${APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      enrollment_candidate_id: null,
    }
  }

  const record = body as Record<string, unknown>
  const confirm = typeof record.confirm === "string" ? record.confirm.trim() : ""
  if (confirm !== APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM) {
    return {
      ok: false,
      error: `Set confirm to "${APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM}".`,
      company_candidate_id: null,
      enrollment_candidate_id: null,
    }
  }

  const companyCandidateId =
    (typeof record.companyCandidateId === "string" ? record.companyCandidateId.trim() : "") ||
    (typeof record.company_candidate_id === "string" ? record.company_candidate_id.trim() : "") ||
    null

  const enrollmentCandidateId =
    (typeof record.enrollmentCandidateId === "string" ? record.enrollmentCandidateId.trim() : "") ||
    (typeof record.enrollment_candidate_id === "string" ? record.enrollment_candidate_id.trim() : "") ||
    null

  if (!companyCandidateId) {
    return {
      ok: false,
      error: "companyCandidateId is required.",
      company_candidate_id: null,
      enrollment_candidate_id: enrollmentCandidateId,
    }
  }

  return {
    ok: true,
    error: null,
    company_candidate_id: companyCandidateId,
    enrollment_candidate_id: enrollmentCandidateId,
  }
}

export function buildApolloFullPipelineProductionCertificationReadinessPayload(input?: {
  env?: NodeJS.ProcessEnv
  company_candidate_id?: string | null
}) {
  const env = input?.env ?? process.env
  const gates = assertApolloFullPipelineProductionCertificationAllowed(env)

  return redactApolloEnrichmentCertProductionSecrets({
    ok: gates.ok,
    qa_marker: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
    certification_qa_marker: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
    auth_method: "platform_admin",
    production_runtime: isApolloScale2ProductionRuntime(env),
    execute_confirm: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
    browser_console_certification_snippet:
      APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
    gates_ok: gates.ok,
    blockers: gates.blockers,
    readiness_checklist: [...APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST],
    rollback_notes: [...APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES],
    attribution_chain: [...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN],
    outreach_sent: false,
    jobs_scheduled: false,
    email_sent: false,
    sms_sent: false,
    voice_drop_sent: false,
    call_placed: false,
    draft_created: true,
    live_outreach_allowed: false,
    pipeline: [...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN],
    company_candidate_id: input?.company_candidate_id ?? null,
  })
}

export { redactApolloEnrichmentCertProductionSecrets as redactApolloFullPipelineProductionCertificationSecrets }
