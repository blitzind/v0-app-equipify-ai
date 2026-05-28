import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createLeadCandidate } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import {
  growthSignalInboxIntentBoost,
  growthSignalInboxPriority,
} from "@/lib/growth/company-growth-signals/integrations/command-center-bridge"
import { prospectSearchDedupeHash } from "@/lib/growth/prospect-search/prospect-search-index"
import {
  buildProspectSearchPushMetadata,
  formatBulkPushSummary,
  type GrowthProspectSearchBulkPushResult,
  type GrowthProspectSearchPushItemResult,
  type GrowthProspectSearchPushOutcome,
  type ProspectSearchSelectionRef,
} from "@/lib/growth/prospect-search/prospect-search-push-metadata"
import { resolveProspectSearchCompanyResultsForPush } from "@/lib/growth/prospect-search/prospect-search-repository"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_PROSPECT_SEARCH_SOURCE_TYPES } from "@/lib/growth/prospect-search/prospect-search-types"

export {
  GROWTH_PROSPECT_SEARCH_BULK_PUSH_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_PUSH_OUTCOMES,
  type GrowthProspectSearchBulkPushResult,
  type GrowthProspectSearchPushItemResult,
  type GrowthProspectSearchPushOutcome,
  type ProspectSearchSelectionRef,
} from "@/lib/growth/prospect-search/prospect-search-push-metadata"

export async function pushProspectSearchCompanyToLeadInbox(
  admin: SupabaseClient,
  company: GrowthProspectSearchCompanyResult,
  query: string,
): Promise<{
  outcome: GrowthProspectSearchPushOutcome
  message: string
  lead_inbox_id?: string | null
}> {
  if (!company.company_name?.trim()) {
    return {
      outcome: "skipped_invalid",
      message: "Company name is required.",
    }
  }

  if (company.is_suppressed) {
    return {
      outcome: "suppressed",
      message: "Suppressed from outreach — not pushed to Lead Inbox.",
    }
  }

  const dedupe_hash = prospectSearchDedupeHash([
    "prospect_search",
    company.source_type,
    company.id,
    company.website ?? "",
  ])

  const growthIntentBoost = growthSignalInboxIntentBoost(company.growth_signal_score)
  const inboxPriority = company.growth_signal_tier
    ? growthSignalInboxPriority(company.growth_signal_tier)
    : "normal"

  const result = await createLeadCandidate(admin, {
    site_key:
      company.source_type === "external_discovered"
        ? "prospect_search_external_discovery"
        : "prospect_search",
    candidate_type: "identified",
    candidate_priority: inboxPriority,
    intent_score: (company.intent_score ?? 0) + growthIntentBoost,
    intent_grade: "C",
    candidate_confidence: company.confidence,
    pipeline_entry: "icp_targeting",
    company_name: company.company_name,
    domain: company.website,
    dedupe_hash,
    candidate_reasoning: [
      company.source_type === "external_discovered"
        ? "Manual push from external company discovery — candidate is not an automatic lead."
        : "Manual push from Prospect Search — operator-initiated, not autonomous outreach.",
      ...(company.growth_signal_score != null
        ? [`Growth signal score ${company.growth_signal_score}${company.growth_signal_tier ? ` (${company.growth_signal_tier})` : ""}.`]
        : []),
      ...company.match_reasoning.slice(0, 3),
    ],
    candidate_evidence:
      company.signals.length > 0
        ? company.signals.map((signal) => ({
            claim: "Prospect search signal",
            evidence: signal,
            source: "growth.prospect_search",
          }))
        : [
            {
              claim: "Prospect search selection",
              evidence: `Operator pushed ${company.source_type} record from ICP search.`,
              source: "growth.prospect_search",
            },
          ],
    candidate_attribution: [
      {
        source: "growth.prospect_search",
        section: "result_action",
        signal: "push_to_lead_inbox",
        evidence: `Pushed from ${company.source_type} record ${company.id}.`,
        confidence: company.confidence,
      },
    ],
    session_count: 0,
    visit_count: 0,
    intent_session_id: `prospect-search-${company.id}`,
    visitor_key: `prospect-search-${dedupe_hash}`,
    metadata: buildProspectSearchPushMetadata(company, query),
  })

  if (result.duplicate) {
    return {
      outcome: "already_exists",
      message: "Already in Lead Inbox.",
    }
  }

  if (!result.ok || !result.row) {
    return {
      outcome: "failed",
      message: result.reason ?? "Lead Inbox create failed.",
    }
  }

  return {
    outcome: "pushed",
    message: "Added to Lead Inbox for human review.",
    lead_inbox_id: result.row.id,
  }
}

