/** Aiden daily briefing types — client-safe. */

import type { AidenBriefingSignals, AidenPriorityRecommendation } from "@/lib/growth/aiden/aiden-priority-engine"

export const AIDEN_DAILY_BRIEFING_QA_MARKER = "aiden-daily-briefing-v1" as const

export type AidenDailyBriefing = {
  qa_marker: typeof AIDEN_DAILY_BRIEFING_QA_MARKER
  greeting: string
  operator_name: string
  generated_at: string
  summary: {
    mailbox_label: string
    pending_approvals: number
    replies_needing_attention: number
    meetings_today: number
    blocked_jobs: number
    drafts_awaiting_review: number
    recommended_action: string
  }
  inbox: AidenBriefingSignals["inbox"]
  mailbox: AidenBriefingSignals["mailbox"]
  approval_queue: AidenBriefingSignals["approval_queue"]
  meetings: AidenBriefingSignals["meetings"]
  revenue: AidenBriefingSignals["revenue"]
  priorities: AidenPriorityRecommendation[]
  section_summaries: {
    inbox: string
    mailbox: string
    approval_queue: string
    meetings: string
    revenue: string
  }
}

export function buildAidenDailyBriefing(input: {
  operatorName: string
  greeting: string
  signals: AidenBriefingSignals
  priorities: AidenPriorityRecommendation[]
  recommendedAction: string
}): AidenDailyBriefing {
  const { signals } = input
  const pendingApprovals = signals.approval_queue.pending_jobs + signals.approval_queue.pending_drafts

  const mailboxLabel =
    signals.mailbox.expired_mailboxes > 0
      ? "Expired"
      : signals.mailbox.warnings > 0
        ? "Warning"
        : signals.mailbox.healthy_mailboxes > 0
          ? "Healthy"
          : "Unknown"

  const inboxSummary = buildInboxSectionSummary(signals.inbox)
  const mailboxSummary = buildMailboxSectionSummary(signals.mailbox)
  const approvalSummary = buildApprovalSectionSummary(signals.approval_queue)
  const meetingsSummary = buildMeetingsSectionSummary(signals.meetings)
  const revenueSummary = buildRevenueSectionSummary(signals.revenue)

  return {
    qa_marker: AIDEN_DAILY_BRIEFING_QA_MARKER,
    greeting: input.greeting,
    operator_name: input.operatorName,
    generated_at: new Date().toISOString(),
    summary: {
      mailbox_label: mailboxLabel,
      pending_approvals: pendingApprovals,
      replies_needing_attention: signals.inbox.replies_needing_attention,
      meetings_today: signals.meetings.meetings_today,
      blocked_jobs: signals.approval_queue.blocked_jobs,
      drafts_awaiting_review: signals.approval_queue.pending_drafts,
      recommended_action: input.recommendedAction,
    },
    inbox: signals.inbox,
    mailbox: signals.mailbox,
    approval_queue: signals.approval_queue,
    meetings: signals.meetings,
    revenue: signals.revenue,
    priorities: input.priorities,
    section_summaries: {
      inbox: inboxSummary,
      mailbox: mailboxSummary,
      approval_queue: approvalSummary,
      meetings: meetingsSummary,
      revenue: revenueSummary,
    },
  }
}

function buildInboxSectionSummary(inbox: AidenBriefingSignals["inbox"]): string {
  if (inbox.replies_needing_attention === 0) {
    return "No replies needing attention right now."
  }
  const parts = [`You have ${inbox.replies_needing_attention} repl${inbox.replies_needing_attention === 1 ? "y" : "ies"} needing attention.`]
  if (inbox.meeting_requests > 0) {
    parts.push(
      `${inbox.meeting_requests} repl${inbox.meeting_requests === 1 ? "y" : "ies"} requested a meeting.`,
    )
  }
  if (inbox.unsubscribes === 0) {
    parts.push("No unsubscribes require action.")
  } else {
    parts.push(`${inbox.unsubscribes} unsubscribe(s) require compliance review.`)
  }
  return parts.join(" ")
}

function buildMailboxSectionSummary(mailbox: AidenBriefingSignals["mailbox"]): string {
  if (mailbox.expired_mailboxes > 0) {
    return "Reconnect Google mailbox before sending."
  }
  if (mailbox.warnings > 0) {
    return `${mailbox.warnings} mailbox warning(s) — validate connection.`
  }
  if (mailbox.healthy_mailboxes > 0) {
    return "Mailbox is healthy."
  }
  return "No mailbox connections configured."
}

function buildApprovalSectionSummary(queue: AidenBriefingSignals["approval_queue"]): string {
  const parts: string[] = []
  const pending = queue.pending_jobs + queue.pending_drafts
  if (pending > 0) {
    parts.push(`${pending} item${pending === 1 ? "" : "s"} require approval.`)
  }
  if (queue.blocked_jobs > 0) {
    parts.push(`${queue.blocked_jobs} blocked job${queue.blocked_jobs === 1 ? "" : "s"} detected.`)
  } else if (pending === 0) {
    parts.push("No blocked jobs detected.")
  }
  if (queue.running_jobs > 0) {
    parts.push(`${queue.running_jobs} job${queue.running_jobs === 1 ? " is" : "s are"} running.`)
  }
  return parts.length > 0 ? parts.join(" ") : "Approval queue is clear."
}

function buildMeetingsSectionSummary(meetings: AidenBriefingSignals["meetings"]): string {
  const parts: string[] = []
  if (meetings.meetings_today === 1) {
    parts.push("You have one meeting today.")
  } else if (meetings.meetings_today > 1) {
    parts.push(`You have ${meetings.meetings_today} meetings today.`)
  } else {
    parts.push("No meetings scheduled today.")
  }
  if (meetings.opportunities_pending === 1) {
    parts.push("One opportunity draft needs review.")
  } else if (meetings.opportunities_pending > 1) {
    parts.push(`${meetings.opportunities_pending} opportunity drafts need review.`)
  }
  return parts.join(" ")
}

function buildRevenueSectionSummary(revenue: AidenBriefingSignals["revenue"]): string {
  const parts = [`${revenue.emails_sent} emails sent.`]
  if (revenue.replies > 0) parts.push(`${revenue.replies} replies received.`)
  if (revenue.meetings > 0) parts.push(`${revenue.meetings} meeting${revenue.meetings === 1 ? "" : "s"} booked.`)
  if (revenue.opportunities > 0) {
    parts.push(`${revenue.opportunities} opportunit${revenue.opportunities === 1 ? "y" : "ies"} created.`)
  }
  return parts.join(" ")
}
