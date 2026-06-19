"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, MoreHorizontal, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_LEADS_HUB_FAVORITE_SAVED_SEARCHES_LIMIT,
  GROWTH_LEADS_HUB_SAVED_SEARCHES_EMPTY,
  growthLeadsHubSavedSearchBadges,
  growthLeadsHubSavedSearchIsScheduled,
  growthLeadsHubSavedSearchResultDeltaLabel,
  growthLeadsHubSavedSearchRunHref,
  growthLeadsHubSavedSearchScheduleLabel,
} from "@/lib/growth/hubs/growth-leads-hub-config"
import { fetchGrowthLeadsHubSavedSearches } from "@/lib/growth/hubs/growth-leads-hub-search-client"
import {
  formatSavedSearchRefreshedAt,
  type GrowthProspectSearchSavedSearchWithWorkflow,
} from "@/lib/growth/prospect-search/saved-search-workflows"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { cn } from "@/lib/utils"

const FAVORITES_KEY = "equipify:growth-leads-hub:saved-search-favorites/v1" as const

function readFavoriteIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    const parsed = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function writeFavoriteIds(ids: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

function SavedSearchCard({
  saved,
  favorite,
}: {
  saved: GrowthProspectSearchSavedSearchWithWorkflow
  favorite: boolean
}) {
  const runHref = growthLeadsHubSavedSearchRunHref(saved.id)
  const badges = growthLeadsHubSavedSearchBadges(saved, favorite)
  const scheduleLabel = growthLeadsHubSavedSearchScheduleLabel(saved)
  const deltaLabel = growthLeadsHubSavedSearchResultDeltaLabel(saved)

  return (
    <article className="rounded-xl border border-border/80 bg-background p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {badges.slice(0, 1).map((badge) => (
              <span key={badge} className="text-xs font-medium text-muted-foreground">
                {badge}
              </span>
            ))}
            <Link href={runHref} className="truncate font-semibold text-foreground hover:text-primary">
              {saved.name}
            </Link>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {saved.workflow.resultCount != null
              ? `${saved.workflow.resultCount.toLocaleString()} results`
              : "— results"}
          </p>
          {deltaLabel ? <p className="mt-0.5 text-xs font-medium text-primary">{deltaLabel}</p> : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            Last run: {formatSavedSearchRefreshedAt(saved.workflow.lastRefreshedAt)}
            {scheduleLabel ? ` · ${scheduleLabel}` : ""}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link
            href={runHref}
            onClick={() =>
              recordGrowthLeadsActivity({
                id: `search:${saved.id}`,
                verb: "Ran",
                label: saved.name,
                href: runHref,
              })
            }
          >
            Run
          </Link>
        </Button>
      </div>
    </article>
  )
}

