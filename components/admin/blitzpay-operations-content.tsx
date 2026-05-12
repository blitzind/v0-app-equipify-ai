"use client"

import { useCallback, useEffect, useState } from "react"
import { CreditCard, Loader2, Play, FlaskConical, AlertTriangle, Info, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type CommandCenterPlatformRollup = {
  reportingWindowDays: number
  orgsWithOpenVendorPayablesApprox: number
  orgsVendorPayablesOverdueApprox: number
  orgsLaunchReadinessConnectGapApprox: number
  orgsStaleConnectSync7d: number
  openDisputesPlatformSample: number
  pendingRefundsPlatform: number
  failedPaymentAttempts7d: number
  schemaHealthOk: boolean
}

type CollectionsPlatformRollup = {
  reportingWindowDays: number
  orgsSampled: number
  overdueCollectibleCentsTotalApprox: number
  estimatedRecoverableOverdueCentsApprox: number
  fieldCollectibleCentsApprox: number
  installmentPlansActiveApprox: number
  achAdoptionOrgsApprox: number
  averageReminderDispatchPct: number
  topRiskThemes: string[]
}

type RecurringRevenuePlatformRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  averagePlannedRecurring30dCents: number
  averageAutopayAdoptionPct: number
  averageRenewalSuccessProxyPct: number
  averageChurnRiskScore0to100: number
  orgsWithFailedRenewalsApprox: number
  topOperationalThemes: string[]
}

type MembershipPlatformRollup = {
  sampledOrganizations: number
  organizationsWithMemberships: number
  totalActiveMembershipsSample: number
  totalMrrCentsSample: number
  delinquentMembershipsSample: number
  openFailuresSample: number
  avgAutopayAdoptionPctSample: number
  delinquencyPressurePct: number
}

type PayrollPlatformRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  orgsWithDraftPayrollApprox: number
  orgsWithFailedPayrollApprox: number
  pendingCommissionExposureCentsApprox: number
  contractorSettlementPendingCentsApprox: number
  recurringSharePendingCentsApprox: number
  highCommissionExposureOrgsApprox: number
}

type CashAccountsPlatformRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  orgsWithReserveGapApprox: number
  orgsRunwayRiskApprox: number
  orgsRunwayWatchApprox: number
  sampleEstimatedOperatingCashTotalApprox: number
  payrollReserveLowCoverageOrgsApprox: number
  apReserveLowCoverageOrgsApprox: number
  outflowStressOrgsApprox: number
}

type ObservabilityPlatformRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgSnapshotsSampled: number
  averageQueueHealthScoreApprox: number
  averageWorkerHealthScoreApprox: number
  orgsWithReplayBacklogApprox: number
  orgsWithQueueDepthApprox: number
  disclaimer: string
}

type BusinessHealthPlatformRollup = {
  reportingWindowDays: number
  generatedAt: string
  orgsSampled: number
  averageOverallHealth: number
  averageFinancialHealth: number
  averageCollectionsHealth: number
  orgsUnderStressApprox: number
  commonBottlenecks: string[]
  averageArPressureRatio: number
  financingAdoptionRatePct: number
  averageReminderDispatchPct: number
  averagePayoutDelayDays: number | null
  recurringRevenueSignalAvg: number
  topGrowthOpportunityThemes: string[]
}

