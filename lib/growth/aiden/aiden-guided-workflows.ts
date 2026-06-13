/** Aiden guided workflow cards — client-safe status + steps from briefing signals. */

import type { AidenGuideLink, AidenGuideStep } from "@/lib/growth/aiden/operator-guide"
import {
  AIDEN_APOLLO_PILOT_CHECKLIST,
  AIDEN_BLOCKER_PLAYBOOK,
  AIDEN_FIRST_REPLY_OPERATOR_STEPS,
  AIDEN_REPLY_HANDLING,
} from "@/lib/growth/aiden/operator-guide"
import type { AidenBriefingSignals } from "@/lib/growth/aiden/aiden-priority-engine"

export const AIDEN_GUIDED_WORKFLOWS_QA_MARKER = "aiden-guided-workflows-v1" as const

export type AidenWorkflowStatusTone = "ready" | "attention" | "blocked" | "idle"

export type AidenGuidedWorkflowCard = {
  id: string
  title: string
  statusLabel: string
  statusTone: AidenWorkflowStatusTone
  summary: string
  steps: AidenGuideStep[]
  links: AidenGuideLink[]
}

function stepsFromChecklist(limit = 4): AidenGuideStep[] {
  return AIDEN_APOLLO_PILOT_CHECKLIST.slice(0, limit).map((item, index) => ({
    order: index + 1,
    title: item.title,
    detail: `${item.where} — ${item.expectedStatus}`,
    links: item.links,
  }))
}

function replyHandlingSteps(): AidenGuideStep[] {
  return AIDEN_FIRST_REPLY_OPERATOR_STEPS.slice(0, 4)
}

function meetingSteps(): AidenGuideStep[] {
  const meetingReply = AIDEN_REPLY_HANDLING.find((entry) => entry.type === "meeting_request")
  return [
    {
      order: 1,
      title: "Open unified inbox",
      detail: "Find threads classified with meeting intent.",
      links: [{ label: "Unified inbox", href: "/admin/growth/inbox" }],
    },
    {
      order: 2,
      title: "Confirm intent",
      detail: meetingReply?.action ?? "Respond with proposed times or booking link.",
      links: [{ label: "Meetings", href: "/admin/growth/meetings" }],
    },
    {
      order: 3,
      title: "Book manually",
      detail: meetingReply?.doNot ?? "Do not auto-send without reading the thread.",
      links: [{ label: "Booking intelligence", href: "/admin/growth/booking-intelligence" }],
    },
  ]
}

function opportunitySteps(): AidenGuideStep[] {
  return [
    {
      order: 1,
      title: "Review opportunity drafts",
      detail: "Open drafts awaiting operator review before pipeline promotion.",
      links: [{ label: "Opportunities", href: "/admin/growth/opportunities" }],
    },
    {
      order: 2,
      title: "Confirm buying stage",
      detail: "Only promote when budget, timeline, and decision maker are clear.",
      links: [{ label: "Pipeline", href: "/admin/growth/opportunities/pipeline" }],
    },
    {
      order: 3,
      title: "Log attribution",
      detail: "Verify reply and meeting touches exist on the lead timeline.",
      links: [{ label: "Revenue attribution", href: "/admin/growth/revenue-attribution" }],
    },
  ]
}

function mailboxRecoverySteps(): AidenGuideStep[] {
  const playbook = AIDEN_BLOCKER_PLAYBOOK.find((entry) =>
    entry.code.toLowerCase().includes("mailbox"),
  )
  return [
    {
      order: 1,
      title: "Open provider setup",
      detail: playbook?.operatorAction ?? "Reconnect Google OAuth and validate mailbox.",
      links: [
        { label: "Provider setup", href: "/admin/growth/providers/setup" },
        { label: "Mailboxes", href: "/admin/growth/infrastructure/mailboxes" },
      ],
    },
    {
      order: 2,
      title: "Validate connection",
      detail: "Confirm mailbox status is connected before approving sends.",
      links: [{ label: "Mailbox health", href: "/admin/growth/infrastructure/mailboxes" }],
    },
    {
      order: 3,
      title: "Re-check approval queue",
      detail: "Blocked jobs may clear after mailbox recovery — read last_error first.",
      links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
    },
  ]
}

function blockedJobSteps(): AidenGuideStep[] {
  return AIDEN_BLOCKER_PLAYBOOK.slice(0, 4).map((entry, index) => ({
    order: index + 1,
    title: entry.code,
    detail: entry.operatorAction,
    links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
  }))
}

