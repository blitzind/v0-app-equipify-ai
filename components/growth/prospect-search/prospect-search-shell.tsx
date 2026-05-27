"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bookmark, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanyResultCard } from "@/components/growth/prospect-search/company-result-card"
import { DiscoveryModeToggle } from "@/components/growth/prospect-search/discovery-mode-toggle"
import {
  GooglePlacesQueryDiagnostics,
  ProviderCacheCostDiagnostics,
  RealWorldProviderStatus,
} from "@/components/growth/prospect-search/real-world-provider-status"
import { GuidedIcpBuilder } from "@/components/growth/prospect-search/guided-icp-builder"
import { IcpTemplateRail } from "@/components/growth/prospect-search/icp-template-rail"
import { PersonResultCard } from "@/components/growth/prospect-search/person-result-card"
import { SearchEmptyState } from "@/components/growth/prospect-search/search-empty-state"
import { SearchRecommendations } from "@/components/growth/prospect-search/search-recommendations"
import { SearchViewToggle } from "@/components/growth/prospect-search/search-view-toggle"
import { rotateHeroPlaceholder } from "@/components/growth/prospect-search/search-suggestion-engine"
import {
  GROWTH_PROSPECT_SEARCH_UX_QA_MARKER,
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
import { GROWTH_SERP_PROVIDER_AUDIT_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const EMPTY_FILTERS: GrowthProspectSearchFilters = {}

export function ProspectSearchShell() {
  const searchParams = useSearchParams()
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<GrowthProspectSearchFilters>(EMPTY_FILTERS)
  const [result, setResult] = useState<GrowthProspectSearchResult | null>(null)
  const [savedSearches, setSavedSearches] = useState<GrowthProspectSearchSavedSearchRow[]>([])
  const [lists, setLists] = useState<GrowthProspectSearchListRow[]>([])
  const [selectedCompany, setSelectedCompany] = useState<GrowthProspectSearchCompanyResult | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"card" | "table">("card")
  const [heroFocused, setHeroFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [discoveryMode, setDiscoveryMode] =
    useState<GrowthProspectSearchDiscoveryMode>("internal")

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
    if (mode === "discover" || mode === "discover_external") {
      setDiscoveryMode("discover_external")
    }
  }, [searchParams])

  const runSearch = useCallback(
    async (queryOverride?: string) => {
      const q = queryOverride ?? query
      if (queryOverride) setQuery(queryOverride)
      setLoading(true)
      setHasSearched(true)
      setError(null)
      setActionMessage(null)
      try {
        const params = new URLSearchParams({ meta: "1", q })
        if (discoveryMode === "discover_external") {
          params.set("mode", "discover_external")
        }
        if (Object.keys(filters).length > 0) {
          params.set("filters", JSON.stringify(filters))
        }
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
        setSavedSearches(json.saved_searches ?? [])
        setLists(json.lists ?? [])
        const first = json.result.companies[0] ?? null
        setSelectedCompany(first)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [query, filters, discoveryMode],
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
            company,
            ...extra,
          }),
        })
        const json = (await res.json()) as { ok?: boolean; message?: string; workspace_url?: string }
        setActionMessage(json.message ?? (json.ok ? "Done." : "Action failed."))
        if (json.workspace_url && action === "open_workspace") {
          window.open(json.workspace_url, "_blank", "noopener,noreferrer")
        }
        if (action === "save_search" || action === "create_list") {
          await runSearch()
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [query, filters, selectedCompany, runSearch],
  )

  const applyTemplate = useCallback((template: ProspectSearchIcpTemplate) => {
    setActiveTemplateId(template.id)
    setQuery(template.query)
    setFilters({ ...EMPTY_FILTERS, ...template.filters })
    void runSearch(template.query)
  }, [runSearch])

  const loadSavedById = useCallback(
    (id: string) => {
      const row = savedSearches.find((s) => s.id === id)
      if (!row) return
      setQuery(row.query_text)
      setFilters(row.filters)
      setActiveTemplateId(null)
      void runSearch(row.query_text)
    },
    [savedSearches, runSearch],
  )

  const companies = result?.companies ?? []
  const people = result?.people ?? []
  const showEmpty = hasSearched && !loading && companies.length === 0 && people.length === 0

  return (
    <div
      className="flex flex-col gap-6"
      data-qa-marker={GROWTH_PROSPECT_SEARCH_QA_MARKER}
      data-ux-marker={GROWTH_PROSPECT_SEARCH_UX_QA_MARKER}
    >
      {/* Search hero */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-violet-50/80 via-card to-cyan-50/50 p-6 shadow-sm dark:from-violet-950/30 dark:to-cyan-950/20">
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl">Discover your ideal customer profile</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {discoveryMode === "internal"
            ? "Search observable Growth Engine + CRM records. No scraping, no outbound."
            : "Discover new companies from real-world public sources (Google Places, SERP, business directory). No Apollo, Seamless, Clay, or PDL. Candidates are not automatic leads."}
        </p>
        <div className="mt-4">
          <DiscoveryModeToggle mode={discoveryMode} onChange={setDiscoveryMode} />
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

      {(actionMessage || error) && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {error ?? actionMessage}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
        <IcpTemplateRail
          activeTemplateId={activeTemplateId}
          onSelectTemplate={applyTemplate}
          onCreateCustom={() => {
            setActiveTemplateId(null)
            setFilters(EMPTY_FILTERS)
            setQuery("")
          }}
          savedSearches={savedSearches}
          lists={lists}
          onLoadSavedSearch={loadSavedById}
        />

        <div className="flex min-w-0 flex-col gap-6">
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <GuidedIcpBuilder
              filters={filters}
              onChange={setFilters}
              onApply={() => void runSearch()}
              onClear={() => setFilters(EMPTY_FILTERS)}
            />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">
                Results
                {result ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    {companies.length} companies
                    {result.discovery_mode === "internal" ? ` · ${people.length} contacts` : " · external discovery"}
                  </span>
                ) : null}
              </h2>
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
            </div>
            <div className="flex items-center gap-2">
              <SearchViewToggle view={view} onViewChange={setView} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => runAction("save_search", { saved_search_name: "ICP discovery" })}
              >
                <Bookmark className="mr-1 size-3.5" />
                Save search
              </Button>
            </div>
          </div>

          {showEmpty ? (
            <SearchEmptyState
              onRunQuery={(q) => void runSearch(q)}
              onSelectTemplate={applyTemplate}
              recentSaved={savedSearches}
            />
          ) : view === "card" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {companies.map((row) => (
                <CompanyResultCard
                  key={`${row.source_type}-${row.id}`}
                  row={row}
                  selected={selectedCompany?.id === row.id}
                  onSelect={() => setSelectedCompany(row)}
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
              onSelect={setSelectedCompany}
            />
          )}

          {people.length > 0 ? (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Contacts ({people.length})</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {people.map((row) => (
                  <PersonResultCard key={row.id} row={row} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function CompanyResultsTable({
  rows,
  selectedId,
  onSelect,
}: {
  rows: GrowthProspectSearchCompanyResult[]
  selectedId: string | null
  onSelect: (row: GrowthProspectSearchCompanyResult) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[800px] text-left text-xs">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
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
              <td className="px-3 py-2 font-medium">{row.company_name}</td>
              <td className="px-3 py-2 tabular-nums">{row.lead_score ?? "—"}</td>
              <td className="px-3 py-2 tabular-nums">{row.intent_score ?? "—"}</td>
              <td className="px-3 py-2">{row.buying_stage ?? "—"}</td>
              <td className="px-3 py-2">
                {row.company_match_confidence != null
                  ? `${Math.round(row.company_match_confidence * 100)}%`
                  : "—"}
              </td>
              <td className="px-3 py-2">{row.location ?? "—"}</td>
              <td className="px-3 py-2">{Math.round(row.confidence * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
