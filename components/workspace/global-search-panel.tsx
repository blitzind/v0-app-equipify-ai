"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"
import { WORKSPACE_SEARCH_INTERACTION_QA_MARKER } from "@/lib/workspace/workspace-search-interactions"
import {
  readGrowthWorkspaceSearchRecent,
  type GrowthWorkspaceSearchRecentEntry,
} from "@/lib/workspace/growth-workspace-search-recent"
import {
  WorkspaceSearchResultIcon,
  WorkspaceSearchResultsSkeleton,
} from "@/components/workspace/workspace-search-result-icon"

const DEBOUNCE_MS = 280

export type GlobalSearchPanelProps = {
  disabled?: boolean
  disabledPlaceholder?: string
  placeholder: string
  emptyHint: string
  groups: GlobalSearchGroup[]
  loading: boolean
  fetchError: string | null
  query: string
  onQueryChange: (value: string) => void
  onRetry?: () => void
  className?: string
  qaMarker?: string
  /** When true, Cmd/Ctrl+K focuses the search input (Core only — Growth uses Cmd+K for command palette). */
  keyboardShortcutEnabled?: boolean
  enableRecentSearches?: boolean
}

export function GlobalSearchPanel({
  disabled = false,
  disabledPlaceholder = "Select a workspace to search",
  placeholder,
  emptyHint,
  groups,
  loading,
  fetchError,
  query,
  onQueryChange,
  onRetry,
  className,
  qaMarker,
  keyboardShortcutEnabled = false,
  enableRecentSearches = false,
}: GlobalSearchPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [recentSearches, setRecentSearches] = useState<GrowthWorkspaceSearchRecentEntry[]>([])
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const flatResults = useMemo(
    () =>
      groups.flatMap((group) =>
        group.results.map((result) => ({ group, result })),
      ),
    [groups],
  )

  useEffect(() => {
    setOpen(false)
    setActiveIndex(-1)
  }, [pathname])

  useEffect(() => {
    if (!enableRecentSearches || !open) return
    setRecentSearches(readGrowthWorkspaceSearchRecent())
  }, [enableRecentSearches, open])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [open])

  useEffect(() => {
    if (!keyboardShortcutEnabled || disabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return
      if (event.key.toLowerCase() !== "k") return
      event.preventDefault()
      inputRef.current?.focus()
      setOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [disabled, keyboardShortcutEnabled])

  useEffect(() => {
    setActiveIndex(flatResults.length > 0 ? 0 : -1)
  }, [flatResults])

  const showPanel = open && !disabled && (query.trim().length >= 2 || (enableRecentSearches && query.trim().length === 0))
  const showRecentPanel = enableRecentSearches && open && !disabled && query.trim().length === 0 && recentSearches.length > 0
  const showResultsPanel = open && !disabled && query.trim().length >= 2

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false)
      setActiveIndex(-1)
      onQueryChange("")
      router.push(href)
    },
    [onQueryChange, router],
  )

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setActiveIndex(-1)
      return
    }

    if (!showPanel || flatResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((prev) => (prev + 1) % flatResults.length)
      return
    }

    if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((prev) => (prev <= 0 ? flatResults.length - 1 : prev - 1))
      return
    }

    if (e.key === "Enter" && activeIndex >= 0 && activeIndex < flatResults.length) {
      e.preventDefault()
      handleSelect(flatResults[activeIndex]!.result.href)
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative flex-1 max-w-sm", "hidden md:block", className)}
      data-workspace-search-interaction={WORKSPACE_SEARCH_INTERACTION_QA_MARKER}
      {...(qaMarker ? { "data-qa-marker": qaMarker } : {})}
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border px-3 py-1.5 bg-background transition-all duration-150",
          disabled ? "opacity-60 border-border" : null,
          open && !disabled
            ? "border-primary ring-2 ring-primary/20 shadow-[0_0_0_3px_rgba(15,122,229,0.08)]"
            : "border-border hover:border-border/80",
        )}
      >
        <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-label="Search workspace"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-activedescendant={
            showPanel && activeIndex >= 0 ? `global-search-option-${activeIndex}` : undefined
          }
          placeholder={disabled ? disabledPlaceholder : placeholder}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0 disabled:cursor-not-allowed focus-visible:ring-0"
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
            if (!disabled) setOpen(true)
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => {
              setOpen(false)
              setActiveIndex(-1)
            }, 180)
          }}
          onKeyDown={handleInputKeyDown}
        />
        {loading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {showRecentPanel ? (
            <div className="py-1">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Recent searches
              </p>
              <ul className="space-y-0.5 px-1 pb-2">
                {recentSearches.map((entry) => (
                  <li key={`${entry.query}:${entry.searchedAt}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ds-hover-list-row"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onQueryChange(entry.query)
                        setOpen(true)
                      }}
                    >
                      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="font-medium text-foreground">{entry.query}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showResultsPanel && fetchError ? (
            <div className="px-4 py-5 text-center space-y-2">
              <AlertCircle className="mx-auto h-8 w-8 text-destructive/80" aria-hidden />
              <p className="text-sm font-medium text-destructive">{fetchError}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Check your connection, then try again or refine your search.
              </p>
              {onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={onRetry}
                >
                  Retry search
                </Button>
              ) : null}
            </div>
          ) : showResultsPanel && loading ? (
            <WorkspaceSearchResultsSkeleton />
          ) : showResultsPanel && groups.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center space-y-2">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/45" aria-hidden />
              <p className="text-sm font-medium text-foreground">No matches</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{emptyHint}</p>
            </div>
          ) : showResultsPanel ? (
            <div className="py-1">
              {groups.map((g) => (
                <div key={g.id} className="px-1 pb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </p>
                  <ul className="space-y-0.5">
                    {g.results.map((r) => {
                      const flatIndex = flatResults.findIndex(
                        (row) => row.result.kind === r.kind && row.result.href === r.href,
                      )
                      const selected = flatIndex === activeIndex
                      return (
                        <li key={`${r.kind}:${r.href}`}>
                          <button
                            id={flatIndex >= 0 ? `global-search-option-${flatIndex}` : undefined}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ds-hover-list-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
                              selected && "bg-accent/60",
                            )}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => {
                              if (flatIndex >= 0) setActiveIndex(flatIndex)
                            }}
                            onClick={() => handleSelect(r.href)}
                          >
                            <WorkspaceSearchResultIcon kind={r.kind} />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium text-foreground line-clamp-1">{r.title}</span>
                              {r.subtitle ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                                  {r.subtitle}
                                </span>
                              ) : null}
                            </span>
                          </button>
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
  )
}

export { DEBOUNCE_MS as WORKSPACE_SEARCH_DEBOUNCE_MS }
