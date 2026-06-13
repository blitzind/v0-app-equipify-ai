/** Aiden priority recommendations — client-safe rules engine. */

export const AIDEN_PRIORITY_ENGINE_QA_MARKER = "aiden-priority-engine-v1" as const

export type AidenPriorityLink = {
  label: string
  href: string
}

export type AidenPriorityRecommendation = {
  priority: 1 | 2 | 3
  title: string
  detail: string
  href: string
}

export type AidenBriefingSignals = {
  mailbox: {
    healthy_mailboxes: number
    expired_mailboxes: number
    warnings: number
  }
  inbox: {
    new_replies: number
    replies_needing_attention: number
    positive_interest: number
    meeting_requests: number
    objections: number
    unsubscribes: number
  }
  approval_queue: {
    pending_drafts: number
    pending_jobs: number
    blocked_jobs: number
    running_jobs: number
  }
  meetings: {
    meetings_today: number
    meetings_this_week: number
    opportunities_pending: number
  }
  revenue: {
    emails_sent: number
    replies: number
    meetings: number
    opportunities: number
    revenue: number
  }
}

type PriorityCandidate = {
  rank: number
  title: string
  detail: string
  href: string
}

export function buildAidenPriorityRecommendations(
  signals: AidenBriefingSignals,
): AidenPriorityRecommendation[] {
  const candidates: PriorityCandidate[] = []

  if (signals.mailbox.expired_mailboxes > 0) {
    candidates.push({
      rank: 1,
      title: "Reconnect expired mailbox",
      detail: `${signals.mailbox.expired_mailboxes} mailbox connection expired — sends will block until reconnected.`,
      href: "/admin/growth/providers/setup",
    })
  } else if (signals.mailbox.warnings > 0) {
    candidates.push({
      rank: 1,
      title: "Review mailbox warnings",
      detail: `${signals.mailbox.warnings} mailbox warning(s) detected — validate before approving sends.`,
      href: "/admin/growth/infrastructure/mailboxes",
    })
  }

  if (signals.inbox.replies_needing_attention > 0) {
    candidates.push({
      rank: 2,
      title: `Reply to ${signals.inbox.replies_needing_attention} lead${signals.inbox.replies_needing_attention === 1 ? "" : "s"}`,
      detail:
        signals.inbox.new_replies > 0
          ? `${signals.inbox.new_replies} new repl${signals.inbox.new_replies === 1 ? "y needs" : "ies need"} attention.`
          : "Unanswered replies waiting in inbox.",
      href: "/admin/growth/inbox",
    })
  }

  if (signals.inbox.meeting_requests > 0) {
    candidates.push({
      rank: 3,
      title: `Respond to ${signals.inbox.meeting_requests} meeting request${signals.inbox.meeting_requests === 1 ? "" : "s"}`,
      detail: "Meeting intent detected — book or propose times promptly.",
      href: "/admin/growth/meetings",
    })
  }

  if (signals.meetings.opportunities_pending > 0) {
    candidates.push({
      rank: 4,
      title: `Review ${signals.meetings.opportunities_pending} opportunity draft${signals.meetings.opportunities_pending === 1 ? "" : "s"}`,
      detail: "Opportunity drafts await operator review before pipeline promotion.",
      href: "/admin/growth/opportunities",
    })
  }

  if (signals.approval_queue.blocked_jobs > 0) {
    candidates.push({
      rank: 5,
      title: `Unblock ${signals.approval_queue.blocked_jobs} job${signals.approval_queue.blocked_jobs === 1 ? "" : "s"}`,
      detail: "Blocked jobs need root-cause fix before retry.",
      href: "/admin/growth/sequences/execution",
    })
  }

  const pendingTotal = signals.approval_queue.pending_jobs + signals.approval_queue.pending_drafts
  if (pendingTotal > 0) {
    candidates.push({
      rank: 6,
      title: `Approve ${pendingTotal} pending item${pendingTotal === 1 ? "" : "s"}`,
      detail:
        signals.approval_queue.pending_jobs > 0
          ? `${signals.approval_queue.pending_jobs} execution job(s) awaiting approval.`
          : `${signals.approval_queue.pending_drafts} draft(s) awaiting review.`,
      href: "/admin/growth/sequences/execution",
    })
  }

  if (candidates.length === 0) {
    candidates.push({
      rank: 7,
      title: "Review dashboard metrics",
      detail: "No urgent blockers. Check inbox and attribution for the day.",
      href: "/admin/growth/command",
    })
  } else if (signals.inbox.replies_needing_attention === 0 && pendingTotal === 0) {
    candidates.push({
      rank: 7,
      title: "Review dashboard metrics",
      detail: `${signals.revenue.emails_sent} emails sent · ${signals.revenue.replies} replies · monitor pipeline health.`,
      href: "/admin/growth/revenue-attribution",
    })
  }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 3)
    .map((item, index) => ({
      priority: (index + 1) as 1 | 2 | 3,
      title: item.title,
      detail: item.detail,
      href: item.href,
    }))
}

export function buildAidenRecommendedActionSummary(
  priorities: AidenPriorityRecommendation[],
): string {
  if (priorities.length === 0) return "Review dashboard and inbox for today."
  const top = priorities[0]
  if (top.href.includes("/inbox") || top.title.toLowerCase().includes("reply")) {
    return "Respond to new replies before approving additional sends."
  }
  if (top.href.includes("/providers/setup") || top.title.toLowerCase().includes("mailbox")) {
    return "Reconnect mailbox before approving any new sends."
  }
  if (top.href.includes("/opportunities")) {
    return "Review opportunity drafts before expanding outbound volume."
  }
  if (top.href.includes("/sequences/execution")) {
    return "Clear approval queue blockers before sending the next batch."
  }
  return top.detail
}

export function aidenGreetingForHour(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function formatAidenOperatorName(email: string | null | undefined): string {
  const local = (email ?? "").split("@")[0]?.trim()
  if (!local) return "Operator"
  const first = local.split(/[._-]/)[0]
  if (!first) return "Operator"
  return first.charAt(0).toUpperCase() + first.slice(1)
}
