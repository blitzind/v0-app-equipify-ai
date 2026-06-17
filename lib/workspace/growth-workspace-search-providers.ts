/**
 * Growth workspace search providers — one function per category, existing APIs only.
 */

import type { GlobalSearchGroup, GlobalSearchResultItem } from "@/lib/global-search/run-global-search"
import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import type { GrowthMeeting } from "@/lib/growth/meeting-intelligence/meeting-intelligence-types"
import type { GrowthSequenceTemplate } from "@/lib/growth/sequences/sequence-types"
import type { GrowthSharePageListItem } from "@/lib/growth/share-pages/share-page-operator-types"
import type { GrowthSharePageTemplate } from "@/lib/growth/share-pages/share-page-template-types"
import type { GrowthMediaAsset } from "@/lib/growth/media/media-asset-types"
import type { VoiceRelationshipMemoryProfilePublicView } from "@/lib/voice/relationship-memory/types"
import type { GrowthWorkspaceSearchCategoryId } from "@/lib/workspace/growth-workspace-search-categories"
import {
  GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION,
  growthSearchFetchJson,
  growthSearchMatchesQuery,
} from "@/lib/workspace/growth-workspace-search-utils"

const LEADS_SEARCH_URL = "/api/platform/growth/calls/workspace/leads/search"

function leadHref(leadId: string): string {
  return `/growth/leads/${encodeURIComponent(leadId)}`
}

function leadSearchHref(hit: CallWorkspaceLeadSearchResult): string {
  const leadId = hit.attachLeadId ?? hit.leadId
  return leadId ? leadHref(leadId) : "/growth/leads"
}

function toGroup(id: GrowthWorkspaceSearchCategoryId, label: string, results: GlobalSearchResultItem[]): GlobalSearchGroup | null {
  if (results.length === 0) return null
  return { id, label, results: results.slice(0, GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION) }
}

async function searchLeads(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{
    ok?: boolean
    results?: CallWorkspaceLeadSearchResult[]
    leads?: CallWorkspaceLeadSearchResult[]
  }>(`${LEADS_SEARCH_URL}?q=${encodeURIComponent(query)}`, signal)
  const rows = body?.results ?? body?.leads ?? []
  return toGroup(
    "leads",
    "Leads",
    rows.map((row) => ({
      kind: "growth_lead",
      title: row.displayName?.trim() || row.companyName?.trim() || "Lead",
      subtitle: [row.companyName?.trim() || null, row.email?.trim() || row.contactEmail?.trim() || null]
        .filter(Boolean)
        .join(" · "),
      href: leadSearchHref(row),
    })),
  )
}

async function searchCampaigns(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; templates?: GrowthSequenceTemplate[] }>(
    "/api/platform/growth/sequences",
    signal,
  )
  const rows = (body?.templates ?? []).filter((row) =>
    growthSearchMatchesQuery(query, row.name, row.description, row.category),
  )
  return toGroup(
    "campaigns",
    "Campaigns",
    rows.map((row) => ({
      kind: "growth_campaign",
      title: row.name,
      subtitle: [row.category, row.status].filter(Boolean).join(" · ") || "Campaign",
      href: "/growth/campaigns",
    })),
  )
}

async function searchInboxThreads(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; threads?: GrowthInboxThread[] }>(
    "/api/platform/growth/inbox",
    signal,
  )
  const rows = (body?.threads ?? []).filter((row) =>
    growthSearchMatchesQuery(query, row.subject, row.lead_label, row.owner_label),
  )
  return toGroup(
    "inbox_threads",
    "Inbox Threads",
    rows.map((row) => ({
      kind: "growth_inbox_thread",
      title: row.subject?.trim() || row.lead_label || "Inbox thread",
      subtitle: [row.lead_label, row.channel, row.thread_status].filter(Boolean).join(" · "),
      href: "/growth/inbox",
    })),
  )
}

