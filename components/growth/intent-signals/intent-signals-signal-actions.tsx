"use client"

import { useState } from "react"
import { BookmarkPlus, CheckCircle2, EyeOff, Loader2, ShieldBan } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { GrowthSignalDetailRow, GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import type { GrowthSignalWatchlistRow } from "@/lib/growth/signals/signal-watchlist-types"

export function IntentSignalsSignalActions({
  signal,
  watchlists,
  selectedWatchlistId,
  onUpdated,
}: {
  signal: GrowthSignalRow | GrowthSignalDetailRow
  watchlists: GrowthSignalWatchlistRow[]
  selectedWatchlistId?: string | null
  onUpdated?: (signal: GrowthSignalRow) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [watchlistId, setWatchlistId] = useState(selectedWatchlistId ?? watchlists[0]?.id ?? "")

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/platform/growth/signals/${signal.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        signal?: GrowthSignalRow
        message?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.message ?? "Action failed.")
      if (data.signal) onUpdated?.(data.signal)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Operator actions</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null || signal.workflow_state === "reviewed"}
          onClick={() => void runAction("mark_reviewed")}
        >
          {busy === "mark_reviewed" ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
          Mark reviewed
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null || signal.suppression_state === "dismissed"}
          onClick={() => void runAction("dismiss")}
        >
          {busy === "dismiss" ? <Loader2 className="size-3.5 animate-spin" /> : <EyeOff className="size-3.5" />}
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy !== null || signal.suppression_state === "suppressed"}
          onClick={() => void runAction("suppress")}
        >
          {busy === "suppress" ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldBan className="size-3.5" />}
          Suppress similar
        </Button>
      </div>

      {watchlists.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={watchlistId} onValueChange={setWatchlistId}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Select watchlist" />
            </SelectTrigger>
            <SelectContent>
              {watchlists.map((watchlist) => (
                <SelectItem key={watchlist.id} value={watchlist.id}>
                  {watchlist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy !== null || !watchlistId}
            onClick={() => void runAction("add_to_watchlist", { watchlist_id: watchlistId })}
          >
            {busy === "add_to_watchlist" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="size-3.5" />
            )}
            Add to watchlist
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">
        Push to Lead Inbox is not enabled in this milestone — manual review only.
      </p>
    </div>
  )
}
