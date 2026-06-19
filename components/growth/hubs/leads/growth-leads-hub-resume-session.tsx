"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  buildGrowthLeadsResumeSessionView,
} from "@/lib/growth/hubs/growth-leads-hub-resume-session-utils"
import {
  readGrowthLeadsActivityTimeline,
  recordGrowthLeadsActivity,
} from "@/lib/growth/hubs/growth-leads-recent-work-memory"

export function GrowthLeadsHubResumeSession() {
  const [session, setSession] = useState(() =>
    buildGrowthLeadsResumeSessionView(readGrowthLeadsActivityTimeline()[0]),
  )

  useEffect(() => {
    function refresh() {
      setSession(buildGrowthLeadsResumeSessionView(readGrowthLeadsActivityTimeline()[0]))
    }
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [])

  if (!session) return null

  return (
    <section aria-labelledby="leads-hub-resume-heading" data-section="resume-session">
      <GrowthEngineCard title="Resume where you left off" data-section="resume-session">
        <h2 id="leads-hub-resume-heading" className="sr-only">
          Resume last session
        </h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last activity</p>
            <p className="mt-1 text-sm font-medium text-foreground">{session.category}</p>
            <p className="truncate text-base font-semibold text-foreground">{session.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{session.relativeTime}</p>
          </div>
          <Button asChild variant="outline" className="shrink-0 self-start sm:self-auto">
            <Link
              href={session.href}
              onClick={() =>
                recordGrowthLeadsActivity({
                  id: `resume:${session.href}`,
                  verb: "Opened",
                  label: session.title,
                  href: session.href,
                })
              }
            >
              Continue
              <ArrowRight className="ml-1 size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </GrowthEngineCard>
    </section>
  )
}
