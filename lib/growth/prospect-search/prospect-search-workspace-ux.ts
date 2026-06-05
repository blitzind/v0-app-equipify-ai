/** Prospect Search operator workspace UX copy (7.PS-FA). Client-safe. */

import type {
  ProspectSearchWorkspaceBulkActionKind,
  ProspectSearchWorkspaceCoverageQueueId,
  ProspectSearchWorkspacePrioritizationAggregate,
  ProspectSearchWorkspaceResearchQueueId,
  ProspectSearchWorkspaceViewId,
  ProspectSearchWorkspaceWorklistKind,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER =
  "growth-prospect-search-workspace-ux-7-ps-fa-v1" as const

export const GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER =
  "growth-prospect-search-workspace-ux-7-ps-fb-v1" as const

export const PROSPECT_SEARCH_WORKSPACE_SUMMARY_TITLE = "Operator workspace"
export const PROSPECT_SEARCH_WORKSPACE_QUEUES_TITLE = "Research & coverage queues"
export const PROSPECT_SEARCH_WORKSPACE_HEALTH_TITLE = "Workspace health"
export const PROSPECT_SEARCH_WORKSPACE_VIEWS_TITLE = "Workspace views"
export const PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE =
  "Execution preview only — plans Growth Engine jobs from PS-C lanes. Does not enqueue or execute in 7.PS-FB."

export const PROSPECT_SEARCH_WORKSPACE_WORKLIST_TITLE = "Operator worklist"
export const PROSPECT_SEARCH_WORKSPACE_EXECUTION_PREVIEW_TITLE = "Bulk execution preview"
export const PROSPECT_SEARCH_WORKSPACE_SELECTION_TITLE = "Workspace selection"

export const PROSPECT_SEARCH_WORKSPACE_WORKLIST_LABELS: Record<
  ProspectSearchWorkspaceWorklistKind,
  string
> = {
  outreach_ready: "Outreach ready",
  research_first: "Research first",
  missing_email: "Missing email",
  missing_phone: "Missing phone",
  committee_gaps: "Committee gaps",
  coverage_gaps: "Coverage gaps",
  unresolved_accounts: "Unresolved accounts",
}

export const PROSPECT_SEARCH_WORKSPACE_WORKLIST_FIELD_LABELS: Record<string, string> = {
  readiness_summary: "Readiness",
  committee_coverage: "Committee",
  verified_channels: "Verified channels",
  company_intelligence_coverage: "Company intelligence",
  blocking_gaps: "Blocking gaps",
  recommended_research_lanes: "Recommended lanes",
  canonical_linkage: "Canonical linkage",
  verified_phone: "Verified phone",
  verified_email: "Verified email",
  committee_status: "Committee status",
  missing_roles: "Missing roles",
  verified_members: "Verified members",
  coverage_diagnostics: "Coverage diagnostics",
}

export const PROSPECT_SEARCH_PRIORITIZATION_AGGREGATE_LABELS: Record<
  ProspectSearchWorkspacePrioritizationAggregate,
  string
> = {
  accounts_ready_for_outreach: "Ready for outreach",
  accounts_with_gaps: "Outreach with gaps",
  research_first_accounts: "Research first",
  insufficient_data_accounts: "Insufficient data",
}

export const PROSPECT_SEARCH_RESEARCH_QUEUE_LABELS: Record<
  ProspectSearchWorkspaceResearchQueueId,
  { label: string; description: string }
> = {
  missing_verified_email: {
    label: "Missing verified email",
    description: "Canonical company linked but no verified email (7.3).",
  },
  missing_verified_phone: {
    label: "Missing verified phone",
    description: "Canonical company linked but no verified phone (7.4).",
  },
  missing_verified_social: {
    label: "Missing verified social",
    description: "Canonical company linked but no verified social profile (7.5).",
  },
  missing_committee: {
    label: "Missing committee",
    description: "No verified buying committee members (7.7).",
  },
  missing_company_intelligence: {
    label: "Missing company intelligence",
    description: "No verified company intelligence snapshots (7.6).",
  },
  unresolved_company: {
    label: "Unresolved company",
    description: "Canonical company not linked (PS-E).",
  },
  unresolved_contacts: {
    label: "Unresolved contacts",
    description: "One or more contacts lack canonical person linkage (PS-E).",
  },
}

export const PROSPECT_SEARCH_COVERAGE_QUEUE_LABELS: Record<
  ProspectSearchWorkspaceCoverageQueueId,
  { label: string; description: string }
> = {
  low_person_linkage: {
    label: "Low person linkage",
    description: "Person linkage below 50% on account contacts.",
  },
  single_thread_risk: {
    label: "Single-thread risk",
    description: "Buying committee flagged single-threaded (7.7).",
  },
  no_economic_buyer: {
    label: "No economic buyer",
    description: "Critical economic buyer role not verified on committee.",
  },
  no_champion: {
    label: "No champion",
    description: "Critical champion role not verified on committee.",
  },
  low_company_intelligence_coverage: {
    label: "Low intelligence coverage",
    description: "Verified company intelligence category coverage below 40%.",
  },
}

export const PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_LABELS: Record<
  ProspectSearchWorkspaceBulkActionKind,
  { label: string; description: string }
> = {
  email_discovery: {
    label: "Email discovery (plan)",
    description: "Would queue email discovery jobs (7.3B) per PS-C planner.",
  },
  phone_discovery: {
    label: "Phone discovery (plan)",
    description: "Would queue phone discovery jobs (7.4B) per PS-C planner.",
  },
  social_profile_discovery: {
    label: "Social discovery (plan)",
    description: "Would queue social profile discovery jobs (7.5B) per PS-C planner.",
  },
  company_intelligence: {
    label: "Company intelligence (plan)",
    description: "Would queue company intelligence jobs (7.6B) per PS-C planner.",
  },
  buying_committee_intelligence: {
    label: "Buying committee (plan)",
    description: "Would queue buying committee intelligence jobs (7.7B) per PS-C planner.",
  },
}

export const PROSPECT_SEARCH_WORKSPACE_VIEW_LABELS: Record<ProspectSearchWorkspaceViewId, string> =
  {
    outreach_ready: "Outreach Ready",
    research_queue: "Research Queue",
    committee_gaps: "Committee Gaps",
    missing_emails: "Missing Emails",
    missing_phones: "Missing Phones",
    low_coverage: "Low Coverage",
    unresolved_accounts: "Unresolved Accounts",
  }
