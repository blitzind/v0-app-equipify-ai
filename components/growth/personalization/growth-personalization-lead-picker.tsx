"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { CallWorkspaceLeadSearchResult } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import { resolveCallWorkspaceAttachLeadId } from "@/lib/growth/native-dialer/call-workspace-lead-search-types"
import {
  GROWTH_PERSONALIZATION_LEAD_SEARCH_DEBOUNCE_MS,
  isUuidLike,
  persistRecentPersonalizationLead,
  readRecentPersonalizationLeads,
  type GrowthPersonalizationRecentLeadSelection,
} from "@/lib/growth/personalization/personalization-generation-ux"

function parseSearchResponse(data: {
  results?: CallWorkspaceLeadSearchResult[]
  leads?: CallWorkspaceLeadSearchResult[]
  entities?: CallWorkspaceLeadSearchResult[]
}): CallWorkspaceLeadSearchResult[] {
  return data.results ?? data.leads ?? data.entities ?? []
}

function hitToRecentSelection(hit: CallWorkspaceLeadSearchResult, leadId: string): GrowthPersonalizationRecentLeadSelection {
  return persistRecentPersonalizationLead({
    leadId,
    companyName: hit.companyName || hit.displayName,
    contactName: hit.contactName,
    industryLabel: null,
    territoryLabel: hit.domain ? hit.domain : null,
    email: hit.email ?? hit.contactEmail,
  })[0]!
}

export type GrowthPersonalizationLeadPickerSelection = GrowthPersonalizationRecentLeadSelection

