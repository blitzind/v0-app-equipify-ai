"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  GROWTH_LEADS_HUB_SEARCH_EMPTY_HINT,
  GROWTH_LEADS_HUB_SEARCH_PLACEHOLDER,
} from "@/lib/growth/hubs/growth-leads-hub-config"
import {
  fetchGrowthLeadsHubSavedSearches,
  GROWTH_LEADS_HUB_SEARCH_QA_MARKER,
  runGrowthLeadsHubSearch,
  type GrowthLeadsHubSearchGroup,
} from "@/lib/growth/hubs/growth-leads-hub-search-client"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import { cn } from "@/lib/utils"

const DEBOUNCE_MS = 280

export function GrowthLeadsHubSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [groups, setGroups] = useState<GrowthLeadsHubSearchGroup[]>([])
  const [savedSearches, setSavedSearches] = useState<GrowthProspectSearchSavedSearchWithWorkflow[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthLeadsHubSavedSearches(ac.signal)
      .then(setSavedSearches)
      .catch(() => setSavedSearches([]))
    return () => ac.abort()
  }, [])

  const flatResults = useMemo(
    () => groups.flatMap((group) => group.results.map((result) => ({ group, result }))),
    [groups],
  )

  const runSearch = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (trimmed.length < 2) {
        setGroups([])
        setError(null)
        setLoading(false)
        return
      }

      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setError(null)

      try {
        const nextGroups = await runGrowthLeadsHubSearch(trimmed, savedSearches, ac.signal)
        setGroups(nextGroups)
        setOpen(true)
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return
        setGroups([])
        setError("Search failed.")
      } finally {
        setLoading(false)
      }
    },
    [savedSearches],
  )

  useEffect(() => {
    const id = window.setTimeout(() => void runSearch(query), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [query, runSearch])

  useEffect(() => () => abortRef.current?.abort(), [])

  function navigateTo(href: string) {
    setOpen(false)
    setActiveIndex(-1)
    router.push(href)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp") && flatResults.length > 0) {
      setOpen(true)
      setActiveIndex(0)
      event.preventDefault()
      return
    }

    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === "Enter" && activeIndex >= 0 && flatResults[activeIndex]) {
      event.preventDefault()
      navigateTo(flatResults[activeIndex]!.result.href)
    } else if (event.key === "Escape") {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const showPanel = open && query.trim().length >= 2
  const showEmpty = showPanel && !loading && !error && flatResults.length === 0

  return (
    <section aria-labelledby="leads-hub-search-heading" data-qa-marker={GROWTH_LEADS_HUB_SEARCH_QA_MARKER}>
      <h2 id="leads-hub-search-heading" className="sr-only">
        Search leads workspace
      </h2>
      <div ref={rootRef} className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
              setActiveIndex(-1)
            }}
            onFocus={() => {
              if (query.trim().length >= 2) setOpen(true)
            }}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 150)
            }}
            onKeyDown={onKeyDown}
            placeholder={GROWTH_LEADS_HUB_SEARCH_PLACEHOLDER}
            aria-label="Search companies, contacts, leads, campaigns, meetings, calls, saved searches, share pages, and videos"
            aria-expanded={showPanel}
            aria-controls="leads-hub-search-results"
            aria-autocomplete="list"
            role="combobox"
            className="h-11 pl-10"
            data-section="global-search"
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        {showPanel ? (
          <div
            id="leads-hub-search-results"
            role="listbox"
            aria-label="Search results"
            className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
          >
            {error ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
                <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => void runSearch(query)}>
                  Retry
                </Button>
              </div>
            ) : null}
            {showEmpty ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{GROWTH_LEADS_HUB_SEARCH_EMPTY_HINT}</p>
            ) : null}
            {!error && flatResults.length > 0 ? (
              <div className="max-h-80 overflow-y-auto py-2">
                {groups.map((group) => (
                  <div key={group.id}>
                    <p className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.label}
                    </p>
                    <ul>
                      {group.results.map((result) => {
                        const flatIndex = flatResults.findIndex(
                          (entry) => entry.result.id === result.id && entry.group.id === group.id,
                        )
                        const active = flatIndex === activeIndex
                        return (
                          <li key={result.id}>
                            <Link
                              href={result.href}
                              role="option"
                              aria-selected={active}
                              className={cn(
                                "block px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                                active && "bg-muted/40",
                              )}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => navigateTo(result.href)}
                            >
                              <span className="block font-medium text-foreground">{result.title}</span>
                              <span className="mt-0.5 block text-xs text-muted-foreground">{result.subtitle}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
