"use client"

import Link from "next/link"
import { CalendarClock, Phone, Reply, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import {
  INBOX_STATUS_TONE,
  displayInboxLeadLabel,
  displayInboxSubject,
  formatInboxDate,
  inboxChannelBadgeTone,
} from "@/components/growth/inbox/growth-inbox-shared-ui"
import type { GrowthInboxThread } from "@/lib/growth/inbox/inbox-types"
import { classificationLabel } from "@/lib/growth/inbox/reply-classifier"
import {
  GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF,
} from "@/lib/growth/hubs/growth-workspace-hub-paths"
import { growthWorkspaceInboxWorkflowHref, growthWorkspaceLeadHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import { useGrowthFeaturePath } from "@/lib/growth/navigation/use-growth-feature-path"
import { GROWTH_INBOX_CHANNEL_LABELS, inboxThreadNeedsAttention } from "@/lib/growth/inbox/inbox-channel-types"
import { cn } from "@/lib/utils"

function resolveNextBestAction(thread: GrowthInboxThread): string {
  if (thread.classification === "meeting_intent") return "Book discovery call"
  if (thread.classification === "positive_interest" || thread.classification === "referral") {
    return "Reply and offer meeting"
  }
  if (thread.classification === "question") return "Answer question"
  if (thread.requires_human_review) return "Review reply"
  return "Follow up"
}

function resolveReplyConfidence(thread: GrowthInboxThread): string {
  const score = thread.classification_confidence ?? 0
  if (score >= 0.8) return "High"
  if (score >= 0.5) return "Medium"
  return "Low"
}

function resolveMeetingPropensity(thread: GrowthInboxThread): string {
  if (thread.classification === "meeting_intent") return "High"
  if (thread.classification === "positive_interest") return "Medium"
  return "Low"
}

type GrowthInboxThreadCardProps = {
  thread: GrowthInboxThread
  selected: boolean
  onSelect: () => void
}

export function GrowthInboxThreadCard({ thread, selected, onSelect }: GrowthInboxThreadCardProps) {
  const callsHref = useGrowthFeaturePath("calls")
  const workflowHref = growthWorkspaceInboxWorkflowHref(thread.lead_id)
  const leadHref = growthWorkspaceLeadHref(thread.lead_id)
  const contactLabel = thread.lead_label.split(" · ").pop() ?? thread.lead_label

  return (
    <article
      className={cn(
        "rounded-xl border px-3 py-3 transition-colors",
        selected ? "border-primary/40 bg-primary/10 shadow-sm" : "border-border/70 bg-card hover:bg-muted/30",
      )}
      data-thread-id={thread.id}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{displayInboxLeadLabel(thread)}</p>
            <p className="truncate text-xs text-muted-foreground">{contactLabel}</p>
          </div>
          {inboxThreadNeedsAttention(thread) ? (
            <span className="size-2 shrink-0 rounded-full bg-rose-500" title="Needs attention" aria-hidden />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <GrowthBadge label={GROWTH_INBOX_CHANNEL_LABELS[thread.channel]} tone={inboxChannelBadgeTone(thread.channel)} />
          <GrowthBadge
            label={classificationLabel(thread.classification)}
            tone={INBOX_STATUS_TONE[thread.priority_tier] ?? "neutral"}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Last message: {formatInboxDate(thread.last_message_at)}
        </p>
        <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
          <span>Reply confidence: {resolveReplyConfidence(thread)}</span>
          <span>Meeting propensity: {resolveMeetingPropensity(thread)}</span>
        </div>
        <p className="mt-2 text-xs font-medium text-foreground">
          Next Best Action: <span className="text-primary">→ {resolveNextBestAction(thread)}</span>
        </p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{displayInboxSubject(thread.subject)}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" asChild>
          <Link href={workflowHref} onClick={(event) => event.stopPropagation()}>
            <Reply className="mr-1 size-3.5" aria-hidden />
            Reply
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`${callsHref}?leadId=${encodeURIComponent(thread.lead_id)}`} onClick={(event) => event.stopPropagation()}>
            <Phone className="mr-1 size-3.5" aria-hidden />
            Call
          </Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF} onClick={(event) => event.stopPropagation()}>
            <CalendarClock className="mr-1 size-3.5" aria-hidden />
            Book Meeting
          </Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link href={leadHref} onClick={(event) => event.stopPropagation()}>
            <UserRound className="mr-1 size-3.5" aria-hidden />
            Open Lead
          </Link>
        </Button>
      </div>
    </article>
  )
}
