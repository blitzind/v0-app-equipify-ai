"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Loader2, Play, FlaskConical, AlertTriangle, Info, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type RevenueRollup = {
  reportingWindowDays: number
  ledgerPaymentCapturedCentsWindow: number
  succeededPaymentIntentsCountWindow: number
  openDisputesPlatformCount: number
  walletLiabilityTotalCentsApprox: number
  treasuryPendingInFlightPayoutCentsApprox: number
  treasuryFailedPayouts30dCount: number
  treasuryInstantPayoutInterestOrgsCount: number
}

type OpsSummary = {
  orgsBlitzpayEnabled: number
  orgsConnectChargesReady: number
  volumeCapturedCents30d: number
  failedPaymentAttempts7d: number
  openDisputes: number
  pendingRefunds: number
  webhookDead24h: number
  reminderRunsFailed7d: number
  reminderDispatchFailures7d: number
  orgsStaleConnectSync7d: number
  schemaHealth: { ok: boolean }
  recentReminderRuns: Array<{
    id: string
    trigger: string
    status: string
    remindersEvaluated: number
    remindersSent: number
    remindersSkipped: number
    createdAt: string
    finishedAt: string | null
    error: string | null
  }>
  alerts: Array<{ severity: "critical" | "warning" | "info"; code: string; message: string }>
}

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100)
}

function alertIcon(sev: OpsSummary["alerts"][0]["severity"]) {
  if (sev === "critical") return <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
  if (sev === "warning") return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
  return <Info className="w-4 h-4 text-slate-500 shrink-0" />
}

