"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { GrowthHomeProgressPeriod } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"
import { AI_CONTINUITY_OUR_PROGRESS_TITLE } from "@/lib/workspace/ai-relationship-continuity"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

type Props = {
  periods: GrowthHomeProgressPeriod[]
}

export function GrowthHomeOurProgressSection({ periods }: Props) {
  const [open, setOpen] = useState(false)

  if (periods.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section data-qa-section="home-our-progress" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{AI_CONTINUITY_OUR_PROGRESS_TITLE}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Aggregates from your existing read models.</p>
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
              {open ? "Hide progress" : "Show progress"}
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="grid gap-4 lg:grid-cols-3">
          {periods.map((period) => (
            <article key={period.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <p className="font-semibold text-foreground">{period.label}</p>
              <dl className="space-y-2">
                {period.metrics.map((metric) => (
                  <div key={metric.label} className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{metric.label}</dt>
                    <dd className="font-medium text-foreground">{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
