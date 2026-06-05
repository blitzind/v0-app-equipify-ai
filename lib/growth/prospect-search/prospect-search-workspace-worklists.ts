/** Prospect Search operator workspace worklists (7.PS-FB). Client-safe. */

import { buildProspectSearchSuggestedGrowthEngineActions } from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import {
  prospectSearchWorkspaceCompanyInQueue,
  prospectSearchWorkspaceCompanyNeedsHumanAcquisition,
  prospectSearchWorkspaceCompanyRef,
} from "@/lib/growth/prospect-search/prospect-search-workspace"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
  type ProspectSearchWorkspaceCompanyRef,
  type ProspectSearchWorkspaceViewId,
  type ProspectSearchWorkspaceWorklist,
  type ProspectSearchWorkspaceWorklistKind,
  type ProspectSearchWorkspaceWorklistRow,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { PROSPECT_SEARCH_WORKSPACE_WORKLIST_LABELS } from "@/lib/growth/prospect-search/prospect-search-workspace-ux"

const COMMITTEE_GAP_QUEUE_IDS = [
  "missing_committee",
  "single_thread_risk",
  "no_economic_buyer",
  "no_champion",
] as const

const COVERAGE_GAP_QUEUE_IDS = [
  "low_person_linkage",
  "unresolved_contacts",
  "low_company_intelligence_coverage",
] as const

export function prospectSearchWorkspaceViewToWorklistKind(
  viewId: ProspectSearchWorkspaceViewId,
): ProspectSearchWorkspaceWorklistKind {
  switch (viewId) {
    case "outreach_ready":
      return "outreach_ready"
    case "acquire_humans":
      return "acquire_humans"
    case "research_queue":
      return "research_first"
    case "missing_emails":
      return "missing_email"
    case "missing_phones":
      return "missing_phone"
    case "committee_gaps":
      return "committee_gaps"
    case "low_coverage":
      return "coverage_gaps"
    case "unresolved_accounts":
      return "unresolved_accounts"
    default:
      return "coverage_gaps"
  }
}

function refMatchesWorklistKind(
  ref: ProspectSearchWorkspaceCompanyRef,
  kind: ProspectSearchWorkspaceWorklistKind,
): boolean {
  switch (kind) {
    case "outreach_ready":
      return ref.readiness?.prioritization_tier === "ready_for_outreach"
    case "research_first":
      return ref.readiness?.prioritization_tier === "research_first"
    case "acquire_humans":
      return prospectSearchWorkspaceCompanyNeedsHumanAcquisition(ref)
    case "missing_email":
      return prospectSearchWorkspaceCompanyInQueue(ref, "missing_verified_email")
    case "missing_phone":
      return prospectSearchWorkspaceCompanyInQueue(ref, "missing_verified_phone")
    case "committee_gaps":
      return COMMITTEE_GAP_QUEUE_IDS.some((queueId) =>
        prospectSearchWorkspaceCompanyInQueue(ref, queueId),
      )
    case "coverage_gaps":
      return COVERAGE_GAP_QUEUE_IDS.some((queueId) =>
        prospectSearchWorkspaceCompanyInQueue(ref, queueId),
      )
    case "unresolved_accounts":
      return (
        prospectSearchWorkspaceCompanyInQueue(ref, "unresolved_company") ||
        prospectSearchWorkspaceCompanyInQueue(ref, "unresolved_contacts")
      )
    default:
      return false
  }
}

function formatVerifiedChannels(ref: ProspectSearchWorkspaceCompanyRef): string {
  const channels = ref.engine?.verified_channels
  const email = channels?.persons_with_verified_email ?? 0
  const phone = channels?.persons_with_verified_phone ?? 0
  const social = channels?.persons_with_verified_profile ?? 0
  return `${email} email · ${phone} phone · ${social} social`
}

function formatCommitteeCoverage(ref: ProspectSearchWorkspaceCompanyRef): string {
  const committee = ref.engine?.buying_committee
  const count = committee?.verified_member_count ?? 0
  const roles = committee?.roles_present?.join(", ").replace(/_/g, " ") ?? "none"
  return `${count} verified (${roles || "no roles"})`
}

function formatCompanyIntelligenceCoverage(ref: ProspectSearchWorkspaceCompanyRef): string {
  const intel = ref.engine?.company_intelligence
  if (intel?.has_verified_intelligence) {
    return `${intel.categories_present.length} categories verified`
  }
  return intel?.discovery_status ?? "No verified intelligence"
}