export function BlitzpayOperationsContent() {
  const [summary, setSummary] = useState<OpsSummary | null>(null)
  const [revenueRollup, setRevenueRollup] = useState<RevenueRollup | null>(null)
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [dispatchBusy, setDispatchBusy] = useState<"idle" | "dry" | "live">("idle")
  const [dispatchMsg, setDispatchMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/platform/blitzpay/operations", { cache: "no-store" }),
        fetch("/api/platform/blitzpay/reminder-runs?limit=25", { cache: "no-store" }),
      ])
      const j1 = (await r1.json()) as { summary?: OpsSummary; error?: string; message?: string }
      const j2 = (await r2.json()) as { runs?: Array<Record<string, unknown>>; error?: string; message?: string }
      if (!r1.ok) {
        setErr(j1.message ?? j1.error ?? "Could not load operations summary.")
        setSummary(null)
      } else {
        setSummary(j1.summary ?? null)
      }
      if (r2.ok) setRuns(j2.runs ?? [])
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error.")
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/platform/blitzpay/revenue-rollup", { cache: "no-store" })
        const j = (await r.json()) as { rollup?: RevenueRollup }
        if (r.ok) setRevenueRollup(j.rollup ?? null)
      } catch {
        setRevenueRollup(null)
      }
    })()
  }, [])

  async function runDispatch(dryRun: boolean) {
    setDispatchBusy(dryRun ? "dry" : "live")
    setDispatchMsg(null)
    try {
      const res = await fetch("/api/platform/blitzpay/reminder-dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const j = (await res.json()) as {
        error?: string
        message?: string
        evaluated?: number
        sent?: number
        skipped?: number
        simulatedSent?: number
        dryRun?: boolean
      }
      if (!res.ok) {
        setDispatchMsg(j.message ?? j.error ?? "Dispatch failed.")
        return
      }
      setDispatchMsg(
        j.dryRun ?
          `Dry run: evaluated ${j.evaluated ?? 0}, would send ${j.simulatedSent ?? 0}, skipped ${j.skipped ?? 0}.`
        : `Manual run: evaluated ${j.evaluated ?? 0}, sent ${j.sent ?? 0}, skipped ${j.skipped ?? 0}.`,
      )
      await load()
    } catch (e) {
      setDispatchMsg(e instanceof Error ? e.message : "Network error.")
    } finally {
      setDispatchBusy("idle")
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading BlitzPay operations…
      </div>
    )
  }

  if (err) {
    return <p className="text-sm text-destructive py-4">{err}</p>
  }

  return (
    <div className="space-y-8 text-sm">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
          <CreditCard className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">BlitzPay operations</h2>
          <p className="text-muted-foreground mt-1 leading-relaxed max-w-3xl">
            Platform-wide health for hosted invoice pay, webhooks, reminders, and disputes. Manual reminder controls
            run with the same orchestration as cron; dry run does not write reminder rows or send email.
          </p>
        </div>
      </div>

      {summary?.alerts && summary.alerts.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active signals</p>
          <ul className="space-y-2">
            {summary.alerts.map((a) => (
              <li
                key={a.code}
                className={cn(
                  "flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
                  a.severity === "critical" && "border-red-200 bg-red-50 text-red-900",
                  a.severity === "warning" && "border-amber-200 bg-amber-50 text-amber-950",
                  a.severity === "info" && "border-border bg-muted/40 text-foreground",
                )}
              >
                {alertIcon(a.severity)}
                <span>{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">BlitzPay orgs</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.orgsBlitzpayEnabled ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Charges-ready orgs</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.orgsConnectChargesReady ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Captured (30d)</p>
          <p className="text-lg font-semibold tabular-nums">{fmtMoney(summary?.volumeCapturedCents30d ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Failed attempts (7d)</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.failedPaymentAttempts7d ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Open disputes</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.openDisputes ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Pending refunds</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.pendingRefunds ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Webhook dead (24h)</p>
          <p className="text-lg font-semibold tabular-nums">{summary?.webhookDead24h ?? "—"}</p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-medium">Schema</p>
          <p className="text-lg font-semibold">{summary?.schemaHealth?.ok ? "OK" : "Issue"}</p>
        </div>
      </div>

      {revenueRollup ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revenue rollup (platform)</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Bounded aggregates across workspaces ({revenueRollup.reportingWindowDays}d window). Ledger sum uses capped
            reads; wallet liability sums up to 5k wallet rows.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Ledger captured</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(revenueRollup.ledgerPaymentCapturedCentsWindow)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Succeeded PIs</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.succeededPaymentIntentsCountWindow}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Open disputes (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.openDisputesPlatformCount}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Wallet liability (approx)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(revenueRollup.walletLiabilityTotalCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">In-flight payouts (approx)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(revenueRollup.treasuryPendingInFlightPayoutCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Failed payouts (30d)</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.treasuryFailedPayouts30dCount}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Instant payout interest orgs</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.treasuryInstantPayoutInterestOrgsCount}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reminder orchestration</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Configure <code className="text-[11px]">CRON_SECRET</code> on the host and call{" "}
          <code className="text-[11px]">POST /api/cron/blitzpay-reminders</code> on a schedule. Manual runs here use the
          same code path with trigger <code className="text-[11px]">manual</code>.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={dispatchBusy !== "idle"}
            onClick={() => void runDispatch(true)}
            className="gap-1.5"
          >
            {dispatchBusy === "dry" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
            Dry run
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={dispatchBusy !== "idle"}
            onClick={() => void runDispatch(false)}
            className="gap-1.5"
          >
            {dispatchBusy === "live" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Manual run
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {dispatchMsg ? <p className="text-xs text-muted-foreground">{dispatchMsg}</p> : null}
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/40">
          <p className="text-xs font-semibold">Recent reminder runs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Trigger</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-right">Eval</th>
                <th className="px-3 py-2 font-medium text-right">Sent</th>
                <th className="px-3 py-2 font-medium text-right">Skip</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {(runs.length ? runs : summary?.recentReminderRuns ?? []).map((row) => {
                const r = row as Record<string, string | number | null | undefined>
                const id = String(r.id ?? "")
                const created = String(r.created_at ?? r.createdAt ?? "")
                return (
                  <tr key={id || created} className="border-b border-border last:border-0">
                    <td className="px-3 py-1.5 whitespace-nowrap">{created ? new Date(created).toLocaleString() : "—"}</td>
                    <td className="px-3 py-1.5">{String(r.trigger ?? "")}</td>
                    <td className="px-3 py-1.5">{String(r.status ?? "")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.reminders_evaluated ?? r.remindersEvaluated ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.reminders_sent ?? r.remindersSent ?? "—"}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{r.reminders_skipped ?? r.remindersSkipped ?? "—"}</td>
                    <td className="px-3 py-1.5 max-w-[220px] truncate text-muted-foreground">
                      {r.error ? String(r.error) : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
