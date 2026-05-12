"use client"

import Link from "next/link"
import { useMemo } from "react"
import { getEffectivePlanId } from "@/lib/billing/effective-plan"
import { useBillingAccessOptional } from "@/lib/billing-access-context"
import { normalizeCommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import type { CommercialProductTier } from "@/lib/billing/blitzpay-commercial-tier"
import { getBlitzpayPlanPackagingFootnote } from "@/lib/billing/blitzpay-commercial-packaging"
import { getBlitzpayPlanMetadata } from "@/lib/billing/blitzpay-plan-metadata"
import type { BlitzpayCommercialSurfaceKey } from "@/lib/blitzpay/blitzpay-commercial-readiness"
import { cn } from "@/lib/utils"

type Props = {
  surface: BlitzpayCommercialSurfaceKey
  className?: string
}

const WRAP = "rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] sm:text-xs text-muted-foreground leading-relaxed"

/**
 * Subtle plan + packaging awareness — informational only (Phase 7A.2).
 * Does not gate routes, APIs, or panels. Safe outside `BillingAccessProvider` (platform admin).
 */
export function BlitzpayPlanAwarenessStrip({ surface, className }: Props) {
  const billing = useBillingAccessOptional()

  const tenant = useMemo(() => {
    if (!billing) return null
    const planIdRaw = billing.subscription?.plan_id ?? "solo"
    const effectivePlanId = getEffectivePlanId(planIdRaw, billing.subscription)
    const tier = (normalizeCommercialProductTier(effectivePlanId) ?? "solo") as CommercialProductTier
    return { effectiveTier: tier, meta: getBlitzpayPlanMetadata(tier), status: billing.status }
  }, [billing])

  if (!billing || !tenant) {
    if (surface !== "platform_blitzpay_ops") return null
    return (
      <div className={cn(WRAP, className)}>
        <p>
          <span className="font-medium text-foreground">Platform</span>
          <span className="mx-1.5 text-border">·</span>
          {getBlitzpayPlanPackagingFootnote({ effectiveTier: "enterprise", surface })}
        </p>
      </div>
    )
  }

  if (tenant.status !== "ready") return null

  const footnote = getBlitzpayPlanPackagingFootnote({ effectiveTier: tenant.effectiveTier, surface })

  return (
    <div className={cn(WRAP, className)}>
      <p>
        <span className="font-medium text-foreground">{tenant.meta.shortLabel}</span>
        <span className="mx-1.5 text-border">·</span>
        {footnote}{" "}
        <Link href="/settings/billing" className="text-primary underline-offset-2 hover:underline whitespace-nowrap">
          Billing
        </Link>
      </p>
    </div>
  )
}
