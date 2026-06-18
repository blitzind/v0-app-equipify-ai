"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import {
  GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS,
  resolveGrowthWorkspaceBriefingHref,
} from "@/lib/growth/workspace/growth-workspace-briefing-links"
import { cn } from "@/lib/utils"

export const GROWTH_OPERATOR_BRIEFING_COMPACT_QA_MARKER = "growth-operator-briefing-compact-v1" as const

function SummaryRow({
  label,
  value,
  href,
  tone,
}: {
  label: string
  value: string | number
  href?: string
  tone?: "ok" | "warn" | "neutral"
}) {
  const content = (
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

  if (!href) return content

  return (
    <Link href={href} className="block rounded-md transition-colors hover:bg-muted/40">
      {content}
    </Link>
  )
}

export function GrowthOperatorBriefingOperationalSummary({ briefing }: { briefing: AidenDailyBriefing | null }) {
  const mailboxLabel = briefing?.summary.mailbox_label ?? "—"
  const mailboxTone =
    mailboxLabel === "Healthy" ? "ok" : mailboxLabel === "Expired" || mailboxLabel === "Warning" ? "warn" : "neutral"

  return (
    <div
      className="grid gap-2 rounded-lg border border-border/60 bg-background/80 p-4 sm:grid-cols-2 lg:grid-cols-3"
      data-qa-marker={GROWTH_OPERATOR_BRIEFING_COMPACT_QA_MARKER}
    >
      <SummaryRow
        label="Mailbox Health"
        value={mailboxLabel}
        tone={mailboxTone}
        href={GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS.mailboxHealth}
      />
      <SummaryRow
        label="Replies Needing Attention"
        value={briefing?.summary.replies_needing_attention ?? 0}
        href={GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS.repliesNeedingAttention}
      />
      <SummaryRow
        label="Meeting Requests"
        value={briefing?.inbox.meeting_requests ?? 0}
        href={GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS.meetingRequests}
      />
      <SummaryRow
        label="Pending Approvals"
        value={briefing?.summary.pending_approvals ?? 0}
        href={GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS.pendingApprovals}
      />
      <SummaryRow
        label="Blocked Jobs"
        value={briefing?.summary.blocked_jobs ?? 0}
        href={GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS.blockedJobs}
      />
    </div>
  )
}

export function GrowthOperatorBriefingPriorities({ briefing }: { briefing: AidenDailyBriefing | null }) {
  const priorities = briefing?.priorities?.slice(0, 3) ?? []
  if (priorities.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top priorities</p>
      {priorities.map((item) => (
        <Link
          key={item.priority}
          href={resolveGrowthWorkspaceBriefingHref(item.href)}
          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition hover:border-indigo-200 hover:bg-indigo-50/30 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/20"
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
  )
}