export function buildAidenGuidedWorkflowCards(signals: AidenBriefingSignals): AidenGuidedWorkflowCard[] {
  const pendingTotal = signals.approval_queue.pending_jobs + signals.approval_queue.pending_drafts
  const launchAttention = pendingTotal > 0 || signals.approval_queue.blocked_jobs > 0

  return [
    {
      id: "launch-pilot",
      title: "Launch Pilot",
      statusLabel: launchAttention ? "Needs review" : "Ready to monitor",
      statusTone: signals.approval_queue.blocked_jobs > 0 ? "blocked" : launchAttention ? "attention" : "ready",
      summary: launchAttention
        ? `${pendingTotal} pending approval(s) · ${signals.approval_queue.blocked_jobs} blocked`
        : "Certification complete — monitor controlled approval waves.",
      steps: stepsFromChecklist(),
      links: [
        { label: "Sequence execution", href: "/admin/growth/sequences/execution" },
        { label: "Command center", href: "/admin/growth/command" },
      ],
    },
    {
      id: "handle-reply",
      title: "Handle Reply",
      statusLabel:
        signals.inbox.replies_needing_attention > 0
          ? `${signals.inbox.replies_needing_attention} need attention`
          : "Inbox clear",
      statusTone: signals.inbox.replies_needing_attention > 0 ? "attention" : "idle",
      summary:
        signals.inbox.replies_needing_attention > 0
          ? `${signals.inbox.new_replies} new · ${signals.inbox.positive_interest} positive interest`
          : "No replies waiting for operator action.",
      steps: replyHandlingSteps(),
      links: [
        { label: "Unified inbox", href: "/admin/growth/inbox" },
        { label: "Reply drafts", href: "/admin/growth/copilot/reply-drafts" },
      ],
    },
    {
      id: "book-meeting",
      title: "Book Meeting",
      statusLabel:
        signals.inbox.meeting_requests > 0
          ? `${signals.inbox.meeting_requests} request${signals.inbox.meeting_requests === 1 ? "" : "s"}`
          : "No requests",
      statusTone: signals.inbox.meeting_requests > 0 ? "attention" : "idle",
      summary:
        signals.inbox.meeting_requests > 0
          ? "Meeting intent detected — respond within 24 hours."
          : `${signals.meetings.meetings_today} meeting(s) today.`,
      steps: meetingSteps(),
      links: [
        { label: "Meetings", href: "/admin/growth/meetings" },
        { label: "Booking intelligence", href: "/admin/growth/booking-intelligence" },
      ],
    },
    {
      id: "create-opportunity",
      title: "Create Opportunity",
      statusLabel:
        signals.meetings.opportunities_pending > 0
          ? `${signals.meetings.opportunities_pending} draft(s) pending`
          : "No drafts pending",
      statusTone: signals.meetings.opportunities_pending > 0 ? "attention" : "idle",
      summary:
        signals.meetings.opportunities_pending > 0
          ? "Opportunity drafts await operator review."
          : "Promote qualified conversations when budget and timeline are confirmed.",
      steps: opportunitySteps(),
      links: [
        { label: "Opportunities", href: "/admin/growth/opportunities" },
        { label: "Pipeline", href: "/admin/growth/opportunities/pipeline" },
      ],
    },
    {
      id: "recover-mailbox",
      title: "Recover Mailbox",
      statusLabel:
        signals.mailbox.expired_mailboxes > 0
          ? `${signals.mailbox.expired_mailboxes} expired`
          : signals.mailbox.warnings > 0
            ? `${signals.mailbox.warnings} warning(s)`
            : "Healthy",
      statusTone:
        signals.mailbox.expired_mailboxes > 0
          ? "blocked"
          : signals.mailbox.warnings > 0
            ? "attention"
            : "ready",
      summary:
        signals.mailbox.expired_mailboxes > 0
          ? "Reconnect mailbox before approving any sends."
          : signals.mailbox.warnings > 0
            ? "Validate mailbox connections before the next approval batch."
            : `${signals.mailbox.healthy_mailboxes} healthy connection(s).`,
      steps: mailboxRecoverySteps(),
      links: [
        { label: "Provider setup", href: "/admin/growth/providers/setup" },
        { label: "Mailboxes", href: "/admin/growth/infrastructure/mailboxes" },
      ],
    },
    {
      id: "investigate-blocked-job",
      title: "Investigate Blocked Job",
      statusLabel:
        signals.approval_queue.blocked_jobs > 0
          ? `${signals.approval_queue.blocked_jobs} blocked`
          : "No blockers",
      statusTone: signals.approval_queue.blocked_jobs > 0 ? "blocked" : "idle",
      summary:
        signals.approval_queue.blocked_jobs > 0
          ? "Read last_error on each blocked job before re-approving."
          : `${signals.approval_queue.running_jobs} job(s) running · queue otherwise clear.`,
      steps: blockedJobSteps(),
      links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
    },
  ]
}
