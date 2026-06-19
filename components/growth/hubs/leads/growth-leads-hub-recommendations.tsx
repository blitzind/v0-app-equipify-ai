"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { buildGrowthLeadsHubRecommendations } from "@/lib/growth/hubs/growth-leads-hub-recommendations"
import {
  readSnoozedGrowthLeadsRecommendationIds,
  snoozeGrowthLeadsRecommendation,
} from "@/lib/growth/hubs/growth-leads-recommendations-snooze-memory"
import { fetchGrowthLeadsHubSavedSearches } from "@/lib/growth/hubs/growth-leads-hub-search-client"
import type { GrowthProspectSearchSavedSearchWithWorkflow } from "@/lib/growth/prospect-search/saved-search-workflows"
import {
  readGrowthLeadsActivityTimeline,
  recordGrowthLeadsActivity,
} from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { useGrowthLeadsHubMetrics } from "@/components/growth/hubs/leads/use-growth-leads-hub-metrics"
import { cn } from "@/lib/utils"

const SEVERITY_STYLES = {
  HIGH: "border-red-200/80 bg-red-50/30",
  MEDIUM: "border-amber-200/80 bg-amber-50/30",
  LOW: "border-border/80 bg-background",
} as const

export function GrowthLeadsHubRecommendations() {
  const { metrics } = useGrowthLeadsHubMetrics()
  const [savedSearches, setSavedSearches] = useState<GrowthProspectSearchSavedSearchWithWorkflow[]>([])
  const [snoozedIds, setSnoozedIds] = useState<Set<string>>(() => readSnoozedGrowthLeadsRecommendationIds())
  const [recentActivity, setRecentActivity] = useState(() => readGrowthLeadsActivityTimeline())

  useEffect(() => {
    const ac = new AbortController()
    void fetchGrowthLeadsHubSavedSearches(ac.signal)
      .then(setSavedSearches)
      .catch(() => setSavedSearches([]))
    return () => ac.abort()
  }, [])

  const recommendations = useMemo(
    () =>
      buildGrowthLeadsHubRecommendations({ metrics, savedSearches, recentActivity }).filter(
        (item) => !snoozedIds.has(item.id),
      ),
    [metrics, savedSearches, recentActivity, snoozedIds],
  )

  const handleSnooze = useCallback((id: string) => {
    snoozeGrowthLeadsRecommendation(id)
    setSnoozedIds(readSnoozedGrowthLeadsRecommendationIds())
  }, [])

  return (
    <section aria-labelledby="leads-hub-recommendations-heading" data-section="recommendations">
      <GrowthEngineCard title="Recommended Next Actions" data-section="work-inbox">
        <h2 id="leads-hub-recommendations-heading" className="sr-only">
          Recommended next actions work inbox
        </h2>
        <ul className="divide-y divide-border/70 rounded-xl border border-border/80">
          {recommendations.map((item) => (
            <li
              key={item.id}
              className={cn("px-4 py-3 first:rounded-t-xl last:rounded-b-xl", SEVERITY_STYLES[item.severity])}
              data-recommendation-id={item.id}
              data-recommendation-severity={item.severity}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    [{item.severity}]
                  </p>
                  <p className="mt-1 text-base font-semibold text-foreground">{item.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.timestampLabel}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild size="sm">
                    <Link
                      href={item.href}
                      onClick={() =>
                        recordGrowthLeadsActivity({
                          id: item.id,
                          verb: "Opened",
                          label: item.label,
                          href: item.href,
                        })
                      }
                    >
                      Open
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleSnooze(item.id)}
                    aria-label={`Snooze recommendation: ${item.label}`}
                  >
                    Snooze
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </GrowthEngineCard>
    </section>
  )
}
