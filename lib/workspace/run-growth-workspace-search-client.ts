/**
 * Client-side Growth workspace search — reuses existing platform APIs (no new routes).
 */

import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"
import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { normalizeGrowthWorkspaceSearchGroups } from "@/lib/workspace/growth-workspace-search-categories"

const LEADS_SEARCH_URL = "/api/platform/growth/calls/workspace/leads/search"

function leadSearchHref(hit: CallWorkspaceLeadSearchResult): string {
  const leadId = hit.attachLeadId ?? hit.leadId
  if (leadId) return `/growth/leads/${encodeURIComponent(leadId)}`
  return "/growth/leads"
}

function mapLeadResults(rows: CallWorkspaceLeadSearchResult[]): GlobalSearchGroup {
  return {
    id: "leads",
    label: "Leads",
    results: rows.slice(0, 5).map((row) => ({
      kind: "growth_lead",
      title: row.displayName?.trim() || row.companyName?.trim() || "Lead",
      subtitle: [row.companyName?.trim() || null, row.email?.trim() || row.contactEmail?.trim() || null]
        .filter(Boolean)
        .join(" · "),
      href: leadSearchHref(row),
    })),
  }
}

async function searchLeads(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const res = await fetch(`${LEADS_SEARCH_URL}?q=${encodeURIComponent(query)}`, {
    signal,
    cache: "no-store",
  })
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    results?: CallWorkspaceLeadSearchResult[]
    leads?: CallWorkspaceLeadSearchResult[]
  }
  if (!res.ok || body.ok === false) return null
  const rows = body.results ?? body.leads ?? []
  return mapLeadResults(rows)
}

/**
 * Runs Growth workspace search by merging results from existing search providers.
 * Categories without a provider yet are omitted gracefully (no throws).
 */
export async function runGrowthWorkspaceSearchClient(
  query: string,
  signal?: AbortSignal,
): Promise<GlobalSearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const partial: GlobalSearchGroup[] = []

  try {
    const leads = await searchLeads(trimmed, signal ?? new AbortController().signal)
    if (leads && leads.results.length > 0) partial.push(leads)
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e
  }

  return normalizeGrowthWorkspaceSearchGroups(partial)
}
