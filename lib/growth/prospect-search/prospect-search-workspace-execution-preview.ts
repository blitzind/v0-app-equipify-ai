/** Prospect Search workspace bulk execution preview (7.PS-FB). PS-C planner only — preview. */

import {
  buildProspectSearchActionableResearchPlan,
  buildProspectSearchSuggestedGrowthEngineActions,
} from "@/lib/growth/prospect-search/prospect-search-actionable-research"
import { planProspectSearchWorkspaceBulkAction } from "@/lib/growth/prospect-search/prospect-search-workspace"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
  type ProspectSearchWorkspaceBulkActionKind,
  type ProspectSearchWorkspaceExecutionPreview,
  type ProspectSearchWorkspaceExecutionPreviewAccount,
  type ProspectSearchWorkspaceQueueId,
} from "@/lib/growth/prospect-search/prospect-search-workspace-types"
import { PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE } from "@/lib/growth/prospect-search/prospect-search-workspace-ux"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export const PROSPECT_SEARCH_WORKSPACE_QUEUE_TO_BULK_ACTION: Partial<
  Record<ProspectSearchWorkspaceQueueId, ProspectSearchWorkspaceBulkActionKind>
> = {
  acquire_humans: "human_acquisition",
  missing_verified_email: "email_discovery",
  missing_verified_phone: "phone_discovery",
  missing_verified_social: "social_profile_discovery",
  missing_company_intelligence: "company_intelligence",
  missing_committee: "buying_committee_intelligence",
  single_thread_risk: "buying_committee_intelligence",
  no_economic_buyer: "buying_committee_intelligence",
  no_champion: "buying_committee_intelligence",
  low_person_linkage: "buying_committee_intelligence",
  low_company_intelligence_coverage: "company_intelligence",
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function actionKindFromPlan(lane: string): string {
  return lane.replace(/_/g, " ")
}

export function buildProspectSearchWorkspaceExecutionPreview(input: {
  companies: GrowthProspectSearchCompanyResult[]
  company_keys: string[]
  queue_id: ProspectSearchWorkspaceQueueId | null
}): ProspectSearchWorkspaceExecutionPreview {
  const keySet = new Set(input.company_keys)
  const targets = input.companies.filter((company) =>
    keySet.has(`${company.source_type}:${company.id}`),
  )

  const bulkKind = input.queue_id
    ? PROSPECT_SEARCH_WORKSPACE_QUEUE_TO_BULK_ACTION[input.queue_id]
    : null
  const bulkPlan = bulkKind
    ? planProspectSearchWorkspaceBulkAction({
        companies: targets,
        action_kind: bulkKind,
        company_keys: input.company_keys,
      })
    : null

  const canonicalCompanyIds = new Set<string>()
  const canonicalPersonIds = new Set<string>()
  let contactCount = 0
  const recommendedKinds = new Set<string>()
  const accounts: ProspectSearchWorkspaceExecutionPreviewAccount[] = []

  for (const company of targets) {
    const company_key = `${company.source_type}:${company.id}`
    const contactRows = company.contact_intelligence?.contacts ?? []
    contactCount += contactRows.length

    const ctx = company.contact_intelligence
    const suggested = buildProspectSearchSuggestedGrowthEngineActions(company)
    const accountKinds: string[] = []
    const blockedReasons: string[] = []

    if (bulkPlan) {
      const executable = bulkPlan.executable_accounts.find((row) => row.company_key === company_key)
      const blocked = bulkPlan.blocked_accounts.find((row) => row.company_key === company_key)
      if (executable) {
        accountKinds.push(bulkPlan.action_kind)
        if (executable.canonical_company_id) canonicalCompanyIds.add(executable.canonical_company_id)
        if (executable.canonical_person_id) canonicalPersonIds.add(executable.canonical_person_id)
      }
      if (blocked) blockedReasons.push(blocked.reason)
    }

    for (const plan of suggested) {
      const kindLabel = actionKindFromPlan(plan.lane)
      if (plan.can_execute) {
        accountKinds.push(kindLabel)
        recommendedKinds.add(kindLabel)
        if (plan.company_id) canonicalCompanyIds.add(plan.company_id)
        if (plan.person_id) canonicalPersonIds.add(plan.person_id)
      } else if (plan.blocked_reason) {
        blockedReasons.push(plan.blocked_reason)
      }
    }

    if (bulkKind && !bulkPlan) {
      const psKind =
        bulkKind === "email_discovery"
          ? "verify_email"
          : bulkKind === "phone_discovery"
            ? "verify_phone_numbers"
            : bulkKind === "social_profile_discovery"
              ? "queue_social_profile_discovery"
              : bulkKind === "company_intelligence"
                ? "rerun_website_extraction"
                : "expand_relationship_coverage"
      const plan = buildProspectSearchActionableResearchPlan({ company, actionKind: psKind })
      if (plan.can_execute) {
        accountKinds.push(bulkKind)
        if (plan.company_id) canonicalCompanyIds.add(plan.company_id)
        if (plan.person_id) canonicalPersonIds.add(plan.person_id)
      } else if (plan.blocked_reason) {
        blockedReasons.push(plan.blocked_reason)
      }
    }

    for (const contact of contactRows) {
      if (contact.canonical_person_id) canonicalPersonIds.add(contact.canonical_person_id)
    }
    const cc =
      ctx?.engine_coverage?.company.canonical_company_id ??
      ctx?.engine_intelligence?.canonical_company_id ??
      company.canonical_company_id
    if (cc) canonicalCompanyIds.add(cc)

    accounts.push({
      company_key,
      company_name: company.company_name,
      recommended_action_kinds: uniqueStrings(accountKinds),
      blocked_reasons: uniqueStrings(blockedReasons),
      canonical_company_id: cc ?? null,
      canonical_person_id:
        bulkPlan?.executable_accounts.find((row) => row.company_key === company_key)
          ?.canonical_person_id ??
        suggested.find((plan) => plan.person_id)?.person_id ??
        null,
      contact_count: contactRows.length,
    })
  }

  return {
    qa_marker: GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
    queue_id: input.queue_id,
    selected_account_count: targets.length,
    affected_account_count: targets.length,
    affected_contact_count: contactCount,
    affected_canonical_company_count: canonicalCompanyIds.size,
    affected_canonical_person_count: canonicalPersonIds.size,
    recommended_action_kinds: uniqueStrings([...recommendedKinds, ...(bulkPlan ? [bulkPlan.action_kind] : [])]),
    accounts,
    planner_note: PROSPECT_SEARCH_WORKSPACE_PLANNER_NOTE,
  }
}

export function countProspectSearchWorkspacePreviewExecutable(
  preview: ProspectSearchWorkspaceExecutionPreview,
): number {
  return preview.accounts.filter(
    (row) => row.recommended_action_kinds.length > 0 && row.blocked_reasons.length === 0,
  ).length
}

export function prospectSearchWorkspaceBulkActionKindForQueue(
  queueId: ProspectSearchWorkspaceQueueId,
): ProspectSearchWorkspaceBulkActionKind | null {
  return PROSPECT_SEARCH_WORKSPACE_QUEUE_TO_BULK_ACTION[queueId] ?? null
}

export function countProspectSearchWorkspacePreviewBlocked(
  preview: ProspectSearchWorkspaceExecutionPreview,
): number {
  return preview.accounts.filter((row) => row.blocked_reasons.length > 0).length
}
