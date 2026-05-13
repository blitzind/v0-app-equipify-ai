"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { buildDeterministicRetryTimeline } from "@/lib/blitzpay/blitzpay-collections-engine"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { cn } from "@/lib/utils"

type Summary = {
  healthScore: number
  healthBand: string
  retryQueueCount: number
  escalatedCount: number
  failedIndicatorCount: number
  delinquencyTrendUp: boolean
}

type StateRow = {
  id: string
  invoiceId: string
  customerId: string
  invoiceNumber: string | null
  invoiceTitle: string | null
  amountCents: number
  collectionStatus: string
  statusLabel: string
  nextRetryAt: string | null
  escalationLevel: number
  recoveryPaused: boolean
  recoveryReadiness: string
  firstFailureAt: string | null
}

type AttemptRow = {
  id: string
  invoiceId: string
  attemptType: string
  attemptStatus: string
  attemptedAt: string
}

type FlowRow = { id: string; invoiceId: string | null; flowStatus: string; triggerType: string }

type ActivityRow = { id: string; activitySummary: string; activityType: string; createdAt: string }

type Props = {
  organizationId: string | null
  orgReady: boolean
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

function escalationBadge(level: number) {
  if (level <= 0) return { label: "Standard", className: "bg-muted text-muted-foreground" }
  if (level <= 2) return { label: "Review", className: "bg-amber-500/15 text-amber-900 dark:text-amber-100" }
  return { label: "Priority review", className: "bg-red-500/15 text-red-900 dark:text-red-100" }
}

function CollectionInvoiceActions({
  row,
  busyKey,
  onPost,
}: {
  row: StateRow
  busyKey: string | null
  onPost: (path: string, invoiceId: string, customerId: string) => void | Promise<void>
}) {
  const bkey = (action: string) => `${action}:${row.invoiceId}`
  return (
    <div className="flex flex-wrap gap-2 min-w-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 text-sm inline-flex items-center gap-1.5"
        disabled={busyKey !== null}
        onClick={() => void onPost("retry", row.invoiceId, row.customerId)}
      >
        {busyKey === bkey("retry") ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden /> : null}
        <span className="whitespace-normal text-left leading-snug">Schedule follow-up</span>
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0"
        disabled={busyKey !== null}
        onClick={() => void onPost("pause", row.invoiceId, row.customerId)}
        aria-label="Pause recovery"
      >
        <Pause className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0"
        disabled={busyKey !== null}
        onClick={() => void onPost("resume", row.invoiceId, row.customerId)}
        aria-label="Resume recovery"
      >
        <Play className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0"
        disabled={busyKey !== null}
        onClick={() => void onPost("resolve", row.invoiceId, row.customerId)}
        aria-label="Mark settled"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 text-sm text-destructive border-destructive/40 whitespace-normal leading-snug"
        disabled={busyKey !== null}
        onClick={() => void onPost("mark-uncollectible", row.invoiceId, row.customerId)}
      >
        Not collectible
      </Button>
    </div>
  )
}

export function BlitzpayCollectionsEnginePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [states, setStates] = useState<StateRow[]>([])
  const [attempts, setAttempts] = useState<AttemptRow[]>([])
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const base = useMemo(
    () => (organizationId ? `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay` : ""),
    [organizationId],
  )

  const load = useCallback(async () => {
    if (!organizationId || !orgReady || !base) {
      setSummary(null)
      setStates([])
      setAttempts([])
      setFlows([])
      setActivities([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [c, a, f] = await Promise.all([
        fetch(`${base}/collections`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/collections/attempts`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/collections/recovery-flows`, { cache: "no-store", credentials: "include" }),
      ])
      const cj = (await c.json()) as {
        summary?: Summary
        states?: StateRow[]
        activities?: ActivityRow[]
      }
      const aj = (await a.json()) as { attempts?: AttemptRow[] }
      const fj = (await f.json()) as { recoveryFlows?: FlowRow[] }
      if (!c.ok || !a.ok || !f.ok) {
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setSummary(cj.summary ?? null)
      setStates(cj.states ?? [])
      setActivities(cj.activities ?? [])
      setAttempts(aj.attempts ?? [])
      setFlows(fj.recoveryFlows ?? [])
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady, base])

  useEffect(() => {
    void load()
  }, [load])

  async function postAction(path: string, invoiceId: string, customerId: string) {
    if (!base) return
    const key = `${path}:${invoiceId}`
    setBusyKey(key)
    setError(null)
    try {
      const res = await fetch(`${base}/collections/${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, customerId }),
      })
      if (!res.ok) {
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      await load()
    } catch {
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setBusyKey(null)
    }
  }

  const healthLabel =
    summary?.healthBand === "strong" ? "Solid" : summary?.healthBand === "steady" ? "Stable" : "Needs care"

  return (
    <section
      className="rounded-xl border border-border bg-white dark:bg-card p-5 shadow-sm space-y-5 min-w-0 max-w-full overflow-hidden"
      aria-labelledby="blitzpay-collections-engine-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <h2 id="blitzpay-collections-engine-heading" className="text-base font-semibold tracking-tight">
            Collection rhythm
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            Courteous, capped follow-up windows for open balances. Nothing here sends messages or charges a card by
            itself—your team stays in control.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading || !organizationId}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Rhythm score</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.healthScore}</p>
            <p className="text-xs text-muted-foreground mt-1">{healthLabel}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Follow-ups queued</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.retryQueueCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Polite reminders only</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Team review</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.escalatedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Needs a human decision</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs font-medium text-muted-foreground">Open tension</p>
            <p className="text-2xl font-semibold tabular-nums">{summary.failedIndicatorCount}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.delinquencyTrendUp ? "Trending warmer — watch balances" : "Steady week over week"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        <div className="lg:col-span-2 space-y-3 min-w-0">
          <h3 className="text-sm font-semibold">Open invoices on file</h3>

          {/* Mobile: stacked cards (avoids wide multi-column table + action overflow) */}
          <div className="space-y-3 md:hidden min-w-0">
            {loading && states.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading collection rows…</p>
            ) : null}
            {states.length === 0 && !loading ? (
              <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground break-words">
                No collection rows yet. Use an action on an invoice after it is tracked, or schedule a follow-up from
                your workflow.
              </div>
            ) : null}
            {states.map((s) => {
              const badge = escalationBadge(s.escalationLevel)
              return (
                <article
                  key={s.id}
                  className="rounded-lg border border-border bg-white dark:bg-card p-4 space-y-3 min-w-0 overflow-hidden shadow-sm"
                >
                  <div className="min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-foreground break-words">{s.invoiceNumber ?? "Invoice"}</h4>
                    {s.invoiceTitle ? (
                      <p className="text-sm text-muted-foreground break-words leading-snug">{s.invoiceTitle}</p>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm min-w-0">
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Balance</dt>
                      <dd className="font-semibold tabular-nums text-foreground mt-0.5">{formatMoney(s.amountCents)}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Escalation</dt>
                      <dd className="mt-0.5">
                        <span className={cn("inline-flex text-xs font-medium rounded-full px-2.5 py-1", badge.className)}>
                          {badge.label}
                        </span>
                      </dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</dt>
                      <dd className="text-sm text-foreground mt-0.5 break-words">{s.statusLabel}</dd>
                      {s.nextRetryAt ? (
                        <div className="text-sm text-muted-foreground flex items-start gap-1.5 mt-1.5 min-w-0">
                          <CalendarClock className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                          <span className="break-words">Next window {s.nextRetryAt.slice(0, 10)}</span>
                        </div>
                      ) : null}
                    </div>
                  </dl>
                  <div className="pt-1 border-t border-border/60 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Actions</p>
                    <div className="flex justify-start min-w-0">
                      <CollectionInvoiceActions row={s} busyKey={busyKey} onPost={postAction} />
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block min-w-0 overflow-x-auto rounded-lg border border-border">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-0">Invoice</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-right min-w-[12rem]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {states.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground py-8 text-center">
                      No collection rows yet. Use an action on an invoice after it is tracked, or schedule a follow-up
                      from your workflow.
                    </TableCell>
                  </TableRow>
                ) : null}
                {states.map((s) => {
                  const badge = escalationBadge(s.escalationLevel)
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="min-w-0 max-w-[14rem]">
                        <div className="font-medium break-words">{s.invoiceNumber ?? "Invoice"}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2 break-words">{s.invoiceTitle}</div>
                      </TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">{formatMoney(s.amountCents)}</TableCell>
                      <TableCell className="min-w-0 max-w-[12rem]">
                        <span className="text-sm break-words">{s.statusLabel}</span>
                        {s.nextRetryAt ? (
                          <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="break-words">Next {s.nextRetryAt.slice(0, 10)}</span>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", badge.className)}>
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right align-top min-w-0">
                        <div className="flex justify-end min-w-0">
                          <CollectionInvoiceActions row={s} busyKey={busyKey} onPost={postAction} />
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          <div>
            <h3 className="text-sm font-semibold mb-2">Suggested cadence</h3>
            <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
              Deterministic windows from the first missed payment signal (internal only).
            </p>
            <ol className="space-y-2 text-sm">
              {(states[0]?.firstFailureAt ?
                buildDeterministicRetryTimeline(states[0].firstFailureAt)
              : [
                  { dayOffset: 1, label: "Day 1" },
                  { dayOffset: 3, label: "Day 3" },
                  { dayOffset: 7, label: "Day 7" },
                  { dayOffset: 14, label: "Day 14" },
                  { dayOffset: 0, label: "Final review if still unpaid" },
                ]
              ).map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">{i + 1}.</span>
                    <span>{step.label}</span>
                  </li>
                ),
              )}
            </ol>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden />
              Recovery overview
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1 min-w-0">
              {flows.slice(0, 6).map((f) => (
                <li key={f.id} className="break-words">
                  {formatBlitzpayUiLabel(f.triggerType)} — {formatBlitzpayUiLabel(f.flowStatus)}
                </li>
              ))}
              {flows.length === 0 ? <li>No active recovery paths recorded.</li> : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold mb-2">Recent attempts</h3>
          <ul className="text-sm space-y-2 text-muted-foreground max-h-48 overflow-y-auto pr-1 min-w-0">
            {attempts.slice(0, 12).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-b border-border/60 pb-2 min-w-0">
                <span className="min-w-0 break-words">
                  {formatBlitzpayUiLabel(a.attemptType)} · {formatBlitzpayUiLabel(a.attemptStatus)}
                </span>
                <span className="text-sm shrink-0 tabular-nums">{a.attemptedAt.slice(0, 16)}</span>
              </li>
            ))}
            {attempts.length === 0 ? <li>No attempts logged yet.</li> : null}
          </ul>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
            Activity
          </h3>
          <ul className="text-sm space-y-2 max-h-48 overflow-y-auto pr-1 min-w-0">
            {activities.slice(0, 14).map((a) => (
              <li key={a.id} className="border-b border-border/60 pb-2 min-w-0">
                <p className="break-words">{a.activitySummary}</p>
                <p className="text-sm text-muted-foreground mt-0.5 tabular-nums">{a.createdAt.slice(0, 16)}</p>
              </li>
            ))}
            {activities.length === 0 ? <li className="text-muted-foreground">No activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  )
}
