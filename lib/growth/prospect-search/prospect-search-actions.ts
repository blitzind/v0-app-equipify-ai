import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createLeadCandidate } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import {
  addProspectSearchListMembers,
  companyResultToListMember,
  createProspectSearchList,
  personResultToListMember,
} from "@/lib/growth/prospect-search/list-management"
import { prospectSearchDedupeHash } from "@/lib/growth/prospect-search/prospect-search-index"
import { buildProspectSearchLeadEngineHandoffUrl } from "@/lib/growth/prospect-search/prospect-search-lead-engine-handoff"
import { createProspectSearchSavedSearch } from "@/lib/growth/prospect-search/saved-searches"
import type {
  GrowthProspectSearchActionResult,
  GrowthProspectSearchCompanyResult,
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
    saved_search_name?: string
    list_name?: string
    list_id?: string
    company?: GrowthProspectSearchCompanyResult | null
    person?: GrowthProspectSearchPersonResult | null
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

  if (action === "save_search") {
    const row = await createProspectSearchSavedSearch(admin, {
      created_by: input.userId ?? null,
      name: input.saved_search_name?.trim() || "Saved search",
      query_text: input.query ?? "",
      filters: input.filters ?? {},
    })
    if (!row) {
      return { ok: false, action, message: "Could not save search — schema may not be applied." }
    }
    return {
      ok: true,
      action,
      message: `Saved search "${row.name}".`,
      saved_search_id: row.id,
    }
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
    const dedupe_hash = prospectSearchDedupeHash([
      "prospect_search",
      company.source_type,
      company.id,
      company.website ?? "",
    ])
    const result = await createLeadCandidate(admin, {
      site_key:
        company.source_type === "external_discovered"
          ? "prospect_search_external_discovery"
          : "prospect_search",
      candidate_type: "identified",
      candidate_priority: "normal",
      intent_score: company.intent_score ?? 0,
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
      metadata: {
        prospect_search: {
          source_type: company.source_type,
          source_id: company.id,
          query: input.query ?? "",
        },
        qualification_context: {
          lead_engine_score: company.lead_engine_score ?? company.lead_score,
          lead_engine_score_label: company.lead_engine_score_label,
          lead_engine_score_explanation: company.lead_engine_score_explanation,
          buying_stage: company.buying_stage,
          buying_stage_confidence: company.buying_stage_confidence,
          buying_stage_reason: company.buying_stage_reason,
          company_match_confidence: company.company_match_confidence,
          intent_score: company.intent_score,
          search_intent_category: company.search_intent_category,
          crm_detected: company.crm_detected,
          field_service_software: company.field_service_software,
          website_platform: company.website_platform,
          service_area: company.service_area,
        },
        ...(company.buying_stage
          ? {
              buying_stage_summary: {
                detected_stage: company.buying_stage,
                stage_confidence: company.buying_stage_confidence,
                stage_reasoning: company.buying_stage_reason ? [company.buying_stage_reason] : [],
                assessed_at: company.buying_stage_last_assessed_at ?? new Date().toISOString(),
                evidence: company.buying_stage_reason ?? "Carried from Prospect Search qualification overlay.",
              },
            }
          : {}),
        ...(company.company_signal_summary
          ? { company_signal_summary: company.company_signal_summary }
          : {}),
      },
    })
    if (!result.ok || !result.row) {
      return {
        ok: false,
        action,
        message: result.reason ?? "Lead Inbox create failed.",
        lead_inbox_id: null,
      }
    }
    return {
      ok: true,
      action,
      message: "Added to Lead Inbox for human review.",
      lead_inbox_id: result.row.id,
      workspace_url: `/admin/growth/leads/${result.row.id}`,
    }
  }

  if (action === "run_lead_engine") {
    const company = input.company
    if (!company?.company_name) {
      return { ok: false, action, message: "Select a company to run Lead Engine sandbox." }
    }
    return {
      ok: true,
      action,
      message: "Open Lead Engine workspace with company context prefilled.",
      workspace_url: buildProspectSearchLeadEngineHandoffUrl(company, input.query),
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
