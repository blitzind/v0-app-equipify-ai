/** Prospect Search operator workspace rollups & bulk planner (7.PS-FA). Client-safe. */

import {
  buildProspectSearchActionableResearchPlan,
  resolveProspectSearchCanonicalResearchContext,
} from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import type { GrowthProspectSearchGrowthEngineJobLane } from "@/lib/growth/prospect-search/prospect-search-actionable-research-types"
import type { GrowthProspectSearchPrioritizationTier } from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import {
  PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS,
  PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES,
  PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS,
  GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER,
  type GrowthProspectSearchOperatorWorkspace,
  type ProspectSearchWorkspaceAggregates,
  type ProspectSearchWorkspaceBulkActionKind,
  type ProspectSearchWorkspaceBulkActionPlan,
  type ProspectSearchWorkspaceCompanyRef,
  type ProspectSearchWorkspaceCoverageQueueId,
  type ProspectSearchWorkspaceHealth,
  type ProspectSearchWorkspacePrioritizationAggregate,
  type ProspectSearchWorkspacePrioritizationRollup,
  type ProspectSearchWorkspaceQueueId,
  type ProspectSearchWorkspaceQueueRollup,
  type ProspectSearchWorkspaceResearchQueueId,
  type ProspectSearchWorkspaceBulkActionPlan,
  type ProspectSearchWorkspaceViewMatch,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import {
  PROSPECT_SEARCH_COVERAGE_QUEUE_LABELS,
  PROSPECT_SEARCH_PRIORITIZATION_AGGREGATE_LABELS,
  PROSPECT_SEARCH_RESEARCH_QUEUE_LABELS,
  PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_LABELS,
  PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE,
  PROSPECT_SEARCH_WORKSPACE_VIEW_LABELS,
} from "@/lib/growth/prospect-search/prospect-search-workspace-ux"
import {
  PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS,
  getProspectSearchWorkspaceViewDefinition,
} from "@/lib/growth/prospect-search/prospect-search-workspace-views"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { ProspectSearchWorkspaceViewId } from "@/lib/growth/prospect-search/prospect-search-workspace-types"

const LOW_PERSON_LINKAGE_PCT = 50
const LOW_COMPANY_INTELLIGENCE_COVERAGE_PCT = 40

const PRIORITIZATION_TIER_BY_AGGREGATE: Record<
  ProspectSearchWorkspacePrioritizationAggregate,
  GrowthProspectSearchPrioritizationTier
> = {
  accounts_ready_for_outreach: "ready_for_outreach",
  accounts_with_gaps: "outreach_with_gaps",
  research_first_accounts: "research_first",
  insufficient_data_accounts: "insufficient_data",
}

const BULK_ACTION_TO_PS_C_KIND: Record<ProspectSearchWorkspaceBulkActionKind, string> = {
  email_discovery: "verify_email",
  phone_discovery: "verify_phone_numbers",
  social_profile_discovery: "queue_social_profile_discovery",
  company_intelligence: "rerun_website_extraction",
  buying_committee_intelligence: "expand_relationship_coverage",
}

function hasCriticalRoleGap(roles: string[], role: string): boolean {
  const needle = role.toLowerCase().replace(/_/g, " ")
  return roles.some((r) => {
    const hay = r.toLowerCase().replace(/_/g, " ")
    return hay === needle || r.toLowerCase() === role.toLowerCase()
  })
}

export function prospectSearchWorkspaceCompanyRef(
  company: GrowthProspectSearchCompanyResult,
): ProspectSearchWorkspaceCompanyRef {
  const intel = company.contact_intelligence
  const engine = intel?.engine_intelligence ?? null
  const coverage = intel?.engine_coverage ?? null
  return {
    company_key: `${company.source_type}:${company.id}`,
    company_id: company.id,
    source_type: company.source_type,
    company_name: company.company_name,
    canonical_company_id:
      coverage?.company.canonical_company_id ??
      engine?.canonical_company_id ??
      company.canonical_company_id ??
      null,
    growth_lead_id: company.growth_lead_id ?? null,
    readiness: intel?.engine_readiness ?? null,
    coverage,
    engine,
  }
}

function isHydratedRef(ref: ProspectSearchWorkspaceCompanyRef): boolean {
  return Boolean(ref.readiness || ref.coverage)
}

function hasCanonicalCompany(ref: ProspectSearchWorkspaceCompanyRef): boolean {
  if (ref.coverage?.company.resolved) return true
  if (ref.readiness?.has_canonical_company) return true
  return Boolean(ref.canonical_company_id)
}

function researchQueueMembership(
  ref: ProspectSearchWorkspaceCompanyRef,
  queueId: ProspectSearchWorkspaceResearchQueueId,
): boolean {
  const engine = ref.engine
  const metrics = ref.coverage?.metrics
  const readiness = ref.readiness
  const channels = engine?.verified_channels
  const committee = engine?.buying_committee
  const canonical = hasCanonicalCompany(ref)

  switch (queueId) {
    case "missing_verified_email":
      return canonical && (channels?.persons_with_verified_email ?? 0) === 0
    case "missing_verified_phone":
      return canonical && (channels?.persons_with_verified_phone ?? 0) === 0
    case "missing_verified_social":
      return canonical && (channels?.persons_with_verified_profile ?? 0) === 0
    case "missing_committee":
      return canonical && (committee?.verified_member_count ?? 0) === 0
    case "missing_company_intelligence":
      return canonical && !engine?.company_intelligence?.has_verified_intelligence
    case "unresolved_company":
      return (
        ref.coverage?.company.unresolved_company === true ||
        (!canonical && Boolean(ref.coverage || ref.readiness))
      )
    case "unresolved_contacts":
      return (ref.coverage?.unresolved_contact_count ?? 0) > 0
    default:
      return false
  }
}

function coverageQueueMembership(
  ref: ProspectSearchWorkspaceCompanyRef,
  queueId: ProspectSearchWorkspaceCoverageQueueId,
): boolean {
  const engine = ref.engine
  const readiness = ref.readiness
  const metrics = ref.coverage?.metrics

  switch (queueId) {
    case "low_person_linkage":
      return (
        hasCanonicalCompany(ref) &&
        (metrics?.contact_count ?? 0) > 0 &&
        (metrics?.canonical_person_coverage_pct ?? 0) < LOW_PERSON_LINKAGE_PCT
      )
    case "single_thread_risk":
      return Boolean(engine?.buying_committee?.single_thread_risk)
    case "no_economic_buyer":
      return (
        hasCriticalRoleGap(readiness?.missing_critical_committee_roles ?? [], "economic buyer") ||
        hasCriticalRoleGap(engine?.buying_committee?.roles_missing ?? [], "economic_buyer")
      )
    case "no_champion":
      return (
        hasCriticalRoleGap(readiness?.missing_critical_committee_roles ?? [], "champion") ||
        hasCriticalRoleGap(engine?.buying_committee?.roles_missing ?? [], "champion")
      )
    case "low_company_intelligence_coverage":
      return (
        hasCanonicalCompany(ref) &&
        (metrics?.intelligence_coverage_pct ?? 0) < LOW_COMPANY_INTELLIGENCE_COVERAGE_PCT &&
        (metrics?.intelligence_coverage_pct ?? 0) >= 0
      )
    default:
      return false
  }
}

function queueMembership(ref: ProspectSearchWorkspaceCompanyRef, queueId: ProspectSearchWorkspaceQueueId): boolean {
  if ((PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS as readonly string[]).includes(queueId)) {
    return researchQueueMembership(ref, queueId as ProspectSearchWorkspaceResearchQueueId)
  }
  return coverageQueueMembership(ref, queueId as ProspectSearchWorkspaceCoverageQueueId)
}

export function buildProspectSearchWorkspacePrioritizationRollups(
  refs: ProspectSearchWorkspaceCompanyRef[],
): ProspectSearchWorkspacePrioritizationRollup[] {
  return PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES.map((key) => {
    const tier = PRIORITIZATION_TIER_BY_AGGREGATE[key]
    const company_keys = refs
      .filter((ref) => ref.readiness?.prioritization_tier === tier)
      .map((ref) => ref.company_key)
    return {
      key,
      label: PROSPECT_SEARCH_PRIORITIZATION_AGGREGATE_LABELS[key],
      count: company_keys.length,
      company_keys,
    }
  })
}

function buildQueueRollup(
  refs: ProspectSearchWorkspaceCompanyRef[],
  queueId: ProspectSearchWorkspaceQueueId,
  meta: { label: string; description: string },
): ProspectSearchWorkspaceQueueRollup {
  const company_keys = refs.filter((ref) => queueMembership(ref, queueId)).map((ref) => ref.company_key)
  return {
    queue_id: queueId,
    label: meta.label,
    description: meta.description,
    count: company_keys.length,
    company_keys,
  }
}

export function buildProspectSearchWorkspaceQueueRollups(
  refs: ProspectSearchWorkspaceCompanyRef[],
): {
  research_queues: ProspectSearchWorkspaceQueueRollup[]
  coverage_queues: ProspectSearchWorkspaceQueueRollup[]
} {
  const research_queues = PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS.map((queueId) =>
    buildQueueRollup(refs, queueId, PROSPECT_SEARCH_RESEARCH_QUEUE_LABELS[queueId]),
  )
  const coverage_queues = PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS.map((queueId) =>
    buildQueueRollup(refs, queueId, PROSPECT_SEARCH_COVERAGE_QUEUE_LABELS[queueId]),
  )
  return { research_queues, coverage_queues }
}

export function buildProspectSearchWorkspaceAggregates(
  refs: ProspectSearchWorkspaceCompanyRef[],
): ProspectSearchWorkspaceAggregates {
  const { research_queues, coverage_queues } = buildProspectSearchWorkspaceQueueRollups(refs)
  return {
    prioritization: buildProspectSearchWorkspacePrioritizationRollups(refs),
    research_queues,
    coverage_queues,
  }
}

export function buildProspectSearchWorkspaceHealth(
  refs: ProspectSearchWorkspaceCompanyRef[],
): ProspectSearchWorkspaceHealth {
  const account_count = refs.length
  const hydrated = refs.filter(isHydratedRef)
  const hydrated_account_count = hydrated.length

  if (account_count === 0) {
    return {
      account_count: 0,
      hydrated_account_count: 0,
      canonical_company_coverage_pct: 0,
      person_linkage_pct: 0,
      verified_channel_coverage_pct: 0,
      committee_coverage_pct: 0,
      company_intelligence_coverage_pct: 0,
      outreach_ready_pct: 0,
    }
  }

  const withCanonical = refs.filter(hasCanonicalCompany)
  let totalContacts = 0
  let linkedContacts = 0
  let withVerifiedChannel = 0
  let withCommittee = 0
  let withCompanyIntel = 0
  let outreachReady = 0

  for (const ref of refs) {
    const metrics = ref.coverage?.metrics
    const engine = ref.engine
    if (metrics) {
      totalContacts += metrics.contact_count
      linkedContacts += metrics.contacts_with_canonical_person
    }
    if (hasCanonicalCompany(ref)) {
      const email = engine?.verified_channels?.persons_with_verified_email ?? 0
      const phone = engine?.verified_channels?.persons_with_verified_phone ?? 0
      if (email > 0 || phone > 0) withVerifiedChannel += 1
      if ((engine?.buying_committee?.verified_member_count ?? 0) > 0) withCommittee += 1
      if (engine?.company_intelligence?.has_verified_intelligence) withCompanyIntel += 1
    }
    if (ref.readiness?.prioritization_tier === "ready_for_outreach") outreachReady += 1
  }

  return {
    account_count,
    hydrated_account_count,
    canonical_company_coverage_pct: Math.round((withCanonical.length / account_count) * 100),
    person_linkage_pct:
      totalContacts > 0 ? Math.round((linkedContacts / totalContacts) * 100) : 0,
    verified_channel_coverage_pct: Math.round((withVerifiedChannel / account_count) * 100),
    committee_coverage_pct: Math.round((withCommittee / account_count) * 100),
    company_intelligence_coverage_pct: Math.round((withCompanyIntel / account_count) * 100),
    outreach_ready_pct: Math.round((outreachReady / account_count) * 100),
  }
}

export function matchProspectSearchWorkspaceView(
  refs: ProspectSearchWorkspaceCompanyRef[],
  viewId: ProspectSearchWorkspaceViewId,
  queueIndex: Map<string, Set<ProspectSearchWorkspaceQueueId>>,
): string[] {
  const definition = getProspectSearchWorkspaceViewDefinition(viewId)
  if (!definition) return []

  return refs
    .filter((ref) => {
      if (definition.prioritization_tiers?.length) {
        const tier = ref.readiness?.prioritization_tier
        if (!tier || !definition.prioritization_tiers.includes(tier)) return false
      }
      if (definition.queue_ids?.length) {
        const queues = queueIndex.get(ref.company_key) ?? new Set()
        if (definition.match_mode === "all_queues") {
          return definition.queue_ids.every((q) => queues.has(q))
        }
        return definition.queue_ids.some((q) => queues.has(q))
      }
      return true
    })
    .map((ref) => ref.company_key)
}

function buildQueueIndex(
  refs: ProspectSearchWorkspaceCompanyRef[],
): Map<string, Set<ProspectSearchWorkspaceQueueId>> {
  const allQueueIds: ProspectSearchWorkspaceQueueId[] = [
    ...PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS,
    ...PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS,
  ]
  const index = new Map<string, Set<ProspectSearchWorkspaceQueueId>>()
  for (const ref of refs) {
    const set = new Set<ProspectSearchWorkspaceQueueId>()
    for (const queueId of allQueueIds) {
      if (queueMembership(ref, queueId)) set.add(queueId)
    }
    index.set(ref.company_key, set)
  }
  return index
}

export function buildProspectSearchWorkspaceViewMatches(
  refs: ProspectSearchWorkspaceCompanyRef[],
): ProspectSearchWorkspaceViewMatch[] {
  const queueIndex = buildQueueIndex(refs)
  return PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS.map((definition) => {
    const company_keys = matchProspectSearchWorkspaceView(refs, definition.id, queueIndex)
    return {
      view_id: definition.id,
      label: PROSPECT_SEARCH_WORKSPACE_VIEW_LABELS[definition.id],
      count: company_keys.length,
      company_keys,
    }
  })
}

export function planProspectSearchWorkspaceBulkAction(input: {
  companies: GrowthProspectSearchCompanyResult[]
  action_kind: ProspectSearchWorkspaceBulkActionKind
  company_keys?: string[]
}): ProspectSearchWorkspaceBulkActionPlan {
  const actionMeta = PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_LABELS[input.action_kind]
  const psKind = BULK_ACTION_TO_PS_C_KIND[input.action_kind]
  const keyFilter = input.company_keys?.length ? new Set(input.company_keys) : null

  const targets = input.companies.filter((company) => {
    const key = `${company.source_type}:${company.id}`
    return !keyFilter || keyFilter.has(key)
  })

  const executable_accounts: ProspectSearchWorkspaceBulkActionPlan["executable_accounts"] =
    []
  const blocked_accounts: ProspectSearchWorkspaceBulkActionPlan["blocked_accounts"] = []

  const canonicalCompanyIds = new Set<string>()
  const personIds = new Set<string>()

  for (const company of targets) {
    const plan = buildProspectSearchActionableResearchPlan({
      company,
      actionKind: psKind,
    })
    const company_key = `${company.source_type}:${company.id}`
    if (plan.can_execute) {
      executable_accounts.push({
        company_key,
        company_name: company.company_name,
        lane: plan.lane,
        canonical_company_id: plan.company_id,
        canonical_person_id: plan.person_id,
      })
      if (plan.company_id) canonicalCompanyIds.add(plan.company_id)
      if (plan.person_id) personIds.add(plan.person_id)
    } else {
      blocked_accounts.push({
        company_key,
        company_name: company.company_name,
        reason: plan.blocked_reason ?? "Blocked by PS-C actionable research planner.",
      })
    }
  }

  const lane = executable_accounts[0]?.lane ?? mapProspectSearchWorkspaceBulkActionToLane(input.action_kind)

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER,
    action_kind: input.action_kind,
    lane,
    label: actionMeta.label,
    description: actionMeta.description,
    action_count: targets.length,
    executable_count: executable_accounts.length,
    blocked_count: blocked_accounts.length,
    affected_account_count: targets.length,
    affected_company_count: canonicalCompanyIds.size,
    affected_person_count: personIds.size,
    executable_accounts,
    blocked_accounts,
    planner_note: PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE,
  }
}

