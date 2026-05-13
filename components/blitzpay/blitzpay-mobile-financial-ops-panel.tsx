"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

const DISCLAIMER =
  "Mobile financial actions captured offline are reviewed and validated by the server before they become official financial records."

type Phase6a = {
  mobileFinancialIntentCount: number
  offlineFinancialIntentCount: number
  mobileSyncFailureRate: number
  mobileSignatureCoverageRate: number
  mobilePayrollApprovalPendingCount: number
  fieldCollectionsIntentCents: number
  mobileTreasuryVisibilityScore: number
  mobileConflictReviewCount: number
}

type HealthPayload = {
  disclaimer: string
  sinceIso: string | null
  phase6a: Phase6a
  recentActivity: Array<{ audit_type: string; audit_summary: string; created_at: string }>
}

type IntentRow = {
  id: string
  intent_type: string
  intent_status: string
  captured_offline: boolean
  amount_cents: number | null
  summary: string | null
}

type SigRow = { id: string; authorization_type: string; authorization_status: string; signature_reference_recorded?: boolean }

type PayrollRow = { id: string; approval_status: string; approval_type: string; amount_cents: number | null }

type TreasuryRow = Record<string, unknown>

type SyncRow = {
  id: string
  batch_status: string
  offline_item_count: number
  processed_item_count: number
  failed_item_count: number
  submitted_at: string
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayMobileFinancialOpsPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [intents, setIntents] = useState<IntentRow[]>([])
  const [signatures, setSignatures] = useState<SigRow[]>([])
  const [payroll, setPayroll] = useState<PayrollRow[]>([])
  const [treasury, setTreasury] = useState<TreasuryRow[]>([])
  const [syncBatches, setSyncBatches] = useState<SyncRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const base = useCallback(() => {
    if (!organizationId) return ""
    return `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/mobile`
  }, [organizationId])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setIntents([])
      setSignatures([])
      setPayroll([])
      setTreasury([])
      setSyncBatches([])
      return
    }
    setLoading(true)
    setError(null)
    const b = base()
    try {
      const [hRes, iRes, sRes, pRes, tRes, yRes] = await Promise.all([
        fetch(`${b}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/intents`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/signatures`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/payroll-approvals`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/treasury-summary`, { cache: "no-store", credentials: "include" }),
        fetch(`${b}/sync-batches`, { cache: "no-store", credentials: "include" }),
      ])
      if (!hRes.ok || !iRes.ok || !sRes.ok || !pRes.ok || !tRes.ok || !yRes.ok) {
        setHealth(null)
        setError(blitzpayStaffWidgetLoadCopy.mobileFinancialOps)
        return
      }
      const h = (await hRes.json()) as HealthPayload
      const i = (await iRes.json()) as { items: IntentRow[] }
      const s = (await sRes.json()) as { items: SigRow[] }
      const p = (await pRes.json()) as { items: PayrollRow[] }
      const t = (await tRes.json()) as { items: TreasuryRow[] }
      const y = (await yRes.json()) as { items: SyncRow[] }
      setHealth(h)
      setIntents(i.items ?? [])
      setSignatures(s.items ?? [])
      setPayroll(p.items ?? [])
      setTreasury(t.items ?? [])
      setSyncBatches(y.items ?? [])
    } catch {
      setHealth(null)
      setError(blitzpayStaffWidgetLoadCopy.mobileFinancialOps)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady, base])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const p6 = health?.phase6a

  return (
    <div
      id="blitzpay-mobile-financial-ops"
      className={cn(
        "rounded-xl border border-border bg-white dark:bg-card p-4 shadow-sm space-y-4",
        "min-w-0 max-w-full overflow-x-hidden",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Smartphone className="h-5 w-5 text-muted-foreground shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Mobile financial ops</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-prose">
              Field capture for intents, approvals, and visibility summaries. Offline queue only — no money movement from this
              panel.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed border border-border/60 rounded-lg px-3 py-2 bg-muted/20">
        {DISCLAIMER}
      </p>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      {p6 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm min-w-0">
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Intents (sample)</p>
            <p className="font-semibold tabular-nums">{p6.mobileFinancialIntentCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Offline capture</p>
            <p className="font-semibold tabular-nums">{p6.offlineFinancialIntentCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Sync issues</p>
            <p className="font-semibold tabular-nums">{p6.mobileSyncFailureRate}%</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Conflicts</p>
            <p className="font-semibold tabular-nums">{p6.mobileConflictReviewCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground leading-snug">Signatures vs intents</p>
            <p className="font-semibold tabular-nums">{p6.mobileSignatureCoverageRate}/100</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Payroll pending</p>
            <p className="font-semibold tabular-nums">{p6.mobilePayrollApprovalPendingCount}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground leading-snug">Field collection intents</p>
            <p className="font-semibold tabular-nums">{fmtMoney(p6.fieldCollectionsIntentCents)}</p>
          </div>
          <div className="rounded-lg border border-border/70 px-2 py-2 min-w-0">
            <p className="text-xs text-muted-foreground">Treasury visibility</p>
            <p className="font-semibold tabular-nums">{p6.mobileTreasuryVisibilityScore}/100</p>
          </div>
        </div>
      ) : loading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading mobile ops…
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offline / queued intents</p>
          <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-1">
            {intents.length === 0 ? (
              <li className="text-muted-foreground text-xs">
                No field intents in the recent bounded window — new captures appear here after mobile sync.
              </li>
            ) : (
              intents.map((it) => (
                <li key={it.id} className="rounded-md border border-border/60 px-2 py-1.5 min-w-0 break-words">
                  <span className="font-medium">{formatBlitzpayUiLabel(it.intent_type)}</span>
                  <span className="text-muted-foreground"> · {formatBlitzpayUiLabel(it.intent_status)}</span>
                  {it.captured_offline ? (
                    <span className="ml-2 text-xs font-semibold text-amber-800 dark:text-amber-200">Offline</span>
                  ) : (
                    <span className="ml-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200">Online</span>
                  )}
                  {it.amount_cents != null ? (
                    <span className="block text-xs text-muted-foreground tabular-nums">{fmtMoney(it.amount_cents)}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signature authorizations</p>
          <ul className="space-y-1.5 text-sm max-h-48 overflow-y-auto pr-1">
            {signatures.length === 0 ? (
              <li className="text-muted-foreground text-xs">
                No signature authorizations in the recent window — completed authorizations list here once recorded.
              </li>
            ) : (
              signatures.map((s) => (
                <li key={s.id} className="rounded-md border border-border/60 px-2 py-1.5 min-w-0 break-words">
                  <span className="font-medium">{formatBlitzpayUiLabel(s.authorization_type)}</span>
                  <span className="text-muted-foreground"> · {formatBlitzpayUiLabel(s.authorization_status)}</span>
                  {s.signature_reference_recorded ? (
                    <span className="ml-2 text-xs text-muted-foreground">Reference on file</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payroll approval queue</p>
          <ul className="space-y-1.5 text-sm max-h-40 overflow-y-auto pr-1">
            {payroll.length === 0 ? (
              <li className="text-muted-foreground text-xs">
                Payroll approvals will list here when items are queued for field or manager sign-off.
              </li>
            ) : (
              payroll.map((r) => (
                <li key={r.id} className="rounded-md border border-border/60 px-2 py-1.5 min-w-0 break-words">
                  <span className="font-medium">{formatBlitzpayUiLabel(r.approval_type)}</span>
                  <span className="text-muted-foreground"> · {formatBlitzpayUiLabel(r.approval_status)}</span>
                  {r.amount_cents != null ? (
                    <span className="block text-xs tabular-nums text-muted-foreground">{fmtMoney(r.amount_cents)}</span>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sync health</p>
          <ul className="space-y-1.5 text-sm max-h-40 overflow-y-auto pr-1">
            {syncBatches.length === 0 ? (
              <li className="text-muted-foreground text-xs">
                No sync batches in the recent window — batches appear as technicians upload offline work.
              </li>
            ) : (
              syncBatches.map((b) => (
                <li key={b.id} className="rounded-md border border-border/60 px-2 py-1.5 text-xs min-w-0 break-words">
                  <span className="font-semibold">{formatBlitzpayUiLabel(b.batch_status)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · items {b.processed_item_count}/{b.offline_item_count}
                    {b.failed_item_count ? ` · issues ${b.failed_item_count}` : ""}
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      <div className="space-y-2 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field treasury summary (bands)</p>
        {treasury.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No field treasury band snapshots yet — summaries populate when mobile treasury capture runs for the org.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {treasury.map((row, idx) => (
              <li key={idx} className="rounded-md border border-border/60 px-2 py-1.5 text-xs leading-relaxed min-w-0 break-words">
                <span className="font-medium">{formatBlitzpayUiLabel(String(row.visible_to_role ?? ""))}</span>
                <span className="text-muted-foreground"> · {String(row.snapshot_date ?? "")}</span>
                {row.available_cash_cents != null ? (
                  <span className="block text-muted-foreground tabular-nums">
                    Cash signal: {fmtMoney(Number(row.available_cash_cents))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Field finance activity</p>
        <ul className="space-y-1 max-h-40 overflow-y-auto text-xs text-muted-foreground pr-1 min-w-0">
          {(health?.recentActivity ?? []).length === 0 ? (
            <li>No recent activity in this view.</li>
          ) : (
            (health?.recentActivity ?? []).map((a, i) => (
              <li key={`${a.created_at}-${i}`} className="break-words">
                <span className="font-medium text-foreground">{formatBlitzpayUiLabel(a.audit_type)}</span> — {a.audit_summary}
              </li>
            ))
          )}
        </ul>
      </div>

      <p className="text-[11px] text-muted-foreground">
        <Link href="/insights/financial-command-center/mobile-financial-ops" className="text-primary underline-offset-2 hover:underline">
          Open on Financial Command Center
        </Link>
      </p>
    </div>
  )
}
