"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react"
import { useSearchParams } from "next/navigation"
import { Bookmark, LayoutTemplate, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CompanyResultCard } from "@/components/growth/prospect-search/company-result-card"
import {
  ProspectSearchBulkActionBar,
  ProspectSearchBulkPushSummary,
} from "@/components/growth/prospect-search/prospect-search-bulk-action-bar"
import { DiscoveryModeToggle } from "@/components/growth/prospect-search/discovery-mode-toggle"
import {
  GooglePlacesQueryDiagnostics,
  ProviderCacheCostDiagnostics,
  RealWorldProviderStatus,
} from "@/components/growth/prospect-search/real-world-provider-status"
import { IcpTemplatesDrawer } from "@/components/growth/prospect-search/icp-templates-drawer"
import { ProspectSearchFilterRail } from "@/components/growth/prospect-search/prospect-search-filter-rail"
import { TerritoryIntelligencePanel } from "@/components/growth/prospect-search/territory-intelligence-panel"
import { PersonResultCard } from "@/components/growth/prospect-search/person-result-card"
import { SearchEmptyState } from "@/components/growth/prospect-search/search-empty-state"
import { SearchRecommendations } from "@/components/growth/prospect-search/search-recommendations"
import { SearchViewToggle } from "@/components/growth/prospect-search/search-view-toggle"
import { rotateHeroPlaceholder } from "@/components/growth/prospect-search/search-suggestion-engine"
import {
  GROWTH_PROSPECT_SEARCH_UX_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER,
  type ProspectSearchIcpTemplate,
} from "@/components/growth/prospect-search/prospect-search-ux-constants"
import {
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-admin-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchDiscoveryMode,
  GrowthProspectSearchFilters,
  GrowthProspectSearchListRow,
  GrowthProspectSearchPersonResult,
  GrowthProspectSearchResult,
  GrowthProspectSearchSavedSearchRow,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER, GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import { CompanyStatusBadges } from "@/components/growth/prospect-search/company-status-badges"
import { ProspectSearchIndexDiagnostics } from "@/components/growth/prospect-search/prospect-search-index-diagnostics"
import { ProspectSearchPagination } from "@/components/growth/prospect-search/prospect-search-pagination"
import { SaveSearchWorkflowDialog } from "@/components/growth/prospect-search/save-search-workflow-dialog"
import {
  attachSavedSearchWorkflow,
  GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER,
  type GrowthProspectSearchSavedSearchWithWorkflow,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import { buildProspectSearchGetRequestParams } from "@/lib/growth/prospect-search/prospect-search-client-request"
import { cn } from "@/lib/utils"

const EMPTY_FILTERS: GrowthProspectSearchFilters = {}

type ProspectSearchRunInput = {
  queryText?: string
  filters?: GrowthProspectSearchFilters
  discoveryMode?: GrowthProspectSearchDiscoveryMode
}

function resolveDiscoveryModeFromParams(
  searchParams: ReturnType<typeof useSearchParams>,
): GrowthProspectSearchDiscoveryMode {
  const mode = searchParams.get("mode")
  if (mode === "internal") return "internal"
  if (mode === "discover" || mode === "discover_external") return "discover_external"
  return "discover_external"
}

type ActionFeedback = {
  message: string
  tone: "success" | "warning" | "error"
  workspaceUrl?: string | null
}

export function ProspectSearchShell() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<GrowthProspectSearchFilters>(EMPTY_FILTERS)
  const [result, setResult] = useState<GrowthProspectSearchResult | null>(null)
  const [savedSearches, setSavedSearches] = useState<GrowthProspectSearchSavedSearchWithWorkflow[]>([])
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [savingSearch, setSavingSearch] = useState(false)
  const [refreshingSavedCounts, setRefreshingSavedCounts] = useState(false)
  const [lists, setLists] = useState<GrowthProspectSearchListRow[]>([])
  const [selectedCompany, setSelectedCompany] = useState<GrowthProspectSearchCompanyResult | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [actionMessage, setActionMessage] = useState<ActionFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"card" | "table">("card")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkPushing, setBulkPushing] = useState(false)
  const [heroFocused, setHeroFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [icpTemplatesOpen, setIcpTemplatesOpen] = useState(false)
  const [discoveryMode, setDiscoveryMode] = useState<GrowthProspectSearchDiscoveryMode>(() =>
    resolveDiscoveryModeFromParams(searchParams),
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const queryRef = useRef(query)
  const filtersRef = useRef(filters)
  const discoveryModeRef = useRef(discoveryMode)
  const pageRef = useRef(page)
  const pageSizeRef = useRef(pageSize)

  queryRef.current = query
  filtersRef.current = filters
  discoveryModeRef.current = discoveryMode
  pageRef.current = page
  pageSizeRef.current = pageSize

  const updateFilters = useCallback((updater: SetStateAction<GrowthProspectSearchFilters>) => {
    setFilters((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater
      filtersRef.current = next
      return next
    })
  }, [])

  const replaceFilters = useCallback((next: GrowthProspectSearchFilters) => {
    filtersRef.current = next
    setFilters(next)
  }, [])

  const heroPlaceholder = useMemo(
    () => rotateHeroPlaceholder(placeholderIndex),
    [placeholderIndex],
  )

  useEffect(() => {
    const t = window.setInterval(() => {
      setPlaceholderIndex((i) => i + 1)
    }, 4500)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    const mode = searchParams.get("mode")
    if (mode === "internal") {
      setDiscoveryMode("internal")
    } else if (mode === "discover" || mode === "discover_external") {
      setDiscoveryMode("discover_external")
    }
  }, [searchParams])

  const fetchResults = useCallback(
    async (input: {
      queryText?: string
      filtersOverride?: GrowthProspectSearchFilters
      discoveryModeOverride?: GrowthProspectSearchDiscoveryMode
      nextPage?: number
      nextPageSize?: number
      resetSelection?: boolean
    } = {}) => {
      const q = input.queryText ?? queryRef.current
      const activeFilters = input.filtersOverride ?? filtersRef.current
      const activeDiscoveryMode = input.discoveryModeOverride ?? discoveryModeRef.current
      const activePage = input.nextPage ?? pageRef.current
      const activePageSize = input.nextPageSize ?? pageSizeRef.current
      if (input.queryText != null) setQuery(input.queryText)
      if (input.filtersOverride != null) {
        filtersRef.current = input.filtersOverride
        setFilters(input.filtersOverride)
      }
      if (input.discoveryModeOverride != null) setDiscoveryMode(input.discoveryModeOverride)
      if (input.nextPage != null) setPage(input.nextPage)
      if (input.nextPageSize != null) setPageSize(input.nextPageSize)
      setLoading(true)
      setHasSearched(true)
      setError(null)
      setActionMessage(null)
      if (input.resetSelection !== false) setSelectedKeys(new Set())
      try {
        const params = buildProspectSearchGetRequestParams({
          query: q,
          filters: activeFilters,
          discoveryMode: activeDiscoveryMode,
          page: activePage,
          pageSize: activePageSize,
        })
        const res = await fetch(`/api/platform/growth/prospect-search?${params}`, {
          cache: "no-store",
        })
        const json = (await res.json()) as {
          ok?: boolean
          result?: GrowthProspectSearchResult
          saved_searches?: GrowthProspectSearchSavedSearchRow[]
          lists?: GrowthProspectSearchListRow[]
          message?: string
        }
        if (!res.ok || !json.ok || !json.result) {
          setError(json.message ?? "Search failed.")
          return
        }
        setResult(json.result)
        setSavedSearches((json.saved_searches ?? []).map((row) => attachSavedSearchWorkflow(row)))
        setLists(json.lists ?? [])
        const first = json.result.companies[0] ?? null
        setSelectedCompany(first)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const runSearch = useCallback(
    async (input?: string | ProspectSearchRunInput) => {
      const normalized =
        typeof input === "string" ? { queryText: input } : (input ?? {})
      setPage(1)
      await fetchResults({
        queryText: normalized.queryText ?? queryRef.current,
        filtersOverride: normalized.filters,
        discoveryModeOverride: normalized.discoveryMode,
        nextPage: 1,
        resetSelection: true,
      })
    },
    [fetchResults],
  )

  const goToPage = useCallback(
    async (nextPage: number) => {
      await fetchResults({ nextPage, resetSelection: true })
    },
    [fetchResults],
  )

  const changePageSize = useCallback(
    async (nextPageSize: number) => {
      setPage(1)
      await fetchResults({ nextPage: 1, nextPageSize, resetSelection: true })
    },
    [fetchResults],
  )

  useEffect(() => {
    void runSearch()
  }, [])

  const runAction = useCallback(
    async (action: string, extra?: Record<string, unknown>) => {
      const company = (extra?.company as GrowthProspectSearchCompanyResult | undefined) ?? selectedCompany
      setActionMessage(null)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/prospect-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            query,
            filters,
            discovery_mode: discoveryMode,
            company,
            ...extra,
          }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          message?: string
          workspace_url?: string
          territory_id?: string
          push_outcome?: "pushed" | "already_exists" | "skipped_invalid" | "failed"
          failed?: number
        }

        const tone: ActionFeedback["tone"] =
          action === "bulk_push_to_lead_inbox"
            ? json.ok
              ? (json.failed ?? 0) > 0
                ? "warning"
                : "success"
              : "error"
            : json.push_outcome === "already_exists" || json.push_outcome === "suppressed"
              ? "warning"
              : json.ok
                ? "success"
                : "error"

        setActionMessage({
          message: json.message ?? (json.ok ? "Done." : "Action failed."),
          tone,
          workspaceUrl: json.workspace_url,
        })

        if (json.workspace_url && (action === "open_workspace" || action === "run_lead_engine")) {
          window.open(json.workspace_url, "_blank", "noopener,noreferrer")
        }
        if (action === "save_search" || action === "create_list" || action === "save_territory") {
          if (action === "save_territory" && json.territory_id) {
            setFilters((prev) => ({ ...prev, territory_id: json.territory_id ?? null }))
          }
          await runSearch()
        }
        if (action === "refresh_territory") {
          await runSearch()
        }
        if (action === "push_to_lead_inbox" && json.push_outcome === "pushed") {
          setSelectedKeys((prev) => {
            if (!company) return prev
            const next = new Set(prev)
            next.delete(prospectSearchSelectionKey(company))
            return next
          })
        }
        if (action === "bulk_push_to_lead_inbox" && json.ok) {
          setSelectedKeys(new Set())
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [query, filters, discoveryMode, selectedCompany, runSearch],
  )

  const applyTemplate = useCallback((template: ProspectSearchIcpTemplate) => {
    const nextFilters = { ...EMPTY_FILTERS, ...template.filters }
    setActiveTemplateId(template.id)
    setActiveSavedSearchId(null)
    setQuery(template.query)
    replaceFilters(nextFilters)
    void runSearch({ queryText: template.query, filters: nextFilters })
  }, [runSearch, replaceFilters])

  const suggestedSaveName = useMemo(() => {
    const parts = [filters.industry, filters.territory_filter?.states?.[0], filters.location]
      .filter(Boolean)
      .map((part) => String(part).trim())
    if (parts.length > 0) return parts.slice(0, 2).join(" ")
    if (query.trim()) return query.trim().slice(0, 60)
    return "Saved search"
  }, [filters.industry, filters.location, filters.territory_filter?.states, query])

  const refreshSavedCounts = useCallback(
    async (savedSearchId?: string) => {
      setRefreshingSavedCounts(true)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/prospect-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "refresh_saved_search_counts",
            saved_search_id: savedSearchId,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; message?: string }
        if (!res.ok || !json.ok) throw new Error(json.message ?? "Could not refresh saved search counts.")

        const metaRes = await fetch("/api/platform/growth/prospect-search?meta=1&q=&page=1&page_size=1", {
          cache: "no-store",
        })
        const metaJson = (await metaRes.json()) as {
          saved_searches?: GrowthProspectSearchSavedSearchRow[]
        }
        setSavedSearches((metaJson.saved_searches ?? []).map((row) => attachSavedSearchWorkflow(row)))
        setActionMessage({ message: json.message ?? "Counts refreshed.", tone: "success" })
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setRefreshingSavedCounts(false)
      }
    },
    [],
  )

  const deleteSavedSearch = useCallback(async (savedSearchId: string) => {
    if (!window.confirm("Delete this saved search workflow?")) return
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/prospect-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_saved_search", saved_search_id: savedSearchId }),
      })
      const json = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok || !json.ok) throw new Error(json.message ?? "Could not delete saved search.")
      setSavedSearches((prev) => prev.filter((row) => row.id !== savedSearchId))
      if (activeSavedSearchId === savedSearchId) setActiveSavedSearchId(null)
      setActionMessage({ message: json.message ?? "Saved search deleted.", tone: "success" })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [activeSavedSearchId])

  const saveSearchWorkflow = useCallback(
    async (input: { name: string; savePagination: boolean }) => {
      setSavingSearch(true)
      setError(null)
      try {
        const res = await fetch("/api/platform/growth/prospect-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "save_search",
            query,
            filters,
            discovery_mode: discoveryMode,
            saved_search_name: input.name,
            save_pagination: input.savePagination,
            page: input.savePagination ? page : undefined,
            page_size: input.savePagination ? pageSize : undefined,
            result_count: result?.total_companies ?? null,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; message?: string; saved_search_id?: string }
        if (!res.ok || !json.ok) throw new Error(json.message ?? "Could not save search.")
        setSaveDialogOpen(false)
        setActiveSavedSearchId(json.saved_search_id ?? null)
        setActionMessage({ message: json.message ?? "Saved.", tone: "success" })
        await refreshSavedCounts()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setSavingSearch(false)
      }
    },
    [query, filters, discoveryMode, page, pageSize, result?.total_companies, refreshSavedCounts],
  )

  const loadSavedById = useCallback(
    async (id: string) => {
      const row = savedSearches.find((s) => s.id === id)
      if (!row) return
      setActiveSavedSearchId(id)
      setActiveTemplateId(null)
      const restoreDiscoveryMode =
        row.workflow.discoveryMode === "discover_external" ? "discover_external" : "internal"
      const restorePage = row.workflow.savePagination && row.workflow.page ? row.workflow.page : 1
      const restorePageSize =
        row.workflow.savePagination && row.workflow.pageSize ? row.workflow.pageSize : pageSize
      setQuery(row.query_text)
      replaceFilters(row.filters)
      setDiscoveryMode(restoreDiscoveryMode)
      setPage(restorePage)
      if (row.workflow.savePagination && row.workflow.pageSize) {
        setPageSize(restorePageSize)
      }
      await fetchResults({
        queryText: row.query_text,
        filtersOverride: row.filters,
        discoveryModeOverride: restoreDiscoveryMode,
        nextPage: restorePage,
        nextPageSize: restorePageSize,
        resetSelection: true,
      })
    },
    [savedSearches, pageSize, fetchResults, replaceFilters],
  )

  const companies = result?.companies ?? []
  const people = result?.people ?? []
  const showEmpty = hasSearched && !loading && companies.length === 0 && people.length === 0

  const selectedCompanies = useMemo(
    () => companies.filter((row) => selectedKeys.has(prospectSearchSelectionKey(row))),
    [companies, selectedKeys],
  )

  const pushableSelectedCount = useMemo(
    () => selectedCompanies.filter((row) => !row.is_suppressed).length,
    [selectedCompanies],
  )

  const toggleCompanySelection = useCallback((row: GrowthProspectSearchCompanyResult, checked: boolean) => {
    const key = prospectSearchSelectionKey(row)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedKeys(new Set(companies.map((row) => prospectSearchSelectionKey(row))))
  }, [companies])

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set())
  }, [])

  const runBulkPush = useCallback(async () => {
    if (selectedCompanies.length === 0) return
    setBulkPushing(true)
    setActionMessage(null)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/prospect-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulk_push_to_lead_inbox",
          query,
          filters,
          discovery_mode: discoveryMode,
          selected: selectedCompanies.map((row) => ({
            source_type: row.source_type,
            id: row.id,
            company_name: row.company_name,
          })),
        }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        message?: string
        workspace_url?: string | null
        failed?: number
      }
      setActionMessage({
        message: json.message ?? (json.ok ? "Bulk push completed." : "Bulk push failed."),
        tone: json.ok ? ((json.failed ?? 0) > 0 ? "warning" : "success") : "error",
        workspaceUrl: json.workspace_url,
      })
      if (json.ok) setSelectedKeys(new Set())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBulkPushing(false)
    }
  }, [selectedCompanies, query, filters, discoveryMode])

  return (
    <div
      className="flex flex-col gap-6"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_QA_MARKER}
      data-ux-marker={GROWTH_PROSPECT_SEARCH_UX_QA_MARKER}
      data-layout-marker={GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER}
      data-saved-search-workflows-marker={GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER}
      data-live-provider-query-expansion-marker={GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER}
    >
      {/* Search hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-50/80 via-card to-cyan-50/50 p-6 shadow-sm dark:from-violet-950/30 dark:to-cyan-950/20">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Discover your ideal customer profile</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {discoveryMode === "internal"
            ? "Search observable Growth Engine + CRM records. No scraping, no outbound."
            : "Discover new companies from real-world public sources (Google Places, SERP, business directory). No Apollo, Seamless, Clay, or PDL. Candidates are not automatic leads."}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <DiscoveryModeToggle
            mode={discoveryMode}
            onChange={(mode) => {
              setDiscoveryMode(mode)
              setSelectedKeys(new Set())
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setIcpTemplatesOpen(true)}>
            <LayoutTemplate className="mr-1.5 size-3.5" />
            ICP Templates
          </Button>
        </div>
        <div className="relative mt-5">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setHeroFocused(true)}
            onBlur={() => setTimeout(() => setHeroFocused(false), 180)}
            onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            placeholder={heroPlaceholder}
            className="h-14 w-full rounded-xl border border-border bg-background/90 pl-12 pr-32 text-base shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          />
          <Button
            className="absolute right-2 top-1/2 -translate-y-1/2"
            size="lg"
            onClick={() => void runSearch()}
            disabled={loading}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </Button>
          <SearchRecommendations
            query={query}
            savedSearchNames={savedSearches.map((s) => s.name)}
            visible={heroFocused}
            onSelect={(v) => {
              setQuery(v)
              void runSearch(v)
            }}
          />
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {actionMessage ? (
        <ProspectSearchBulkPushSummary
          message={actionMessage.message}
          workspaceUrl={actionMessage.workspaceUrl}
          tone={actionMessage.tone}
        />
      ) : null}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <ProspectSearchFilterRail
          filters={filters}
          onChange={updateFilters}
          onApply={() =>
            void runSearch({
              queryText: queryRef.current,
              filters: filtersRef.current,
              discoveryMode: discoveryModeRef.current,
            })
          }
          onClear={() => replaceFilters(EMPTY_FILTERS)}
          savedSearches={savedSearches}
          lists={lists}
          onLoadSavedSearch={(id) => void loadSavedById(id)}
          activeSavedSearchId={activeSavedSearchId}
          refreshingSavedCounts={refreshingSavedCounts}
          onRefreshSavedCounts={(id) => void refreshSavedCounts(id)}
          onDeleteSavedSearch={(id) => void deleteSavedSearch(id)}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <TerritoryIntelligencePanel
            summary={result?.territory_intelligence}
            filters={filters}
            query={query}
            loading={loading}
            onSaveTerritory={async (name) => {
              await runAction("save_territory", { territory_name: name })
            }}
            onRefreshTerritory={async () => {
              await runAction("refresh_territory", {
                territory_id: filters.territory_id ?? result?.territory_intelligence?.territory_id,
              })
              await runSearch()
            }}
            onPushTopProspects={async () => {
              await runAction("push_territory_top_prospects")
            }}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                Results
                {result ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {result.total_companies.toLocaleString()} companies
                    {result.discovery_mode === "internal" ? ` · ${result.total_people.toLocaleString()} contacts` : " · external discovery"}
                  </span>
                ) : null}
              </h2>
              {result?.discovery_mode === "internal" ? (
                <ProspectSearchIndexDiagnostics diagnostics={result.index_diagnostics} />
              ) : null}
              {result?.discovery_mode === "discover_external" &&
              (result.provider_status_label || result.provider_status_message) ? (
                <RealWorldProviderStatus
                  className="mt-2"
                  label={result.provider_status_label}
                  message={
                    result.real_world_built_query
                      ? `${result.provider_status_message ?? ""} Query: ${result.real_world_built_query}`
                      : result.provider_status_message
                  }
                />
              ) : null}
              {result?.provider_messages && result.provider_messages.length > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {result.provider_messages.join(" · ")}
                </p>
              ) : null}
              {result?.discovery_mode === "discover_external" &&
              result.provider_diagnostics &&
              result.provider_diagnostics.length > 0 ? (
                <>
                  {result.provider_diagnostics
                    .filter((row) => row.provider_type === "google_places")
                    .map((row) => (
                      <GooglePlacesQueryDiagnostics
                        key={`${row.provider_type}-${row.provider_name}`}
                        diagnostic={row}
                        qaMarker={result.google_places_query_expansion_qa_marker}
                      />
                    ))}
                  <ProviderCacheCostDiagnostics
                    diagnostics={result.provider_diagnostics}
                    qaMarker={result.provider_cache_qa_marker}
                  />
                  <div
                    className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700"
                    data-qa-marker={result.provider_audit_qa_marker ?? GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER}
                  >
                    <p className="font-medium">Provider diagnostics</p>
                    <ul className="mt-1 space-y-1">
                      {result.provider_diagnostics
                        .filter((row) => row.provider_type !== "google_places")
                        .map((row) => (
                          <li key={`${row.provider_type}-${row.provider_name}`}>
                            {row.provider_name}: executed={String(row.provider_executed)}, latency=
                            {row.provider_latency_ms}ms, results={row.provider_result_count}
                            {row.provider_fallback_reason
                              ? `, fallback=${row.provider_fallback_reason}`
                              : ""}
                          </li>
                        ))}
                      {result.provider_diagnostics
                        .filter((row) => row.provider_type === "google_places")
                        .map((row) => (
                          <li key={`${row.provider_type}-${row.provider_name}-summary`}>
                            {row.provider_name}: executed={String(row.provider_executed)}, latency=
                            {row.provider_latency_ms}ms, merged={row.provider_merged_result_count ?? row.provider_result_count}
                            , queries={row.provider_query_generated?.length ?? 0}
                          </li>
                        ))}
                    </ul>
                    {result.provider_fallback_reason ? (
                      <p className="mt-1 opacity-90">
                        Run fallback reason: {result.provider_fallback_reason}
                      </p>
                    ) : null}
                  </div>
                </>
              ) : null}
              {process.env.NODE_ENV === "development" &&
              result?.discovery_mode === "discover_external" &&
              result.external_filter_diagnostics ? (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-950">
                  <p className="font-medium">External filter diagnostics (dev only)</p>
                  <p>
                    raw={result.external_filter_diagnostics.raw_provider_count} · normalized=
                    {result.external_filter_diagnostics.normalized_result_count} · dropped=
                    {result.external_filter_diagnostics.dropped_result_count}
                  </p>
                  {Object.keys(result.external_filter_diagnostics.dropped_reasons).length > 0 ? (
                    <p className="mt-1 opacity-90">
                      dropped reasons:{" "}
                      {Object.entries(result.external_filter_diagnostics.dropped_reasons)
                        .map(([reason, count]) => `${reason}=${count}`)
                        .join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {companies.length > 0 ? (
                <Button size="sm" variant="ghost" onClick={selectAllVisible}>
                  Select all visible
                </Button>
              ) : null}
              <SearchViewToggle view={view} onViewChange={setView} />
              <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>
                <Bookmark className="mr-1 size-3.5" />
                Save workflow
              </Button>
            </div>
          </div>

          <ProspectSearchBulkActionBar
            selectedCount={selectedKeys.size}
            pushableCount={pushableSelectedCount}
            selectedCompanies={selectedCompanies}
            pushing={bulkPushing}
            onPush={() => void runBulkPush()}
            onClear={clearSelection}
          />

          {result && result.discovery_mode === "internal" && result.total_companies > 0 ? (
            <ProspectSearchPagination
              page={result.page ?? page}
              pageSize={result.page_size ?? pageSize}
              totalCount={result.total_companies}
              hasNextPage={result.has_next_page ?? false}
              loading={loading}
              onPageChange={(nextPage) => void goToPage(nextPage)}
              onPageSizeChange={(nextPageSize) => void changePageSize(nextPageSize)}
            />
          ) : null}

          {showEmpty ? (
            <SearchEmptyState
              onRunQuery={(q) => void runSearch(q)}
              onSelectTemplate={applyTemplate}
              recentSaved={savedSearches}
              title={result?.expanded_search_exhausted ? "No companies found" : undefined}
              emptyMessage={
                result?.expanded_search_exhausted
                  ? "No companies found after expanded provider search. Try adding a location or broadening filters."
                  : result?.discovery_mode === "discover_external" && hasSearched
                    ? "No companies matched this search yet. Try a starter ICP template or broaden industry filters."
                    : undefined
              }
            />
          ) : view === "card" ? (
            <div className="flex flex-col gap-4">
              {companies.map((row) => (
                <CompanyResultCard
                  key={`${row.source_type}-${row.id}`}
                  row={row}
                  selected={selectedCompany?.id === row.id}
                  checked={selectedKeys.has(prospectSearchSelectionKey(row))}
                  onSelect={() => setSelectedCompany(row)}
                  onCheckedChange={(checked) => toggleCompanySelection(row, checked)}
                  onAction={(action, extra) => {
                    setSelectedCompany(row)
                    void runAction(action, { ...extra, company: row })
                  }}
                />
              ))}
            </div>
          ) : (
            <CompanyResultsTable
              rows={companies}
              selectedId={selectedCompany?.id ?? null}
              selectedKeys={selectedKeys}
              onSelect={setSelectedCompany}
              onToggleSelection={toggleCompanySelection}
              onSelectAllVisible={selectAllVisible}
              onClearSelection={clearSelection}
            />
          )}

          {people.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Contacts ({people.length})</h3>
              <div className="flex flex-col gap-3">
                {people.map((row) => (
                  <PersonResultCard key={row.id} row={row} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <IcpTemplatesDrawer
        open={icpTemplatesOpen}
        onOpenChange={setIcpTemplatesOpen}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={applyTemplate}
        onCreateCustom={() => {
          setActiveTemplateId(null)
          setActiveSavedSearchId(null)
          replaceFilters(EMPTY_FILTERS)
          setQuery("")
        }}
      />

      <SaveSearchWorkflowDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultName={suggestedSaveName}
        onSave={(input) => void saveSearchWorkflow(input)}
        saving={savingSearch}
      />
    </div>
  )
}

function CompanyResultsTable({
  rows,
  selectedId,
  selectedKeys,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
}: {
  rows: GrowthProspectSearchCompanyResult[]
  selectedId: string | null
  selectedKeys: Set<string>
  onSelect: (row: GrowthProspectSearchCompanyResult) => void
  onToggleSelection: (row: GrowthProspectSearchCompanyResult, checked: boolean) => void
  onSelectAllVisible: () => void
  onClearSelection: () => void
}) {
  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedKeys.has(prospectSearchSelectionKey(row)))

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <p className="text-xs text-muted-foreground">
          {selectedKeys.size > 0 ? `${selectedKeys.size} selected` : "Select companies for bulk push"}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onSelectAllVisible}>
            Select all visible
          </Button>
          {selectedKeys.size > 0 ? (
            <Button size="sm" variant="ghost" onClick={onClearSelection}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={(value) => {
                  if (value === true) onSelectAllVisible()
                  else onClearSelection()
                }}
                aria-label="Select all visible companies"
              />
            </th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Company</th>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Intent</th>
            <th className="px-3 py-2">Stage</th>
            <th className="px-3 py-2">Match</th>
            <th className="px-3 py-2">Location</th>
            <th className="px-3 py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.source_type}-${row.id}`}
              className={cn(
                "cursor-pointer border-t border-border hover:bg-muted/30",
                selectedId === row.id && "bg-violet-50/80",
              )}
              onClick={() => onSelect(row)}
            >
              <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedKeys.has(prospectSearchSelectionKey(row))}
                  onCheckedChange={(value) => onToggleSelection(row, value === true)}
                  aria-label={`Select ${row.company_name}`}
                />
              </td>
              <td className="px-3 py-2 align-top">
                <CompanyStatusBadges row={row} />
              </td>
              <td className="px-3 py-2 font-medium">{row.company_name}</td>
              <td className="px-3 py-2 tabular-nums">
                {row.lead_engine_score ?? row.lead_score ?? ""}
              </td>
              <td className="px-3 py-2 tabular-nums">{row.intent_score ?? ""}</td>
              <td className="px-3 py-2">
                {row.buying_stage ? row.buying_stage.replace(/_/g, " ") : ""}
              </td>
              <td className="px-3 py-2">
                {row.company_match_confidence != null
                  ? `${Math.round(row.company_match_confidence * 100)}%`
                  : ""}
              </td>
              <td className="px-3 py-2">{row.location ?? ""}</td>
              <td className="px-3 py-2">{Math.round(row.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
