"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"

type Props = {
  organizationId: string | null
  orgReady: boolean
}

const DEBOUNCE_MS = 280

export function GlobalSearchHeader({ organizationId, orgReady }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [groups, setGroups] = useState<GlobalSearchGroup[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const runSearch = useCallback(
    async (q: string) => {
      if (!organizationId || !orgReady || q.trim().length < 2) {
        setGroups([])
        setFetchError(null)
        setLoading(false)
        return
      }
      abortRef.current?.abort()
      const ac = new AbortController()
      abortRef.current = ac
      setLoading(true)
      setFetchError(null)
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/global-search?q=${encodeURIComponent(q)}`,
          { signal: ac.signal, cache: "no-store" },
        )
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          groups?: GlobalSearchGroup[]
          message?: string
        }
        if (!res.ok) {
          setGroups([])
          setFetchError(body.message ?? "Search failed.")
          return
        }
        setGroups(body.groups ?? [])
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return
        setGroups([])
        setFetchError("Search failed.")
      } finally {
        setLoading(false)
      }
    },
    [organizationId, orgReady],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setGroups([])
      setFetchError(null)
      setLoading(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(query)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, runSearch])

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocMouseDown)
    return () => document.removeEventListener("mousedown", onDocMouseDown)
  }, [open])

  const disabled = !organizationId || !orgReady

  function handleSelect(href: string) {
    setOpen(false)
    setQuery("")
    setGroups([])
    router.push(href)
  }

  const showPanel = open && !disabled && query.trim().length >= 2

  return (
    <div ref={rootRef} className={cn("relative flex-1 max-w-sm", "hidden md:block")}>
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
          type="search"
          autoComplete="off"
          disabled={disabled}
          role="combobox"
          aria-label="Search workspace"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          placeholder={
            disabled
              ? organizationId
                ? "Loading workspace…"
                : "Select a workspace to search"
              : "Search customers, equipment, work orders…"
          }
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground min-w-0 disabled:cursor-not-allowed"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
            if (!disabled) setOpen(true)
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => setOpen(false), 180)
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault()
              setOpen(false)
            }
          }}
        />
        {loading ? <Loader2 className="w-4 h-4 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>

      {showPanel ? (
        <div
          id="global-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[min(70vh,420px)] overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-lg"
        >
          {fetchError ? (
            <p className="px-3 py-4 text-sm text-destructive">{fetchError}</p>
          ) : groups.length === 0 && !loading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No matches in this workspace.</p>
          ) : (
            <div className="py-1">
              {groups.map((g) => (
                <div key={g.id} className="px-1 pb-2">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </p>
                  <ul className="space-y-0.5">
                    {g.results.map((r) => (
                      <li key={`${r.kind}:${r.href}`}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={false}
                          className="w-full rounded-md px-2 py-2 text-left text-sm transition-colors ds-hover-list-row focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelect(r.href)}
                        >
                          <span className="font-medium text-foreground line-clamp-1">{r.title}</span>
                          {r.subtitle ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-1">
                              {r.subtitle}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
