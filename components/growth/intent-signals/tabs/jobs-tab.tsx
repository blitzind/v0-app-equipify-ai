"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react"
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
import { IntentSignalsSignalActions } from "@/components/growth/intent-signals/intent-signals-signal-actions"
import {
  GROWTH_INTENT_SIGNALS_JOBS_TAB_QA_MARKER,
  getIntentSignalTabMeta,
} from "@/components/growth/intent-signals/intent-signals-ux-constants"
import {
  buildCompanyHiringIntensityMap,
  resolveCompanyIntensityKey,
} from "@/lib/growth/signals/hiring-velocity-ui-helpers"
import {
  formatHiringIntensityLabel,
  formatJobDepartmentLabel,
} from "@/lib/growth/signals/job-signal-classification"
import type { GrowthSignalDetailRow, GrowthSignalRow } from "@/lib/growth/signals/signal-types"
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

function displayCompany(signal: GrowthSignalRow): string {
  return signal.company_name?.trim() || signal.domain?.trim() || "—"
}

function displayPublisher(signal: GrowthSignalRow): string {
  const publisher = signal.metadata?.publisher
  return typeof publisher === "string" && publisher.trim() ? publisher.trim() : "—"
}

function readEmploymentType(signal: GrowthSignalRow): string {
  const value = signal.metadata?.employment_type
  return typeof value === "string" && value.trim() ? value.trim() : "—"
}

function readSourceUrl(signal: GrowthSignalRow): string | null {
  const value = signal.metadata?.source_url
  return typeof value === "string" && value.startsWith("http") ? value : null
}

function countWithinMs(signals: GrowthSignalRow[], ms: number): number {
  const cutoff = Date.now() - ms
  return signals.filter((signal) => {
    const t = Date.parse(signal.occurred_at)
    return Number.isFinite(t) && t >= cutoff
  }).length
}

export function JobsTab({
  onOpenSetupDrawer,
  watchlistId,
}: {
  onOpenSetupDrawer?: () => void
  watchlistId?: string | null
}) {
  const tabMeta = getIntentSignalTabMeta("jobs")
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
      const params = new URLSearchParams({ signal_type: "job_posting", limit: "100" })
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
        throw new Error(data.message ?? "Could not load job posting signals.")
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
  }, [watchlistId])

  const loadWatchlists = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/growth/signals/watchlists", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; items?: GrowthSignalWatchlistRow[] }
      if (res.ok && data.ok) setWatchlists(data.items ?? [])
    } catch {
      setWatchlists([])
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void loadWatchlists()
  }, [loadWatchlists])

  const intensityByCompany = useMemo(() => buildCompanyHiringIntensityMap(signals), [signals])

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

  const primarySourceUrl = detail?.sources?.[0]?.source_url ?? (detail ? readSourceUrl(detail) : null)

  return (
    <div className="flex flex-col gap-4" data-qa-marker={GROWTH_INTENT_SIGNALS_JOBS_TAB_QA_MARKER}>
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
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading job signals" />
        </div>
      ) : signals.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card px-6 py-14 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-violet-50 text-violet-600">
            <FileText className="size-7" />
          </div>
          <div className="max-w-md space-y-2">
            <h3 className="text-lg font-semibold">{tabMeta.emptyState.title}</h3>
            <p className="text-sm text-muted-foreground">{tabMeta.emptyState.description}</p>
          </div>
          <Button type="button" className="gap-2" variant="outline" onClick={onOpenSetupDrawer} disabled={!onOpenSetupDrawer}>
            <Sparkles className="size-4" />
            {tabMeta.emptyState.ctaLabel}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[1080px] text-left text-sm">
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
                const intensity = intensityByCompany.get(resolveCompanyIntensityKey(signal)) ?? "low"
                return (
                  <tr key={signal.id} className="border-b border-border/60 align-top">
                    <td className="px-4 py-3">{displayCompany(signal)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{signal.title?.trim() || "—"}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{signal.evidence_summary || "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{formatJobDepartmentLabel(signal.category)}</Badge>
                    </td>
                    <td className="px-4 py-3">{signal.geography?.trim() || "—"}</td>
                    <td className="px-4 py-3">{readEmploymentType(signal)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{formatHiringIntensityLabel(intensity)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{signal.signal_score}</span>
                        <Badge variant="outline">{signal.urgency}</Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3">{formatRelativeDate(signal.occurred_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(signal.id)}>
                          View details
                        </Button>
                        {readSourceUrl(signal) ? (
                          <Button type="button" size="sm" variant="ghost" asChild>
                            <a href={readSourceUrl(signal)!} target="_blank" rel="noopener noreferrer">
                              View source
                            </a>
                          </Button>
                        ) : null}
                      </div>
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
            <SheetTitle>{detail?.title?.trim() || "Job posting signal"}</SheetTitle>
            <SheetDescription>Evidence-backed job posting detail</SheetDescription>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Evidence summary</p>
                <p>{detail.evidence_summary || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Company</p>
                  <p>{displayCompany(detail)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Department</p>
                  <p>{formatJobDepartmentLabel(detail.category)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Role family</p>
                  <p>{typeof detail.metadata?.role_family === "string" ? detail.metadata.role_family : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Employment type</p>
                  <p>{readEmploymentType(detail)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Score</p>
                  <p>
                    {detail.signal_score} · {detail.urgency}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Location</p>
                  <p>{detail.geography?.trim() || "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Posted</p>
                  <p>{detail.occurred_at ? new Date(detail.occurred_at).toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Detected</p>
                  <p>{detail.detected_at ? new Date(detail.detected_at).toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Publisher</p>
                  <p>{displayPublisher(detail)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Operational relevance</p>
                  <p>
                    {typeof detail.metadata?.operational_relevance === "string"
                      ? detail.metadata.operational_relevance
                      : "—"}
                  </p>
                </div>
              </div>
              {detail.sources.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase text-muted-foreground">Sources</p>
                  {detail.sources.map((source) => (
                    <div key={source.id} className="rounded-lg border border-border p-3">
                      <p className="font-medium">{source.publisher?.trim() || source.source_label || "—"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{source.excerpt || "—"}</p>
                      {source.source_url ? (
                        <a
                          href={source.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-violet-700 underline"
                        >
                          View source
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              {primarySourceUrl ? (
                <Button type="button" variant="secondary" asChild className="w-full">
                  <a href={primarySourceUrl} target="_blank" rel="noopener noreferrer">
                    Open primary source
                  </a>
                </Button>
              ) : null}
              <IntentSignalsSignalActions
                signal={detail}
                watchlists={watchlists}
                selectedWatchlistId={watchlistId}
                onUpdated={(updated) => {
                  setDetail((prev) => (prev ? { ...prev, ...updated } : prev))
                  void load()
                }}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
