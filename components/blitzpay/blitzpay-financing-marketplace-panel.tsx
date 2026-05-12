"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, Landmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type Health = {
  generatedAt: string
  disclaimer: string
  qualificationNote: string
  pipeline: Record<string, number>
  recentAudit: Array<{ id: string; audit_type: string; audit_summary: string; created_at: string }>
}

type ProviderRow = {
  id: string
  provider_name: string
  provider_status: string
  provider_type: string
}

type AppRow = {
  id: string
  application_type: string
  application_status: string
  requested_amount_cents: number
  qualification_score: number | null
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayFinancingMarketplacePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [applications, setApplications] = useState<AppRow[]>([])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setProviders([])
      setApplications([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay`
      const [hRes, pRes, aRes] = await Promise.all([
        fetch(`${base}/financing/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/financing/providers`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/financing/applications`, { cache: "no-store", credentials: "include" }),
      ])
      const [hJson, pJson, aJson] = await Promise.all([
        hRes.json().catch(() => null) as Promise<{ financingHealth?: Health } | null>,
        pRes.json().catch(() => null) as Promise<{ providers?: ProviderRow[] } | null>,
        aRes.json().catch(() => null) as Promise<{ applications?: AppRow[] } | null>,
      ])
      if (!hRes.ok || !pRes.ok || !aRes.ok) {
        setHealth(null)
        setProviders([])
        setApplications([])
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setHealth(hJson?.financingHealth ?? null)
      setProviders((pJson?.providers ?? []).slice(0, 24))
      setApplications((aJson?.applications ?? []).slice(0, 20))
    } catch {
      setHealth(null)
      setProviders([])
      setApplications([])
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  return (
    <div
      id="blitzpay-financing-marketplace-anchor"
      className="rounded-xl border border-border bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Financing marketplace</h3>
            <p className="text-sm text-muted-foreground leading-snug">
              Orchestration and readiness only — Equipify does not lend or hold funds.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-500/50 pl-3">
        {health?.disclaimer ??
          "Financing options are offered through third-party providers. Approval and terms are determined by the financing provider."}
      </p>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {health ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Draft</p>
            <p className="font-semibold tabular-nums mt-1">{health.pipeline.draft ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Submitted</p>
            <p className="font-semibold tabular-nums mt-1">{health.pipeline.submitted ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Approved</p>
            <p className="font-semibold tabular-nums mt-1">{health.pipeline.approved ?? 0}</p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Funded</p>
            <p className="font-semibold tabular-nums mt-1">{health.pipeline.funded ?? 0}</p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">{health?.qualificationNote}</p>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Providers (marketplace)</p>
        <div className="overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                    No providers configured yet.
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{p.provider_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.provider_type}</td>
                    <td className="px-3 py-2">{p.provider_status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Applications (recent)</p>
        <ul className="space-y-2 text-sm">
          {applications.length === 0 ? (
            <li className="text-muted-foreground">No applications yet.</li>
          ) : (
            applications.map((a) => (
              <li key={a.id} className="rounded-lg border border-border/60 px-3 py-2 flex flex-wrap justify-between gap-2">
                <span className="font-medium">{a.application_type}</span>
                <span className="text-muted-foreground">{a.application_status}</span>
                {typeof a.qualification_score === "number" ? (
                  <span className="text-xs text-muted-foreground w-full">Readiness (internal): {a.qualification_score}/100</span>
                ) : null}
                <span className="tabular-nums w-full sm:w-auto">{fmtMoney(a.requested_amount_cents)}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {(health?.recentAudit ?? []).slice(0, 8).map((e) => (
            <li key={e.id} className="flex gap-2">
              <span className="shrink-0 text-[10px] font-medium text-muted-foreground">{formatBlitzpayUiLabel(e.audit_type)}</span>
              <span className="leading-snug">{e.audit_summary}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
