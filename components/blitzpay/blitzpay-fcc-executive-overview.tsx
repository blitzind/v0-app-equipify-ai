"use client"

import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Gauge,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import { blitzpayStaffWidgetLoadCopy } from "@/lib/blitzpay/blitzpay-staff-widget-load-messages"
import type { FccExecutiveOverviewPayload } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import {
  FCC_BLOCK,
  FCC_BLOCK_HEADER,
  FCC_BLOCK_TITLE,
  FCC_BRIEFING_TRI_GRID,
  FCC_CARD_BODY,
  FCC_CARD_SHELL,
  FCC_DUAL_COL_GRID,
  FCC_EXEC_OVERVIEW_STACK,
  FCC_HEALTH_STRIP_GRID,
  FCC_META_FOOTNOTE,
} from "@/lib/navigation-chrome"

const fccExecutiveOverviewByOrg = new Map<string, FccExecutiveOverviewPayload>()

export function invalidateFccExecutiveOverviewSessionCache(organizationId?: string | null): void {
  if (organizationId) fccExecutiveOverviewByOrg.delete(organizationId)
  else fccExecutiveOverviewByOrg.clear()
}

function readFccExecutiveOverviewSessionCache(organizationId: string): FccExecutiveOverviewPayload | null {
  return fccExecutiveOverviewByOrg.get(organizationId) ?? null
}

function writeFccExecutiveOverviewSessionCache(organizationId: string, payload: FccExecutiveOverviewPayload): void {
  fccExecutiveOverviewByOrg.set(organizationId, payload)
}

type Props = {
  organizationId: string | null
  orgReady: boolean
}

function fmtUsd0(cents: number): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100,
  )
}