async function searchCalls(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{
    ok?: boolean
    queue?: Array<{
      leadId: string
      contactName: string | null
      companyName: string | null
      phoneNumber: string | null
      reason: string
      ctaHref?: string
    }>
  }>("/api/platform/growth/calls/queue", signal)
  const rows = (body?.queue ?? []).filter((row) =>
    growthSearchMatchesQuery(query, row.contactName, row.companyName, row.phoneNumber, row.reason),
  )
  return toGroup(
    "calls",
    "Calls",
    rows.map((row) => ({
      kind: "growth_call",
      title: row.contactName?.trim() || row.companyName?.trim() || "Call queue item",
      subtitle: [row.companyName, row.phoneNumber, row.reason].filter(Boolean).join(" · "),
      href: row.leadId ? leadHref(row.leadId) : "/growth/calls",
    })),
  )
}

async function searchMeetings(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; feed?: { items?: GrowthMeeting[] } }>(
    "/api/platform/growth/meetings/inbox?limit=50",
    signal,
  )
  const rows = (body?.feed?.items ?? []).filter((row) =>
    growthSearchMatchesQuery(
      query,
      row.title,
      row.notes,
      row.outcome,
      (row as GrowthMeeting & { companyName?: string | null }).companyName,
    ),
  )
  return toGroup(
    "meetings",
    "Meetings",
    rows.map((row) => ({
      kind: "growth_meeting",
      title: row.title?.trim() || "Meeting",
      subtitle: [row.status, row.startAt ? new Date(row.startAt).toLocaleString() : null].filter(Boolean).join(" · "),
      href: "/growth/meetings",
    })),
  )
}

async function searchSharePages(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; items?: GrowthSharePageListItem[] }>(
    `/api/platform/growth/share-pages?search=${encodeURIComponent(query)}&limit=${GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION}`,
    signal,
  )
  const rows = body?.items ?? []
  return toGroup(
    "share_pages",
    "Share Pages",
    rows.map((row) => ({
      kind: "growth_share_page",
      title: row.companyName?.trim() || row.leadLabel?.trim() || "Share page",
      subtitle: [row.leadLabel, row.status, row.sourceChannel].filter(Boolean).join(" · "),
      href: `/growth/share-pages/${encodeURIComponent(row.id)}`,
    })),
  )
}

async function searchMediaAssets(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; items?: GrowthMediaAsset[] }>(
    `/api/platform/growth/media-assets?search=${encodeURIComponent(query)}&limit=${GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION}`,
    signal,
  )
  const rows = body?.items ?? []
  return toGroup(
    "media_assets",
    "Media Assets",
    rows.map((row) => ({
      kind: "growth_media_asset",
      title: row.title?.trim() || row.originalFilename?.trim() || "Media asset",
      subtitle: [row.assetType, row.status, row.description].filter(Boolean).join(" · "),
      href: "/growth/media",
    })),
  )
}

async function searchTemplates(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{ ok?: boolean; templates?: GrowthSharePageTemplate[] }>(
    `/api/platform/growth/share-pages/templates?search=${encodeURIComponent(query)}&limit=${GROWTH_WORKSPACE_SEARCH_MAX_PER_SECTION}`,
    signal,
  )
  const rows = body?.templates ?? []
  return toGroup(
    "templates",
    "Templates",
    rows.map((row) => ({
      kind: "growth_template",
      title: row.name?.trim() || "Template",
      subtitle: [row.category, row.status, row.description].filter(Boolean).join(" · "),
      href: `/growth/share-pages/templates/${encodeURIComponent(row.id)}`,
    })),
  )
}

