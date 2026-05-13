"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Network, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"

type Phase5b = {
  supplierNetworkParticipationScore: number
  procurementBenchmarkScore: number
  preferredPricingOpportunityCents: number
  bulkPurchaseOpportunityCents: number
  supplierPerformanceHealthScore: number
  rebateCaptureOpportunityScore: number
  vendorFinancingOpportunityScore: number
  supplierNetworkCoverageRate: number
}

type HealthPayload = {
  disclaimer: string
  sinceIso: string | null
  phase5b: Phase5b
  visibleNetworkCount: number
}

type NetworkRow = {
  id: string
  network_name: string
  network_type: string
  network_status: string
  visibility_scope: string
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpaySupplierNetworkPanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthPayload | null>(null)
  const [networks, setNetworks] = useState<NetworkRow[]>([])
  const [programs, setPrograms] = useState<Array<Record<string, unknown>>>([])
  const [bulk, setBulk] = useState<Array<Record<string, unknown>>>([])
  const [scores, setScores] = useState<Array<Record<string, unknown>>>([])
  const [benchmarks, setBenchmarks] = useState<Array<Record<string, unknown>>>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setNetworks([])
      return
    }
    setLoading(true)
    setError(null)
    const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/supplier-network`
    try {
      const [hRes, nRes, pRes, bRes, sRes, mRes] = await Promise.all([
        fetch(`${base}/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/networks`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/preferred-programs`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/bulk-opportunities`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/vendor-performance`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/benchmarks?limit=24`, { cache: "no-store", credentials: "include" }),
      ])
      if (!hRes.ok || !nRes.ok || !pRes.ok || !bRes.ok || !sRes.ok || !mRes.ok) {
        setHealth(null)
        setError(blitzpayStaffWidgetLoadCopy.supplierNetwork)
        return
      }
      const h = (await hRes.json()) as HealthPayload
      setHealth(h)
      const nj = (await nRes.json()) as { networks: NetworkRow[] }
      setNetworks(nj.networks ?? [])
      const pj = (await pRes.json()) as { programs: Array<Record<string, unknown>> }
      setPrograms(pj.programs ?? [])
      const bj = (await bRes.json()) as { opportunities: Array<Record<string, unknown>> }
      setBulk(bj.opportunities ?? [])
      const sj = (await sRes.json()) as { scores: Array<Record<string, unknown>> }
      setScores(sj.scores ?? [])
      const mj = (await mRes.json()) as { benchmarks: Array<Record<string, unknown>> }
      setBenchmarks(mj.benchmarks ?? [])
    } catch {
      setHealth(null)
      setError(blitzpayStaffWidgetLoadCopy.supplierNetwork)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const p5 = health?.phase5b

  return (
    <div
      id="blitzpay-supplier-network"
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5",
        "shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]",
        "min-w-0 max-w-full overflow-x-hidden",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Network className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Supplier network</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Opt-in coordination across distributors and peer contractors — aggregate benchmarks and planning signals
              only. Nothing here buys inventory or extends credit automatically.
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
          <Loader2 className="w-4 h-4 animate-spin" /> Loading supplier network signals…
        </p>
      : null}

      {health && p5 ?
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Reporting window since {health?.sinceIso ? new Date(health.sinceIso).toLocaleDateString() : "—"} · Visible
            networks {health?.visibleNetworkCount ?? 0}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
            {[
              { k: "Network participation (advisory score)", v: `${p5.supplierNetworkParticipationScore}/100` },
              { k: "Procurement benchmark (aggregate)", v: `${p5.procurementBenchmarkScore}/100` },
              { k: "Preferred pricing signal (upper bound est.)", v: fmtMoney(p5.preferredPricingOpportunityCents) },
              { k: "Bulk coordination savings (est.)", v: fmtMoney(p5.bulkPurchaseOpportunityCents) },
              { k: "Supplier performance health", v: `${p5.supplierPerformanceHealthScore}/100` },
              { k: "Rebate capture opportunity (score)", v: `${p5.rebateCaptureOpportunityScore}/100` },
              { k: "Vendor financing visibility (score)", v: `${p5.vendorFinancingOpportunityScore}/100` },
              { k: "Network coverage (networks + seats)", v: `${p5.supplierNetworkCoverageRate}/100` },
            ].map((x) => (
              <div key={x.k} className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5 min-w-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide leading-snug break-words">{x.k}</p>
                <p className="text-sm font-semibold tabular-nums mt-1 text-foreground">{x.v}</p>
              </div>
            ))}
          </div>
        </>
      : !loading && (health?.visibleNetworkCount ?? 0) === 0 && networks.length === 0 ?
        <p className="text-sm text-muted-foreground">
          No supplier networks yet. When your organization creates or joins a network with approved sharing, preferred
          programs, bulk coordination rows, and aggregate benchmarks appear here.
        </p>
      : null}

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Networks you can see</p>
        {networks.length === 0 ?
          <p className="text-sm text-muted-foreground">No networks listed for this organization.</p>
        : <ul className="space-y-2 text-sm">
            {networks.map((n) => (
              <li key={n.id} className="rounded-lg border border-border/70 px-3 py-2 flex flex-wrap justify-between gap-2 min-w-0">
                <span className="font-medium text-foreground min-w-0 break-words">{n.network_name}</span>
                <span className="text-muted-foreground text-xs min-w-0 break-words text-right">
                  {formatBlitzpayUiLabel(n.network_type)} · {formatBlitzpayUiLabel(n.network_status)} ·{" "}
                  {formatBlitzpayUiLabel(n.visibility_scope)}
                </span>
              </li>
            ))}
          </ul>
        }
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preferred programs (bounded)</p>
          {programs.length === 0 ?
            <p className="text-sm text-muted-foreground">No preferred programs visible.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {programs.slice(0, 8).map((p) => (
                <li key={String(p.id)} className="tabular-nums">
                  <span className="font-medium text-foreground">{String(p.program_name ?? "Program")}</span> ·{" "}
                  {formatBlitzpayUiLabel(String(p.pricing_structure ?? ""))} · {formatBlitzpayUiLabel(String(p.program_status ?? ""))}
                </li>
              ))}
            </ul>
          }
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bulk coordination (visibility)</p>
          {bulk.length === 0 ?
            <p className="text-sm text-muted-foreground">No active bulk rows visible.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {bulk.slice(0, 8).map((o) => (
                <li key={String(o.id)} className="tabular-nums">
                  <span className="font-medium text-foreground">{formatBlitzpayUiLabel(String(o.opportunity_type ?? ""))}</span> ·{" "}
                  {formatBlitzpayUiLabel(String(o.opportunity_status ?? ""))}
                  {o.estimated_savings_cents != null ?
                    ` · est. savings ${fmtMoney(Math.max(0, Math.round(Number(o.estimated_savings_cents))))}`
                  : ""}
                </li>
              ))}
            </ul>
          }
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Supplier scorecards (org-local)</p>
          {scores.length === 0 ?
            <p className="text-sm text-muted-foreground">No stored supplier scores yet.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {scores.slice(0, 8).map((r) => (
                <li key={String(r.id)} className="tabular-nums">
                  Vendor {String(r.vendor_id ?? "").slice(0, 8)}… · overall {String(r.overall_score ?? "—")} ·{" "}
                  {String(r.score_period ?? "")}
                </li>
              ))}
            </ul>
          }
        </div>
        <div className="rounded-lg border border-border/70 px-3 py-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aggregate benchmarks</p>
          {benchmarks.length === 0 ?
            <p className="text-sm text-muted-foreground">No shared procurement benchmarks posted for visible networks.</p>
          : <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              {benchmarks.slice(0, 8).map((b) => (
                <li key={String(b.id)}>
                  {formatBlitzpayUiLabel(String(b.benchmark_type ?? ""))} · {formatBlitzpayUiLabel(String(b.benchmark_period ?? ""))} · score{" "}
                  {String(b.benchmark_score ?? "—")}
                </li>
              ))}
            </ul>
          }
          <p className="text-xs text-muted-foreground leading-relaxed pt-1">
            Benchmarks are rolled up for the network — not customer-level and not raw contract text.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Staff APIs live under{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[11px]">/api/organizations/…/blitzpay/supplier-network/*</code>.{" "}
        <Link href={blitzpayFccHref("procurement-inventory")} className="text-primary underline-offset-2 hover:underline">
          Procurement &amp; inventory
        </Link>{" "}
        remains the system of record for stock and rebates on your own org.
      </p>
    </div>
  )
}
