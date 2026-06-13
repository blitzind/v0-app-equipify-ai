/** Aiden rule-based operator Q&A — no LLM, read-only guidance from briefing state. */

import type { AidenDailyBriefing } from "@/lib/growth/aiden/aiden-daily-briefing"
import {
  AIDEN_APOLLO_PILOT_CHECKLIST,
  AIDEN_BLOCKER_PLAYBOOK,
  AIDEN_REPLY_HANDLING,
} from "@/lib/growth/aiden/operator-guide"
import { buildAidenPriorityRecommendations } from "@/lib/growth/aiden/aiden-priority-engine"

export const AIDEN_ASK_ENGINE_QA_MARKER = "aiden-ask-engine-v1" as const

export type AidenAskAnswer = {
  question: string
  answer: string
  links: { label: string; href: string }[]
  source: "priority" | "blocker" | "launch" | "reply" | "mailbox" | "fallback"
}

export const AIDEN_ASK_SUGGESTED_QUESTIONS = [
  "What do I do next?",
  "Why is this blocked?",
  "How do I launch?",
  "How do I handle replies?",
  "How do I recover mailbox health?",
] as const

type BriefingSignalsBundle = Pick<
  AidenDailyBriefing,
  "summary" | "inbox" | "mailbox" | "approval_queue" | "meetings" | "priorities"
>

function normalizeQuestion(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ")
}

function matches(question: string, patterns: string[]): boolean {
  return patterns.some((pattern) => question.includes(pattern))
}

export function answerAidenQuestion(rawQuestion: string, briefing: BriefingSignalsBundle): AidenAskAnswer {
  const question = normalizeQuestion(rawQuestion)
  const signals = {
    mailbox: briefing.mailbox,
    inbox: briefing.inbox,
    approval_queue: briefing.approval_queue,
    meetings: briefing.meetings,
    revenue: { emails_sent: 0, replies: 0, meetings: 0, opportunities: 0, revenue: 0 },
  }
  const priorities = briefing.priorities.length
    ? briefing.priorities
    : buildAidenPriorityRecommendations(signals)

  if (matches(question, ["what do i do next", "what should i do", "next step", "what next"])) {
    const top = priorities[0]
    return {
      question: rawQuestion,
      answer: top
        ? `${top.title}. ${top.detail}`
        : briefing.summary.recommended_action,
      links: top ? [{ label: top.title, href: top.href }] : [{ label: "Command center", href: "/admin/growth/command" }],
      source: "priority",
    }
  }

  if (matches(question, ["why is this blocked", "why blocked", "what is blocked", "blocker"])) {
    if (briefing.approval_queue.blocked_jobs > 0) {
      const playbook = AIDEN_BLOCKER_PLAYBOOK[0]
      return {
        question: rawQuestion,
        answer: `${briefing.approval_queue.blocked_jobs} job(s) blocked. ${playbook?.operatorAction ?? "Read last_error on each job in Sequence Execution."}`,
        links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
        source: "blocker",
      }
    }
    if (briefing.mailbox.expired_mailboxes > 0) {
      return {
        question: rawQuestion,
        answer: `${briefing.mailbox.expired_mailboxes} mailbox connection(s) expired — sends block until reconnected.`,
        links: [{ label: "Provider setup", href: "/admin/growth/providers/setup" }],
        source: "mailbox",
      }
    }
    return {
      question: rawQuestion,
      answer: "No blocked jobs detected right now. Check pending approvals or inbox replies if something feels stuck.",
      links: [{ label: "Sequence execution", href: "/admin/growth/sequences/execution" }],
      source: "fallback",
    }
  }

  if (matches(question, ["how do i launch", "how to launch", "launch pilot", "launch"])) {
    const steps = AIDEN_APOLLO_PILOT_CHECKLIST.slice(0, 3)
      .map((item) => `${item.title}: ${item.expectedStatus}`)
      .join(" ")
    return {
      question: rawQuestion,
      answer: `Launch path: ${steps}`,
      links: [
        { label: "Sequence execution", href: "/admin/growth/sequences/execution" },
        { label: "Aiden guide", href: "/admin/growth/aiden" },
      ],
      source: "launch",
    }
  }

  if (matches(question, ["how do i handle repl", "handle repl", "reply workflow", "respond to repl"])) {
    const positive = AIDEN_REPLY_HANDLING.find((entry) => entry.type === "positive_interest")
    const meeting = AIDEN_REPLY_HANDLING.find((entry) => entry.type === "meeting_request")
    return {
      question: rawQuestion,
      answer: `Open unified inbox first. Positive interest: ${positive?.action ?? "Use reply draft and propose next step."} Meeting request: ${meeting?.action ?? "Propose times promptly."} Nothing auto-sends.`,
      links: [
        { label: "Unified inbox", href: "/admin/growth/inbox" },
        { label: "Reply drafts", href: "/admin/growth/copilot/reply-drafts" },
      ],
      source: "reply",
    }
  }

  if (matches(question, ["recover mailbox", "mailbox health", "reconnect mailbox", "mailbox expired"])) {
    const playbook = AIDEN_BLOCKER_PLAYBOOK.find((entry) => entry.code.toLowerCase().includes("mailbox"))
    return {
      question: rawQuestion,
      answer:
        briefing.mailbox.expired_mailboxes > 0
          ? `${briefing.mailbox.expired_mailboxes} expired mailbox(es). ${playbook?.operatorAction ?? "Reconnect in Provider setup."}`
          : briefing.mailbox.warnings > 0
            ? `${briefing.mailbox.warnings} warning(s). Validate connections before approving sends.`
            : "Mailbox looks healthy. No recovery needed.",
      links: [
        { label: "Provider setup", href: "/admin/growth/providers/setup" },
        { label: "Mailboxes", href: "/admin/growth/infrastructure/mailboxes" },
      ],
      source: "mailbox",
    }
  }

  const top = priorities[0]
  return {
    question: rawQuestion,
    answer: top
      ? `Try this first: ${top.title}. ${top.detail}`
      : briefing.summary.recommended_action,
    links: top ? [{ label: top.title, href: top.href }] : [{ label: "Aiden guide", href: "/admin/growth/aiden" }],
    source: "fallback",
  }
}
