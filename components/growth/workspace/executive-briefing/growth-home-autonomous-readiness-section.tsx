"use client"

import type { GrowthHomeAutonomousReadiness } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"

export function GrowthHomeAutonomousReadinessSection({
  readiness,
}: {
  readiness: GrowthHomeAutonomousReadiness | null
}) {
  if (!readiness) return null

  return (
    <section
      data-qa-section="home-autonomous-readiness"
      className="rounded-2xl border border-border/70 bg-card p-6 space-y-5"
    >
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Autonomous readiness</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mode</p>
          <p className="mt-1 font-medium">{readiness.mode}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Execution readiness</p>
          <GrowthHomeConfidenceBadge
            percent={readiness.executionReadinessPercent}
            label={readiness.executionReadinessLabel}
            className="mt-1"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Guardrails</p>
          <p className="mt-1 font-medium">{readiness.guardrails}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Kill switch</p>
          <p className="mt-1 font-medium">{readiness.killSwitch}</p>
        </div>
      </div>
    </section>
  )
}
