/** Operator workload estimate for 25-company pilot (Phase 13-informed). */

import type {
  Apollo25CompanyPilotWorkloadEstimate,
  Apollo25CompanyPilotSelectionReport,
} from "@/lib/growth/apollo/apollo-25-company-pilot-types"

const MINUTES_PER_APPROVAL = 4
const DRAFTS_PER_COMPANY = 2
const JOBS_PER_COMPANY = 3

export function estimateApollo25CompanyPilotWorkload(
  selection: Apollo25CompanyPilotSelectionReport,
  input?: {
    minutes_per_approval?: number
    drafts_per_company?: number
    jobs_per_company?: number
    primary_bottleneck?: string
  },
): Apollo25CompanyPilotWorkloadEstimate {
  const companies = selection.selected_count
  const minutes = input?.minutes_per_approval ?? MINUTES_PER_APPROVAL
  const draftsPer = input?.drafts_per_company ?? DRAFTS_PER_COMPANY
  const jobsPer = input?.jobs_per_company ?? JOBS_PER_COMPANY

  const enrollment_approvals_required = companies
  const playbook_approvals_required = companies
  const voice_drop_approvals_required = companies
  const multichannel_approvals_required = companies
  const draft_approvals_required = companies * draftsPer
  const job_approvals_required = companies * jobsPer

  const totalApprovals =
    enrollment_approvals_required +
    playbook_approvals_required +
    voice_drop_approvals_required +
    multichannel_approvals_required +
    draft_approvals_required +
    job_approvals_required

  const estimated_operator_hours = Math.round(((totalApprovals * minutes) / 60) * 10) / 10

  let primary_bottleneck = input?.primary_bottleneck ?? "sequence_execution"
  if (job_approvals_required >= draft_approvals_required) primary_bottleneck = "safe_execution"
  if (draft_approvals_required > job_approvals_required) primary_bottleneck = "sequence_execution"

  return {
    enrollment_approvals_required,
    playbook_approvals_required,
    voice_drop_approvals_required,
    multichannel_approvals_required,
    draft_approvals_required,
    job_approvals_required,
    estimated_operator_hours,
    primary_bottleneck,
  }
}
