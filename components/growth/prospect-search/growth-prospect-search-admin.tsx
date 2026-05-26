"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bookmark,
  ExternalLink,
  Inbox,
  ListPlus,
  Loader2,
  Play,
  Search,
  Workflow,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GROWTH_PROSPECT_SEARCH_EXAMPLE_QUERIES,
  GROWTH_PROSPECT_SEARCH_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-admin-types"
import type {
  GrowthProspectSearchCompanyResult,
  GrowthProspectSearchFilters,
  GrowthProspectSearchListRow,
  GrowthProspectSearchPersonResult,
  GrowthProspectSearchResult,
  GrowthProspectSearchSavedSearchRow,
} from "@/lib/growth/prospect-search/prospect-search-types"
import { cn } from "@/lib/utils"

const EMPTY_FILTERS: GrowthProspectSearchFilters = {}

export function GrowthProspectSearchAdmin() {
  const [query, setQuery] = useState("")
  const [filters, setFilters] = useState<GrowthProspectSearchFilters>(EMPTY_FILTERS)
  const [result, setResult] = useState<GrowthProspectSearchResult | null>(null)
  const [savedSearches, setSavedSearches] = useState<GrowthProspectSearchSavedSearchRow[]>([])
  const [lists, setLists] = useState<GrowthProspectSearchListRow[]>([])
  const [selectedCompany, setSelectedCompany] = useState<GrowthProspectSearchCompanyResult | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSearch = useCallback(async (queryOverride?: string) => {
    const q = queryOverride ?? query
    if (queryOverride) setQuery(queryOverride)
    setLoading(true)
    setError(null)
    setActionMessage(null)
    try {
      const params = new URLSearchParams({ meta: "1", q })
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
      if (json.result.companies[0]) setSelectedCompany(json.result.companies[0])
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [query, filters])

  useEffect(() => {
    void runSearch()
  }, [])

  const runAction = useCallback(
    async (
      action: string,
      extra?: Record<string, unknown>,
    ) => {
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
            company: selectedCompany,
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

  const icpFields = useMemo(
    () => (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <FilterField
          label="Industry"
          value={filters.industry ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, industry: v || null }))}
        />
        <FilterField
          label="Subindustry"
          value={filters.subindustry ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, subindustry: v || null }))}
        />
        <FilterField
          label="Location"
          value={filters.location ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, location: v || null }))}
        />
        <FilterField
          label="Service area"
          value={filters.service_area ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, service_area: v || null }))}
        />
        <FilterField
          label="CRM detected"
          value={filters.crm_detected ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, crm_detected: v || null }))}
        />
        <FilterField
          label="Field service software"
          value={filters.field_service_software ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, field_service_software: v || null }))}
        />
        <FilterField
          label="Intent score min"
          type="number"
          value={filters.intent_score_min != null ? String(filters.intent_score_min) : ""}
          onChange={(v) =>
            setFilters((f) => ({
              ...f,
              intent_score_min: v ? Number(v) : null,
            }))
          }
        />
        <FilterField
          label="Lead score min"
          type="number"
          value={filters.lead_score_min != null ? String(filters.lead_score_min) : ""}
          onChange={(v) =>
            setFilters((f) => ({
              ...f,
              lead_score_min: v ? Number(v) : null,
            }))
          }
        />
        <FilterField
          label="Title contains"
          value={filters.title_contains ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, title_contains: v || null }))}
        />
        <div className="flex items-end gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.returning_visitor_only === true}
              onChange={(e) =>
                setFilters((f) => ({ ...f, returning_visitor_only: e.target.checked }))
              }
              className="rounded border-border"
            />
            Returning visitor only
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Existing accounts</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={filters.existing_account_mode ?? "any"}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                existing_account_mode: e.target.value as GrowthProspectSearchFilters["existing_account_mode"],
              }))
            }
          >
            <option value="any">Any</option>
            <option value="exclude">Exclude existing</option>
            <option value="include_only">Existing only</option>
          </select>
        </div>
      </div>
    ),
    [filters],
  )

  return (
    <div className="flex flex-col gap-6" data-qa-marker={GROWTH_PROSPECT_SEARCH_QA_MARKER}>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground">Search</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Natural-language + ICP filters over observable Growth Engine and CRM records — no scraping or outbound.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder='e.g. "hvac companies 20-100 employees"'
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void runSearch()}
            />
          </div>
          <Button onClick={() => void runSearch()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {GROWTH_PROSPECT_SEARCH_EXAMPLE_QUERIES.map((ex) => (
            <button
              key={ex.query}
              type="button"
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              onClick={() => void runSearch(ex.query)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">ICP Builder</h2>
        <div className="mt-3">{icpFields}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
          <Button variant="outline" size="sm" onClick={() => void runSearch()}>
            Apply & search
          </Button>
        </div>
      </section>

      {(actionMessage || error) && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {error ?? actionMessage}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <aside className="rounded-xl border border-border bg-card p-3 lg:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Saved searches
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {savedSearches.length === 0 && (
              <li className="text-muted-foreground">None yet</li>
            )}
            {savedSearches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    setQuery(s.query_text)
                    setFilters(s.filters)
                    void runSearch()
                  }}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lists
          </h3>
          <ul className="mt-2 space-y-1 text-sm">
            {lists.length === 0 && <li className="text-muted-foreground">None yet</li>}
            {lists.map((l) => (
              <li key={l.id} className="px-2 py-1">
                {l.name}
                <span className="text-muted-foreground"> ({l.member_count})</span>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <ResultToolbar
            selected={selectedCompany}
            onAction={runAction}
          />

          <CompanyTable
            rows={result?.companies ?? []}
            selectedId={selectedCompany?.id ?? null}
            onSelect={setSelectedCompany}
          />

          <PeopleTable rows={result?.people ?? []} />
        </div>
      </div>
    </div>
  )
}

function FilterField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
    </div>
  )
}

function ResultToolbar({
  selected,
  onAction,
}: {
  selected: GrowthProspectSearchCompanyResult | null
  onAction: (action: string, extra?: Record<string, unknown>) => Promise<void>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => onAction("save_search", { saved_search_name: "ICP search" })}>
        <Bookmark className="mr-1 size-3.5" />
        Save search
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!selected}
        onClick={() => onAction("create_list", { list_name: selected?.company_name ?? "List" })}
      >
        <ListPlus className="mr-1 size-3.5" />
        Create list
      </Button>
      <Button variant="outline" size="sm" disabled={!selected} onClick={() => onAction("push_to_lead_inbox")}>
        <Inbox className="mr-1 size-3.5" />
        Push to Lead Inbox
      </Button>
      <Button variant="outline" size="sm" disabled={!selected} onClick={() => onAction("run_lead_engine")}>
        <Workflow className="mr-1 size-3.5" />
        Run Lead Engine
      </Button>
      <Button variant="outline" size="sm" disabled={!selected} onClick={() => onAction("open_workspace")}>
        <ExternalLink className="mr-1 size-3.5" />
        Open workspace
      </Button>
      <Button variant="ghost" size="sm" disabled title="CSV export — future only">
        <Play className="mr-1 size-3.5 opacity-40" />
        Export CSV (future)
      </Button>
    </div>
  )
}

function CompanyTable({
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
      <h3 className="border-b border-border px-3 py-2 text-sm font-semibold">
        Companies ({rows.length})
      </h3>
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-2 py-2">Company</th>
            <th className="px-2 py-2">Website</th>
            <th className="px-2 py-2">Industry</th>
            <th className="px-2 py-2">Employees</th>
            <th className="px-2 py-2">Location</th>
            <th className="px-2 py-2">Intent</th>
            <th className="px-2 py-2">Buying stage</th>
            <th className="px-2 py-2">Lead score</th>
            <th className="px-2 py-2">Confidence</th>
            <th className="px-2 py-2">DM coverage</th>
            <th className="px-2 py-2">Signals</th>
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
              <td className="px-2 py-2 font-medium">{row.company_name}</td>
              <td className="px-2 py-2 text-muted-foreground">{row.website ?? "—"}</td>
              <td className="px-2 py-2">{row.industry ?? "—"}</td>
              <td className="px-2 py-2">{row.employees ?? "—"}</td>
              <td className="px-2 py-2">{row.location ?? "—"}</td>
              <td className="px-2 py-2">{row.intent_score ?? "—"}</td>
              <td className="px-2 py-2">{row.buying_stage ?? "—"}</td>
              <td className="px-2 py-2">{row.lead_score ?? "—"}</td>
              <td className="px-2 py-2">{row.confidence.toFixed(2)}</td>
              <td className="px-2 py-2">
                {row.decision_maker_coverage != null
                  ? `${Math.round(row.decision_maker_coverage * 100)}%`
                  : "—"}
              </td>
              <td className="max-w-[140px] truncate px-2 py-2" title={row.signals.join("; ")}>
                {row.signals[0] ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PeopleTable({ rows }: { rows: GrowthProspectSearchPersonResult[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-3 py-2 text-sm font-semibold">
        Contacts ({rows.length})
      </h3>
      <table className="w-full min-w-[600px] text-left text-xs">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-2 py-2">Name</th>
            <th className="px-2 py-2">Company</th>
            <th className="px-2 py-2">Title</th>
            <th className="px-2 py-2">Email</th>
            <th className="px-2 py-2">Verification</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-2 py-2">{row.full_name ?? "—"}</td>
              <td className="px-2 py-2">{row.company_name}</td>
              <td className="px-2 py-2">{row.title ?? "—"}</td>
              <td className="px-2 py-2">{row.email ?? "—"}</td>
              <td className="px-2 py-2">{row.verification_status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
