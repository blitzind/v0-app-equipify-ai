import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  addProspectSearchListMembers,
  companyResultToListMember,
  createProspectSearchList,
  personResultToListMember,
} from "@/lib/growth/prospect-search/list-management"
import { buildProspectSearchLeadEngineHandoffUrl } from "@/lib/growth/prospect-search/prospect-search-lead-engine-handoff"
import {
  buildProspectWorkflowTimelinePayload,
  type GrowthProspectWorkflowContinuityEventKind,
} from "@/lib/growth/prospect-search/prospect-pipeline-automation"
import {
  appendWorkflowContextToUrl,
  buildGrowthWorkflowContext,
} from "@/lib/growth/prospect-search/prospect-workflow-context"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import {
  executeBulkPushToLeadInbox,
  pushProspectSearchCompanyToLeadInbox,
  type ProspectSearchSelectionRef,
} from "@/lib/growth/prospect-search/prospect-search-push-to-inbox"
import {
  buildSavedSearchMetadataOnSave,
  createProspectSearchSavedSearch,
  deleteProspectSearchSavedSearch,
  refreshAllProspectSearchSavedSearchCounts,
  refreshProspectSearchSavedSearchCount,
} from "@/lib/growth/prospect-search/saved-searches"
import { countProspectSearchMatchesInternal } from "@/lib/growth/prospect-search/prospect-search-count"
import {
  createTerritory,
  createTerritoryFromSavedSearch,
  refreshTerritoryIntelligence,
} from "@/lib/growth/territory-intelligence/territory-repository"
import { runProspectSearch } from "@/lib/growth/prospect-search/prospect-search-repository"
import { GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE } from "@/lib/growth/prospect-search/prospect-search-schema-health"
import type {
  GrowthProspectSearchActionResult,
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
  GrowthProspectSearchPersonResult,
  GrowthProspectSearchResultAction,
} from "@/lib/growth/prospect-search/prospect-search-types"

