"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { WatchlistIntelligenceInsightCard } from "@/components/growth/intent-signals/intent-signals-watchlist-insight-card"
import { GROWTH_INTENT_SIGNALS_WATCHLISTS_QA_MARKER } from "@/components/growth/intent-signals/intent-signals-ux-constants"
import { buildWatchlistSignalCopilotSummary } from "@/lib/growth/signals/ai/signal-copilot-safe-summary"
import type { SignalCopilotWatchlistSummary } from "@/lib/growth/signals/ai/signal-copilot-types"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import type { GrowthSignalWatchlistRow } from "@/lib/growth/signals/signal-watchlist-types"

export type IntentSignalsWatchlistSelection = {
  watchlistId: string | null
  watchlist: GrowthSignalWatchlistRow | null
}

export function IntentSignalsWatchlistBar({
  selection,
  onSelectionChange,
  onCreateClick,
  refreshToken,
}: {
  selection: IntentSignalsWatchlistSelection
  onSelectionChange: (next: IntentSignalsWatchlistSelection) => void
  onCreateClick: () => void
  refreshToken?: number
}) {
  const [watchlists, setWatchlists] = useState<GrowthSignalWatchlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [watchlistSignals, setWatchlistSignals] = useState<GrowthSignalRow[]>([])
  const [watchlistInsightLoading, setWatchlistInsightLoading] = useState(false)

  const loadWatchlists = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/signals/watchlists", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: GrowthSignalWatchlistRow[]
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Could not load watchlists.")
      setWatchlists(data.items ?? [])
      if (selection.watchlistId) {
        const match = (data.items ?? []).find((item) => item.id === selection.watchlistId) ?? null
        onSelectionChange({ watchlistId: match?.id ?? null, watchlist: match })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
      setWatchlists([])
    } finally {
      setLoading(false)
    }
  }, [onSelectionChange, selection.watchlistId])

  useEffect(() => {
    void loadWatchlists()
  }, [loadWatchlists, refreshToken])

  const loadWatchlistInsight = useCallback(async (watchlistId: string) => {
    setWatchlistInsightLoading(true)
    try {
      const params = new URLSearchParams({ watchlist_id: watchlistId, limit: "50" })
      const res = await fetch(`/api/platform/growth/signals?${params.toString()}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: GrowthSignalRow[]
      }
      setWatchlistSignals(res.ok && data.ok ? data.items ?? [] : [])
    } catch {
      setWatchlistSignals([])
    } finally {
      setWatchlistInsightLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selection.watchlistId) {
      setWatchlistSignals([])
      return
    }
    void loadWatchlistInsight(selection.watchlistId)
  }, [loadWatchlistInsight, selection.watchlistId, refreshToken, refreshing])

  const watchlistInsight = useMemo((): SignalCopilotWatchlistSummary | null => {
    if (!selection.watchlist) return null
    const topCompanies = Array.from(
      new Set(
        watchlistSignals
          .map((signal) => signal.company_name?.trim() || signal.domain?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    )
    return buildWatchlistSignalCopilotSummary({
      watchlist_name: selection.watchlist.name,
      matched_signals: watchlistSignals,
      top_companies: topCompanies,
    })
  }, [selection.watchlist, watchlistSignals])

  async function refreshSelected() {
    if (!selection.watchlistId) return
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/signals/watchlists/${selection.watchlistId}/refresh`, {
        method: "POST",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        watchlist?: GrowthSignalWatchlistRow
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Refresh failed.")
      if (data.watchlist) {
        onSelectionChange({ watchlistId: data.watchlist.id, watchlist: data.watchlist })
        setWatchlists((prev) => prev.map((item) => (item.id === data.watchlist!.id ? data.watchlist! : item)))
      }
      await loadWatchlists()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refresh failed.")
    } finally {
      setRefreshing(false)
    }
  }

  function handleSelect(value: string) {
    if (value === "all") {
      onSelectionChange({ watchlistId: null, watchlist: null })
      return
    }
    const watchlist = watchlists.find((item) => item.id === value) ?? null
    onSelectionChange({ watchlistId: watchlist?.id ?? null, watchlist })
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
        data-qa-marker={GROWTH_INTENT_SIGNALS_WATCHLISTS_QA_MARKER}
      >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watchlist</span>
        {loading ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Loading watchlists" />
        ) : (
          <Select value={selection.watchlistId ?? "all"} onValueChange={handleSelect}>
            <SelectTrigger className="h-8 w-[220px] text-sm">
              <SelectValue placeholder="All signals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All signals</SelectItem>
              {watchlists.map((watchlist) => (
                <SelectItem key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1" onClick={onCreateClick}>
          <Plus className="size-3.5" />
          Create watchlist
        </Button>
      </div>

      {selection.watchlist ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {selection.watchlist.match_count} match{selection.watchlist.match_count === 1 ? "" : "es"}
          </span>
          <span>·</span>
          <span>
            Last evaluated{" "}
            {selection.watchlist.last_evaluated_at
              ? new Date(selection.watchlist.last_evaluated_at).toLocaleString()
              : "never"}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2"
            disabled={refreshing}
            onClick={() => void refreshSelected()}
          >
            {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            Refresh
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      {selection.watchlist && watchlistInsightLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-label="Loading watchlist intelligence" />
          Loading watchlist intelligence…
        </div>
      ) : null}

      <WatchlistIntelligenceInsightCard summary={watchlistInsight} />
    </div>
  )
}
