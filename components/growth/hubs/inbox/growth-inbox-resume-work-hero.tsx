"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2 } from "lucide-react"
import { useGrowthInboxWorkspace } from "@/components/growth/inbox/growth-inbox-workspace-provider"
import { useGrowthReplyIntelligenceDashboard } from "@/components/growth/inbox/use-growth-reply-intelligence-dashboard"
import {
  buildGrowthInboxFinalPolishBriefingLines,
  extractGrowthInboxOperatorFirstName,
  formatGrowthInboxBriefingHeadline,
} from "@/lib/growth/hubs/growth-inbox-hub-briefing-utils"
import { buildGrowthInboxResumeSessionView } from "@/lib/growth/hubs/growth-inbox-hub-resume-session-utils"
import { readGrowthInboxActivityTimeline } from "@/lib/growth/hubs/growth-inbox-recent-work-memory"
import { deriveGrowthInboxOverviewMetrics } from "@/lib/growth/inbox/growth-inbox-overview-metrics"

export const GROWTH_INBOX_RESUME_WORK_HERO_QA_MARKER = "growth-inbox-resume-work-hero-v1" as const

const PROFILE_ENDPOINT = "/api/growth/workspace/settings/profile"

export function GrowthInboxResumeWorkHero() {
  const { threads } = useGrowthInboxWorkspace()
  const { dashboard, loading } = useGrowthReplyIntelligenceDashboard({ deferLoad: true })
  const [operatorFirstName, setOperatorFirstName] = useState<string | null>(null)
  const [resume, setResume] = useState(() => buildGrowthInboxResumeSessionView(readGrowthInboxActivityTimeline()[0]))

  const metrics = useMemo(
    () => deriveGrowthInboxOverviewMetrics({ threads, replyDashboard: dashboard }),
    [threads, dashboard],
  )
  const lines = buildGrowthInboxFinalPolishBriefingLines(metrics)

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

  useEffect(() => {
    function refresh() {
      setResume(buildGrowthInboxResumeSessionView(readGrowthInboxActivityTimeline()[0]))
    }
    refresh()
    window.addEventListener("storage", refresh)
    return () => window.removeEventListener("storage", refresh)
  }, [])

  const hasBriefing = lines.some((line) => line.count > 0)

  return (
    <section aria-labelledby="inbox-resume-work-hero-heading" data-section="resume-work-hero" data-qa-marker={GROWTH_INBOX_RESUME_WORK_HERO_QA_MARKER}>
      <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/8 via-background to-background px-3 py-3 shadow-sm sm:px-4">
        <h2 id="inbox-resume-work-hero-heading" className="sr-only">
          Resume work
        </h2>
        {loading && threads.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading inbox…
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {formatGrowthInboxBriefingHeadline(operatorFirstName)}.
            </p>
            {hasBriefing ? (
              <ul className="space-y-0.5 text-sm text-muted-foreground">
                {lines.map((line) => (
                  <li key={line.id}>{line.text}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Inbox is clear — pick up where you left off or scan the queue.</p>
            )}
            {resume ? (
              <div className="rounded-lg border border-border/60 bg-card/80 px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Continue where you left off
                </p>
                <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{resume.title}</p>
                    <p className="text-xs text-muted-foreground">Opened {resume.relativeTime}</p>
                  </div>
                  <Link
                    href={resume.href}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  >
                    Continue
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
