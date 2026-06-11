/** Apollo Account Playbooks production route — server-only orchestration. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { mapApolloEnrollmentCandidateDbRow } from "@/lib/growth/apollo/apollo-enrollment-automation-evidence"
import { handoffEnrollmentApprovedToAccountPlaybook } from "@/lib/growth/apollo/apollo-account-playbooks-bridge"
import { certifyApolloAccountPlaybooks } from "@/lib/growth/apollo/apollo-account-playbooks-certification"
import { mapApolloAccountPlaybookDbRow } from "@/lib/growth/apollo/apollo-account-playbooks-evidence"
import { buildApolloAccountPlaybookFunnelMetrics } from "@/lib/growth/apollo/apollo-account-playbooks-funnel-metrics"
import type {
  ApolloAccountPlaybookAutomationReport,
  ApolloAccountPlaybookCertificationReport,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_ID,
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import {
  assertApolloAccountPlaybooksExecuteAllowed,
  buildApolloAccountPlaybooksReadinessPayload,
  redactApolloAccountPlaybooksSecrets,
} from "@/lib/growth/apollo/apollo-account-playbooks-route-gates"

export type ApolloAccountPlaybooksExecuteResult = {
  ok: boolean
  execution_id: string
  report: ApolloAccountPlaybookAutomationReport | null
  certification: ApolloAccountPlaybookCertificationReport | null
  blockers: string[]
  error?:
    | "gates_failed"
    | "enrollment_not_found"
    | "enrollment_not_approved"
    | "automation_failed"
    | "certification_failed"
  message?: string | null
}

export async function buildApolloAccountPlaybooksReadiness(
  admin: SupabaseClient,
  input?: { env?: NodeJS.ProcessEnv; enrollment_candidate_id?: string | null },
) {
  return buildApolloAccountPlaybooksReadinessPayload({
    env: input?.env ?? process.env,
    enrollment_candidate_id: input?.enrollment_candidate_id ?? null,
  })
}

export async function executeApolloAccountPlaybooksInProduction(
  admin: SupabaseClient,
  input: {
    enrollment_candidate_id: string
    certification_mode?: boolean
    env?: NodeJS.ProcessEnv
  },
): Promise<ApolloAccountPlaybooksExecuteResult> {
  const env = input.env ?? process.env
  const execution_id = randomUUID()
  const gates = assertApolloAccountPlaybooksExecuteAllowed(env)

  if (!gates.ok) {
    return redactApolloAccountPlaybooksSecrets({
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
    return redactApolloAccountPlaybooksSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: [enrollmentError.message],
      error: "enrollment_not_found",
    })
  }

  if (!enrollmentRow) {
    return redactApolloAccountPlaybooksSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["enrollment_candidate_not_found"],
      error: "enrollment_not_found",
    })
  }

  const enrollment = mapApolloEnrollmentCandidateDbRow(enrollmentRow as Record<string, unknown>)
  if (enrollment.status !== "enrollment_approved") {
    return redactApolloAccountPlaybooksSecrets({
      ok: false,
      execution_id,
      report: null,
      certification: null,
      blockers: ["enrollment_not_approved"],
      error: "enrollment_not_approved",
      message: `Enrollment candidate status is ${enrollment.status}.`,
    })
  }

  const handoff = await handoffEnrollmentApprovedToAccountPlaybook(admin, {
    enrollment_candidate_id: enrollment.candidate_id,
    company_candidate_id: enrollment.company_candidate_id,
    canonical_company_id: null,
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
  })

  const playbooks: ApolloAccountPlaybookAutomationReport["playbooks"] = []
  if (handoff.playbook_id) {
    const { data: playbookRow } = await admin
      .schema("growth")
      .from("account_playbooks")
      .select("*")
      .eq("id", handoff.playbook_id)
      .maybeSingle()
    if (playbookRow) {
      playbooks.push(mapApolloAccountPlaybookDbRow(playbookRow as Record<string, unknown>))
    }
  }

  const funnel_metrics = await buildApolloAccountPlaybookFunnelMetrics(admin)
  const blockers: string[] = handoff.ok ? [] : [handoff.error ?? "handoff_failed"]

  const report: ApolloAccountPlaybookAutomationReport = {
    qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
    automation_id: APOLLO_ACCOUNT_PLAYBOOKS_ID,
    execution_id,
    enrollment_candidate_id: enrollment.candidate_id,
    playbooks_created: handoff.ok && handoff.playbook_id ? 1 : 0,
    playbooks_skipped_duplicate: handoff.ok && !handoff.playbook_id ? 1 : 0,
    funnel_metrics,
    playbooks,
    blockers,
    outreach_sent: false,
    completed_at: new Date().toISOString(),
  }

  await admin.schema("growth").from("account_playbook_runs").insert({
    execution_id,
    enrollment_candidate_id: enrollment.candidate_id,
    account_playbook_id: handoff.playbook_id,
    status: blockers.length === 0 ? "completed" : "partial",
    playbooks_created: report.playbooks_created,
    playbooks_skipped_duplicate: report.playbooks_skipped_duplicate,
    funnel_metrics,
    blockers,
    outreach_sent: false,
    metadata: { qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER },
  })

  let certification: ApolloAccountPlaybookCertificationReport | null = null
  if (input.certification_mode) {
    certification = await certifyApolloAccountPlaybooks(admin, {
      company_candidate_id: enrollment.company_candidate_id,
      execution_id,
      report,
      approve_test_playbook: true,
    })
    if (!certification.certified) {
      return redactApolloAccountPlaybooksSecrets({
        ok: false,
        execution_id,
        report,
        certification,
        blockers: certification.blockers,
        error: "certification_failed",
      })
    }
  }

  return redactApolloAccountPlaybooksSecrets({
    ok: blockers.length === 0,
    execution_id,
    report,
    certification,
    blockers,
  })
}
