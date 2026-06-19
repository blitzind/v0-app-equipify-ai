"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildGrowthCampaignsBriefingLines,
  extractGrowthCampaignsOperatorFirstName,
  formatGrowthCampaignsBriefingHeadline,
  resolveGrowthCampaignsContinueWorkingHref,
} from "@/lib/growth/hubs/growth-campaigns-hub-briefing-utils"
import { useGrowthCampaignsHubMetrics } from "@/components/growth/hubs/campaigns/use-growth-campaigns-hub-metrics"
import { cn } from "@/lib/utils"

const PROFILE_ENDPOINT = "/api/growth/workspace/settings/profile"

export function GrowthCampaignsHubTodaysBriefing() {
  const { loading, metrics } = useGrowthCampaignsHubMetrics()
  const [operatorFirstName, setOperatorFirstName] = useState<string | null>(null)
  const continueHref = resolveGrowthCampaignsContinueWorkingHref(metrics)
  const lines = buildGrowthCampaignsBriefingLines(metrics)

  useEffect(() => {
    const ac = new AbortController()
    void fetch(PROFILE_ENDPOINT, { cache: "no-store", signal: ac.signal })
      .then((res) => res.json())
      .then((data: { ok?: boolean; profile?: { displayName?: string } }) => {
        if (data.ok !== false && data.profile?.displayName) {
          setOperatorFirstName(extractGrowthCampaignsOperatorFirstName(data.profile.displayName))
        }
      })
      .catch(() => setOperatorFirstName(null))
    return () => ac.abort()
  }, [])

  const headline = formatGrowthCampaignsBriefingHeadline(operatorFirstName)

  return (
    <section aria-labelledby="campaigns-hub-briefing-heading" data-section="todays-briefing">
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm",
          "lg:p-8",
        )}
      >
        <h2 id="campaigns-hub-briefing-heading" className="sr-only">
          Today&apos;s campaign briefing
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading briefing…
          </div>
        ) : (
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <p className="text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">{headline}</p>
              <ul className="space-y-1.5 text-base text-muted-foreground">
                {lines.map((line) => (
                  <li key={line.id}>{line.text}</li>
                ))}
              </ul>
            </div>
            <Button asChild size="lg" className="shrink-0 self-start lg:self-auto">
              <Link href={continueHref}>
                Continue Working
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
