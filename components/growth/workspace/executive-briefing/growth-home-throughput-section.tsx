"use client"

import Link from "next/link"
import type { GrowthHomeThroughputMetric } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export function GrowthHomeThroughputSection({ metrics }: { metrics: GrowthHomeThroughputMetric[] }) {
  if (metrics.length === 0) return null

  return (
    <section data-qa-section="home-throughput" className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">What I moved forward today</h2>
        <p className="mt-1 text-sm text-muted-foreground">Operational throughput from live runtime read models.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const card = (
            <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
              <p className="text-sm text-muted-foreground">{metric.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{metric.value}</p>
            </div>
          )
          return metric.href ? (
            <Link key={metric.id} href={metric.href} className="block transition-opacity hover:opacity-90">
              {card}
            </Link>
          ) : (
            <div key={metric.id}>{card}</div>
          )
        })}
      </div>
    </section>
  )
}
