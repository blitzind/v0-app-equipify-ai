/** Apollo Account Playbooks evidence helpers — client-safe. */

import type {
  ApolloAccountPlaybookAttributionRecord,
  ApolloAccountPlaybookCommitteeRoleCategory,
  ApolloAccountPlaybookCoverageStatus,
  ApolloAccountPlaybookMemberRow,
  ApolloAccountPlaybookQueueSnapshot,
  ApolloAccountPlaybookRow,
  ApolloAccountPlaybookSourceAttribution,
  ApolloAccountPlaybookStatus,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-account-playbooks-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

function asRoleCategory(value: unknown): ApolloAccountPlaybookCommitteeRoleCategory {
  const normalized = asString(value)
  if (
    normalized === "Executive" ||
    normalized === "Operations" ||
    normalized === "Technical" ||
    normalized === "Financial" ||
    normalized === "End User" ||
    normalized === "Unknown"
  ) {
    return normalized
  }
  return "Unknown"
}

function asCoverageStatus(value: unknown): ApolloAccountPlaybookCoverageStatus {
  const normalized = asString(value)
  if (normalized === "Weak" || normalized === "Partial" || normalized === "Strong") return normalized
  return "Weak"
}

export function buildApolloAccountPlaybookAttributionChain(): ApolloAccountPlaybookSourceAttribution[] {
  return [...APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION]
}

export function buildApolloAccountPlaybookAttributionRecord(
  enrollmentAttribution?: Record<string, unknown> | null,
): ApolloAccountPlaybookAttributionRecord {
  return {
    apollo_source: asString(enrollmentAttribution?.apollo_source) || "Apollo Primary Contact Acquisition",
    qualification_source:
      asString(enrollmentAttribution?.qualification_source) || "apollo_enrollment_qualification_engine",
    enrollment_source:
      asString(enrollmentAttribution?.enrollment_source) || "apollo_enrollment_automation",
    account_playbook_source: "apollo_account_playbooks_abp_1",
    attribution_chain: buildApolloAccountPlaybookAttributionChain(),
  }
}

export function assertApolloAccountPlaybookAttributionPreserved(
  record: ApolloAccountPlaybookAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  return APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION.every((entry) =>
    record.attribution_chain.includes(entry),
  )
}

export function evaluateApolloAccountPlaybookDuplicateBlock(input: {
  existing_status: ApolloAccountPlaybookStatus
}): { blocked: boolean; code: string | null } {
  if (
    input.existing_status === "pending_playbook_approval" ||
    input.existing_status === "playbook_approved"
  ) {
    return { blocked: true, code: "duplicate_playbook_pending_or_approved" }
  }
  return { blocked: false, code: null }
}

export function evaluateApolloAccountPlaybookApprovalGate(input: {
  playbook: ApolloAccountPlaybookRow
}): { allowed: boolean; code: string | null } {
  if (input.playbook.status !== "pending_playbook_approval") {
    return { allowed: false, code: "invalid_playbook_status" }
  }
  if (!input.playbook.playbook_key) {
    return { allowed: false, code: "playbook_key_missing" }
  }
  if (input.playbook.committee_coverage_score <= 0 && input.playbook.committee_role_summary.length === 0) {
    return { allowed: false, code: "committee_intelligence_missing" }
  }
  return { allowed: true, code: null }
}

export function mapApolloAccountPlaybookDbRow(row: Record<string, unknown>): ApolloAccountPlaybookRow {
  const sourceAttribution =
    row.source_attribution && typeof row.source_attribution === "object"
      ? (row.source_attribution as ApolloAccountPlaybookAttributionRecord)
      : buildApolloAccountPlaybookAttributionRecord(null)

  const committeeRoleSummary = Array.isArray(row.committee_role_summary)
    ? (row.committee_role_summary as ApolloAccountPlaybookRow["committee_role_summary"])
    : []

  const recommendedMessagingTheme =
    row.recommended_messaging_theme && typeof row.recommended_messaging_theme === "object"
      ? (row.recommended_messaging_theme as Record<string, string[]>)
      : {}

  const recommendedChannelMix =
    row.recommended_channel_mix && typeof row.recommended_channel_mix === "object"
      ? (row.recommended_channel_mix as Record<string, string[]>)
      : {}

  return {
    playbook_id: asString(row.id),
    enrollment_candidate_id: asString(row.enrollment_candidate_id),
    company_candidate_id: asString(row.company_candidate_id),
    canonical_company_id: asString(row.canonical_company_id) || null,
    company_contact_id: asString(row.company_contact_id) || null,
    contact_candidate_id: asString(row.contact_candidate_id) || null,
    growth_lead_id: asString(row.growth_lead_id) || null,
    status: (asString(row.status) || "pending_playbook_approval") as ApolloAccountPlaybookStatus,
    company_name: asString(row.company_name),
    playbook_key: asString(row.playbook_key),
    committee_strategy: asString(row.committee_strategy),
    recommended_roles: Array.isArray(row.recommended_roles)
      ? row.recommended_roles.map(asRoleCategory)
      : [],
    recommended_channels: asStringArray(row.recommended_channels),
    committee_role_summary: committeeRoleSummary,
    committee_coverage_score: asNumber(row.committee_coverage_score),
    coverage_status: asCoverageStatus(row.coverage_status),
    recommended_messaging_theme: recommendedMessagingTheme,
    recommended_channel_mix: recommendedChannelMix,
    confidence_score: asNumber(row.confidence_score),
    reasoning: asString(row.reasoning),
    source_attribution: sourceAttribution,
    created_at: asString(row.created_at),
    playbook_approved_at: asString(row.playbook_approved_at) || null,
    playbook_approved_email: asString(row.playbook_approved_email) || null,
  }
}

export function mapApolloAccountPlaybookMemberDbRow(
  row: Record<string, unknown>,
): ApolloAccountPlaybookMemberRow {
  return {
    member_id: asString(row.id),
    account_playbook_id: asString(row.account_playbook_id),
    full_name: asString(row.full_name),
    title: asString(row.title) || null,
    role_category: asRoleCategory(row.role_category),
    recommended_messaging_theme: asStringArray(row.recommended_messaging_theme),
    recommended_channel_mix: asStringArray(row.recommended_channel_mix),
    contactable: row.contactable === true,
    is_decision_maker: row.is_decision_maker === true,
  }
}

export function buildApolloAccountPlaybookQueueSnapshot(input: {
  items: ApolloAccountPlaybookRow[]
}): ApolloAccountPlaybookQueueSnapshot {
  const pending = input.items.filter((item) => item.status === "pending_playbook_approval").length
  const approved = input.items.filter((item) => item.status === "playbook_approved").length
  const rejected = input.items.filter((item) => item.status === "playbook_rejected").length
  const rerun = input.items.filter((item) => item.status === "playbook_rerun_requested").length

  return {
    qa_marker: APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
    queue_label: "Account Playbook Ready",
    items: input.items,
    summary: {
      total: input.items.length,
      pending,
      approved,
      rejected,
      rerun_requested: rerun,
      playbook_ready: approved + pending,
    },
    outreach_sent: false,
  }
}
