"use client"

import Link from "next/link"
import { ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { useAidenBriefing } from "@/components/growth/use-aiden-briefing"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import { AIDEN_DAILY_BRIEFING_QA_MARKER } from "@/lib/growth/aiden/aiden-daily-briefing"
import { cn } from "@/lib/utils"

type AidenDailyBriefingPanelProps = {
  className?: string
  headerVariant?: "default" | "compact"
  briefing?: AidenDailyBriefing | null
  loading?: boolean
  error?: string | null
  onReload?: () => void
}

function SummaryRow({ label, value, tone }: { label: string; value: string | number; tone?: "ok" | "warn" | "neutral" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          tone === "ok" && "text-emerald-700 dark:text-emerald-400",
          tone === "warn" && "text-amber-700 dark:text-amber-400",
        )}
      >
        {value}
      </span>
    </div>
  )
}

function SectionCard({
  title,
  summary,
  children,
}: {
  title: string
  summary: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/10 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 text-sm leading-snug">{summary}</p>
      <div className="mt-3 space-y-1.5">{children}</div>
    </div>
  )
}

function CompactBriefingHeader({ briefing }: { briefing: AidenDailyBriefing }) {
  const mailboxTone =
    briefing.summary.mailbox_label === "Healthy"
      ? "ok"
      : briefing.summary.mailbox_label === "Expired"
        ? "warn"
        : "neutral"

  return (
    <div className="grid gap-2 rounded-lg border border-border/60 bg-background/80 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <SummaryRow label="Mailbox Health" value={briefing.summary.mailbox_label} tone={mailboxTone} />
      <SummaryRow label="Replies Needing Attention" value={briefing.summary.replies_needing_attention} />
      <SummaryRow label="Meeting Requests" value={briefing.inbox.meeting_requests} />
      <SummaryRow label="Pending Approvals" value={briefing.summary.pending_approvals} />
      <SummaryRow label="Blocked Jobs" value={briefing.summary.blocked_jobs} />
      <SummaryRow label="Today's Recommended Action" value={briefing.summary.recommended_action} />
    </div>
  )
}

export function AidenDailyBriefingPanel({
  className,
  headerVariant = "default",
  briefing: briefingProp,
  loading: loadingProp,
  error: errorProp,
  onReload,
}: AidenDailyBriefingPanelProps) {
  const internal = useAidenBriefing(briefingProp === undefined)
  const briefing = briefingProp !== undefined ? briefingProp : internal.briefing
  const loading = loadingProp ?? internal.loading
  const error = errorProp ?? internal.error
  const reload = onReload ?? internal.reload

  if (loading && !briefing) {
    return (
      <div className={cn("rounded-xl border border-indigo-100 bg-indigo-50/40 p-5 dark:border-indigo-900/40 dark:bg-indigo-950/20", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading Aiden briefing…
        </div>
      </div>
    )
  }

  if (error && !briefing) {
    return (
      <div className={cn("rounded-xl border border-rose-100 bg-rose-50/40 p-5", className)}>
        <p className="text-sm text-rose-700">{error}</p>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => void reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (!briefing) return null

  const mailboxTone =
    briefing.summary.mailbox_label === "Healthy"
      ? "ok"
      : briefing.summary.mailbox_label === "Expired"
        ? "warn"
        : "neutral"

  return (
    <section
      className={cn(
        "rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-background p-5 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30",
        className,
      )}
      data-aiden-daily-briefing={AIDEN_DAILY_BRIEFING_QA_MARKER}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-base font-semibold">
              {briefing.greeting}, {briefing.operator_name}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Read-only operational briefing — no actions taken automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <GrowthBadge label={briefing.qa_marker} tone="neutral" />
          <Button size="sm" variant="ghost" disabled={loading} onClick={() => void reload()} aria-label="Refresh briefing">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </div>

      {headerVariant === "compact" ? (
        <div className="mt-4 space-y-4">
          <CompactBriefingHeader briefing={briefing} />
          {briefing.priorities.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top priorities</p>
              {briefing.priorities.map((item) => (
                <Link
                  key={item.priority}
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <div>
                    <p className="font-medium">
                      Priority {item.priority}: {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 rounded-lg border border-border/60 bg-background/80 p-4 sm:grid-cols-2">
            <SummaryRow label="Mailbox" value={briefing.summary.mailbox_label} tone={mailboxTone} />
            <SummaryRow label="Pending approvals" value={briefing.summary.pending_approvals} />
            <SummaryRow label="Replies needing attention" value={briefing.summary.replies_needing_attention} />
            <SummaryRow label="Meetings today" value={briefing.summary.meetings_today} />
            <SummaryRow label="Blocked jobs" value={briefing.summary.blocked_jobs} />
            <SummaryRow label="Drafts awaiting review" value={briefing.summary.drafts_awaiting_review} />
          </div>

          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Recommended action</p>
            <p className="mt-1 text-sm font-medium">{briefing.summary.recommended_action}</p>
          </div>

          {briefing.priorities.length > 0 ? (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top priorities</p>
              {briefing.priorities.map((item) => (
                <Link
                  key={item.priority}
                  href={item.href}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/30"
                >
                  <div>
                    <p className="font-medium">
                      Priority {item.priority}: {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <ArrowRight className="mt-0.5 size-4 shrink-0 text-indigo-500" />
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <SectionCard title="Inbox" summary={briefing.section_summaries.inbox}>
              <SummaryRow label="New replies" value={briefing.inbox.new_replies} />
              <SummaryRow label="Positive interest" value={briefing.inbox.positive_interest} />
              <SummaryRow label="Meeting requests" value={briefing.inbox.meeting_requests} />
              <SummaryRow label="Objections" value={briefing.inbox.objections} />
              <SummaryRow label="Unsubscribes" value={briefing.inbox.unsubscribes} />
            </SectionCard>

            <SectionCard title="Mailbox health" summary={briefing.section_summaries.mailbox}>
              <SummaryRow label="Healthy" value={briefing.mailbox.healthy_mailboxes} tone="ok" />
              <SummaryRow label="Expired" value={briefing.mailbox.expired_mailboxes} tone="warn" />
              <SummaryRow label="Warnings" value={briefing.mailbox.warnings} />
            </SectionCard>

            <SectionCard title="Approval queue" summary={briefing.section_summaries.approval_queue}>
              <SummaryRow label="Pending drafts" value={briefing.approval_queue.pending_drafts} />
              <SummaryRow label="Pending jobs" value={briefing.approval_queue.pending_jobs} />
              <SummaryRow label="Blocked jobs" value={briefing.approval_queue.blocked_jobs} />
              <SummaryRow label="Running jobs" value={briefing.approval_queue.running_jobs} />
            </SectionCard>

            <SectionCard title="Meetings" summary={briefing.section_summaries.meetings}>
              <SummaryRow label="Today" value={briefing.meetings.meetings_today} />
              <SummaryRow label="This week" value={briefing.meetings.meetings_this_week} />
              <SummaryRow label="Opportunity drafts pending" value={briefing.meetings.opportunities_pending} />
            </SectionCard>

            <SectionCard title="Revenue" summary={briefing.section_summaries.revenue}>
              <SummaryRow label="Emails sent" value={briefing.revenue.emails_sent} />
              <SummaryRow label="Replies" value={briefing.revenue.replies} />
              <SummaryRow label="Meetings" value={briefing.revenue.meetings} />
              <SummaryRow label="Opportunities" value={briefing.revenue.opportunities} />
              <SummaryRow label="Revenue" value={briefing.revenue.revenue} />
            </SectionCard>
          </div>
        </>
      )}
    </section>
  )
}
