/**
 * Leads hub spotlight search — reuses existing Growth search APIs (no new routes).
 */

import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { resolveCallWorkspaceAttachLeadId } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import { attachSavedSearchWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import type { GrowthProspectSearchSavedSearchRow } from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-workspace-base-path"
import { growthLeadsHubSavedSearchRunHref } from "@/lib/growth/hubs/growth-leads-hub-config"
import { runGrowthWorkspaceSearchProviders } from "@/lib/workspace/growth-workspace-search-providers"
import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"

export const GROWTH_LEADS_HUB_SEARCH_QA_MARKER = "growth-leads-hub-search-v2" as const

export type GrowthLeadsHubSearchResultKind =
  | "company"
  | "contact"
  | "lead"
  | "campaign"
  | "meeting"
  | "call"
  | "saved_search"
  | "share_page"
  | "video"

export type GrowthLeadsHubSearchResult = {
  id: string
  kind: GrowthLeadsHubSearchResultKind
  title: string
  subtitle: string
  href: string
}

export type GrowthLeadsHubSearchGroup = {
  id: string
  label: string
  results: GrowthLeadsHubSearchResult[]
}

const LEADS_SEARCH_URL = "/api/platform/growth/calls/workspace/leads/search"

const GROUP_ORDER: GrowthLeadsHubSearchResultKind[] = [
  "company",
  "contact",
  "lead",
  "campaign",
  "meeting",
  "call",
  "saved_search",
  "share_page",
  "video",
]

const GROUP_LABELS: Record<GrowthLeadsHubSearchResultKind, string> = {
  company: "Companies",
  contact: "Contacts",
  lead: "Leads",
  campaign: "Campaigns",
  meeting: "Meetings",
  call: "Calls",
  saved_search: "Saved Searches",
  share_page: "Share Pages",
  video: "Videos",
}

const WORKSPACE_GROUP_MAP: Record<string, GrowthLeadsHubSearchResultKind> = {
  campaigns: "campaign",
  meetings: "meeting",
  calls: "call",
  share_pages: "share_page",
  media_assets: "video",
}

function leadHref(leadId: string): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/${encodeURIComponent(leadId)}`
}

function mapEntityKind(source: CallWorkspaceLeadSearchResult["source"]): GrowthLeadsHubSearchResultKind {
  if (source === "growth_lead" || source === "import_lead") return "lead"
  if (source === "account" || source === "prospect") return "company"
  return "contact"
}

function mapSearchHit(row: CallWorkspaceLeadSearchResult): GrowthLeadsHubSearchResult {
  const kind = mapEntityKind(row.source)
  const attachLeadId = resolveCallWorkspaceAttachLeadId(row)
  const title = row.displayName?.trim() || row.companyName?.trim() || "Result"
  const subtitle = [row.companyName?.trim(), row.email?.trim() || row.contactEmail?.trim(), row.source.replace(/_/g, " ")]
    .filter(Boolean)
    .join(" · ")

  return {
    id: `${row.source}:${row.id}`,
    kind,
    title,
    subtitle,
    href: attachLeadId ? leadHref(attachLeadId) : `${GROWTH_WORKSPACE_BASE_PATH}/leads/research`,
  }
}

function filterSavedSearches(
  query: string,
  rows: GrowthProspectSearchSavedSearchWithWorkflow[],
): GrowthLeadsHubSearchResult[] {
  const needle = query.trim().toLowerCase()
  return rows
    .filter((row) => row.name.toLowerCase().includes(needle) || row.query_text.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((row) => ({
      id: `saved_search:${row.id}`,
      kind: "saved_search" as const,
      title: row.name,
      subtitle: row.workflow.resultCount != null ? `${row.workflow.resultCount.toLocaleString()} saved results` : "Saved search",
      href: growthLeadsHubSavedSearchRunHref(row.id),
    }))
}

function mapWorkspaceGroup(group: GlobalSearchGroup): GrowthLeadsHubSearchGroup | null {
  const kind = WORKSPACE_GROUP_MAP[group.id]
  if (!kind) return null
  return {
    id: kind,
    label: GROUP_LABELS[kind],
    results: group.results.map((result) => ({
      id: `${kind}:${result.href}:${result.title}`,
      kind,
      title: result.title,
      subtitle: result.subtitle,
      href: result.href,
    })),
  }
}

export async function fetchGrowthLeadsHubSavedSearches(signal?: AbortSignal): Promise<GrowthProspectSearchSavedSearchWithWorkflow[]> {
  const params = new URLSearchParams({
    meta: "1",
    q: "",
    filters: "{}",
    page_size: "1",
  })
  const res = await fetch(`/api/platform/growth/prospect-search?${params.toString()}`, {
    cache: "no-store",
    signal,
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    saved_searches?: GrowthProspectSearchSavedSearchRow[]
  }
  if (!res.ok || !data.ok) return []
  return (data.saved_searches ?? []).map((row) => attachSavedSearchWorkflow(row))
}

export async function runGrowthLeadsHubSearch(
  query: string,
  savedSearches: GrowthProspectSearchSavedSearchWithWorkflow[],
  signal?: AbortSignal,
): Promise<GrowthLeadsHubSearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const [entityResult, workspaceGroupsResult] = await Promise.allSettled([
    fetch(`${LEADS_SEARCH_URL}?q=${encodeURIComponent(trimmed)}`, { cache: "no-store", signal }),
    runGrowthWorkspaceSearchProviders(trimmed, signal),
  ])

  const byKind = new Map<GrowthLeadsHubSearchResultKind, GrowthLeadsHubSearchResult[]>()

  if (entityResult.status === "fulfilled") {
    const data = (await entityResult.value.json().catch(() => ({}))) as {
      ok?: boolean
      results?: CallWorkspaceLeadSearchResult[]
      leads?: CallWorkspaceLeadSearchResult[]
    }
    const entityRows = data?.results ?? data?.leads ?? []
    if (entityResult.value.ok && data.ok !== false) {
      for (const row of entityRows.map(mapSearchHit)) {
        const bucket = byKind.get(row.kind) ?? []
        bucket.push(row)
        byKind.set(row.kind, bucket)
      }
    }
  }

  if (workspaceGroupsResult.status === "fulfilled") {
    for (const group of workspaceGroupsResult.value) {
      const mapped = mapWorkspaceGroup(group)
      if (!mapped) continue
      const bucket = byKind.get(mapped.id as GrowthLeadsHubSearchResultKind) ?? []
      bucket.push(...mapped.results)
      byKind.set(mapped.id as GrowthLeadsHubSearchResultKind, bucket)
    }
  }

  const savedMatches = filterSavedSearches(trimmed, savedSearches)
  if (savedMatches.length > 0) {
    byKind.set("saved_search", savedMatches)
  }

  const groups: GrowthLeadsHubSearchGroup[] = []
  for (const kind of GROUP_ORDER) {
    const results = byKind.get(kind) ?? []
    if (results.length === 0) continue
    groups.push({ id: kind, label: GROUP_LABELS[kind], results: results.slice(0, 6) })
  }

  return groups
}
