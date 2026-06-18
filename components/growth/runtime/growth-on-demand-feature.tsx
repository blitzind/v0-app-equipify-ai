"use client"

import { Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { GrowthFeatureKey } from "@/lib/growth/runtime/growth-feature-registry"
import { useGrowthOnDemandFeature } from "@/lib/growth/runtime/use-growth-on-demand-feature"
import {
  GROWTH_ON_DEMAND_DEFERRED_COPY,
  GROWTH_INBOX_FETCH_AUDIT_QA_MARKER,
} from "@/lib/growth/inbox/growth-inbox-fetch-audit"
import { shouldDeferGrowthInboxTier3Hydration } from "@/lib/growth/inbox/growth-inbox-minimal-runtime-contract"
import { GROWTH_ON_DEMAND_FEATURE_QA_MARKER } from "@/lib/growth/runtime/use-growth-on-demand-feature"

export function GrowthOnDemandFeature({
  feature,
  scopeKey,
  title,
  description,
  enabled = true,
  load,
  children,
  compact = false,
}: {
  feature: GrowthFeatureKey
  scopeKey?: string | null
  title: string
  description?: string
  enabled?: boolean
  load: () => Promise<void>
  children: React.ReactNode
  compact?: boolean
}) {
  const deferTier3 = shouldDeferGrowthInboxTier3Hydration()
  const { status, error, isLoaded, load: triggerLoad, refresh } = useGrowthOnDemandFeature({
    feature,
    scopeKey,
    enabled,
    load,
  })

  if (!deferTier3 && isLoaded) {
    return (
      <div data-qa-marker={GROWTH_ON_DEMAND_FEATURE_QA_MARKER} data-growth-on-demand-feature={feature}>
        {children}
      </div>
    )
  }

  if (!deferTier3 && status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading {title}…
      </div>
    )
  }

  if (deferTier3 && !isLoaded && status !== "loading") {
    return (
      <div
        className={compact ? "space-y-2 rounded-md border border-dashed border-border/70 p-3" : "space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/10 p-4"}
        data-qa-marker={GROWTH_ON_DEMAND_FEATURE_QA_MARKER}
        data-growth-on-demand-feature={feature}
        data-equipify-qa-marker={GROWTH_INBOX_FETCH_AUDIT_QA_MARKER}
      >
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium text-foreground">{title}</p>
            {description ? <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p> : null}
            <p className="text-[11px] leading-relaxed text-muted-foreground">{GROWTH_ON_DEMAND_DEFERRED_COPY}</p>
          </div>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void triggerLoad()}>
          Load intelligence
        </Button>
        {error ? <p className="text-[11px] text-rose-700">{error}</p> : null}
      </div>
    )
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading {title}…
      </div>
    )
  }

  return (
    <div className="space-y-2" data-qa-marker={GROWTH_ON_DEMAND_FEATURE_QA_MARKER} data-growth-on-demand-feature={feature}>
      <div className="flex items-center justify-end">
        <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[10px]" onClick={() => void refresh()}>
          <RefreshCw className="size-3" />
          Refresh
        </Button>
      </div>
      {children}
      {error ? <p className="text-[11px] text-rose-700">{error}</p> : null}
    </div>
  )
}
