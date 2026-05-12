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
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5" aria-labelledby="blitzpay-collections-engine-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold">Open invoices on file</h3>
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                  const bkey = (action: string) => `${action}:${s.invoiceId}`
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium">{s.invoiceNumber ?? "Invoice"}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{s.invoiceTitle}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">{formatMoney(s.amountCents)}</TableCell>
                      <TableCell>
                        <span className="text-sm">{s.statusLabel}</span>
                        {s.nextRetryAt ? (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <CalendarClock className="h-3 w-3" aria-hidden />
                            Next window {s.nextRetryAt.slice(0, 10)}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <span className={cn("text-xs font-medium rounded-full px-2 py-0.5", badge.className)}>
                          {badge.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busyKey !== null}
                            onClick={() => void postAction("retry", s.invoiceId, s.customerId)}
                          >
                            {busyKey === bkey("retry") ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                            Schedule follow-up
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyKey !== null}
                            onClick={() => void postAction("pause", s.invoiceId, s.customerId)}
                          >
                            <Pause className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyKey !== null}
                            onClick={() => void postAction("resume", s.invoiceId, s.customerId)}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busyKey !== null}
                            onClick={() => void postAction("resolve", s.invoiceId, s.customerId)}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/40"
                            disabled={busyKey !== null}
                            onClick={() => void postAction("mark-uncollectible", s.invoiceId, s.customerId)}
                          >
                            Not collectible
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
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
            <ul className="text-sm text-muted-foreground space-y-1">
              {flows.slice(0, 6).map((f) => (
                <li key={f.id}>
                  {f.triggerType.replace(/_/g, " ")} — {f.flowStatus}
                </li>
              ))}
              {flows.length === 0 ? <li>No active recovery paths recorded.</li> : null}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold mb-2">Recent attempts</h3>
          <ul className="text-sm space-y-2 text-muted-foreground max-h-48 overflow-y-auto pr-1">
            {attempts.slice(0, 12).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 border-b border-border/60 pb-2">
                <span>
                  {a.attemptType.replace(/_/g, " ")} · {a.attemptStatus}
                </span>
                <span className="text-xs shrink-0">{a.attemptedAt.slice(0, 16)}</span>
              </li>
            ))}
            {attempts.length === 0 ? <li>No attempts logged yet.</li> : null}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden />
            Activity
          </h3>
          <ul className="text-sm space-y-2 max-h-48 overflow-y-auto pr-1">
            {activities.slice(0, 14).map((a) => (
              <li key={a.id} className="border-b border-border/60 pb-2">
                <p>{a.activitySummary}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{a.createdAt.slice(0, 16)}</p>
              </li>
            ))}
            {activities.length === 0 ? <li className="text-muted-foreground">No activity yet.</li> : null}
          </ul>
        </div>
      </div>
    </section>
  )
}
