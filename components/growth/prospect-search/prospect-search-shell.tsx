"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react"
import { useSearchParams } from "next/navigation"
import { Bookmark, LayoutTemplate, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CompanyResultCard } from "@/components/growth/prospect-search/company-result-card"
import {
  ProspectSearchBulkActionBar,
  ProspectSearchBulkPushSummary,
} from "@/components/growth/prospect-search/prospect-search-bulk-action-bar"
import { DiscoveryModeToggle } from "@/components/growth/prospect-search/discovery-mode-toggle"
import { IcpTemplatesDrawer } from "@/components/growth/prospect-search/icp-templates-drawer"
import { ProspectSearchFilterRail } from "@/components/growth/prospect-search/prospect-search-filter-rail"
import { ProspectSearchCleanStartPanel } from "@/components/growth/prospect-search/prospect-search-clean-start-panel"
import { ProspectSearchDiscoverReadyPanel } from "@/components/growth/prospect-search/prospect-search-discover-ready-panel"
import { ProspectSearchDiscoverResultsTable } from "@/components/growth/prospect-search/prospect-search-discover-results-table"
import { ProspectSearchDiagnosticsDisclosure } from "@/components/growth/prospect-search/prospect-search-diagnostics-disclosure"
import {
  ProspectSearchActiveFilterPills,
  ProspectSearchRelaxFilters,
} from "@/components/growth/prospect-search/prospect-search-active-filter-pills"
import { TerritoryIntelligencePanel } from "@/components/growth/prospect-search/territory-intelligence-panel"
import { TerritoryOpportunityHeatmapPanel } from "@/components/growth/prospect-search/territory-opportunity-heatmap-panel"
import { PersonResultCard } from "@/components/growth/prospect-search/person-result-card"
import { SearchEmptyState } from "@/components/growth/prospect-search/search-empty-state"
import { SearchRecommendations } from "@/components/growth/prospect-search/search-recommendations"
import { SearchViewToggle } from "@/components/growth/prospect-search/search-view-toggle"
import { rotateHeroPlaceholder } from "@/components/growth/prospect-search/search-suggestion-engine"
import {
  GROWTH_PROSPECT_SEARCH_UX_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER,
  GROWTH_RESULTS_HEADER_LAYOUT_V1_QA_MARKER,
  GROWTH_SEARCH_CLEAN_START_QA_MARKER,
  GROWTH_SEARCH_DIAGNOSTICS_HIDDEN_QA_MARKER,
  GROWTH_SEARCH_HAS_SEARCHED_STATE_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_TRUTHFUL_LIFECYCLE_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_NO_PRESEARCH_COUNTS_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_STAGED_SEARCH_QA_MARKER,
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
  GrowthProspectSearchSortBy,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
import { GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER } from "@/lib/growth/prospect-search/prospect-pipeline-automation"
import type { GrowthProspectWorkflowContinuityEventKind } from "@/lib/growth/prospect-search/prospect-pipeline-automation"
import { ProspectWorkflowLauncher } from "@/components/growth/prospect-search/prospect-workflow-launcher"
import { SavedSearchBatchLaunchPanel } from "@/components/growth/outbound-launch/saved-search-batch-launch-panel"
import { prospectSearchSelectionKey } from "@/lib/growth/prospect-search/prospect-search-selection"
import { CompanyStatusBadges } from "@/components/growth/prospect-search/company-status-badges"
import { ProspectSearchPagination } from "@/components/growth/prospect-search/prospect-search-pagination"
import { SaveSearchWorkflowDialog } from "@/components/growth/prospect-search/save-search-workflow-dialog"
import {
  attachSavedSearchWorkflow,
  GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER,
  type GrowthProspectSearchSavedSearchWithWorkflow,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import { buildProspectSearchGetRequestParams } from "@/lib/growth/prospect-search/prospect-search-client-request"
import {
  formatProspectSearchResultsCountLabel,
  GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER,
  GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER,
  resolveProspectSearchDiscoverResultsPhase,
  resolveRawProviderCount,
  shouldShowProspectSearchCleanStart,
  shouldShowProspectSearchResultsCount,
} from "@/lib/growth/prospect-search/prospect-search-discover-ui-state"
import {
  GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER,
  resolveProspectSearchExternalPendingMessage,
  shouldFetchProspectSearchResults,
  type ProspectSearchFetchTrigger,
} from "@/lib/growth/prospect-search/prospect-search-provider-search-intent"
import {
  buildProspectSearchCriteriaKey,
  isProspectSearchCriteriaStale,
  resolveProspectSearchStagedSearchPendingMessage,
} from "@/lib/growth/prospect-search/prospect-search-staged-lifecycle"
import { useProspectSearchTerritoryHeatmap } from "@/lib/growth/prospect-search/use-prospect-search-territory-heatmap"
import {
  applyTerritoryHeatmapDrilldown,
  isTerritoryQualifiedProspect,
  type GrowthTerritoryOpportunityRecommendedAction,
} from "@/lib/growth/prospect-search/territory-opportunity-heatmap"
import { cn } from "@/lib/utils"

const EMPTY_FILTERS: GrowthProspectSearchFilters = {}

type ProspectSearchRunInput = {
  queryText?: string
  filters?: GrowthProspectSearchFilters
  discoveryMode?: GrowthProspectSearchDiscoveryMode
  trigger?: ProspectSearchFetchTrigger
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
  const [searchCompleted, setSearchCompleted] = useState(false)
  const [actionMessage, setActionMessage] = useState<ActionFeedback | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"card" | "table">("card")
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [bulkPushing, setBulkPushing] = useState(false)
  const [workflowLaunchBusy, setWorkflowLaunchBusy] = useState(false)
  const [heroFocused, setHeroFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [icpTemplatesOpen, setIcpTemplatesOpen] = useState(false)
  const [discoveryMode, setDiscoveryMode] = useState<GrowthProspectSearchDiscoveryMode>(() =>
    resolveDiscoveryModeFromParams(searchParams),
  )
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState<GrowthProspectSearchSortBy>("rank")
  const [pendingProviderSearchHint, setPendingProviderSearchHint] = useState<string | null>(null)
  const [lastSearchedCriteriaKey, setLastSearchedCriteriaKey] = useState<string | null>(null)

  const queryRef = useRef(query)
  const filtersRef = useRef(filters)
  const discoveryModeRef = useRef(discoveryMode)
  const pageRef = useRef(page)
  const pageSizeRef = useRef(pageSize)
  const sortByRef = useRef(sortBy)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const fetchRequestIdRef = useRef(0)

  queryRef.current = query
  filtersRef.current = filters
  discoveryModeRef.current = discoveryMode
  pageRef.current = page
  pageSizeRef.current = pageSize
  sortByRef.current = sortBy

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

  const companies = result?.companies ?? []
  const people = result?.people ?? []
  const discoverFilteredResults = result?.filtered_discover_results ?? []
  const rawProviderCount = resolveRawProviderCount(result)
  const discoverPhase = resolveProspectSearchDiscoverResultsPhase({
    discoveryMode,
    isSearching: loading,
    searchCompleted,
    filteredCount: companies.length,
    rawProviderCount,
  })
  const showCleanStart = shouldShowProspectSearchCleanStart({
    discoveryMode,
    hasSearched,
    searchCompleted,
  })
  const currentCriteriaKey = useMemo(
    () => buildProspectSearchCriteriaKey(query, filters),
    [query, filters],
  )
  const criteriaStale = isProspectSearchCriteriaStale(currentCriteriaKey, lastSearchedCriteriaKey)
  const showResultsCount = shouldShowProspectSearchResultsCount({
    discoveryMode,
    searchCompleted,
    hasSearched,
    loading,
    criteriaStale,
  })
  const showInternalEmpty =
    discoveryMode === "internal" && hasSearched && !loading && companies.length === 0 && people.length === 0
  const showDiscoverNoResults =
    discoveryMode === "discover_external" &&
    searchCompleted &&
    !loading &&
    discoverPhase === "no_raw_results"
  const showDiscoverFiltersHiding =
    discoveryMode === "discover_external" &&
    searchCompleted &&
    !loading &&
    discoverPhase === "filters_hiding_results"
  const showDiscoverReady =
    discoveryMode === "discover_external" && !searchCompleted && !loading
  const stagedSearchPendingMessage = criteriaStale
    ? resolveProspectSearchStagedSearchPendingMessage(discoveryMode)
    : null

  const { heatmap, loading: heatmapLoading, panelVisible: territoryHeatmapVisible } =
    useProspectSearchTerritoryHeatmap({
      query,
      filters,
      discoveryMode,
      savedSearchRestored: Boolean(activeSavedSearchId),
      enabled: hasSearched && !criteriaStale,
    })

  const searchLoadingLabel =
    discoveryMode === "discover_external" ? "Searching companies…" : "Searching…"
  const heroSearchButtonLabel =
    discoveryMode === "discover_external" ? "Search market" : "Search"
  const applyButtonLabel =
    discoveryMode === "discover_external" ? "Apply filters" : "Search"
  const searchButtonDisabled = loading
  const applyButtonDisabled = loading

  const resetExecutionState = useCallback(() => {
    fetchAbortRef.current?.abort()
    setResult(null)
    setHasSearched(false)
    setSearchCompleted(false)
    setLastSearchedCriteriaKey(null)
    setPendingProviderSearchHint(null)
    setSelectedCompany(null)
    setSelectedKeys(new Set())
    setPage(1)
    setActiveSavedSearchId(null)
    setActiveTemplateId(null)
  }, [])

  const clearAllFilters = useCallback(() => {
    replaceFilters(EMPTY_FILTERS)
    setQuery("")
    resetExecutionState()
  }, [replaceFilters, resetExecutionState])

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

  useEffect(() => {
    if (lastSearchedCriteriaKey === null) return
    if (currentCriteriaKey === lastSearchedCriteriaKey) return
    setResult(null)
    setSelectedCompany(null)
    setSelectedKeys(new Set())
    setSearchCompleted(false)
    setPendingProviderSearchHint(resolveProspectSearchStagedSearchPendingMessage(discoveryMode))
  }, [currentCriteriaKey, lastSearchedCriteriaKey, discoveryMode])

  const fetchResults = useCallback(
    async (input: {
      queryText?: string
      filtersOverride?: GrowthProspectSearchFilters
      discoveryModeOverride?: GrowthProspectSearchDiscoveryMode
      nextPage?: number
      nextPageSize?: number
      sortByOverride?: GrowthProspectSearchSortBy
      resetSelection?: boolean
    } = {}) => {
      const q = input.queryText ?? queryRef.current
      const activeFilters = input.filtersOverride ?? filtersRef.current
      const activeDiscoveryMode = input.discoveryModeOverride ?? discoveryModeRef.current
      const activeSortBy = input.sortByOverride ?? sortByRef.current
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
      if (input.sortByOverride != null) setSortBy(input.sortByOverride)
      setLoading(true)
      setHasSearched(true)
      if (activeDiscoveryMode === "discover_external") {
        setSearchCompleted(false)
      }
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
          sortBy: activeSortBy,
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
        if (activeDiscoveryMode === "discover_external") {
          setSearchCompleted(true)
        }
      }
    },
    [],
  )

  const runSearch = useCallback(
    async (input?: string | ProspectSearchRunInput) => {
      const normalized =
        typeof input === "string"
          ? { queryText: input, trigger: "explicit_operator_search" as const }
          : (input ?? { trigger: "explicit_operator_search" as const })
      const activeDiscoveryMode = normalized.discoveryMode ?? discoveryModeRef.current
      const trigger = normalized.trigger ?? "explicit_operator_search"

      if (normalized.queryText != null) setQuery(normalized.queryText)
      if (normalized.filters != null) replaceFilters(normalized.filters)

      if (
        !shouldFetchProspectSearchResults({
          discoveryMode: activeDiscoveryMode,
          trigger,
        })
      ) {
        if (trigger !== "post_action_refresh" && trigger !== "pagination" && trigger !== "sort_change") {
          setPendingProviderSearchHint(
            resolveProspectSearchExternalPendingMessage(trigger, activeDiscoveryMode),
          )
        }
        return
      }

      setPendingProviderSearchHint(null)
      setPage(1)
      await fetchResults({
        queryText: normalized.queryText ?? queryRef.current,
        filtersOverride: normalized.filters ?? filtersRef.current,
        discoveryModeOverride: activeDiscoveryMode,
        nextPage: 1,
        resetSelection: true,
      })
    },
    [fetchResults, replaceFilters],
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

  const loadInitialMeta = useCallback(async () => {
    try {
      const metaRes = await fetch("/api/platform/growth/prospect-search?meta=1&q=&page=1&page_size=1", {
        cache: "no-store",
      })
      const metaJson = (await metaRes.json()) as {
        ok?: boolean
        saved_searches?: GrowthProspectSearchSavedSearchRow[]
        lists?: GrowthProspectSearchListRow[]
      }
      if (!metaRes.ok || metaJson.ok === false) return
      setSavedSearches((metaJson.saved_searches ?? []).map((row) => attachSavedSearchWorkflow(row)))
      setLists(metaJson.lists ?? [])
    } catch {
      // Clean start should still render when meta load fails.
    }
  }, [])

  useEffect(() => {
    void loadInitialMeta()
  }, [loadInitialMeta])

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
          await runSearch({ trigger: "post_action_refresh" })
        }
        if (action === "refresh_territory") {
          await runSearch({ trigger: "post_action_refresh" })
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

  const handleWorkflowLaunch = useCallback(
    async (
      company: GrowthProspectSearchCompanyResult,
      input: {
        launchUrl?: string | null
        serverAction?: string | null
        timelineEventKind?: string | null
      },
    ) => {
      setWorkflowLaunchBusy(true)
      try {
        if (input.timelineEventKind) {
          await fetch("/api/platform/growth/prospect-search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "record_prospect_workflow_continuity",
              query,
              filters,
              discovery_mode: discoveryMode,
              company,
              workflow_event_kind: input.timelineEventKind as GrowthProspectWorkflowContinuityEventKind,
            }),
          })
        }
        if (input.serverAction) {
          await runAction(input.serverAction, { company })
        } else if (input.launchUrl) {
          window.open(input.launchUrl, "_blank", "noopener,noreferrer")
        }
      } finally {
        setWorkflowLaunchBusy(false)
      }
    },
    [query, filters, discoveryMode, runAction],
  )

  const applyTemplate = useCallback((template: ProspectSearchIcpTemplate) => {
    const nextFilters = { ...EMPTY_FILTERS, ...template.filters }
    setActiveTemplateId(template.id)
    setActiveSavedSearchId(null)
    setQuery(template.query)
    replaceFilters(nextFilters)
    void runSearch({
      queryText: template.query,
      filters: nextFilters,
      trigger: "icp_template_selection",
    })
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

      if (
        !shouldFetchProspectSearchResults({
          discoveryMode: restoreDiscoveryMode,
          trigger: "saved_workflow_restore",
        })
      ) {
        setPendingProviderSearchHint(
          resolveProspectSearchExternalPendingMessage("saved_workflow_restore", restoreDiscoveryMode),
        )
        return
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

  const handleTerritoryHeatmapDrilldown = useCallback(
    (territoryId: string) => {
      const row = heatmap?.territories.find((entry) => entry.id === territoryId)
      if (!row) return
      const nextFilters = applyTerritoryHeatmapDrilldown(filtersRef.current, row)
      replaceFilters(nextFilters)
      setSelectedCompany(null)
      setSelectedKeys(new Set())
      void runSearch({
        filters: nextFilters,
        trigger: "explicit_operator_search",
        resetSelection: true,
      })
    },
    [heatmap?.territories, replaceFilters, runSearch],
  )

  const handleTerritoryHeatmapRecommendedAction = useCallback(
    async (action: GrowthTerritoryOpportunityRecommendedAction) => {
      if (action === "save_workflow") {
        setSaveDialogOpen(true)
        return
      }
      if (action === "bulk_push_qualified") {
        const qualified = companies.filter((row) =>
          isTerritoryQualifiedProspect({
            id: row.id,
            lead_score: row.lead_score,
            lead_engine_score: row.lead_engine_score,
            is_suppressed: row.is_suppressed,
          }),
        )
        if (filters.territory_id || filters.territory_filter) {
          await runAction("push_territory_top_prospects")
          return
        }
        if (qualified.length === 0) return
        setSelectedKeys(new Set(qualified.map((row) => prospectSearchSelectionKey(row))))
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
              selected: qualified.map((row) => ({
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
        return
      }
      if (action === "launch_outbound_review") {
        document.getElementById("growth-outbound-launch-review")?.scrollIntoView({ behavior: "smooth" })
        return
      }
      void runSearch({ trigger: "explicit_operator_search" })
      document.getElementById("growth-prospect-search-results")?.scrollIntoView({ behavior: "smooth" })
    },
    [companies, discoveryMode, filters, query, runAction, runSearch],
  )

  return (
    <div
      className="flex flex-col gap-6"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_QA_MARKER}
      data-ux-marker={GROWTH_PROSPECT_SEARCH_UX_QA_MARKER}
      data-layout-marker={GROWTH_PROSPECT_SEARCH_LAYOUT_V2_QA_MARKER}
      data-saved-search-workflows-marker={GROWTH_SAVED_SEARCH_WORKFLOWS_QA_MARKER}
      data-pipeline-automation-marker={GROWTH_PROSPECT_PIPELINE_AUTOMATION_QA_MARKER}
      data-provider-search-intent-marker={GROWTH_PROSPECT_SEARCH_PROVIDER_INTENT_QA_MARKER}
      data-live-provider-query-expansion-marker={GROWTH_LIVE_PROVIDER_QUERY_EXPANSION_QA_MARKER}
      data-clean-start-marker={GROWTH_SEARCH_CLEAN_START_QA_MARKER}
      data-has-searched-marker={GROWTH_SEARCH_HAS_SEARCHED_STATE_QA_MARKER}
      data-has-searched={hasSearched ? "true" : "false"}
      data-search-completed={searchCompleted ? "true" : "false"}
      data-discover-phase={discoverPhase ?? "internal"}
      data-discover-ready-qa={GROWTH_DISCOVER_READY_TO_SEARCH_QA_MARKER}
      data-diagnostics-hidden-marker={GROWTH_SEARCH_DIAGNOSTICS_HIDDEN_QA_MARKER}
      data-truthful-lifecycle-marker={GROWTH_PROSPECT_SEARCH_TRUTHFUL_LIFECYCLE_QA_MARKER}
      data-no-presearch-counts-marker={GROWTH_PROSPECT_SEARCH_NO_PRESEARCH_COUNTS_QA_MARKER}
      data-staged-search-marker={GROWTH_PROSPECT_SEARCH_STAGED_SEARCH_QA_MARKER}
      data-current-criteria-key={currentCriteriaKey}
      data-last-searched-criteria-key={lastSearchedCriteriaKey ?? ""}
      data-criteria-stale={criteriaStale ? "true" : "false"}
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
              resetExecutionState()
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => setIcpTemplatesOpen(true)}>
            <LayoutTemplate className="mr-1.5 size-3.5" />
            ICP Templates
          </Button>
        </div>
        <div className="mt-5">
          <div className="relative flex flex-col gap-2 sm:block">
          <Search className="pointer-events-none absolute left-4 top-1/2 hidden size-5 -translate-y-1/2 text-muted-foreground sm:block" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setHeroFocused(true)}
            onBlur={() => setTimeout(() => setHeroFocused(false), 180)}
            onKeyDown={(e) => e.key === "Enter" && !searchButtonDisabled && void runSearch({ trigger: "explicit_operator_search" })}
            placeholder={heroPlaceholder}
            className="h-14 w-full rounded-xl border border-border bg-background/90 pl-4 pr-4 text-base shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:pl-12 sm:pr-36"
          />
          <Button
            className="w-full sm:absolute sm:right-2 sm:top-1/2 sm:w-auto sm:-translate-y-1/2"
            size="lg"
            onClick={() => void runSearch({ trigger: "explicit_operator_search" })}
            disabled={searchButtonDisabled}
            aria-label={discoveryMode === "discover_external" ? "Search companies" : "Search"}
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {searchLoadingLabel}
              </>
            ) : (
              heroSearchButtonLabel
            )}
          </Button>
          <SearchRecommendations
            query={query}
            savedSearchNames={savedSearches.map((s) => s.name)}
            visible={heroFocused}
            onSelect={(v) => {
              setQuery(v)
              void runSearch({ queryText: v, trigger: "search_recommendation_select" })
            }}
          />
          </div>
        </div>
      </section>

      {pendingProviderSearchHint || stagedSearchPendingMessage ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-provider-search-pending-hint="v1"
          data-staged-search-pending="v1"
        >
          {stagedSearchPendingMessage ?? pendingProviderSearchHint}
        </p>
      ) : null}
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
          onApply={() => {
            if (discoveryModeRef.current === "discover_external") {
              setPendingProviderSearchHint(
                resolveProspectSearchExternalPendingMessage(
                  "filters_updated",
                  discoveryModeRef.current,
                ),
              )
              return
            }
            void runSearch({
              queryText: queryRef.current,
              filters: filtersRef.current,
              discoveryMode: discoveryModeRef.current,
              trigger: "explicit_operator_search",
            })
          }}
          onClear={clearAllFilters}
          applyLabel={applyButtonLabel}
          applyDisabled={applyButtonDisabled}
          savedSearches={savedSearches}
          lists={lists}
          onLoadSavedSearch={(id) => void loadSavedById(id)}
          activeSavedSearchId={activeSavedSearchId}
          refreshingSavedCounts={refreshingSavedCounts}
          onRefreshSavedCounts={(id) => void refreshSavedCounts(id)}
          onDeleteSavedSearch={(id) => void deleteSavedSearch(id)}
        />

        <div
          className="flex min-w-0 flex-1 flex-col gap-6"
          data-qa-marker={GROWTH_RESULTS_HEADER_LAYOUT_V1_QA_MARKER}
        >
          {!showCleanStart ? (
            <>
              {(discoveryMode === "internal" && hasSearched) ||
              (discoveryMode === "discover_external" && searchCompleted) ? (
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
              ) : null}

              {territoryHeatmapVisible && hasSearched && !criteriaStale ? (
                <TerritoryOpportunityHeatmapPanel
                  heatmap={heatmap}
                  loading={heatmapLoading}
                  onDrilldown={handleTerritoryHeatmapDrilldown}
                  onRecommendedAction={(action) => void handleTerritoryHeatmapRecommendedAction(action)}
                />
              ) : null}

              {showDiscoverReady ? <ProspectSearchDiscoverReadyPanel /> : null}

              {loading && discoveryMode === "discover_external" && !searchCompleted ? (
                <p className="text-sm text-muted-foreground">{searchLoadingLabel}</p>
              ) : null}

              {(discoveryMode === "internal" && hasSearched) ||
              (discoveryMode === "discover_external" && (searchCompleted || loading)) ? (
                <>
              {companies.length > 0 && searchCompleted ? (
                <div id="growth-outbound-launch-review">
                  <SavedSearchBatchLaunchPanel
                  savedSearchId={activeSavedSearchId}
                  companies={companies}
                  onOpenCompany={(companyId) => {
                    const match = companies.find((row) => row.id === companyId)
                    if (match) setSelectedCompany(match)
                  }}
                />
                </div>
              ) : null}

              <div id="growth-prospect-search-results" className="w-full min-w-0 space-y-3">
                <ProspectSearchActiveFilterPills filters={filters} onChange={replaceFilters} />

                {loading && discoveryMode === "internal" ? (
                  <p className="text-sm text-muted-foreground">{searchLoadingLabel}</p>
                ) : null}

                <div className="flex w-full min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-semibold leading-snug text-foreground">
                      <span className="inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="whitespace-nowrap">Results</span>
                        {result && showResultsCount ? (
                          <>
                            <span className="whitespace-nowrap font-normal text-muted-foreground">
                              {formatProspectSearchResultsCountLabel({
                                discoveryMode,
                                searchCompleted,
                                totalCompanies: result.total_companies,
                              })}
                            </span>
                            {result.discovery_mode === "internal" ? (
                              <>
                                <span className="font-normal text-muted-foreground" aria-hidden="true">
                                  ·
                                </span>
                                <span className="font-normal text-muted-foreground">
                                  {result.total_people.toLocaleString()} contacts
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </h2>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {companies.length > 0 ? (
                      <Button size="sm" variant="ghost" onClick={selectAllVisible}>
                        Select all visible
                      </Button>
                    ) : null}
                    <Select
                      value={sortBy}
                      onValueChange={(value: GrowthProspectSearchSortBy) => {
                        setSortBy(value)
                        void fetchResults({ sortByOverride: value, nextPage: 1, resetSelection: true })
                      }}
                    >
                      <SelectTrigger className="h-8 w-[170px] text-xs">
                        <SelectValue placeholder="Sort results" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rank">Default rank</SelectItem>
                        <SelectItem value="signal_momentum">Signal momentum</SelectItem>
                      </SelectContent>
                    </Select>
                    <SearchViewToggle view={view} onViewChange={setView} />
                    <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(true)}>
                      <Bookmark className="mr-1 size-3.5" />
                      Save workflow
                    </Button>
                  </div>
                </div>

                {result?.used_relaxed_external_filters ? (
                  <p className="text-xs text-muted-foreground">
                    Showing provider matches with incomplete firmographic data. Try broadening filters if needed.
                  </p>
                ) : null}

                {result ? <ProspectSearchDiagnosticsDisclosure result={result} /> : null}

                {(showInternalEmpty || showDiscoverNoResults || showDiscoverFiltersHiding) &&
                !showDiscoverReady ? (
                  <ProspectSearchRelaxFilters
                    filters={filters}
                    discoveryMode={discoveryMode}
                    resultCount={result?.total_companies ?? null}
                    onChange={replaceFilters}
                  />
                ) : null}
              </div>

              {searchCompleted ? (
              <ProspectSearchBulkActionBar
                selectedCount={selectedKeys.size}
                pushableCount={pushableSelectedCount}
                selectedCompanies={selectedCompanies}
                pushing={bulkPushing}
                onPush={() => void runBulkPush()}
                onClear={clearSelection}
              />
              ) : null}

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

              {showDiscoverFiltersHiding ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 px-6 py-10 text-center">
                  <h3 className="text-lg font-semibold">
                    Filters are hiding all discovered companies/prospects
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    External discovery returned {rawProviderCount?.toLocaleString() ?? "some"} companies, but
                    your current filters removed every match. Broaden firmographic filters or clear enrichment
                    filters that provider rows do not include yet.
                  </p>
                </div>
              ) : showDiscoverNoResults ? (
                <SearchEmptyState
                  onRunQuery={(q) => void runSearch({ queryText: q, trigger: "suggested_query_click" })}
                  onSelectTemplate={applyTemplate}
                  recentSaved={savedSearches}
                  title="No companies found"
                  emptyMessage={
                    result?.expanded_search_exhausted
                      ? "No companies found after expanded provider search. Try adding a location or broadening filters."
                      : "No companies matched this external discovery search. Try broadening industry or location filters."
                  }
                />
              ) : showInternalEmpty ? (
                <SearchEmptyState
                  onRunQuery={(q) => void runSearch({ queryText: q, trigger: "suggested_query_click" })}
                  onSelectTemplate={applyTemplate}
                  recentSaved={savedSearches}
                  title="No companies found"
                  emptyMessage="No companies matched this search yet. Try broadening filters or adjusting your query."
                />
              ) : searchCompleted && view === "card" ? (
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
                      onWorkflowLaunch={(launchInput) => void handleWorkflowLaunch(row, launchInput)}
                      workflowBusy={workflowLaunchBusy}
                      searchQuery={query}
                      savedSearchId={activeSavedSearchId}
                    />
                  ))}
                </div>
              ) : searchCompleted && discoveryMode === "discover_external" ? (
                <>
                  <ProspectSearchDiscoverResultsTable
                    rows={discoverFilteredResults}
                    selectedId={selectedCompany?.id ?? null}
                    selectedKeys={selectedKeys}
                    onSelect={setSelectedCompany}
                    onToggleSelection={toggleCompanySelection}
                    onSelectAllVisible={selectAllVisible}
                    onClearSelection={clearSelection}
                  />
                  {selectedCompany ? (
                    <div
                      className="rounded-xl border border-border bg-card p-2"
                      data-qa={GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER}
                      data-qa-marker={GROWTH_DISCOVER_COMPANY_INTELLIGENCE_PANEL_QA_MARKER}
                    >
                      <CompanyResultCard
                        row={selectedCompany}
                        selected
                        checked={selectedKeys.has(prospectSearchSelectionKey(selectedCompany))}
                        onSelect={() => setSelectedCompany(selectedCompany)}
                        onCheckedChange={(checked) =>
                          toggleCompanySelection(selectedCompany, checked === true)
                        }
                        onAction={(action, extra) => {
                          void runAction(action, { ...extra, company: selectedCompany })
                        }}
                        onWorkflowLaunch={(launchInput) =>
                          void handleWorkflowLaunch(selectedCompany, launchInput)
                        }
                        workflowBusy={workflowLaunchBusy}
                        searchQuery={query}
                        savedSearchId={activeSavedSearchId}
                      />
                    </div>
                  ) : null}
                </>
              ) : searchCompleted ? (
                <>
                <CompanyResultsTable
                  rows={companies}
                  selectedId={selectedCompany?.id ?? null}
                  selectedKeys={selectedKeys}
                  onSelect={setSelectedCompany}
                  onToggleSelection={toggleCompanySelection}
                  onSelectAllVisible={selectAllVisible}
                  onClearSelection={clearSelection}
                />
                {selectedCompany ? (
                  <div className="hidden rounded-xl border border-border bg-card p-4 lg:block">
                    <p className="mb-3 text-sm font-semibold">{selectedCompany.company_name}</p>
                    <ProspectWorkflowLauncher
                      company={selectedCompany}
                      query={query}
                      filters={filters}
                      discoveryMode={discoveryMode}
                      savedSearchId={activeSavedSearchId}
                      busy={workflowLaunchBusy}
                      onLaunch={(launchInput) =>
                        void handleWorkflowLaunch(selectedCompany, {
                          launchUrl: launchInput.launchUrl,
                          serverAction: launchInput.serverAction,
                          timelineEventKind: launchInput.timelineEventKind,
                        })
                      }
                    />
                  </div>
                ) : null}
                </>
              ) : null}

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
                </>
              ) : null}
            </>
          ) : (
            <ProspectSearchCleanStartPanel
              savedSearches={savedSearches}
              onRunQuery={(q) => void runSearch({ queryText: q, trigger: "suggested_query_click" })}
              onRestoreSavedSearch={(id) => void loadSavedById(id)}
            />
          )}
        </div>
      </div>

      <IcpTemplatesDrawer
        open={icpTemplatesOpen}
        onOpenChange={setIcpTemplatesOpen}
        activeTemplateId={activeTemplateId}
        onSelectTemplate={applyTemplate}
        onCreateCustom={() => {
          replaceFilters(EMPTY_FILTERS)
          setQuery("")
          resetExecutionState()
        }}
      />

      <SaveSearchWorkflowDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        defaultName={suggestedSaveName}
        onSave={(input) => void saveSearchWorkflow(input)}
        saving={savingSearch}
      />

      {selectedCompany &&
      (discoveryMode === "internal" ? hasSearched : searchCompleted) ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
          <ProspectWorkflowLauncher
            company={selectedCompany}
            query={query}
            filters={filters}
            discoveryMode={discoveryMode}
            savedSearchId={activeSavedSearchId}
            compact
            busy={workflowLaunchBusy}
            onLaunch={(launchInput) =>
              void handleWorkflowLaunch(selectedCompany, {
                launchUrl: launchInput.launchUrl,
                serverAction: launchInput.serverAction,
                timelineEventKind: launchInput.timelineEventKind,
              })
            }
          />
        </div>
      ) : null}
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
