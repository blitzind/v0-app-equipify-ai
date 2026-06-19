"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import {
  buildGrowthInboxBriefingLines,
  extractGrowthInboxOperatorFirstName,
  formatGrowthInboxBriefingHeadline,
  resolveGrowthInboxContinueWorkingHref,
} from "@/lib/growth/hubs/growth-inbox-hub-briefing-utils"
import { deriveGrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"
import { cn } from "@/lib/utils"

const PROFILE_ENDPOINT = "/api/growth/workspace/settings/profile"

export function GrowthInboxTodaysBriefing() {
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard, loading } = useGrowthReplyIntelligenceDashboard({ deferLoad: true })
  const [operatorFirstName, setOperatorFirstName] = useState<string | null>(null)
  const metrics = useMemo(
    () => deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard }),
    [threads, dashboard],
  )
  const continueHref = resolveGrowthInboxContinueWorkingHref(metrics)
  const lines = buildGrowthInboxBriefingLines(metrics)

  useEffect(() => {
    const ac = new AbortController()
    void fetch(PROFILE_ENDPOINT, { cache: "no-store", signal: ac.signal })
      .then((res) => res.json())
      .then((data: { ok?: boolean; profile?: { displayName?: string } }) => {
        if (data.ok !== false && data.profile?.displayName) {
          setOperatorFirstName(extractGrowthInboxOperatorFirstName(data.profile.displayName))
        }
      })
      .catch(() => setOperatorFirstName(null))
    return () => ac.abort()
  }, [])

  return (
    <section aria-labelledby="inbox-hub-briefing-heading" data-section="todays-briefing">
      <div
        className={cn(
          "rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-5 shadow-sm",
          "lg:p-6",
        )}
      >
        <h2 id="inbox-hub-briefing-heading" className="sr-only">
          Today&apos;s inbox briefing
        </h2>
        {loading && threads.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading briefing…
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-xl font-semibold tracking-tight text-foreground lg:text-2xl">
                {formatGrowthInboxBriefingHeadline(operatorFirstName)}
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
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