function mapProspectSearchWorkspaceBulkActionToLane(
  kind: ProspectSearchWorkspaceBulkActionKind,
): GrowthProspectSearchGrowthEngineJobLane {
  switch (kind) {
    case "email_discovery":
      return "email_discovery"
    case "phone_discovery":
      return "phone_discovery"
    case "social_profile_discovery":
      return "social_profile_discovery"
    case "company_intelligence":
      return "company_intelligence"
    case "buying_committee_intelligence":
      return "buying_committee_intelligence"
    default:
      return "legacy_contact_discovery"
  }
}

export function buildProspectSearchOperatorWorkspace(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchOperatorWorkspace {
  const company_refs = companies.map(prospectSearchWorkspaceCompanyRef)
  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER,
    account_count: company_refs.length,
    aggregates: buildProspectSearchWorkspaceAggregates(company_refs),
    health: buildProspectSearchWorkspaceHealth(company_refs),
    views: buildProspectSearchWorkspaceViewMatches(company_refs),
    company_refs,
  }
}

export function filterProspectSearchCompaniesByWorkspaceView(
  companies: GrowthProspectSearchCompanyResult[],
  viewId: ProspectSearchWorkspaceViewId,
): GrowthProspectSearchCompanyResult[] {
  const workspace = buildProspectSearchOperatorWorkspace(companies)
  const match = workspace.views.find((row) => row.view_id === viewId)
  if (!match?.company_keys.length) return []
  const keys = new Set(match.company_keys)
  return companies.filter((company) => keys.has(`${company.source_type}:${company.id}`))
}

/** Resolve primary canonical person for planner evidence (read-only). */
export function resolveProspectSearchWorkspacePrimaryPersonId(
  company: Pick<GrowthProspectSearchCompanyResult, "contact_intelligence" | "canonical_company_id">,
): string | null {
  return resolveProspectSearchCanonicalResearchContext(company).canonical_person_id
}
