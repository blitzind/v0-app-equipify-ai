"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  buildGrowthLeadsBriefingLines,
  extractGrowthLeadsOperatorFirstName,
  formatGrowthLeadsBriefingHeadline,
  resolveGrowthLeadsContinueWorkingHref,
} from "@/lib/growth/hubs/growth-leads-hub-briefing-utils"
import { recordGrowthLeadsActivity } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { useGrowthLeadsHubMetrics } from "@/components/growth/hubs/leads/use-growth-leads-hub-metrics"
import { cn } from "@/lib/utils"

const PROFILE_ENDPOINT = "/api/growth/workspace/settings/profile"

export function GrowthLeadsHubTodaysBriefing() {
  const { loading, metrics } = useGrowthLeadsHubMetrics()
  const [operatorFirstName, setOperatorFirstName] = useState<string | null>(null)
  const continueHref = resolveGrowthLeadsContinueWorkingHref(metrics)
  const lines = buildGrowthLeadsBriefingLines(metrics)

  useEffect(() => {
    const ac = new AbortController()
    void fetch(PROFILE_ENDPOINT, { cache: "no-store", signal: ac.signal })
      .then((res) => res.json())
      .then((data: { ok?: boolean; profile?: { displayName?: string } }) => {
        if (data.ok !== false && data.profile?.displayName) {
          setOperatorFirstName(extractGrowthLeadsOperatorFirstName(data.profile.displayName))
        }
      })
      .catch(() => setOperatorFirstName(null))
    return () => ac.abort()
  }, [])

  const headline = formatGrowthLeadsBriefingHeadline(operatorFirstName)

  return (
    <section aria-labelledby="leads-hub-briefing-heading" data-section="todays-briefing">
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm",
          "lg:p-8",
        )}
        data-section="todays-briefing"
      >
        <h2 id="leads-hub-briefing-heading" className="sr-only">
          Today&apos;s briefing
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
              <Link
                href={continueHref}
                onClick={() =>
                  recordGrowthLeadsActivity({
                    id: `continue-working:${continueHref}`,
                    verb: "Opened",
                    label: "Continue Working",
                    href: continueHref,
                  })
                }
              >
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
