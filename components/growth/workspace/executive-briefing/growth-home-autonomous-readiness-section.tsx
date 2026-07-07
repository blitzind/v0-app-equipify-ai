"use client"

import { ShieldCheck } from "lucide-react"
import type { GrowthHomeAutonomousReadiness } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { GrowthHomeConfidenceBadge } from "@/components/growth/workspace/executive-briefing/growth-home-confidence-badge"
import { cn } from "@/lib/utils"

export function GrowthHomeAutonomousReadinessSection({
  readiness,
  embedded = false,
}: {
  readiness: GrowthHomeAutonomousReadiness | null
  embedded?: boolean
}) {
  if (!readiness) return null

  return (
    <section
      data-qa-section="home-autonomous-readiness"
      className={cn(
        embedded
          ? "h-full rounded-xl border border-border/70 bg-card p-4 space-y-3"
          : "rounded-2xl border border-border/70 bg-card p-5 space-y-4 sm:p-6",
      )}
    >
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
        <h3 className="text-base font-semibold tracking-tight">Autonomous Readiness</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Mode</p>
          <p className="mt-1 text-sm font-medium">{readiness.mode}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Execution readiness</p>
          <GrowthHomeConfidenceBadge
            percent={readiness.executionReadinessPercent}
            label={readiness.executionReadinessLabel}
            className="mt-1"
          />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Guardrails</p>
          <p className="mt-1 text-sm font-medium line-clamp-2">{readiness.guardrails}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Kill switch</p>
          <p className="mt-1 text-sm font-medium">{readiness.killSwitch}</p>
        </div>
      </div>
    </section>
  )
}
