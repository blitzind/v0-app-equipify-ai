/** Apollo Account Playbooks funnel metrics — server-only aggregation. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOK_COMMITTEE_ROLE_CATEGORIES,
  APOLLO_ACCOUNT_PLAYBOOK_COVERAGE_STATUSES,
  type ApolloAccountPlaybookFunnelMetrics,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"

const PLAYBOOKS_TABLE = "account_playbooks"
const ENROLLMENT_TABLE = "apollo_enrollment_candidates"
const MEMBERS_TABLE = "account_playbook_members"

export async function buildApolloAccountPlaybookFunnelMetrics(
  admin: SupabaseClient,
): Promise<ApolloAccountPlaybookFunnelMetrics> {
  const [{ data: playbooks }, { data: enrollments }, { data: members }] = await Promise.all([
    admin.schema("growth").from(PLAYBOOKS_TABLE).select("status, coverage_status"),
    admin.schema("growth").from(ENROLLMENT_TABLE).select("status"),
    admin.schema("growth").from(MEMBERS_TABLE).select("role_category"),
  ])

  const playbookRows = playbooks ?? []
  const enrollmentApprovals = (enrollments ?? []).filter(
    (row) => row.status === "enrollment_approved",
  ).length

  const coverage_status_mix = Object.fromEntries(
    APOLLO_ACCOUNT_PLAYBOOK_COVERAGE_STATUSES.map((status) => [
      status,
      playbookRows.filter((row) => row.coverage_status === status).length,
    ]),
  ) as ApolloAccountPlaybookFunnelMetrics["coverage_status_mix"]

  const role_category_mix = Object.fromEntries(
    APOLLO_ACCOUNT_PLAYBOOK_COMMITTEE_ROLE_CATEGORIES.map((role) => [
      role,
      (members ?? []).filter((row) => row.role_category === role).length,
    ]),
  ) as ApolloAccountPlaybookFunnelMetrics["role_category_mix"]

  return {
    qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
    enrollment_approvals: enrollmentApprovals,
    account_playbooks: playbookRows.length,
    approved_playbooks: playbookRows.filter((row) => row.status === "playbook_approved").length,
    rejected_playbooks: playbookRows.filter((row) => row.status === "playbook_rejected").length,
    playbook_ready_accounts: playbookRows.filter(
      (row) => row.status === "pending_playbook_approval" || row.status === "playbook_approved",
    ).length,
    coverage_status_mix,
    role_category_mix,
    computed_at: new Date().toISOString(),
  }
}