function buildWorklistRowFields(
  ref: ProspectSearchWorkspaceCompanyRef,
  kind: ProspectSearchWorkspaceWorklistKind,
): Record<string, string | number | string[] | null> {
  const readiness = ref.readiness
  const engine = ref.engine
  const coverage = ref.coverage

  switch (kind) {
    case "outreach_ready":
      return {
        readiness_summary: readiness?.operator_summary ?? null,
        committee_coverage: formatCommitteeCoverage(ref),
        verified_channels: formatVerifiedChannels(ref),
        company_intelligence_coverage: formatCompanyIntelligenceCoverage(ref),
      }
    case "acquire_humans":
      return {
        canonical_linkage: ref.coverage?.company.resolved
          ? `Linked (${ref.canonical_company_id ?? "canonical"})`
          : "Unresolved canonical company",
        contact_count: ref.coverage?.metrics?.contact_count ?? 0,
        linked_persons: ref.coverage?.metrics?.contacts_with_canonical_person ?? 0,
        recommended_action: "Run website contact discovery and canonical person promotion",
      }
    case "research_first": {
      const blocking: string[] = []
      if (readiness?.contactability.level === "gap" || readiness?.contactability.level === "blocked") {
        blocking.push(readiness.contactability.summary)
      }
      if (readiness?.channel.level === "gap" || readiness?.channel.level === "blocked") {
        blocking.push(readiness.channel.summary)
      }
      if (readiness?.committee.level === "gap" || readiness?.committee.level === "blocked") {
        blocking.push(readiness.committee.summary)
      }
      if (
        readiness?.company_intelligence.level === "gap" ||
        readiness?.company_intelligence.level === "blocked"
      ) {
        blocking.push(readiness.company_intelligence.summary)
      }
      const companyStub = {
        contact_intelligence: {
          engine_intelligence: engine,
          engine_readiness: readiness,
          engine_coverage: coverage,
        },
        canonical_company_id: ref.canonical_company_id,
      } as GrowthProspectSearchCompanyResult
      const lanes = buildProspectSearchSuggestedGrowthEngineActions(companyStub)
        .map((plan) => plan.lane.replace(/_/g, " "))
        .slice(0, 4)
      return {
        blocking_gaps: blocking.length ? blocking : [readiness?.operator_summary ?? "Research gaps pending"],
        recommended_research_lanes: lanes.length ? lanes : ["Resolve canonical linkage first"],
      }
    }
    case "missing_email":
      return {
        canonical_linkage: ref.coverage?.company.resolved
          ? `Linked (${ref.canonical_company_id ?? "canonical"})`
          : "Unresolved canonical company",
        verified_phone:
          (engine?.verified_channels?.persons_with_verified_phone ?? 0) > 0
            ? `${engine!.verified_channels!.persons_with_verified_phone} verified`
            : "None",
        committee_status: formatCommitteeCoverage(ref),
      }
    case "missing_phone":
      return {
        verified_email:
          (engine?.verified_channels?.persons_with_verified_email ?? 0) > 0
            ? `${engine!.verified_channels!.persons_with_verified_email} verified`
            : "None",
        committee_status: formatCommitteeCoverage(ref),
      }
    case "committee_gaps": {
      const missingRoles = [
        ...(readiness?.missing_critical_committee_roles ?? []),
        ...(engine?.buying_committee?.roles_missing ?? []).map((r) => r.replace(/_/g, " ")),
      ]
      const uniqueRoles = [...new Set(missingRoles.map((r) => r.trim()).filter(Boolean))]
      const verifiedMembers =
        engine?.buying_committee?.members
          ?.map((m) => m.display_name || m.person_id)
          .filter(Boolean)
          .slice(0, 4) ?? []
      return {
        missing_roles: uniqueRoles.length ? uniqueRoles : ["committee coverage gap"],
        verified_members: verifiedMembers.length
          ? verifiedMembers
          : ["No verified committee members"],
      }
    }
    case "coverage_gaps":
    case "unresolved_accounts": {
      const diagnostics: string[] = []
      if (prospectSearchWorkspaceCompanyInQueue(ref, "low_person_linkage")) {
        diagnostics.push(
          `Low person linkage (${coverage?.metrics.canonical_person_coverage_pct ?? 0}%)`,
        )
      }
      if (prospectSearchWorkspaceCompanyInQueue(ref, "unresolved_contacts")) {
        diagnostics.push(`${coverage?.unresolved_contact_count ?? 0} unresolved contacts`)
      }
      if (prospectSearchWorkspaceCompanyInQueue(ref, "low_company_intelligence_coverage")) {
        diagnostics.push(
          `Low company intelligence (${coverage?.metrics.intelligence_coverage_pct ?? 0}%)`,
        )
      }
      if (prospectSearchWorkspaceCompanyInQueue(ref, "unresolved_company")) {
        diagnostics.push("Unresolved canonical company")
      }
      return {
        coverage_diagnostics: diagnostics.length ? diagnostics : ["Coverage gap detected"],
      }
    }
    default:
      return {}
  }
}

export function buildProspectSearchWorkspaceWorklistRow(
  ref: ProspectSearchWorkspaceCompanyRef,
  kind: ProspectSearchWorkspaceWorklistKind,
): ProspectSearchWorkspaceWorklistRow {
  return {
    company_key: ref.company_key,
    company_name: ref.company_name,
    canonical_company_id: ref.canonical_company_id,
    fields: buildWorklistRowFields(ref, kind),
  }
}

export function buildProspectSearchWorkspaceWorklist(input: {
  companies: GrowthProspectSearchCompanyResult[]
  kind: ProspectSearchWorkspaceWorklistKind
  company_keys?: string[]
}): ProspectSearchWorkspaceWorklist {
  const keyFilter = input.company_keys?.length ? new Set(input.company_keys) : null
  const refs = input.companies
    .map(prospectSearchWorkspaceCompanyRef)
    .filter((ref) => !keyFilter || keyFilter.has(ref.company_key))
    .filter((ref) => refMatchesWorklistKind(ref, input.kind))

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
    kind: input.kind,
    label: PROSPECT_SEARCH_WORKSPACE_WORKLIST_LABELS[input.kind],
    account_count: refs.length,
    rows: refs.map((ref) => buildProspectSearchWorkspaceWorklistRow(ref, input.kind)),
  }
}

export function buildProspectSearchWorkspaceWorklistForView(input: {
  companies: GrowthProspectSearchCompanyResult[]
  viewId: ProspectSearchWorkspaceViewId
  company_keys?: string[]
}): ProspectSearchWorkspaceWorklist {
  return buildProspectSearchWorkspaceWorklist({
    companies: input.companies,
    kind: prospectSearchWorkspaceViewToWorklistKind(input.viewId),
    company_keys: input.company_keys,
  })
}