export async function executeProspectSearchAction(
  admin: SupabaseClient,
  input: {
    action: GrowthProspectSearchResultAction
    userId?: string | null
    query?: string
    filters?: GrowthProspectSearchFilters
    discovery_mode?: GrowthProspectSearchDiscoveryMode
    saved_search_name?: string
    list_name?: string
    list_id?: string
    company?: GrowthProspectSearchCompanyResult | null
    person?: GrowthProspectSearchPersonResult | null
    selected?: ProspectSearchSelectionRef[]
    territory_name?: string
    territory_id?: string
    saved_search_id?: string
    page?: number
    page_size?: number
    save_pagination?: boolean
    result_count?: number | null
    owner_label?: string | null
    workflow_event_kind?: GrowthProspectWorkflowContinuityEventKind
  },
): Promise<GrowthProspectSearchActionResult> {
  const { action } = input

  if (action === "export_csv") {
    return {
      ok: false,
      action,
      message: "CSV export is reserved for a future release — not executed in v1.",
    }
  }

  if (action === "save_territory") {
    const filters = input.filters ?? {}
    const territory =
      input.saved_search_id
        ? await createTerritoryFromSavedSearch(admin, {
            saved_search_id: input.saved_search_id,
            name: input.territory_name,
            created_by: input.userId ?? null,
          })
        : await createTerritory(admin, {
            name: input.territory_name,
            territory_filter: filters.territory_filter ?? {},
            industry: filters.industry,
            icp_label: input.territory_name ?? filters.industry ?? null,
            query_text: input.query ?? "",
            filters,
            created_by: input.userId ?? null,
          })

    if (!territory) {
      return { ok: false, action, message: "Could not save territory — schema may not be applied." }
    }

    return {
      ok: true,
      action,
      message: `Saved territory "${territory.name}".`,
      territory_id: territory.id,
    }
  }

  if (action === "refresh_territory") {
    const territoryId = input.territory_id ?? input.filters?.territory_id
    if (!territoryId) {
      return { ok: false, action, message: "Select a saved territory to refresh." }
    }
    const snapshot = await refreshTerritoryIntelligence(admin, territoryId)
    if (!snapshot?.score) {
      return { ok: false, action, message: "Territory refresh failed." }
    }
    return {
      ok: true,
      action,
      message: `Territory refreshed — opportunity score ${snapshot.score.territory_opportunity_score}/100.`,
      territory_id: territoryId,
    }
  }

  if (action === "push_territory_top_prospects") {
    const search = await runProspectSearch(admin, {
      query: input.query ?? "",
      filters: input.filters,
      discovery_mode: input.discovery_mode,
      page: 1,
      page_size: 200,
    })

    const topCompanies = search.companies
      .filter((company) => !company.is_suppressed)
      .sort((a, b) => {
        const scoreA = (a.growth_signal_score ?? 0) * 0.5 + (a.lead_engine_score ?? a.lead_score ?? 0) * 0.5
        const scoreB = (b.growth_signal_score ?? 0) * 0.5 + (b.lead_engine_score ?? b.lead_score ?? 0) * 0.5
        return scoreB - scoreA
      })
      .slice(0, 10)

    if (topCompanies.length === 0) {
      return { ok: false, action, message: "No eligible territory prospects to push." }
    }

    const bulkResult = await executeBulkPushToLeadInbox(admin, {
      query: input.query ?? "",
      filters: input.filters,
      discovery_mode: input.discovery_mode,
      selected: topCompanies.map((company) => ({
        source_type: company.source_type,
        id: company.id,
        company_name: company.company_name,
      })),
    })

    return {
      ok: bulkResult.ok,
      action,
      message: bulkResult.message,
      workspace_url: bulkResult.workspace_url,
      selected_total: bulkResult.selected_total,
      pushed: bulkResult.pushed,
      already_exists: bulkResult.already_exists,
      skipped_invalid: bulkResult.skipped_invalid,
      suppressed: bulkResult.suppressed,
      failed: bulkResult.failed,
    }
  }

  if (action === "save_search") {
    let resultCount = input.result_count ?? null
    if (resultCount == null && (input.discovery_mode ?? "internal") === "internal") {
      resultCount = await countProspectSearchMatchesInternal(admin, {
        query: input.query ?? "",
        filters: input.filters ?? {},
      })
    }

    const metadata = await buildSavedSearchMetadataOnSave({
      resultCount,
      page: input.page,
      pageSize: input.page_size,
      savePagination: input.save_pagination,
      ownerLabel: input.owner_label ?? null,
      discoveryMode: input.discovery_mode ?? "internal",
    })

    const row = await createProspectSearchSavedSearch(admin, {
      created_by: input.userId ?? null,
      name: input.saved_search_name?.trim() || "Saved search",
      query_text: input.query ?? "",
      filters: input.filters ?? {},
      metadata,
    })
    if (!row) {
      return {
        ok: false,
        action,
        message: GROWTH_PROSPECT_SEARCH_SCHEMA_SETUP_MESSAGE,
      }
    }
    return {
      ok: true,
      action,
      message: `Saved search "${row.name}".`,
      saved_search_id: row.id,
    }
  }

  if (action === "refresh_saved_search_counts") {
    const refreshed = input.saved_search_id
      ? await refreshProspectSearchSavedSearchCount(admin, input.saved_search_id)
      : null
    const rows = refreshed
      ? [refreshed]
      : (await refreshAllProspectSearchSavedSearchCounts(admin)).map((row) => ({
          id: row.id,
          created_at: row.created_at,
          updated_at: row.updated_at,
          created_by: row.created_by,
          name: row.name,
          query_text: row.query_text,
          filters: row.filters,
          metadata: row.metadata,
        }))

    return {
      ok: true,
      action,
      message: input.saved_search_id
        ? "Saved search count refreshed."
        : `Refreshed counts for ${rows.length} saved search(es).`,
      saved_search_id: input.saved_search_id ?? null,
    }
  }

  if (action === "delete_saved_search") {
    if (!input.saved_search_id) {
      return { ok: false, action, message: "Saved search id is required." }
    }
    const deleted = await deleteProspectSearchSavedSearch(admin, input.saved_search_id)
    if (!deleted) {
      return { ok: false, action, message: "Could not delete saved search." }
    }
    return { ok: true, action, message: "Saved search deleted." }
  }

  if (action === "create_list") {
    const list = await createProspectSearchList(admin, {
      created_by: input.userId ?? null,
      name: input.list_name?.trim() || "Prospect list",
      description: input.query ? `From search: ${input.query}` : "",
    })
    if (!list) {
      return { ok: false, action, message: "Could not create list — schema may not be applied." }
    }
    const members = []
    if (input.company) members.push(companyResultToListMember(input.company))
    if (input.person) members.push(personResultToListMember(input.person))
    if (members.length) await addProspectSearchListMembers(admin, list.id, members)
    return {
      ok: true,
      action,
      message: `Created list "${list.name}"${members.length ? ` with ${members.length} member(s).` : "."}`,
      list_id: list.id,
    }
  }

  if (action === "push_to_lead_inbox") {
    const company = input.company
    if (!company) {
      return { ok: false, action, message: "Select a company row to push to Lead Inbox." }
    }

    const pushResult = await pushProspectSearchCompanyToLeadInbox(admin, company, input.query ?? "")

    if (pushResult.outcome === "already_exists") {
      return {
        ok: true,
        action,
        message: pushResult.message,
        push_outcome: pushResult.outcome,
        lead_inbox_id: null,
      }
    }

    if (pushResult.outcome === "suppressed") {
      return {
        ok: true,
        action,
        message: pushResult.message,
        push_outcome: pushResult.outcome,
        lead_inbox_id: null,
      }
    }

    if (pushResult.outcome !== "pushed") {
      return {
        ok: false,
        action,
        message: pushResult.message,
        push_outcome: pushResult.outcome,
        lead_inbox_id: null,
      }
    }

    return {
      ok: true,
      action,
      message: pushResult.message,
      push_outcome: pushResult.outcome,
      lead_inbox_id: pushResult.lead_inbox_id ?? null,
      workspace_url: pushResult.lead_inbox_id
        ? `/admin/growth/leads/${pushResult.lead_inbox_id}`
        : null,
    }
  }

  if (action === "bulk_push_to_lead_inbox") {
    const bulkResult = await executeBulkPushToLeadInbox(admin, {
      query: input.query ?? "",
      filters: input.filters,
      discovery_mode: input.discovery_mode,
      selected: input.selected ?? [],
    })

    return {
      ok: bulkResult.ok,
      action,
      message: bulkResult.message,
      workspace_url: bulkResult.workspace_url,
      selected_total: bulkResult.selected_total,
      pushed: bulkResult.pushed,
      already_exists: bulkResult.already_exists,
      skipped_invalid: bulkResult.skipped_invalid,
      suppressed: bulkResult.suppressed,
      failed: bulkResult.failed,
      bulk_items: bulkResult.items.map((item) => ({
        outcome: item.outcome,
        company_name: item.company_name,
        source_type: item.source_type,
        message: item.message,
      })),
    }
  }

  if (action === "record_prospect_workflow_continuity") {
    const company = input.company
    const eventKind = input.workflow_event_kind
    if (!company || !eventKind) {
      return { ok: true, action, message: "Workflow continuity skipped — missing context." }
    }

    const leadId = company.growth_lead_id ?? company.lead_inbox_id
    if (!leadId) {
      return { ok: true, action, message: "Workflow continuity skipped — no lead record yet." }
    }

    const payload = buildProspectWorkflowTimelinePayload({ company, eventKind })
    const titles: Record<GrowthProspectWorkflowContinuityEventKind, string> = {
      prospect_workflow_started: "Prospect workflow started",
      lead_engine_launched: "Lead Engine launched from Prospect Search",
      outreach_workflow_started: "Outreach workflow started from Prospect Search",
      meeting_workflow_started: "Meeting workflow started from Prospect Search",
      sequence_workflow_started: "Sequence workflow started from Prospect Search",
    }

    await appendGrowthLeadTimelineEvent(admin, {
      leadId,
      eventType: "manual_touch",
      title: titles[eventKind],
      summary: company.recommended_next_action_reason ?? company.recommended_next_step_reason ?? null,
      payload: payload as unknown as Record<string, unknown>,
      actorUserId: input.userId ?? null,
    })

    return { ok: true, action, message: "Workflow continuity recorded.", growth_lead_id: leadId }
  }

  if (action === "run_lead_engine") {
    const company = input.company
    if (!company?.company_name) {
      return { ok: false, action, message: "Select a company to run Lead Engine sandbox." }
    }

    const workflowContext = buildGrowthWorkflowContext({
      company,
      query: input.query,
      filters: input.filters,
      discoveryMode: input.discovery_mode,
    })
    const workspaceUrl = appendWorkflowContextToUrl(
      buildProspectSearchLeadEngineHandoffUrl(company, input.query),
      workflowContext,
    )

    const leadId = company.growth_lead_id ?? company.lead_inbox_id
    if (leadId) {
      const payload = buildProspectWorkflowTimelinePayload({
        company,
        eventKind: "lead_engine_launched",
      })
      await appendGrowthLeadTimelineEvent(admin, {
        leadId,
        eventType: "manual_touch",
        title: "Lead Engine launched from Prospect Search",
        summary: company.recommended_next_action_reason ?? null,
        payload: payload as unknown as Record<string, unknown>,
        actorUserId: input.userId ?? null,
      })
    }

    return {
      ok: true,
      action,
      message: "Open Lead Engine workspace with company context prefilled.",
      workspace_url: workspaceUrl,
      growth_lead_id: company.growth_lead_id,
    }
  }

  if (action === "open_workspace") {
    const company = input.company
    if (company?.lead_inbox_id) {
      return {
        ok: true,
        action,
        message: "Opening Lead Inbox operator workspace.",
        lead_inbox_id: company.lead_inbox_id,
        workspace_url: `/admin/growth/leads/${company.lead_inbox_id}`,
      }
    }
    if (company?.growth_lead_id) {
      return {
        ok: true,
        action,
        message: "Opening Growth lead workspace.",
        growth_lead_id: company.growth_lead_id,
        workspace_url: `/admin/growth/leads/${company.growth_lead_id}`,
      }
    }
    if (input.list_id) {
      return {
        ok: true,
        action,
        message: "List saved — open Search to manage members.",
        list_id: input.list_id,
        workspace_url: "/admin/growth/search",
      }
    }
    return { ok: false, action, message: "No workspace URL for this selection." }
  }

  return { ok: false, action, message: `Unknown action: ${action}` }
}
