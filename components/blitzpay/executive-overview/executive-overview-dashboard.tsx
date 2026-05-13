"use client"

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
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { tierRank } from "@/lib/billing/blitzpay-commercial-tier"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import type { FccExecutiveOverviewPayload } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import type {
  ExecutiveOverviewWidgetId,
  ExecutiveOverviewWidgetSurface,
  FccExecutiveOverviewDataScope,
  ResolvedExecutiveOverviewWidget,
} from "@/lib/blitzpay/executive-overview-widgets"
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
  FCC_OVERVIEW_PRE_AI_BRIEFING_TIGHTEN,
  FCC_OVERVIEW_SECTION_LEAD,
} from "@/lib/navigation-chrome"

export type ExecutiveOverviewDashboardProps = {
  data: FccExecutiveOverviewPayload
  tier: CommercialProductTier
  widgets: ResolvedExecutiveOverviewWidget[]
  allowFcc: (fccSlug: string | undefined) => boolean
  dataScope?: FccExecutiveOverviewDataScope
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

function fccHref(kind: "fcc" | "settings", slug?: string): string {
  if (kind === "settings") return "/settings/payments"
  return blitzpayFccHref(slug ?? "overview")
}

function PreviewRibbon({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-primary/25 bg-primary/[0.03] px-2.5 py-1.5 text-[10px] font-medium text-primary mb-2">
      {label}
    </div>
  )
}

function UpgradeCtaRow() {
  return (
    <div className="flex flex-wrap gap-2 pt-2">
      <Button asChild variant="secondary" size="sm" className="h-8 text-xs">
        <Link href="/settings/billing">Plans and billing</Link>
      </Button>
    </div>
  )
}

function widgetSurfaceClass(surface: ExecutiveOverviewWidgetSurface): string {
  if (surface === "preview") return "opacity-95 border-dashed border-primary/20"
  if (surface === "upgrade_cta") return "border-dashed border-muted-foreground/30 bg-muted/[0.08]"
  return ""
}

export function ExecutiveOverviewDashboard({ data: o, tier, widgets, allowFcc, dataScope }: ExecutiveOverviewDashboardProps) {
  const tr = tierRank(tier)
  const surfaceOf = (id: ExecutiveOverviewWidgetId): ExecutiveOverviewWidgetSurface =>
    widgets.find((w) => w.id === id)?.surface ?? "enabled"
  const healthSource = o.healthCards.filter((c) => c.hrefKind === "settings" || allowFcc(c.fccSlug))
  const healthCap = tr <= tierRank("solo") ? 4 : tr <= tierRank("core") ? 5 : tr <= tierRank("growth") ? 6 : 8
  const healthCards = healthSource.slice(0, healthCap)
  const attentionItems = o.attention.filter((a) => a.hrefKind === "settings" || allowFcc(a.fccSlug)).slice(0, 10)

  const active = new Set(widgets.map((w) => w.id))

  return (
    <div className={FCC_EXEC_OVERVIEW_STACK}>
      {active.has("executive_health_bar") ? (
        <section aria-labelledby="fcc-exec-health-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <Gauge className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-exec-health-heading" className={FCC_BLOCK_TITLE}>
              Executive health
            </h2>
          </div>
          <div className={FCC_HEALTH_STRIP_GRID}>
            {healthCards.map((c) => (
              <Link
                key={c.id}
                href={fccHref(c.hrefKind, c.fccSlug)}
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
      ) : null}

      {active.has("attention_queue") ? (
        <section aria-labelledby="fcc-attention-heading" className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
            <h2 id="fcc-attention-heading" className={FCC_BLOCK_TITLE}>
              Needs attention
            </h2>
          </div>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className="p-0 divide-y divide-border">
              {attentionItems.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  No prioritized items in this window — keep monitoring collections and hosted pay readiness.
                </p>
              ) : (
                attentionItems.map((a) => (
                  <Link
                    key={a.id}
                    href={fccHref(a.hrefKind, a.fccSlug)}
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
                      {a.estimatedImpactCents != null && a.estimatedImpactCents > 0 ? (
                        <span className="text-[11px] text-muted-foreground mt-0.5 block tabular-nums">
                          Estimated exposure ~{fmtUsd0(a.estimatedImpactCents)}
                        </span>
                      ) : null}
                      {a.recommendedAction ? (
                        <span className="text-[11px] text-foreground/90 mt-1 block leading-snug">{a.recommendedAction}</span>
                      ) : null}
                      {a.contextAsOf ? (
                        <span className="text-[10px] text-muted-foreground/80 mt-1 block tabular-nums">
                          As of {new Date(a.contextAsOf).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          {a.contextNote ? ` · ${a.contextNote}` : null}
                        </span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" aria-hidden />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className={FCC_DUAL_COL_GRID}>
        {active.has("receivables_pulse") ? (
          <section aria-labelledby="fcc-ar-heading" className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <ClipboardList className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 id="fcc-ar-heading" className={FCC_BLOCK_TITLE}>
                Receivables pulse
              </h2>
            </div>
            <Card className={FCC_CARD_SHELL}>
              <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Overdue (collectible est.)</dt>
                    <dd className="font-semibold tabular-nums">{fmtUsd0(o.cash.overdueCollectibleCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Open invoices (overdue)</dt>
                    <dd className="font-semibold tabular-nums">{o.cash.overdueInvoiceCount}</dd>
                  </div>
                </dl>
                {allowFcc("collections") ? (
                  <Button asChild variant="outline" size="sm" className="mt-1">
                    <Link href={blitzpayFccHref("collections")}>Collections</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {active.has("near_term_inflows") ? (
          <section aria-labelledby="fcc-inflow-heading" className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <CircleDollarSign className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 id="fcc-inflow-heading" className={FCC_BLOCK_TITLE}>
                Near-term inflows
              </h2>
            </div>
            <Card className={FCC_CARD_SHELL}>
              <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
                <p className="text-muted-foreground text-[13px] leading-relaxed">
                  Expected inflows are modeled signals — not a bank balance.
                </p>
                <dl className="grid grid-cols-2 gap-3">
                  <div>
                    <dt className="text-[11px] text-muted-foreground">7d / 30d</dt>
                    <dd className="font-semibold tabular-nums text-xs sm:text-sm">
                      {fmtUsd0(o.cash.expectedInflows7dCents)} / {fmtUsd0(o.cash.expectedInflows30dCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-muted-foreground">Autopay adoption</dt>
                    <dd className="font-semibold tabular-nums">{fmtPct(o.revenue.autopayAdoptionPct)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>

      {active.has("collections_compact") ? (
        <section aria-labelledby="fcc-coll-heading" className={cn(FCC_BLOCK, FCC_OVERVIEW_SECTION_LEAD)}>
          <div className={FCC_BLOCK_HEADER}>
            <ClipboardList className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 id="fcc-coll-heading" className={FCC_BLOCK_TITLE}>
              Collections summary
            </h2>
          </div>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-[12px] leading-snug">
                <li>
                  Reminders <span className="font-medium text-foreground">{fmtPct(o.collections.reminderEffectivenessRatePct)}</span>
                </li>
                <li>
                  Conversion <span className="font-medium text-foreground">{fmtPct(o.collections.reminderConversionRatePct)}</span>
                </li>
                <li>
                  Field recovery <span className="font-medium text-foreground">{fmtPct(o.collections.fieldCollectionRecoveryRatePct)}</span>
                </li>
              </ul>
              {allowFcc("collections") ? (
                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link href={blitzpayFccHref("collections")}>Open collections</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {active.has("autopay_strip") ? (
        <section aria-labelledby="fcc-autopay-heading" className={FCC_BLOCK}>
          <Card className={FCC_CARD_SHELL}>
            <CardContent className={cn(FCC_CARD_BODY, "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm")}>
              <div>
                <p id="fcc-autopay-heading" className="text-xs font-semibold text-foreground">
                  Hosted pay and renewals posture
                </p>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Autopay {fmtPct(o.revenue.autopayAdoptionPct)} · Renewal proxy {fmtPct(o.revenue.renewalSuccessProxyPct)}
                </p>
              </div>
              {allowFcc("billing-profiles") ? (
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href={blitzpayFccHref("billing-profiles")}>Billing profiles</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className={FCC_DUAL_COL_GRID}>
        {active.has("recurring_revenue") ? (
          <section className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <TrendingUp className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 className={FCC_BLOCK_TITLE}>Recurring revenue</h2>
            </div>
            <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("recurring_revenue")))}>
              <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
                {surfaceOf("recurring_revenue") === "upgrade_cta" ? (
                  <>
                    <PreviewRibbon label="Upgrade to Core for renewals workspace, collection health, and revenue confidence." />
                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                      Planned recurring inflow, stability, and churn signals stay aggregate-only and ready when you move up.
                    </p>
                    <UpgradeCtaRow />
                  </>
                ) : (
                  <>
                    <dl className="grid grid-cols-2 gap-3">
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Planned inflow (30d)</dt>
                        <dd className="font-semibold tabular-nums">{fmtUsd0(o.revenue.recurringPlannedInflow30dCents)}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-muted-foreground">Stability / churn</dt>
                        <dd className="font-medium text-xs">
                          {o.revenue.recurringStabilityScore0to100}/100 · {o.revenue.churnRiskScore0to100}/100
                        </dd>
                      </div>
                    </dl>
                    {allowFcc("recurring-revenue") ? (
                      <Button asChild variant="outline" size="sm">
                        <Link href={blitzpayFccHref("recurring-revenue")}>Renewals workspace</Link>
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {active.has("retention_confidence") ? (
          <section className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <TrendingUp className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 className={FCC_BLOCK_TITLE}>Revenue confidence</h2>
            </div>
            <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("retention_confidence")))}>
              <CardContent className={cn(FCC_CARD_BODY, "text-sm text-muted-foreground leading-relaxed")}>
                {surfaceOf("retention_confidence") === "upgrade_cta" ? (
                  <>
                    <PreviewRibbon label="Upgrade to Core for customer retention and revenue optimization workspace." />
                    <p className="text-[13px]">Concentration, renewal posture, and recovery opportunities surface here on Core.</p>
                    <UpgradeCtaRow />
                  </>
                ) : (
                  <>
                    {o.executiveBriefing.opportunities.slice(0, 2).map((x, i) => (
                      <p key={i} className="mb-1.5 last:mb-0">
                        {x}
                      </p>
                    ))}
                    {allowFcc("revenue-optimization") ? (
                      <Button asChild variant="outline" size="sm" className="mt-2">
                        <Link href={blitzpayFccHref("revenue-optimization")}>Revenue optimization</Link>
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>

      {active.has("cash_runway") ? (
        <section className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <CircleDollarSign className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 className={FCC_BLOCK_TITLE}>Cash snapshot</h2>
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
          <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("cash_runway")))}>
            <CardContent className={cn(FCC_CARD_BODY, "grid sm:grid-cols-2 gap-3 text-sm")}>
              {surfaceOf("cash_runway") === "upgrade_cta" ? (
                <div className="sm:col-span-2 space-y-2">
                  <PreviewRibbon label="Upgrade to Growth for operating cash workspace, projections, and vendor obligations." />
                  <p className="text-muted-foreground text-[13px] leading-relaxed">
                    Cash runway, reserve gaps, and orchestration-safe inflow/outflow estimates unlock on Growth.
                  </p>
                  <UpgradeCtaRow />
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Operating cash (estimate)</p>
                    <p className="font-semibold tabular-nums">{fmtUsd0(o.cash.operatingCashCents)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground">Reserve gap / target</p>
                    <p className="font-medium tabular-nums text-xs">
                      {fmtUsd0(o.cash.reserveGapCents)} / {fmtUsd0(o.cash.reserveTargetCents)}
                    </p>
                  </div>
                  {allowFcc("operating-cash") ? (
                    <div className="sm:col-span-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={blitzpayFccHref("operating-cash")}>Operating cash workspace</Link>
                      </Button>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <div className={cn(FCC_DUAL_COL_GRID, FCC_OVERVIEW_SECTION_LEAD)}>
        {active.has("payroll_vendor_pressure") ? (
          <section className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <ClipboardList className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 className={FCC_BLOCK_TITLE}>Payroll and vendor pressure</h2>
            </div>
            <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("payroll_vendor_pressure")))}>
              <CardContent className={cn(FCC_CARD_BODY, "text-sm text-muted-foreground")}>
                {surfaceOf("payroll_vendor_pressure") === "upgrade_cta" ? (
                  <>
                    <PreviewRibbon label="Upgrade to Growth for payroll accruals, vendor bills, and obligations workspace." />
                    <p className="leading-relaxed text-[13px]">
                      Signals stay human-in-the-loop — orchestration only, not disbursement.
                    </p>
                    <UpgradeCtaRow />
                  </>
                ) : (
                  <>
                    <p className="leading-relaxed">
                      Accruals and payables signals stay human-in-the-loop — orchestration only, not payroll disbursement.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {allowFcc("payroll-commissions") ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={blitzpayFccHref("payroll-commissions")}>Payroll</Link>
                        </Button>
                      ) : null}
                      {allowFcc("vendor-bills") ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={blitzpayFccHref("vendor-bills")}>Vendor bills</Link>
                        </Button>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {active.has("operational_bottlenecks") ? (
          <section className={FCC_BLOCK}>
            <div className={FCC_BLOCK_HEADER}>
              <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 className={FCC_BLOCK_TITLE}>Operational bottlenecks</h2>
            </div>
            <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("operational_bottlenecks")))}>
              <CardContent className={cn(FCC_CARD_BODY, "space-y-2 text-sm")}>
                {surfaceOf("operational_bottlenecks") === "upgrade_cta" ? (
                  <>
                    <PreviewRibbon label="Upgrade to Growth for operational bottlenecks and internal books workspace." />
                    <p className="text-muted-foreground text-[13px]">Leakage notes and job-to-cash friction roll up here on Growth.</p>
                    <UpgradeCtaRow />
                  </>
                ) : (
                  <>
                    {o.operationalNotes.length === 0 ? (
                      <p className="text-muted-foreground">No leakage signals in this window.</p>
                    ) : (
                      <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[12px] leading-relaxed">
                        {o.operationalNotes.slice(0, 4).map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    )}
                    {allowFcc("internal-books") ? (
                      <Button asChild variant="outline" size="sm" className="mt-1">
                        <Link href={blitzpayFccHref("internal-books")}>Internal books</Link>
                      </Button>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        ) : null}
      </div>

      {active.has("ai_executive_briefing") ? (
        <section className={cn(FCC_BLOCK, FCC_OVERVIEW_PRE_AI_BRIEFING_TIGHTEN)}>
          <div className={FCC_BLOCK_HEADER}>
            <Sparkles className="h-4 w-4 text-violet-600 shrink-0" aria-hidden />
            <h2 className={FCC_BLOCK_TITLE}>AI executive summary</h2>
          </div>
          <Card
            className={cn(
              "border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-card shadow-sm",
              widgetSurfaceClass(surfaceOf("ai_executive_briefing")),
            )}
          >
            <CardHeader className="pb-2 pt-4 px-4 sm:px-5">
              <CardDescription className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Advisory only · deterministic
              </CardDescription>
              <CardTitle className="text-base font-semibold leading-snug">Weekly-style snapshot</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pb-4 space-y-3 text-sm">
              {surfaceOf("ai_executive_briefing") === "upgrade_cta" ? (
                <>
                  <PreviewRibbon label="Upgrade to Growth for AI Financial Copilot and recovery-oriented briefing." />
                  <p className="text-muted-foreground leading-relaxed text-[13px]">
                    This block summarizes opportunities, risks, and suggested next steps — advisory only, not disbursement
                    instructions.
                  </p>
                  <UpgradeCtaRow />
                </>
              ) : (
                <>
                  <p className="text-muted-foreground leading-relaxed">{o.executiveBriefing.paragraph}</p>
                  <div className={FCC_BRIEFING_TRI_GRID}>
                    <div>
                      <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Opportunities</p>
                      <ul className="space-y-1 text-[12px] text-muted-foreground">
                        {(o.executiveBriefing.opportunities.length ? o.executiveBriefing.opportunities : ["No major opportunities flagged."]).map(
                          (x, i) => (
                            <li key={i}>{x}</li>
                          ),
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 mb-1">Risks</p>
                      <ul className="space-y-1 text-[12px] text-muted-foreground">
                        {(o.executiveBriefing.risks.length ? o.executiveBriefing.risks : ["No separate risk lines."]).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-primary mb-1">Suggested actions</p>
                      <ul className="space-y-1 text-[12px] text-muted-foreground">
                        {(o.executiveBriefing.suggestedActions.length ? o.executiveBriefing.suggestedActions : ["Validate in command center data."]).map(
                          (x, i) => (
                            <li key={i}>{x}</li>
                          ),
                        )}
                      </ul>
                    </div>
                  </div>
                  {allowFcc("ai-financial-copilot") ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={blitzpayFccHref("ai-financial-copilot")}>AI Financial Copilot</Link>
                    </Button>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {active.has("enterprise_rollups") ? (
        <section className={FCC_BLOCK}>
          <div className={FCC_BLOCK_HEADER}>
            <Building2 className="h-4 w-4 text-primary shrink-0" aria-hidden />
            <h2 className={FCC_BLOCK_TITLE}>Entity rollups</h2>
          </div>
          <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("enterprise_rollups")))}>
            <CardContent className={cn(FCC_CARD_BODY, "text-sm space-y-2")}>
              {surfaceOf("enterprise_rollups") === "preview" ? (
                <PreviewRibbon label="Preview — Scale unlocks linked-org rollups with governed membership." />
              ) : null}
              {o.multiEntity ? (
                <>
                  <p className="text-muted-foreground text-[13px]">
                    {o.multiEntity.visibleGroupCount} linked group(s) · ~{o.multiEntity.activeMemberOrgApprox} orgs in view.
                  </p>
                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">Franchise health</dt>
                      <dd className="font-semibold">{o.multiEntity.franchiseHealthScore}/100</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">ME risk</dt>
                      <dd className="font-semibold">{o.multiEntity.multiEntityRiskScore}/100</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <p className="text-muted-foreground text-[13px]">No linked financial groups detected for this org.</p>
              )}
              {surfaceOf("enterprise_rollups") === "preview" ? <UpgradeCtaRow /> : null}
              {allowFcc("multi-entity-finance") && surfaceOf("enterprise_rollups") === "enabled" ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={blitzpayFccHref("multi-entity-finance")}>Multi-entity finance</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {active.has("scale_intelligence_strip") ? (
        <section className={FCC_BLOCK}>
          <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("scale_intelligence_strip")))}>
            <CardContent className={cn(FCC_CARD_BODY, "text-sm space-y-2")}>
              {surfaceOf("scale_intelligence_strip") === "preview" ? (
                <PreviewRibbon label="Preview — supplier and procurement intelligence unlocks on Scale." />
              ) : null}
              <p className="text-muted-foreground leading-relaxed text-[13px]">
                Supplier benchmarks, procurement exposure, and compliance rollups stay aggregate-only — no cross-tenant PII.
              </p>
              <div className="flex flex-wrap gap-2">
                {allowFcc("supplier-network") ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={blitzpayFccHref("supplier-network")}>Supplier network</Link>
                  </Button>
                ) : null}
                {allowFcc("procurement-inventory") ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={blitzpayFccHref("procurement-inventory")}>Procurement finance</Link>
                  </Button>
                ) : null}
                {allowFcc("tax-compliance") ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={blitzpayFccHref("tax-compliance")}>Tax and compliance</Link>
                  </Button>
                ) : null}
              </div>
              {surfaceOf("scale_intelligence_strip") === "preview" ? <UpgradeCtaRow /> : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {active.has("financial_operations_timeline") &&
      (o.timeline.length > 0 || surfaceOf("financial_operations_timeline") === "preview") ? (
        <section aria-labelledby="fcc-timeline-heading" className={FCC_BLOCK}>
          <h2 id="fcc-timeline-heading" className={FCC_BLOCK_TITLE}>
            Financial operations timeline
          </h2>
          <Card className={cn(FCC_CARD_SHELL, widgetSurfaceClass(surfaceOf("financial_operations_timeline")))}>
            <CardContent className="p-0">
              {surfaceOf("financial_operations_timeline") === "preview" ? (
                <div className="px-4 pt-3 pb-0">
                  <PreviewRibbon label="Preview — Scale merges enterprise observability with compliance signals in one timeline." />
                </div>
              ) : null}
              {o.timeline.length > 0 ? (
                <ul className="divide-y divide-border max-h-[280px] overflow-y-auto">
                  {o.timeline.slice(0, 8).map((t, i) => (
                    <li key={`${t.occurredAt}-${i}`} className="px-4 py-2 flex flex-col sm:flex-row sm:items-start sm:gap-3 text-sm">
                      <time className="text-[11px] text-muted-foreground shrink-0 tabular-nums sm:w-36">
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
              ) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">No compliance or enterprise events in this window.</p>
              )}
              {surfaceOf("financial_operations_timeline") === "preview" ? (
                <div className="px-4 pb-3">
                  <UpgradeCtaRow />
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      <p className={FCC_META_FOOTNOTE}>
        As of {new Date(o.generatedAt).toLocaleString()} · {o.reportingWindowDays}-day window
        {dataScope ? ` · Data scope ${dataScope}` : null} · Stripe Connect:{" "}
        {o.stripe.onboardingComplete ? "onboarding complete" : "onboarding incomplete"} · Charges:{" "}
        {o.stripe.chargesEnabled ? "enabled" : "disabled"}
      </p>
    </div>
  )
}
