"use client"

import type { GrowthHomeExecutiveSnapshotKpi } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"
import { GROWTH_HOME_EXECUTIVE_SNAPSHOT_TITLE } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-2a"

type Props = {
  kpis: GrowthHomeExecutiveSnapshotKpi[]
}

export function GrowthHomeExecutiveSnapshotSection({ kpis }: Props) {
  return (
    <section data-qa-section="home-executive-snapshot" data-section="home-executive-kpis" className="space-y-3">
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{GROWTH_HOME_EXECUTIVE_SNAPSHOT_TITLE}</h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums tracking-tight text-foreground">{kpi.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
