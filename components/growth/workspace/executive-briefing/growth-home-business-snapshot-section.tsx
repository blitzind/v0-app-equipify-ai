"use client"

import Link from "next/link"
import type { GrowthHomeBusinessMetric } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { cn } from "@/lib/utils"

export function GrowthHomeBusinessSnapshotSection({ metrics }: { metrics: GrowthHomeBusinessMetric[] }) {
  if (metrics.length === 0) return null

  return (
    <section data-qa-section="home-business-snapshot" className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-muted-foreground">Business snapshot</h2>
        <p className="text-xs text-muted-foreground/80">Key numbers at a glance — details available on each surface.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Link
            key={metric.id}
            href={metric.href}
            className={cn(
              "rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 transition-colors hover:bg-muted/40",
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{metric.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{metric.value}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