function fmtPct(n: number, digits = 0): string {
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(n)}%`
}

function toneRing(tone: "healthy" | "watch" | "risk"): string {
  if (tone === "healthy") return "ring-emerald-500/25 border-emerald-500/30"
  if (tone === "watch") return "ring-amber-500/25 border-amber-500/35"
  return "ring-red-500/25 border-red-500/35"
}

function severityBadge(sev: "risk" | "watch" | "info") {
  if (sev === "risk") return "bg-red-500/12 text-red-700 dark:text-red-400 border-red-500/25"
  if (sev === "watch") return "bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25"
  return "bg-muted text-muted-foreground border-border"
}

function resolveHref(kind: "fcc" | "settings", slug?: string): string {
  if (kind === "settings") return "/settings/payments"
  return blitzpayFccHref(slug ?? "overview")
}

export function BlitzpayFccExecutiveOverview({ organizationId, orgReady }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FccExecutiveOverviewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    if (!organizationId || !orgReady) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/blitzpay/fcc-executive-overview?windowDays=30`,
        { cache: "no-store", credentials: "include" },
      )
      const j = (await res.json()) as { overview?: FccExecutiveOverviewPayload; message?: string }
      if (!res.ok) {
        setData(null)
        setError(j.message ?? blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
        return
      }
      const overview = j.overview ?? null
      if (overview) writeFccExecutiveOverviewSessionCache(organizationId, overview)
      setData(overview)
      if (!overview) setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
    } catch {
      setData(null)
      setError(blitzpayStaffWidgetLoadCopy.executiveBusinessHealth)
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgReady])

  useLayoutEffect(() => {
    if (!organizationId || !orgReady) return
    const cached = readFccExecutiveOverviewSessionCache(organizationId)
    if (cached) {
      setData(cached)
      setError(null)
      setLoading(false)
    } else {
      setData(null)
      setError(null)
      setLoading(true)
    }
  }, [organizationId, orgReady])

  useEffect(() => {
    if (!organizationId || !orgReady) return
    if (readFccExecutiveOverviewSessionCache(organizationId)) return
    void fetchOverview()
  }, [organizationId, orgReady, fetchOverview])

  if (!organizationId || !orgReady) return null

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 animate-pulse min-h-[120px]" aria-busy="true" />
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        {error ?? "Executive overview is unavailable."}
      </div>
    )
  }

  const o = data

  return (
    <div className={FCC_EXEC_OVERVIEW_STACK}>
      {/* 1. Executive health bar */}
      <section aria-labelledby="fcc-exec-health-heading" className={FCC_BLOCK}>
        <div className={FCC_BLOCK_HEADER}>
          <Gauge className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <h2 id="fcc-exec-health-heading" className={FCC_BLOCK_TITLE}>
            Executive health
          </h2>
        </div>
        <div className={FCC_HEALTH_STRIP_GRID}>
          {o.healthCards.map((c) => (
            <Link
              key={c.id}
              href={resolveHref(c.hrefKind, c.fccSlug)}
              className={cn(
                "rounded-xl border bg-card/90 p-3 sm:p-3.5 shadow-sm ring-1 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                toneRing(c.tone),
              )}
            >
              <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                {c.label}
              </p>
              {c.score != null ? (
                <p className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground mt-1">{c.score}</p>
              ) : (
                <p className="text-xs font-medium text-foreground mt-1">Exposure</p>
              )}
              <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-3">{c.subtitle}</p>
              <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-primary">
                Open <ChevronRight className="h-3 w-3" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 2. Attention today */}
      <section aria-labelledby="fcc-attention-heading" className={FCC_BLOCK}>
        <div className={FCC_BLOCK_HEADER}>
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
          <h2 id="fcc-attention-heading" className={FCC_BLOCK_TITLE}>
            What needs attention
          </h2>
        </div>
        <Card className={FCC_CARD_SHELL}>
          <CardContent className="p-0 divide-y divide-border">
            {o.attention.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No prioritized items in this window — keep monitoring collections and payouts.</p>
            ) : (
              o.attention.map((a) => (
                <Link
                  key={a.id}
                  href={resolveHref(a.hrefKind, a.fccSlug)}
                  className="flex items-start gap-3 p-3 sm:p-4 hover:bg-muted/25 transition-colors"
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      severityBadge(a.severity),
                    )}
                  >
                    {a.severity}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-sm text-foreground leading-snug block">{a.message}</span>
                    {a.impactHint ? (
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">{a.impactHint}</span>
                    ) : null}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className={FCC_DUAL_COL_GRID}>
        {/* 3. Cash snapshot */}
        <section aria-labelledby="fcc-cash-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <CircleDollarSign className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-cash-heading" className={FCC_BLOCK_TITLE}>
              Cash snapshot
            </h2>
            <span
              className={cn(
                "ml-auto text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md border",
                o.cash.runwayStatus === "healthy" && "bg-emerald-500/10 text-emerald-800 border-emerald-500/25",
                o.cash.runwayStatus === "watch" && "bg-amber-500/10 text-amber-900 border-amber-500/25",
                o.cash.runwayStatus === "risk" && "bg-red-500/10 text-red-800 border-red-500/25",
              )}
            >
              Runway {o.cash.runwayStatus}
            </span>
          </div>
          <Card className={cn(FCC_CARD_SHELL, "h-full flex flex-col")}>
            <CardContent className={cn(FCC_CARD_BODY, "space-y-3 text-sm flex-1 flex flex-col")}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Operating cash (estimate)</dt>
                  <dd className="font-semibold tabular-nums">{fmtUsd0(o.cash.operatingCashCents)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Overdue receivables</dt>
                  <dd className="font-semibold tabular-nums">
                    {fmtUsd0(o.cash.overdueCollectibleCents)} · {o.cash.overdueInvoiceCount} inv.
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Expected inflows (7d / 30d)</dt>
                  <dd className="font-medium tabular-nums text-xs sm:text-sm">
                    {fmtUsd0(o.cash.expectedInflows7dCents)} / {fmtUsd0(o.cash.expectedInflows30dCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Expected outflows (7d / 30d)</dt>
                  <dd className="font-medium tabular-nums text-xs sm:text-sm">
                    {fmtUsd0(o.cash.expectedOutflows7dCents)} / {fmtUsd0(o.cash.expectedOutflows30dCents)}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-[11px] text-muted-foreground">Reserve vs. target (internal)</dt>
                  <dd className="font-medium tabular-nums text-xs sm:text-sm">
                    Gap {fmtUsd0(o.cash.reserveGapCents)} on target {fmtUsd0(o.cash.reserveTargetCents)}
                  </dd>
                </div>
              </dl>
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link href={blitzpayFccHref("operating-cash")}>Operating cash detail</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* 4. Revenue intelligence */}
        <section aria-labelledby="fcc-revenue-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <TrendingUp className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-revenue-heading" className={FCC_BLOCK_TITLE}>
              Revenue stability
            </h2>
          </div>
          <Card className={cn(FCC_CARD_SHELL, "h-full flex flex-col")}>
            <CardContent className={cn(FCC_CARD_BODY, "space-y-3 text-sm flex-1 flex flex-col")}>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Planned recurring inflow (30d)</dt>
                  <dd className="font-semibold tabular-nums">{fmtUsd0(o.revenue.recurringPlannedInflow30dCents)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Stability / churn risk</dt>
                  <dd className="font-medium">
                    {o.revenue.recurringStabilityScore0to100}/100 stability · {o.revenue.churnRiskScore0to100}/100 churn
                    risk
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Autopay / renewal proxy</dt>
                  <dd className="font-medium">
                    {fmtPct(o.revenue.autopayAdoptionPct)} autopay · {fmtPct(o.revenue.renewalSuccessProxyPct)} renewal
                    proxy
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Projected renewals (90d)</dt>
                  <dd className="font-semibold tabular-nums">{fmtUsd0(o.revenue.projectedRenewalRevenue90dCents)}</dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Signals are bounded operational estimates — validate against contracts and Stripe settlement.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href={blitzpayFccHref("recurring-revenue")}>Recurring revenue workspace</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 5. Collections snapshot + 6. Operational bottlenecks */}
      <div className={FCC_DUAL_COL_GRID}>
        <section aria-labelledby="fcc-coll-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <ClipboardList className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-coll-heading" className={FCC_BLOCK_TITLE}>
              Collections & recovery
            </h2>
          </div>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
              <ul className="space-y-1.5 text-muted-foreground text-[13px] leading-relaxed">
                <li>
                  Reminder effectiveness{" "}
                  <span className="font-medium text-foreground">{fmtPct(o.collections.reminderEffectivenessRatePct)}</span>
                </li>
                <li>
                  Reminder conversion{" "}
                  <span className="font-medium text-foreground">{fmtPct(o.collections.reminderConversionRatePct)}</span> ·
                  Field recovery{" "}
                  <span className="font-medium text-foreground">
                    {fmtPct(o.collections.fieldCollectionRecoveryRatePct)}
                  </span>
                </li>
                <li>
                  Recoverable overdue (estimate){" "}
                  <span className="font-medium text-foreground">
                    {fmtUsd0(o.collections.estimatedRecoverableOverdueCents)}
                  </span>
                </li>
                <li>
                  Work orders with collectible balances:{" "}
                  <span className="font-medium text-foreground">{o.collections.workOrdersWithCollectibleBalancesCount}</span>
                </li>
              </ul>
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={blitzpayFccHref("collections")}>Collections workspace</Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="fcc-ops-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-ops-heading" className={FCC_BLOCK_TITLE}>
              Operational bottlenecks
            </h2>
          </div>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className={cn(FCC_CARD_BODY, "space-y-2")}>
              {o.operationalNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No leakage signals in this window.</p>
              ) : (
                <ul className="list-disc pl-4 space-y-1.5 text-sm text-muted-foreground leading-relaxed">
                  {o.operationalNotes.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
              {o.cashAccelerationNotes.length > 0 ? (
                <div className="pt-2 border-t border-border mt-2">
                  <p className="text-[11px] font-medium text-foreground mb-1">Cash acceleration ideas</p>
                  <ul className="list-disc pl-4 space-y-1 text-[12px] text-muted-foreground">
                    {o.cashAccelerationNotes.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button asChild variant="outline" size="sm" className="mt-2">
                <Link href={blitzpayFccHref("internal-books")}>Internal books</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

      {/* 7. AI-style executive briefing (deterministic) */}
      <section aria-labelledby="fcc-brief-heading" className={FCC_BLOCK}>
        <div className={FCC_BLOCK_HEADER}>
          <Sparkles className="h-4 w-4 text-violet-600 shrink-0" aria-hidden />
          <h2 id="fcc-brief-heading" className={FCC_BLOCK_TITLE}>
            Executive briefing (deterministic)
          </h2>
        </div>
        <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
            <CardDescription className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Advisory only · no autonomous actions
            </CardDescription>
            <CardTitle className="text-base font-semibold leading-snug">Weekly-style snapshot</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pb-4 space-y-4 text-sm">
            <p className="text-muted-foreground leading-relaxed">{o.executiveBriefing.paragraph}</p>
            <div className={FCC_BRIEFING_TRI_GRID}>
              <div>
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1.5">Top opportunities</p>
                <ul className="space-y-1 text-[12px] text-muted-foreground leading-relaxed">
                  {(o.executiveBriefing.opportunities.length
                    ? o.executiveBriefing.opportunities
                    : ["No major opportunities flagged in this window."]
                  ).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1.5">Top risks</p>
                <ul className="space-y-1 text-[12px] text-muted-foreground leading-relaxed">
                  {(o.executiveBriefing.risks.length ? o.executiveBriefing.risks : ["No separate risk lines beyond the attention queue."]).map(
                    (x, i) => (
                      <li key={i}>{x}</li>
                    ),
                  )}
                </ul>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-primary mb-1.5">Suggested actions</p>
                <ul className="space-y-1 text-[12px] text-muted-foreground leading-relaxed">
                  {(o.executiveBriefing.suggestedActions.length
                    ? o.executiveBriefing.suggestedActions
                    : ["Open command center data to validate supporting metrics."]
                  ).map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href={blitzpayFccHref("ai-financial-copilot")}>AI Financial Copilot</Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 8. Multi-entity */}
      {o.multiEntity ? (
        <section aria-labelledby="fcc-me-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <Building2 className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-me-heading" className={FCC_BLOCK_TITLE}>
              Multi-location / enterprise
            </h2>
          </div>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className={cn(FCC_CARD_BODY, "text-sm space-y-2")}>
              <p className="text-muted-foreground text-[13px]">
                {o.multiEntity.visibleGroupCount} linked financial group(s) · ~{o.multiEntity.activeMemberOrgApprox}{" "}
                orgs in consolidated view.
              </p>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <dt className="text-[11px] text-muted-foreground">Franchise health</dt>
                  <dd className="font-semibold">{o.multiEntity.franchiseHealthScore}/100</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Multi-entity risk</dt>
                  <dd className="font-semibold">{o.multiEntity.multiEntityRiskScore}/100</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">Collections rate</dt>
                  <dd className="font-semibold">{fmtPct(o.multiEntity.consolidatedCollectionsRate)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] text-muted-foreground">IC / treasury exposure</dt>
                  <dd className="font-semibold text-xs leading-tight">
                    {fmtUsd0(o.multiEntity.intercompanyBalanceExposureCents)} / {fmtUsd0(o.multiEntity.multiEntityTreasuryExposureCents)}
                  </dd>
                </div>
              </dl>
              <Button asChild variant="outline" size="sm">
                <Link href={blitzpayFccHref("multi-entity-finance")}>Multi-entity finance</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}

      {/* 9. Timeline */}
      <section aria-labelledby="fcc-timeline-heading" className={FCC_BLOCK}>
        <h2 id="fcc-timeline-heading" className={FCC_BLOCK_TITLE}>
          Recent financial operations
        </h2>
        <Card className={FCC_CARD_SHELL}>
          <CardContent className="p-0">
            {o.timeline.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No recent compliance or enterprise audit lines in this window.</p>
            ) : (
              <ul className="divide-y divide-border">
                {o.timeline.map((t, i) => (
                  <li key={`${t.occurredAt}-${i}`} className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-start sm:gap-3 text-sm">
                    <time className="text-[11px] text-muted-foreground shrink-0 tabular-nums sm:w-40">
                      {new Date(t.occurredAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground mr-2">{t.category}</span>
                      <span className="text-foreground text-[13px] leading-snug">{t.label}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <p className={FCC_META_FOOTNOTE}>
        As of {new Date(o.generatedAt).toLocaleString()} · {o.reportingWindowDays}-day window · Stripe Connect:{" "}
        {o.stripe.onboardingComplete ? "onboarding complete" : "onboarding incomplete"} · Charges:{" "}
        {o.stripe.chargesEnabled ? "enabled" : "disabled"}
      </p>
    </div>
  )
}