type RevenueRollup = {
  reportingWindowDays: number
  ledgerPaymentCapturedCentsWindow: number
  succeededPaymentIntentsCountWindow: number
  openDisputesPlatformCount: number
  walletLiabilityTotalCentsApprox: number
  treasuryPendingInFlightPayoutCentsApprox: number
  treasuryFailedPayouts30dCount: number
  treasuryInstantPayoutInterestOrgsCount: number
  apOpenPayablesOrgsApprox: number
  apOpenOutstandingCentsTotalApprox: number
  apOverdueOpenLinesApprox: number
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
  const [commandRollup, setCommandRollup] = useState<CommandCenterPlatformRollup | null>(null)
  const [healthRollup, setHealthRollup] = useState<BusinessHealthPlatformRollup | null>(null)
  const [collectionsRollup, setCollectionsRollup] = useState<CollectionsPlatformRollup | null>(null)
  const [recurringRollup, setRecurringRollup] = useState<RecurringRevenuePlatformRollup | null>(null)
  const [membershipRollup, setMembershipRollup] = useState<MembershipPlatformRollup | null>(null)
  const [payrollRollup, setPayrollRollup] = useState<PayrollPlatformRollup | null>(null)
  const [cashRollup, setCashRollup] = useState<CashAccountsPlatformRollup | null>(null)
  const [observabilityRollup, setObservabilityRollup] = useState<ObservabilityPlatformRollup | null>(null)
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
        const [r1, r2, r3, r4, r5, r6, r7, r8, r9] = await Promise.all([
          fetch("/api/platform/blitzpay/revenue-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/command-center-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/business-health-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/collections-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/recurring-revenue-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/membership-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/payroll-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/cash-accounts-rollup", { cache: "no-store" }),
          fetch("/api/platform/blitzpay/observability-rollup", { cache: "no-store" }),
        ])
        const j1 = (await r1.json()) as { rollup?: RevenueRollup }
        const j2 = (await r2.json()) as { rollup?: CommandCenterPlatformRollup }
        const j3 = (await r3.json()) as { rollup?: BusinessHealthPlatformRollup }
        const j4 = (await r4.json()) as { rollup?: CollectionsPlatformRollup }
        const j5 = (await r5.json()) as { rollup?: RecurringRevenuePlatformRollup }
        const j6 = (await r6.json()) as { rollup?: MembershipPlatformRollup }
        const j7 = (await r7.json()) as { rollup?: PayrollPlatformRollup }
        const j8 = (await r8.json()) as { rollup?: CashAccountsPlatformRollup }
        const j9 = (await r9.json()) as { rollup?: ObservabilityPlatformRollup }
        if (r1.ok) setRevenueRollup(j1.rollup ?? null)
        else setRevenueRollup(null)
        if (r2.ok) setCommandRollup(j2.rollup ?? null)
        else setCommandRollup(null)
        if (r3.ok) setHealthRollup(j3.rollup ?? null)
        else setHealthRollup(null)
        if (r4.ok) setCollectionsRollup(j4.rollup ?? null)
        else setCollectionsRollup(null)
        if (r5.ok) setRecurringRollup(j5.rollup ?? null)
        else setRecurringRollup(null)
        if (r6.ok) setMembershipRollup(j6.rollup ?? null)
        else setMembershipRollup(null)
        if (r7.ok) setPayrollRollup(j7.rollup ?? null)
        else setPayrollRollup(null)
        if (r8.ok) setCashRollup(j8.rollup ?? null)
        else setCashRollup(null)
        if (r9.ok) setObservabilityRollup(j9.rollup ?? null)
        else setObservabilityRollup(null)
      } catch {
        setRevenueRollup(null)
        setCommandRollup(null)
        setHealthRollup(null)
        setCollectionsRollup(null)
        setRecurringRollup(null)
        setMembershipRollup(null)
        setPayrollRollup(null)
        setCashRollup(null)
        setObservabilityRollup(null)
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
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">AP — orgs w/ open payables</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.apOpenPayablesOrgsApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">AP — open outstanding (approx)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(revenueRollup.apOpenOutstandingCentsTotalApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">AP — overdue open lines</p>
              <p className="text-lg font-semibold tabular-nums">{revenueRollup.apOverdueOpenLinesApprox}</p>
            </div>
          </div>
        </div>
      ) : null}

      {commandRollup ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Financial command center (platform)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Bounded scans across workspaces — use with BlitzPay Ops playbooks. Schema:{" "}
            {commandRollup.schemaHealthOk ? "OK" : "check failures"}.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">AP — orgs (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.orgsWithOpenVendorPayablesApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">AP — overdue orgs (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.orgsVendorPayablesOverdueApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Connect launch gaps</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.orgsLaunchReadinessConnectGapApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Stale Connect sync (7d)</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.orgsStaleConnectSync7d}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Failed pay attempts (7d)</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.failedPaymentAttempts7d}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Open disputes (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.openDisputesPlatformSample}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Pending refunds</p>
              <p className="text-lg font-semibold tabular-nums">{commandRollup.pendingRefundsPlatform}</p>
            </div>
          </div>
        </div>
      ) : null}

      {observabilityRollup ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Enterprise observability (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{observabilityRollup.disclaimer}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Org snapshots (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{observabilityRollup.orgSnapshotsSampled}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg queue health</p>
              <p className="text-lg font-semibold tabular-nums">{observabilityRollup.averageQueueHealthScoreApprox}/100</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg worker health</p>
              <p className="text-lg font-semibold tabular-nums">{observabilityRollup.averageWorkerHealthScoreApprox}/100</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Replay backlog orgs</p>
              <p className="text-lg font-semibold tabular-nums">{observabilityRollup.orgsWithReplayBacklogApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Queue depth pressure orgs</p>
              <p className="text-lg font-semibold tabular-nums">{observabilityRollup.orgsWithQueueDepthApprox}</p>
            </div>
          </div>
        </div>
      ) : null}

      {healthRollup && healthRollup.orgsSampled > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Executive business health (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled up to {healthRollup.orgsSampled} active Connect workspaces ({healthRollup.reportingWindowDays}d window).
            Deterministic scores — not a credit score; use for internal monitoring only.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg overall health</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.averageOverallHealth}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg financial</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.averageFinancialHealth}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg collections</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.averageCollectionsHealth}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Orgs under stress</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.orgsUnderStressApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg AR pressure ratio</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.averageArPressureRatio}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Financing adoption %</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.financingAdoptionRatePct}%</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg reminder dispatch %</p>
              <p className="text-lg font-semibold tabular-nums">{healthRollup.averageReminderDispatchPct}%</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg payout delay (d)</p>
              <p className="text-lg font-semibold tabular-nums">
                {healthRollup.averagePayoutDelayDays == null ? "—" : healthRollup.averagePayoutDelayDays}
              </p>
            </div>
          </div>
          {healthRollup.commonBottlenecks.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-[11px] text-amber-950">
              <p className="font-semibold mb-1">Common bottlenecks (themes)</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {healthRollup.commonBottlenecks.map((b) => (
                  <li key={b.slice(0, 120)}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {healthRollup.topGrowthOpportunityThemes.length > 0 ? (
            <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-3 text-[11px] text-sky-950">
              <p className="font-semibold mb-1">Growth opportunity themes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {healthRollup.topGrowthOpportunityThemes.map((b) => (
                  <li key={b.slice(0, 120)}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {collectionsRollup && collectionsRollup.orgsSampled > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Collections acceleration (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled {collectionsRollup.orgsSampled} Connect workspaces ({collectionsRollup.reportingWindowDays}d). Totals
            are directional, not audited cash forecasts.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Overdue AR (approx sum)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(collectionsRollup.overdueCollectibleCentsTotalApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Recoverable overdue (heuristic)</p>
              <p className="text-lg font-semibold tabular-nums">
                {fmtMoney(collectionsRollup.estimatedRecoverableOverdueCentsApprox)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Field opportunity (approx)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(collectionsRollup.fieldCollectibleCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg active plans / org</p>
              <p className="text-lg font-semibold tabular-nums">{collectionsRollup.installmentPlansActiveApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">ACH-heavy orgs (sample)</p>
              <p className="text-lg font-semibold tabular-nums">{collectionsRollup.achAdoptionOrgsApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg reminder dispatch %</p>
              <p className="text-lg font-semibold tabular-nums">{collectionsRollup.averageReminderDispatchPct}%</p>
            </div>
          </div>
          {collectionsRollup.topRiskThemes.length > 0 ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50/80 p-3 text-[11px] text-rose-950">
              <p className="font-semibold mb-1">Operational risk themes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {collectionsRollup.topRiskThemes.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {recurringRollup && recurringRollup.orgsSampled > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Recurring revenue & renewals (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled {recurringRollup.orgsSampled} Connect workspaces ({recurringRollup.reportingWindowDays}d). Averages are
            directional; bounded reads only.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg planned renewals (30d)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(recurringRollup.averagePlannedRecurring30dCents)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg autopay adoption %</p>
              <p className="text-lg font-semibold tabular-nums">{recurringRollup.averageAutopayAdoptionPct}%</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg renewal success proxy %</p>
              <p className="text-lg font-semibold tabular-nums">{recurringRollup.averageRenewalSuccessProxyPct}%</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg churn-risk score</p>
              <p className="text-lg font-semibold tabular-nums">{recurringRollup.averageChurnRiskScore0to100}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Orgs w/ failed renewals</p>
              <p className="text-lg font-semibold tabular-nums">{recurringRollup.orgsWithFailedRenewalsApprox}</p>
            </div>
          </div>
          {recurringRollup.topOperationalThemes.length > 0 ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-[11px]">
              <p className="font-semibold mb-1">Themes</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {recurringRollup.topOperationalThemes.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {cashRollup && cashRollup.orgsSampled > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Operating cash &amp; runway (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled {cashRollup.orgsSampled} recent orgs ({cashRollup.reportingWindowDays}d). Estimates are internal planning
            only; not custodial balances.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Reserve gap orgs</p>
              <p className="text-lg font-semibold tabular-nums">{cashRollup.orgsWithReserveGapApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Runway risk / watch</p>
              <p className="text-lg font-semibold tabular-nums">
                {cashRollup.orgsRunwayRiskApprox} / {cashRollup.orgsRunwayWatchApprox}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Sample operating cash sum</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(cashRollup.sampleEstimatedOperatingCashTotalApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Low payroll coverage orgs</p>
              <p className="text-lg font-semibold tabular-nums">{cashRollup.payrollReserveLowCoverageOrgsApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Low AP coverage orgs</p>
              <p className="text-lg font-semibold tabular-nums">{cashRollup.apReserveLowCoverageOrgsApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Outflow stress orgs</p>
              <p className="text-lg font-semibold tabular-nums">{cashRollup.outflowStressOrgsApprox}</p>
            </div>
          </div>
        </div>
      ) : null}

      {payrollRollup && payrollRollup.orgsSampled > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payroll & commission exposure (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled {payrollRollup.orgsSampled} recent orgs ({payrollRollup.reportingWindowDays}d window). Directional totals;
            bounded reads only. Not ACH payroll processing.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Draft payroll runs (orgs)</p>
              <p className="text-lg font-semibold tabular-nums">{payrollRollup.orgsWithDraftPayrollApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Failed payroll (orgs)</p>
              <p className="text-lg font-semibold tabular-nums">{payrollRollup.orgsWithFailedPayrollApprox}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Pending commissions (sample sum)</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(payrollRollup.pendingCommissionExposureCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Contractor settlements pending</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(payrollRollup.contractorSettlementPendingCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Revenue-share pending</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(payrollRollup.recurringSharePendingCentsApprox)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">High commission exposure orgs</p>
              <p className="text-lg font-semibold tabular-nums">{payrollRollup.highCommissionExposureOrgsApprox}</p>
            </div>
          </div>
        </div>
      ) : null}

      {membershipRollup && membershipRollup.sampledOrganizations > 0 ? (
        <div className="rounded-xl border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Native memberships (platform sample)
          </p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Sampled {membershipRollup.sampledOrganizations} recent orgs; {membershipRollup.organizationsWithMemberships} show
            membership rows. Bounded reads only.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Active memberships</p>
              <p className="text-lg font-semibold tabular-nums">{membershipRollup.totalActiveMembershipsSample}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">MRR sample total</p>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(membershipRollup.totalMrrCentsSample)}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Delinquents</p>
              <p className="text-lg font-semibold tabular-nums">{membershipRollup.delinquentMembershipsSample}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Open failures</p>
              <p className="text-lg font-semibold tabular-nums">{membershipRollup.openFailuresSample}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Avg autopay %</p>
              <p className="text-lg font-semibold tabular-nums">{membershipRollup.avgAutopayAdoptionPctSample}%</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Delinquency pressure %</p>
              <p className="text-lg font-semibold tabular-nums">{membershipRollup.delinquencyPressurePct}%</p>
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
