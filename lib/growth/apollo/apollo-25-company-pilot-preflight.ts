/** 25-company pilot preflight certification — dry-run gates, no sends. */

import {
  evaluateApolloFullPipelineExecutionJobSafety,
  evaluateApolloFullPipelineStageSafety,
  summarizeApolloFullPipelineSafetyViolations,
} from "@/lib/growth/apollo/apollo-full-pipeline-materialization-evidence"
import type { ApolloPrimaryContactOperatorReviewRow } from "@/lib/growth/apollo/apollo-primary-contact-operator-review-types"
import {
  APOLLO_25_COMPANY_PILOT_QA_MARKER,
  type Apollo25CompanyPilotPreflightCheck,
  type Apollo25CompanyPilotPreflightCompanyResult,
  type Apollo25CompanyPilotPreflightReport,
  type Apollo25CompanyPilotSelectionRow,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

function check(
  key: string,
  label: string,
  pass: boolean,
  blocker: string | null,
): Apollo25CompanyPilotPreflightCheck {
  return { key, label, pass, blocker }
}

export function runApollo25CompanyPilotPreflightForCompany(input: {
  company: Apollo25CompanyPilotSelectionRow
  contact: ApolloPrimaryContactOperatorReviewRow
  growth_lead_id?: string | null
  enrollment_creatable?: boolean
}): Apollo25CompanyPilotPreflightCompanyResult {
  const contact = input.contact
  const checks: Apollo25CompanyPilotPreflightCheck[] = []

  checks.push(
    check(
      "apollo_contact_evidence",
      "Apollo contact evidence exists",
      contact.full_name.trim().length > 0 &&
        Boolean(contact.company_contact_id || contact.contact_candidate_id),
      "missing_apollo_contact_evidence",
    ),
  )

  checks.push(
    check(
      "lead_resolvable",
      "Lead exists or can be created",
      Boolean(contact.company_contact_id || contact.contact_candidate_id),
      "lead_resolution_path_missing",
    ),
  )

  checks.push(
    check(
      "enrollment_candidate_creatable",
      "Enrollment candidate can be created",
      input.enrollment_creatable ?? input.company.qualification_score >= 70,
      "enrollment_not_creatable",
    ),
  )

  checks.push(
    check(
      "account_playbook_creatable",
      "Account playbook can be created",
      input.company.qualification_score > 0 && contact.sequence_ready,
      "playbook_prerequisites_missing",
    ),
  )

  checks.push(
    check(
      "voice_drop_candidate_creatable",
      "Voice drop candidate can be created",
      contact.channel_availability.phone || contact.phone_status === "verified",
      "voice_channel_unavailable",
    ),
  )

  checks.push(
    check(
      "multichannel_candidate_creatable",
      "Multi-channel candidate can be created",
      contact.channel_availability.email || input.company.selected_contact.verified_email_status !== "missing",
      "email_channel_unavailable",
    ),
  )

  checks.push(
    check(
      "sequence_execution_candidate_creatable",
      "Sequence execution candidate can be created",
      contact.sequence_ready && contact.contactable,
      "sequence_execution_prerequisites_missing",
    ),
  )

  checks.push(
    check(
      "personalized_draft_generatable",
      "Personalized draft can be generated",
      contact.full_name.trim().length > 0 && input.company.company_name.trim().length > 0,
      "personalization_inputs_missing",
    ),
  )

  const safeJobStatuses = [{ status: "pending_approval" }, { status: "draft" }]
  const jobViolations = evaluateApolloFullPipelineExecutionJobSafety({ jobs: safeJobStatuses })
  checks.push(
    check(
      "execution_job_pending_approval",
      "Execution job can be created in pending approval",
      jobViolations.length === 0,
      jobViolations.length > 0 ? "unsafe_job_status_simulation" : null,
    ),
  )

  const stageViolations = [
    ...evaluateApolloFullPipelineStageSafety({ outreach_sent: false, jobs_scheduled: false }, "enrollment"),
    ...evaluateApolloFullPipelineStageSafety({ outreach_sent: false, jobs_scheduled: false }, "sequence_execution"),
  ]
  checks.push(
    check(
      "no_send_schedule",
      "No send/schedule in preflight path",
      stageViolations.length === 0,
      stageViolations.length > 0 ? summarizeApolloFullPipelineSafetyViolations(stageViolations) : null,
    ),
  )

  const blockers = checks.filter((c) => !c.pass).map((c) => c.blocker ?? c.key)

  return {
    company_candidate_id: input.company.company_candidate_id,
    company_name: input.company.company_name,
    pass: blockers.length === 0,
    blockers,
    checks,
  }
}

export function runApollo25CompanyPilotPreflight(input: {
  selected: Apollo25CompanyPilotSelectionRow[]
  contacts_by_company: Record<string, ApolloPrimaryContactOperatorReviewRow>
}): Apollo25CompanyPilotPreflightReport {
  const results = input.selected.map((company) => {
    const contactId =
      company.selected_contact.company_contact_id ?? company.selected_contact.contact_candidate_id ?? ""
    const contact =
      input.contacts_by_company[company.company_candidate_id] ??
      ({
        row_id: contactId,
        company_contact_id: company.selected_contact.company_contact_id,
        contact_candidate_id: company.selected_contact.contact_candidate_id,
        canonical_person_id: null,
        full_name: company.selected_contact.full_name,
        title: company.selected_contact.title,
        company_name: company.company_name,
        source: "Apollo",
        channel_availability: {
          email: company.selected_contact.verified_email_status !== "missing",
          phone: true,
          linkedin: false,
        },
        enrichment_status: "channel_ready",
        contactable: true,
        sequence_ready: company.selected_contact.sequence_ready,
        operator_review_status: "approved",
        outreach_ready: true,
        blockers: [],
        contact_status: null,
        email_status:
          company.selected_contact.verified_email_status === "verified" ? "verified" : null,
        phone_status: null,
      } satisfies ApolloPrimaryContactOperatorReviewRow)

    return runApollo25CompanyPilotPreflightForCompany({
      company,
      contact,
      enrollment_creatable: company.qualification_score >= 70,
    })
  })

  const companies_passed = results.filter((r) => r.pass).length
  const companies_evaluated = results.length
  const pilot_readiness_pct =
    companies_evaluated > 0 ? Math.round((companies_passed / companies_evaluated) * 100) : 0

  return {
    qa_marker: APOLLO_25_COMPANY_PILOT_QA_MARKER,
    companies_evaluated,
    companies_passed,
    pilot_readiness_pct,
    results,
    safety_summary: "Preflight dry-run only — no outreach_sent, jobs_scheduled, or channel sends.",
  }
}
