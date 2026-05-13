"use client"

import { useCallback, useEffect, useState } from "react"
import { Scale, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import { formatBlitzpayUiLabel } from "@/lib/blitzpay/blitzpay-ui-labels"

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100)
}

type ComplianceHealth = {
  generatedAt: string
  reporting: {
    salesTaxPayableCents: number
    payrollTaxPayableCents: number
    contractorTaxEstimateCents: number
    convenienceFeeExposureRisk: number
    achAuthorizationCoverageRate: number
    vendor1099ReadinessRate: number
    filingReadinessScore: number
    complianceHealthScore: number
  }
  jurisdictionCount: number
  activeRuleCount: number
  recentAudit: Array<{
    id: string
    audit_type: string
    audit_summary: string
    created_at: string
  }>
  convenienceFeeWarnings: string[]
  disclaimer: string
}

type JurisdictionRow = {
  id: string
  jurisdiction_name: string
  jurisdiction_type: string
  tax_status: string
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

export function BlitzpayTaxCompliancePanel({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<ComplianceHealth | null>(null)
  const [jurisdictions, setJurisdictions] = useState<JurisdictionRow[]>([])
  const [auditTail, setAuditTail] = useState<ComplianceHealth["recentAudit"]>([])

  const load = useCallback(async () => {
    if (!organizationId || !orgReady) {
      setHealth(null)
      setJurisdictions([])
      setAuditTail([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const base = `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay`
      const [hRes, jRes, aRes] = await Promise.all([
        fetch(`${base}/compliance/health`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/tax/jurisdictions`, { cache: "no-store", credentials: "include" }),
        fetch(`${base}/compliance/audit-log`, { cache: "no-store", credentials: "include" }),
      ])
      const [hJson, jJson, aJson] = await Promise.all([
        hRes.json().catch(() => null) as Promise<{ complianceHealth?: ComplianceHealth } | null>,
        jRes.json().catch(() => null) as Promise<{ jurisdictions?: JurisdictionRow[] } | null>,
        aRes.json().catch(() => null) as Promise<{ auditLog?: ComplianceHealth["recentAudit"] } | null>,
      ])
      if (!hRes.ok || !jRes.ok || !aRes.ok) {
        setHealth(null)
        setJurisdictions([])
        setAuditTail([])
        setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
        return
      }
      setHealth(hJson?.complianceHealth ?? null)
      setJurisdictions(jJson?.jurisdictions ?? [])
      setAuditTail((aJson?.auditLog ?? []).slice(0, 12))
    } catch {
      setHealth(null)
      setJurisdictions([])
      setAuditTail([])
      setError(blitzpayStaffWidgetLoadCopy.dataUnavailable)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    void load()
  }, [load])

  if (!organizationId || !orgReady) return null

  const rep = health?.reporting

  return (
    <div
      id="blitzpay-tax-compliance-anchor"
      className="rounded-xl border border-border bg-white dark:bg-card px-4 py-5 sm:px-6 sm:py-6 space-y-5 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Scale className="h-5 w-5 text-[color:var(--primary)] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Tax & compliance signals</p>
            <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
              Deterministic estimates and checklists — Equipify does not file or remit taxes. No raw tax IDs shown here.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" disabled={loading} onClick={() => void load()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
          Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed rounded-lg border border-border/80 bg-muted/30 px-3 py-2">
        {health?.disclaimer ??
          "Compliance indicators are operational guidance tools and do not replace professional tax or legal advice."}
      </p>

      {error ? <p className="text-xs text-muted-foreground leading-relaxed">{error}</p> : null}
      {loading && !health ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </p>
      ) : null}

      {rep ? (
        <>
          <p className="text-xs text-muted-foreground tabular-nums">
            Snapshot {health ? new Date(health.generatedAt).toLocaleString() : ""} · {health?.jurisdictionCount ?? 0}{" "}
            jurisdictions · {health?.activeRuleCount ?? 0} active rules
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Sales tax (tracked est.)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(rep.salesTaxPayableCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Payroll tax (est.)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(rep.payrollTaxPayableCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Contractor tax (est.)</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{fmtMoney(rep.contractorTaxEstimateCents)}</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Filing readiness</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{rep.filingReadinessScore}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Compliance health</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{rep.complianceHealthScore}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Convenience fee risk</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{rep.convenienceFeeExposureRisk}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">ACH authorization coverage</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{rep.achAuthorizationCoverageRate}/100</p>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Vendor 1099 readiness</p>
              <p className="text-sm font-semibold tabular-nums mt-1">{rep.vendor1099ReadinessRate}/100</p>
            </div>
          </div>

          {health?.convenienceFeeWarnings?.length ? (
            <ul className="text-sm text-[color:var(--status-warning)] space-y-1 leading-relaxed list-disc pl-5">
              {health.convenienceFeeWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jurisdictions</p>
              {jurisdictions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jurisdictions yet — add your primary state or locality when ready.</p>
              ) : (
                <div className="max-h-48 overflow-auto text-sm">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground border-b border-border/60">
                        <th className="py-1.5 pr-2">Name</th>
                        <th className="py-1.5 pr-2">Type</th>
                        <th className="py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jurisdictions.map((j) => (
                        <tr key={j.id} className="border-b border-border/40">
                          <td className="py-1.5 pr-2 font-medium text-foreground">{j.jurisdiction_name}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground">{j.jurisdiction_type}</td>
                          <td className="py-1.5">{j.tax_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border/70 px-4 py-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent compliance activity</p>
              {(auditTail.length ? auditTail : health?.recentAudit ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No audit entries yet — changes to tax rules and calculations appear here.</p>
              ) : (
                <ul className="space-y-2 text-sm max-h-48 overflow-auto">
                  {(auditTail.length ? auditTail : health?.recentAudit ?? []).map((e) => (
                    <li key={e.id} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {new Date(e.created_at).toLocaleString()} · {formatBlitzpayUiLabel(e.audit_type)}
                      </span>
                      <p className="text-foreground mt-0.5 leading-snug">{e.audit_summary}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
