"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Building2, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"

type Phase5a = {
  multiEntityRevenueExposureCents: number
  multiEntityTreasuryExposureCents: number
  intercompanyBalanceExposureCents: number
  consolidatedCollectionsRate: number
  franchiseHealthScore: number
  sharedBenchmarkCoverage: number
  multiEntityRiskScore: number
  consolidatedOrganizationCount: number
}

type HealthPayload = {
  disclaimer: string
  sinceIso: string | null
  phase5a: Phase5a
  visibleGroupCount: number
  activeMemberOrgApprox: number
  rollups: {
    regionalTreasuryRollupCents: number
    regionalPayrollRollupCents: number
    regionalProcurementInventoryCents: number
  }
  intercompanyBalanceRows: number
}

type GroupRow = {
  id: string
  organization_id: string
  group_name: string
  group_type: string
  group_status: string
  parent_group_id: string | null
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayMultiEntityFinancePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [balances, setBalances] = useState<Array<{ balance_amount_cents: number; balance_status: string }>>([])
  const [snapshots, setSnapshots] = useState<Array<Record<string, unknown>>>([])
  const [benchmarks, setBenchmarks] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setGroups([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/multi-entity`
    try {
      const [hRes, gRes, bRes, sRes, mRes] = await Promise.all([
        fetch(`${base}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/groups`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/intercompany-balances`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/consolidated-snapshots?limit=10`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/benchmarks?limit=24`, { cache: "no-store", credentials: "include" }),
      ])
      if (!hRes.ok || !gRes.ok || !bRes.ok || !sRes.ok || !mRes.ok) {
        setHealth(null)
        setError(blitzpayStaffWidgetLoadCopy.multiEntityFinance)
        return
      }
      const h = (await hRes.json()) as HealthPayload
      setHealth(h)
      const gj = (await gRes.json()) as { groups: GroupRow[] }
      setGroups(gj.groups ?? [])
      const bj = (await bRes.json()) as { balances: Array<{ balance_amount_cents: number; balance_status: string }> }
      setBalances(bj.balances ?? [])
      const sj = (await sRes.json()) as { snapshots: Array<Record<string, unknown>> }
      setSnapshots(sj.snapshots ?? [])
      const mj = (await mRes.json()) as { benchmarks: Array<Record<string, unknown>> }
      setBenchmarks(mj.benchmarks ?? [])
    } catch {
      setHealth(null)
      setError(blitzpayStaffWidgetLoadCopy.multiEntityFinance)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const p5 = health?.phase5a

  return (
    <div
      id="blitzpay-multi-entity-finance"
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Building2 className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Multi-entity finance</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Group rollups for franchises, regional operators, and multi-location contractors — reporting only. Each
              location keeps its own books and permissions.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}

      {health?.disclaimer ?
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3">{health.disclaimer}</p>
      : null}

      {loading && !health ?
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading linked-location signals…
        </p>
      : null}

      {health && health.visibleGroupCount > 0 && p5 ?
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Window since {health?.sinceIso ? new Date(health.sinceIso).toLocaleDateString() : "—"} · Groups{" "}
            {health?.visibleGroupCount ?? 0} · Approx. linked orgs {health?.activeMemberOrgApprox ?? 0}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { k: "Regional treasury rollup (est.)", v: fmtMoney(health?.rollups.regionalTreasuryRollupCents ?? 0) },
              { k: "Regional payroll / burden rollup (est.)", v: fmtMoney(health?.rollups.regionalPayrollRollupCents ?? 0) },
              { k: "Procurement & inventory rollup (est.)", v: fmtMoney(health?.rollups.regionalProcurementInventoryCents ?? 0) },
              { k: "Inter-company rows (visible)", v: String(health?.intercompanyBalanceRows ?? 0) },
              { k: "Revenue exposure (aggregate est.)", v: fmtMoney(p5.multiEntityRevenueExposureCents) },
              { k: "Treasury exposure (aggregate est.)", v: fmtMoney(p5.multiEntityTreasuryExposureCents) },
              { k: "Inter-company balances (active)", v: fmtMoney(p5.intercompanyBalanceExposureCents) },
              { k: "Collections rate (mean across linked)", v: `${p5.consolidatedCollectionsRate}/100` },
              { k: "Franchise health (advisory)", v: `${p5.franchiseHealthScore}/100` },
              { k: "Shared benchmark coverage", v: `${p5.sharedBenchmarkCoverage}/100` },
              { k: "Multi-entity risk (mean)", v: `${p5.multiEntityRiskScore}/100` },
              { k: "Organizations in rollups", v: String(p5.consolidatedOrganizationCount) },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug">{x.k}</p>
                <p className="text-sm font-semibold tabular-nums mt-1 text-foreground">{x.v}</p>
              </div>
            ))}
          </div>
        </>
      : !loading && (health?.visibleGroupCount ?? 0) === 0 ?
        <p className="text-sm text-muted-foreground">
          No financial groups linked yet. When your organization anchors or joins a group, regional rollups and
          inter-company summaries appear here.
        </p>
      : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Group hierarchy</p>
        {groups.length === 0 ?
          <p className="text-sm text-muted-foreground">No groups visible for this organization.</p>
        : <ul className="space-y-2 text-sm">
            {groups.map((g) => (
              <li key={g.id} className="rounded-lg border border-border/70 px-3 py-2 flex flex-wrap justify-between gap-2">
                <span className="font-medium text-foreground">{g.group_name}</span>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">
                  {g.group_type.replace(/_/g, " ")} · {g.group_status}
                </span>
              </li>
            ))}
          </ul>
        }
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inter-company summary</p>
          {balances.length === 0 ?
            <p className="text-sm text-muted-foreground">No inter-company tracking rows in visible groups.</p>
          : <ul className="text-sm space-y-1 text-muted-foreground max-h-40 overflow-y-auto">
              {balances.slice(0, 12).map((b, idx) => (
                <li key={idx} className="tabular-nums">
                  {String(b.balance_status)} · {fmtMoney(b.balance_amount_cents)}
                </li>
              ))}
            </ul>
          }
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Consolidated KPI snapshots</p>
          {snapshots.length === 0 ?
            <p className="text-sm text-muted-foreground">No stored consolidated snapshots yet (reporting-only persistence).</p>
          : <ul className="text-sm space-y-1 text-muted-foreground max-h-40 overflow-y-auto">
              {snapshots.slice(0, 8).map((s, idx) => (
                <li key={idx} className="tabular-nums">
                  {String(s.snapshot_date)} · revenue {fmtMoney(Number(s.total_revenue_cents ?? 0))}
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shared benchmark scorecards</p>
        {benchmarks.length === 0 ?
          <p className="text-sm text-muted-foreground">No stored benchmark rows yet. Coverage above is computed live from linked reporting.</p>
        : <ul className="text-sm space-y-1 text-muted-foreground">
            {benchmarks.slice(0, 8).map((b, idx) => (
              <li key={idx}>
                {String(b.benchmark_type)} / {String(b.benchmark_period)} — score {String(b.benchmark_score ?? "—")}
              </li>
            ))}
          </ul>
        }
      </div>

      <p className="text-xs text-muted-foreground">
        Need the full command center view?{" "}
        <Link href="/insights/financial-command-center" className="text-primary underline-offset-2 hover:underline">
          Financial command center
        </Link>
        .
      </p>
    </div>
  )
}