async function searchOpportunities(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{
    ok?: boolean
    feed?: { items?: Array<{ id: string; title: string; companyName: string; stageLabel?: string }> }
  }>("/api/platform/growth/opportunities/pipeline?limit=50", signal)
  const rows = (body?.feed?.items ?? []).filter((row) =>
    growthSearchMatchesQuery(query, row.title, row.companyName, row.stageLabel),
  )
  return toGroup(
    "opportunities",
    "Opportunities",
    rows.map((row) => ({
      kind: "growth_opportunity",
      title: row.title?.trim() || row.companyName?.trim() || "Opportunity",
      subtitle: [row.companyName, row.stageLabel].filter(Boolean).join(" · "),
      href: "/growth/opportunities/pipeline",
    })),
  )
}

async function searchConversations(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{
    ok?: boolean
    dashboard?: Record<string, Array<{ id: string; companyName?: string; contactName?: string | null }>>
  }>("/api/platform/growth/conversations/dashboard", signal)
  const dashboard = body?.dashboard
  if (!dashboard) return null
  const merged = [
    ...(dashboard.conversationRisk ?? []),
    ...(dashboard.buyingIntent ?? []),
    ...(dashboard.strongHealth ?? []),
    ...(dashboard.sentimentShift ?? []),
  ]
  const seen = new Set<string>()
  const rows = merged.filter((row) => {
    if (seen.has(row.id)) return false
    seen.add(row.id)
    return growthSearchMatchesQuery(query, row.companyName, row.contactName)
  })
  return toGroup(
    "conversations",
    "Conversations",
    rows.map((row) => ({
      kind: "growth_conversation",
      title: row.contactName?.trim() || row.companyName?.trim() || "Conversation",
      subtitle: row.companyName ?? "Conversation intelligence",
      href: "/growth/conversations",
    })),
  )
}

async function searchRelationships(query: string, signal: AbortSignal): Promise<GlobalSearchGroup | null> {
  const body = await growthSearchFetchJson<{
    ok?: boolean
    profiles?: VoiceRelationshipMemoryProfilePublicView[]
  }>(`/api/platform/growth/voice/relationships/search?q=${encodeURIComponent(query)}`, signal)
  const rows = body?.profiles ?? []
  return toGroup(
    "relationships",
    "Relationships",
    rows.map((row) => ({
      kind: "growth_relationship",
      title: row.primaryContactName?.trim() || row.primaryPhoneNumber || "Relationship",
      subtitle: [row.relationshipStatus, row.primaryPhoneNumber].filter(Boolean).join(" · "),
      href: "/growth/relationships",
    })),
  )
}

export const GROWTH_WORKSPACE_SEARCH_PROVIDER_ORDER: GrowthWorkspaceSearchCategoryId[] = [
  "leads",
  "campaigns",
  "inbox_threads",
  "calls",
  "meetings",
  "share_pages",
  "media_assets",
  "templates",
  "opportunities",
  "conversations",
  "relationships",
]

const PROVIDERS: Record<
  GrowthWorkspaceSearchCategoryId,
  (query: string, signal: AbortSignal) => Promise<GlobalSearchGroup | null>
> = {
  leads: searchLeads,
  campaigns: searchCampaigns,
  inbox_threads: searchInboxThreads,
  calls: searchCalls,
  meetings: searchMeetings,
  share_pages: searchSharePages,
  media_assets: searchMediaAssets,
  templates: searchTemplates,
  opportunities: searchOpportunities,
  conversations: searchConversations,
  relationships: searchRelationships,
}

export async function runGrowthWorkspaceSearchProviders(
  query: string,
  signal: AbortSignal,
): Promise<GlobalSearchGroup[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const settled = await Promise.allSettled(
    GROWTH_WORKSPACE_SEARCH_PROVIDER_ORDER.map((categoryId) => PROVIDERS[categoryId](trimmed, signal)),
  )

  const groups: GlobalSearchGroup[] = []
  for (const result of settled) {
    if (result.status === "rejected") {
      if ((result.reason as Error)?.name === "AbortError") throw result.reason
      continue
    }
    if (result.value && result.value.results.length > 0) groups.push(result.value)
  }
  return groups
}