export function GrowthPersonalizationLeadPicker({
  selectedLeadId,
  onSelect,
}: {
  selectedLeadId: string | null
  onSelect: (selection: GrowthPersonalizationLeadPickerSelection) => void
}) {
  const [query, setQuery] = useState("")
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [results, setResults] = useState<CallWorkspaceLeadSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recent, setRecent] = useState<GrowthPersonalizationRecentLeadSelection[]>([])
  const [selectedCard, setSelectedCard] = useState<GrowthPersonalizationRecentLeadSelection | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setRecent(readRecentPersonalizationLeads())
  }, [])

  const runSearch = useCallback(async (searchQuery: string) => {
    const trimmed = searchQuery.trim()
    if (trimmed.length < 2 && !isUuidLike(trimmed)) {
      setResults([])
      setSearchError(null)
      setSearching(false)
      return
    }

    setSearching(true)
    setSearchError(null)
    try {
      const res = await fetch(
        `/api/platform/growth/calls/workspace/leads/search?q=${encodeURIComponent(trimmed)}`,
        { cache: "no-store" },
      )
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        results?: CallWorkspaceLeadSearchResult[]
        leads?: CallWorkspaceLeadSearchResult[]
        entities?: CallWorkspaceLeadSearchResult[]
        message?: string
      }
      if (!res.ok || data.ok === false) {
        throw new Error(data.message ?? "Search failed.")
      }
      setResults(parseSearchResponse(data))
      setOpen(true)
    } catch (error) {
      setResults([])
      setSearchError(error instanceof Error ? error.message : "Search failed.")
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(query), GROWTH_PERSONALIZATION_LEAD_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query, runSearch])

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedCard(null)
      return
    }
    const fromRecent = readRecentPersonalizationLeads().find((entry) => entry.leadId === selectedLeadId)
    if (fromRecent) setSelectedCard(fromRecent)
  }, [selectedLeadId])

  const flatSelectable = useMemo(() => {
    if (query.trim().length >= 2 || isUuidLike(query)) return results
    return []
  }, [query, results])

  function applySelection(selection: GrowthPersonalizationRecentLeadSelection) {
    setSelectedCard(selection)
    setRecent(readRecentPersonalizationLeads())
    setOpen(false)
    setActiveIndex(-1)
    onSelect(selection)
  }

  function selectHit(hit: CallWorkspaceLeadSearchResult) {
    const leadId = resolveCallWorkspaceAttachLeadId(hit)
    if (!leadId) {
      setSearchError("This result does not have a Growth lead yet. Promote or attach a lead first.")
      return
    }
    applySelection(hitToRecentSelection(hit, leadId))
  }

  function selectRecent(entry: GrowthPersonalizationRecentLeadSelection) {
    applySelection(persistRecentPersonalizationLead(entry)[0]!)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
      if (flatSelectable.length > 0 || recent.length > 0) setOpen(true)
    }
    const items = flatSelectable.length > 0 ? flatSelectable : recent
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, items.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault()
      if (flatSelectable.length > 0) {
        selectHit(flatSelectable[activeIndex]!)
      } else if (recent[activeIndex]) {
        selectRecent(recent[activeIndex]!)
      }
    } else if (event.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const showPanel = open && (flatSelectable.length > 0 || recent.length > 0 || searching || searchError)
  const singleResult = flatSelectable.length === 1 && !searching

  return (
    <div className="space-y-3" data-qa="growth-personalization-lead-picker">
      <div>
        <p className="text-sm font-medium">Generate Personalization</p>
        <p className="text-xs text-muted-foreground">Lead or Company</p>
      </div>

      <div ref={rootRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Search leads, companies, contacts..."
          aria-label="Search leads, companies, contacts"
          aria-expanded={Boolean(showPanel)}
          aria-autocomplete="list"
          role="combobox"
          className="pl-10"
        />
        {searching ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}

      {showPanel ? (
        <div className="rounded-lg border border-border/70 bg-card p-2 shadow-sm">
          {searching ? <p className="px-2 py-1 text-xs text-muted-foreground">Searching…</p> : null}
          {!searching && flatSelectable.length === 0 && query.trim().length >= 2 ? (
            <p className="px-2 py-1 text-xs text-muted-foreground">No matching leads or companies.</p>
          ) : null}

          {flatSelectable.length > 1 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto" role="listbox">
              {flatSelectable.map((hit, index) => (
                <li key={`${hit.source}:${hit.id}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeIndex === index}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted/60 ${
                      activeIndex === index ? "bg-muted/60" : ""
                    }`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectHit(hit)}
                  >
                    <span className="mt-0.5 text-muted-foreground">○</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{hit.companyName || hit.displayName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.contactName ?? hit.displayName}
                        {hit.email ? ` · ${hit.email}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {singleResult ? (
            <button
              type="button"
              className="w-full rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-left text-sm text-emerald-950"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectHit(flatSelectable[0]!)}
            >
              <div className="flex items-center gap-2 font-medium">
                <Check className="size-4" />
                {flatSelectable[0]!.companyName || flatSelectable[0]!.displayName}
              </div>
              <p className="mt-1 text-xs">{flatSelectable[0]!.contactName ?? "Contact unavailable"}</p>
              <p className="text-xs text-emerald-900/80">
                {flatSelectable[0]!.email ?? flatSelectable[0]!.domain ?? "—"}
              </p>
            </button>
          ) : null}

          {!query.trim() || (query.trim().length < 2 && !isUuidLike(query)) ? (
            <div className="mt-1 space-y-1">
              <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Recent</p>
              {recent.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">Recent selections appear here after you generate.</p>
              ) : (
                <ul className="space-y-1">
                  {recent.map((entry, index) => (
                    <li key={entry.leadId}>
                      <button
                        type="button"
                        className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60 ${
                          selectedLeadId === entry.leadId ? "bg-violet-50/80" : ""
                        } ${activeIndex === index ? "bg-muted/60" : ""}`}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectRecent(entry)}
                      >
                        <span className="truncate font-medium">{entry.companyName}</span>
                        {selectedLeadId === entry.leadId ? <GrowthBadge label="Selected" tone="healthy" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {selectedCard ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Check className="size-4 text-violet-700" />
            <span className="font-medium">{selectedCard.companyName}</span>
            {selectedCard.industryLabel ? <GrowthBadge label={selectedCard.industryLabel} tone="neutral" /> : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {[selectedCard.contactName, selectedCard.territoryLabel, selectedCard.email].filter(Boolean).join(" · ") ||
              "Lead selected"}
          </p>
        </div>
      ) : null}

      {isUuidLike(query.trim()) && !selectedCard ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            applySelection(
              persistRecentPersonalizationLead({
                leadId: query.trim(),
                companyName: `Lead ${query.trim().slice(0, 8)}…`,
              })[0]!,
            )
          }
        >
          Use lead ID
        </Button>
      ) : null}
    </div>
  )
}
