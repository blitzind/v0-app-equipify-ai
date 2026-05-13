"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { getBlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
import { blitzpayFccHref } from "@/lib/navigation/blitzpay-financial-command-center-nav"
import type { BlitzPayFccSectionId } from "@/lib/blitzpay/sections"
import { FCC_OVERVIEW_PAGE_STACK } from "@/lib/navigation-chrome"

type Props = {
  slug: BlitzPayFccSectionId
  tier: CommercialProductTier
}

const COPY: Partial<
  Record<
    BlitzPayFccSectionId,
    { title: string; summary: string; bullets: readonly string[]; nextTierHint: string }
  >
> = {
  "multi-entity-finance": {
    title: "Multi-entity finance",
    summary: "Roll up cash, AR, and risk across linked orgs with explicit membership — built for regional and franchise operators.",
    bullets: [
      "Consolidated health scores without cross-tenant data leakage",
      "Linked-group reporting with audit-friendly drilldowns",
    ],
    nextTierHint: "Included on Scale and Enterprise packaging.",
  },
  "enterprise-observability": {
    title: "Enterprise observability",
    summary: "Queue health, bounded replays, and workflow signals so finance and ops can trust money movement at volume.",
    bullets: ["Worker and idempotency posture at a glance", "Operational breadcrumbs for investigations"],
    nextTierHint: "Included on Scale and Enterprise packaging.",
  },
  "procurement-inventory": {
    title: "Procurement & inventory finance",
    summary: "Tie vendor economics to inventory and job costing so margins reflect reality, not spreadsheets.",
    bullets: ["Reorder and rebate signals", "Inventory valuation context for leadership reviews"],
    nextTierHint: "Included on Scale and Enterprise packaging.",
  },
  "financing-marketplace": {
    title: "Financing marketplace",
    summary: "Surface vetted financing paths for larger jobs and capex without becoming a lender — applications stay in governed flows.",
    bullets: ["Opportunity-level readiness signals", "Human-in-the-loop offers and status"],
    nextTierHint: "Included on Scale and Enterprise packaging.",
  },
}

export function BlitzpayFccSectionUpgradePreview({ slug, tier }: Props) {
  const meta = getBlitzpayPlanMetadata(tier)
  const row = COPY[slug]

  return (
    <div className={FCC_OVERVIEW_PAGE_STACK}>
      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-sm overflow-hidden">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
            <CardDescription className="text-[11px] uppercase tracking-wide text-muted-foreground m-0">
              Upgrade preview · {meta.shortLabel} plan
            </CardDescription>
          </div>
          <CardTitle className="text-lg sm:text-xl font-semibold leading-snug">
            {row?.title ?? "Financial workspace"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <p className="text-muted-foreground leading-relaxed">{row?.summary}</p>
          {row?.bullets?.length ? (
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground leading-relaxed">
              {row.bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {row?.nextTierHint ? (
            <p className="text-[12px] text-muted-foreground border border-border/80 rounded-lg px-3 py-2 bg-muted/20">
              {row.nextTierHint}
            </p>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center pt-1">
            <Button asChild className="sm:w-auto w-full">
              <Link href="/settings/billing">View plans and billing</Link>
            </Button>
            <Button asChild variant="outline" className="sm:w-auto w-full">
              <Link href={blitzpayFccHref("overview")}>Back to BlitzPay overview</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