export async function resolveProspectSearchCompaniesForPush(
  admin: SupabaseClient,
  input: {
    query: string
    filters?: GrowthProspectSearchFilters
    discovery_mode?: GrowthProspectSearchDiscoveryMode
    selected: ProspectSearchSelectionRef[]
  },
): Promise<Map<string, GrowthProspectSearchCompanyResult>> {
  return resolveProspectSearchCompanyResultsForPush(admin, {
    query: input.query,
    filters: input.filters,
    discovery_mode: input.discovery_mode,
    selected: input.selected,
  })
}

export async function executeBulkPushToLeadInbox(
  admin: SupabaseClient,
  input: {
    query: string
    filters?: GrowthProspectSearchFilters
    discovery_mode?: GrowthProspectSearchDiscoveryMode
    selected: ProspectSearchSelectionRef[]
  },
): Promise<GrowthProspectSearchBulkPushResult> {
  const selected = input.selected.filter(
    (ref) => ref.source_type && ref.id && GROWTH_PROSPECT_SEARCH_SOURCE_TYPES.includes(ref.source_type),
  )

  if (selected.length === 0) {
    return {
      ok: false,
      action: "bulk_push_to_lead_inbox",
      message: "Select at least one company to push to Lead Inbox.",
      selected_total: 0,
      pushed: 0,
      already_exists: 0,
      skipped_invalid: 0,
      suppressed: 0,
      failed: 0,
      items: [],
    }
  }

  const resolved = await resolveProspectSearchCompaniesForPush(admin, {
    query: input.query,
    filters: input.filters,
    discovery_mode: input.discovery_mode,
    selected,
  })

  const items: GrowthProspectSearchPushItemResult[] = []
  let pushed = 0
  let already_exists = 0
  let skipped_invalid = 0
  let suppressed = 0
  let failed = 0

  for (const ref of selected) {
    const company = resolved.get(prospectSearchSelectionKey(ref))
    if (!company) {
      skipped_invalid += 1
      items.push({
        outcome: "skipped_invalid",
        company_name: ref.company_name?.trim() || "Unknown company",
        source_type: ref.source_type,
        message: "Could not revalidate company in current search results.",
      })
      continue
    }

    const pushResult = await pushProspectSearchCompanyToLeadInbox(admin, company, input.query)
    items.push({
      outcome: pushResult.outcome,
      company_name: company.company_name,
      source_type: company.source_type,
      message: pushResult.message,
      lead_inbox_id: pushResult.lead_inbox_id ?? null,
    })

    switch (pushResult.outcome) {
      case "pushed":
        pushed += 1
        break
      case "already_exists":
        already_exists += 1
        break
      case "suppressed":
        suppressed += 1
        break
      case "skipped_invalid":
        skipped_invalid += 1
        break
      case "failed":
        failed += 1
        break
    }
  }

  const selected_total = selected.length
  const message = formatBulkPushSummary({
    selected_total,
    pushed,
    already_exists,
    skipped_invalid,
    suppressed,
    failed,
  })

  return {
    ok: pushed > 0 || already_exists > 0,
    action: "bulk_push_to_lead_inbox",
    message,
    selected_total,
    pushed,
    already_exists,
    skipped_invalid,
    suppressed,
    failed,
    items,
    workspace_url: pushed > 0 ? "/admin/growth/queue" : null,
  }
}