function SavedSearchRowActions({ saved, favorite, onToggleFavorite }: {
  saved: GrowthProspectSearchSavedSearchWithWorkflow
  favorite: boolean
  onToggleFavorite: (id: string) => void
}) {
  const runHref = growthLeadsHubSavedSearchRunHref(saved.id)
  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button asChild size="sm" variant="outline">
        <Link href={runHref}>Run</Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" aria-label={`More actions for ${saved.name}`}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={runHref}>Open in Prospect Search</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}>New search</Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleFavorite(saved.id)}>
            {favorite ? "Remove favorite" : "Mark as favorite"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function GrowthLeadsHubFavoriteSavedSearches() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<GrowthProspectSearchSavedSearchWithWorkflow[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavoriteIds())

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthLeadsHubSavedSearches(ac.signal)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  const featuredRows = useMemo(() => {
    const favorites = rows
      .filter((row) => favoriteIds.has(row.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, GROWTH_LEADS_HUB_FAVORITE_SAVED_SEARCHES_LIMIT)
    const favoriteSet = new Set(favorites.map((row) => row.id))
    const scheduled = rows
      .filter((row) => growthLeadsHubSavedSearchIsScheduled(row) && !favoriteSet.has(row.id))
      .sort((a, b) => a.name.localeCompare(b.name))
    return [...favorites, ...scheduled]
  }, [rows, favoriteIds])

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeFavoriteIds(next)
      return next
    })
  }

  return (
    <section id="saved-searches" aria-labelledby="leads-hub-favorite-searches-heading" data-section="favorite-saved-searches">
      <GrowthEngineCard title="Favorite Saved Searches" data-section="saved-searches">
        <h2 id="leads-hub-favorite-searches-heading" className="sr-only">
          Favorite saved searches
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 px-1 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading saved searches…
          </div>
        ) : featuredRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            <p>{GROWTH_LEADS_HUB_SAVED_SEARCHES_EMPTY}</p>
            <Link
              href={GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF}
              className="mt-3 inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              Open Prospect Search
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredRows.map((saved) => (
                <SavedSearchCard key={saved.id} saved={saved} favorite={favoriteIds.has(saved.id)} />
              ))}
            </div>
            <div className="mt-4 border-t border-border/60 pt-3">
              <Link
                href="#saved-searches-all"
                className="inline-flex text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                View All Saved Searches →
              </Link>
            </div>
          </>
        )}
      </GrowthEngineCard>
    </section>
  )
}

export function GrowthLeadsHubAllSavedSearches() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<GrowthProspectSearchSavedSearchWithWorkflow[]>([])
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavoriteIds())

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthLeadsHubSavedSearches(ac.signal)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
    return () => ac.abort()
  }, [])

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aFav = favoriteIds.has(a.id) ? 1 : 0
      const bFav = favoriteIds.has(b.id) ? 1 : 0
      if (aFav !== bFav) return bFav - aFav
      return a.name.localeCompare(b.name)
    })
  }, [rows, favoriteIds])

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeFavoriteIds(next)
      return next
    })
  }

  if (loading || sortedRows.length === 0) return null

  return (
    <section id="saved-searches-all" aria-labelledby="leads-hub-all-searches-heading" data-section="all-saved-searches">
      <GrowthEngineCard title="All Saved Searches" data-section="all-saved-searches">
        <h2 id="leads-hub-all-searches-heading" className="sr-only">
          All saved searches
        </h2>
        <div className="hidden overflow-x-auto rounded-lg border border-border/80 md:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/20 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="w-10 px-3 py-2">
                  <span className="sr-only">Favorite</span>
                </th>
                <th scope="col" className="px-3 py-2">
                  Name
                </th>
                <th scope="col" className="px-3 py-2">
                  Last Run
                </th>
                <th scope="col" className="px-3 py-2">
                  Result Count
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((saved) => {
                const favorite = favoriteIds.has(saved.id)
                const runHref = growthLeadsHubSavedSearchRunHref(saved.id)
                return (
                  <tr key={saved.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        aria-label={favorite ? `Unfavorite ${saved.name}` : `Favorite ${saved.name}`}
                        aria-pressed={favorite}
                        onClick={() => toggleFavorite(saved.id)}
                        className={cn(
                          "rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                          favorite ? "text-amber-500" : "text-muted-foreground hover:text-amber-500",
                        )}
                      >
                        <Star className={cn("size-4", favorite && "fill-current")} />
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      <Link href={runHref} className="truncate font-medium text-foreground hover:text-primary">
                        {saved.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatSavedSearchRefreshedAt(saved.workflow.lastRefreshedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                      {saved.workflow.resultCount != null ? saved.workflow.resultCount.toLocaleString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <SavedSearchRowActions saved={saved} favorite={favorite} onToggleFavorite={toggleFavorite} />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <ul className="space-y-2 md:hidden">
          {sortedRows.map((saved) => (
            <li key={saved.id} className="rounded-lg border border-border/80 px-3 py-3">
              <SavedSearchCard saved={saved} favorite={favoriteIds.has(saved.id)} />
            </li>
          ))}
        </ul>
      </GrowthEngineCard>
    </section>
  )
}
