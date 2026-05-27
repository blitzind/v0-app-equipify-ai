"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Briefcase, Loader2, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { IntentSignalsFilterBar } from "@/components/growth/intent-signals/intent-signals-filter-bar"
import { IntentSignalsMetricsRow } from "@/components/growth/intent-signals/intent-signals-metrics-row"
import { IntentSignalsPersonSignalDetail } from "@/components/growth/intent-signals/intent-signals-person-signal-detail"
import { IntentSignalsSignalActions } from "@/components/growth/intent-signals/intent-signals-signal-actions"
import {
  GROWTH_INTENT_SIGNALS_JOB_CHANGES_TAB_QA_MARKER,
  GROWTH_INTENT_SIGNALS_PROMOTIONS_TAB_QA_MARKER,
  getIntentSignalTabMeta,
  type IntentSignalTabId,
} from "@/components/growth/intent-signals/intent-signals-ux-constants"
import {
  formatIdentityConfidenceBadge,
  readPersonSignalMetadata,
} from "@/lib/growth/signals/person-signal-metadata"
import type { GrowthSignalDetailRow, GrowthSignalRow, GrowthSignalType } from "@/lib/growth/signals/signal-types"
import type { GrowthSignalWatchlistRow } from "@/lib/growth/signals/signal-watchlist-types"

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return "—"
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) return `${Math.max(mins, 1)} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 48) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString()
}

function displayPerson(signal: GrowthSignalRow): string {
  return signal.contact_display_label?.trim() || readPersonSignalMetadata(signal).person_name?.trim() || "—"
}

function displayCompany(signal: GrowthSignalRow): string {
  return signal.company_name?.trim() || signal.domain?.trim() || "—"
}

function countWithinMs(signals: GrowthSignalRow[], ms: number): number {
  const cutoff = Date.now() - ms
  return signals.filter((signal) => {
    const t = Date.parse(signal.occurred_at)
    return Number.isFinite(t) && t >= cutoff
  }).length
}

export function PersonSignalsTab({
  tabId,
  signalType,
  watchlistId,
}: {
  tabId: Extract<IntentSignalTabId, "job-changes" | "promotions">
  signalType: Extract<GrowthSignalType, "job_change" | "promotion">
  watchlistId?: string | null
}) {
  const tabMeta = getIntentSignalTabMeta(tabId)
  const qaMarker =
    tabId === "job-changes"
      ? GROWTH_INTENT_SIGNALS_JOB_CHANGES_TAB_QA_MARKER
      : GROWTH_INTENT_SIGNALS_PROMOTIONS_TAB_QA_MARKER
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [signals, setSignals] = useState<GrowthSignalRow[]>([])
  const [total, setTotal] = useState(0)
  const [watchlists, setWatchlists] = useState<GrowthSignalWatchlistRow[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<GrowthSignalDetailRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ signal_type: signalType, limit: "100" })
      if (watchlistId) params.set("watchlist_id", watchlistId)
      const res = await fetch(`/api/platform/growth/signals?${params.toString()}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: GrowthSignalRow[]
        total?: number
        message?: string
      }
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? "Could not load person signals.")
      }
      setSignals(data.items ?? [])
      setTotal(data.total ?? data.items?.length ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
      setSignals([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [signalType, watchlistId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/platform/growth/signals/watchlists", { cache: "no-store" })
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthSignalWatchlistRow[] }
        if (res.ok && data.ok) setWatchlists(data.items ?? [])
      } catch {
        setWatchlists([])
      }
    })()
  }, [])

  const metrics = useMemo(
    () => ({
      total,
      h24: countWithinMs(signals, 24 * 60 * 60 * 1000),
      d7: countWithinMs(signals, 7 * 24 * 60 * 60 * 1000),
      d30: countWithinMs(signals, 30 * 24 * 60 * 60 * 1000),
    }),
    [signals, total],
  )

  async function openDetail(signalId: string) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await fetch(`/api/platform/growth/signals/${signalId}`, { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        signal?: GrowthSignalDetailRow
        message?: string
      }
      if (!res.ok || !data.ok || !data.signal) {
        throw new Error(data.message ?? "Could not load signal detail.")
      }
      setDetail(data.signal)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Detail load failed.")
      setDetailOpen(false)
    } finally {
      setDetailLoading(false)
    }
  }

  const EmptyIcon = tabId === "promotions" ? TrendingUp : Briefcase

  return (
    <div className="flex flex-col gap-4" data-qa-marker={qaMarker}>
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <IntentSignalsFilterBar filters={tabMeta.filters} sourceDisabled />

      <IntentSignalsMetricsRow
        totalCount={metrics.total}
        count24h={metrics.h24}
        count7d={metrics.d7}
        count30d={metrics.d30}
        isPreview={false}
        exportDisabled
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading person signals" />
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <EmptyIcon className="size-7" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold">{tabMeta.emptyState.title}</h3>
            <p className="text-sm text-muted-foreground">{tabMeta.emptyState.description}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
                {tabMeta.columns.map((col) => (
                  <th key={col.key} className="px-4 py-2">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {signals.map((signal) => {
                const personMeta = readPersonSignalMetadata(signal)
                return (
                  <tr key={signal.id} className="border-b border-border/60 align-top">
                    <td className="px-4 py-3 font-medium">{displayPerson(signal)}</td>
                    {tabId === "job-changes" ? (
                      <>
                        <td className="px-4 py-3">{signal.title?.trim() || "—"}</td>
                        <td className="px-4 py-3">{displayCompany(signal)}</td>
                        <td className="px-4 py-3">{signal.previous_title?.trim() || "—"}</td>
                        <td className="px-4 py-3">
                          {personMeta.previous_company_name?.trim() ||
                            personMeta.previous_company_domain?.trim() ||
                            "—"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">{signal.title?.trim() || "—"}</td>
                        <td className="px-4 py-3">{displayCompany(signal)}</td>
                        <td className="px-4 py-3">{signal.previous_title?.trim() || "—"}</td>
                        <td className="px-4 py-3">
                          {personMeta.seniority_delta != null && personMeta.seniority_delta > 0
                            ? `+${personMeta.seniority_delta}`
                            : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3">
                      <Badge variant="outline">
                        {formatIdentityConfidenceBadge(personMeta.identity_confidence)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{signal.signal_score}</span>
                        <Badge variant="outline">{signal.urgency}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatRelativeDate(signal.occurred_at)}</td>
                    <td className="px-4 py-3">
                      <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(signal.id)}>
                        View details
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{detail ? displayPerson(detail) : "Person signal"}</SheetTitle>
            <SheetDescription>Evidence-backed person-level employment intelligence</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="mt-4 space-y-4">
              <IntentSignalsPersonSignalDetail signal={detail} />
              <IntentSignalsSignalActions
                signal={detail}
                watchlists={watchlists}
                onActionComplete={() => void load()}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

export function JobChangesTab(props: { watchlistId?: string | null }) {
  return <PersonSignalsTab tabId="job-changes" signalType="job_change" {...props} />
}

export function PromotionsTab(props: { watchlistId?: string | null }) {
  return <PersonSignalsTab tabId="promotions" signalType="promotion" {...props} />
}
