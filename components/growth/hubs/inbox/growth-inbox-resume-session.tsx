"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buildGrowthInboxResumeSessionView } from "@/lib/growth/hubs/growth-inbox-hub-resume-session-utils"
import { readGrowthInboxActivityTimeline } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"

export function GrowthInboxResumeSession() {
  const [resume, setResume] = useState(() => buildGrowthInboxResumeSessionView(readGrowthInboxActivityTimeline()[0]))

  useEffect(() => {
    function refresh() {
      setResume(buildGrowthInboxResumeSessionView(readGrowthInboxActivityTimeline()[0]))
    }
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [])

  if (!resume) return null

  return (
    <section aria-labelledby="inbox-hub-resume-heading" data-section="resume-session">
      <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
        <h2 id="inbox-hub-resume-heading" className="text-sm font-semibold text-foreground">
          Resume Last Session
        </h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{resume.category}</p>
            <p className="text-sm font-medium text-foreground">{resume.title}</p>
            <p className="text-xs text-muted-foreground">{resume.relativeTime}</p>
          </div>
          <Link
            href={resume.href}
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Continue
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
