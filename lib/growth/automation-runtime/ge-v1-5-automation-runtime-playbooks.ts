/** GE-v1-5 — Built-in operator-assist playbooks (client-safe). */

import type {
  GeV15AutomationRuntimeAction,
  GeV15AutomationRuntimeTrigger,
  GeV15ConditionSpec,
  GeV15DelaySpec,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export type GeV15PlaybookActionSpec = {
  action: GeV15AutomationRuntimeAction
  title: string
  summary: string
  draftContent?: string
  priority?: number
  actionKind?: "email" | "call" | "meeting" | "reminder" | "review"
}

export type GeV15AutomationPlaybook = {
  id: string
  name: string
  description: string
  triggers: GeV15AutomationRuntimeTrigger[]
  conditions: GeV15ConditionSpec[]
  actions: GeV15PlaybookActionSpec[]
  delay?: GeV15DelaySpec | null
  /** Match when trigger payload contains this intent (demo assistant). */
  intentMatch?: string[]
}

export const GE_V1_5_BUILTIN_PLAYBOOKS: GeV15AutomationPlaybook[] = [
  {
    id: "pricing_intent",
    name: "Pricing intent",
    description:
      "Prospect asked about pricing → high intent recommendation → operator notification.",
    triggers: ["question_asked"],
    intentMatch: ["pricing"],
    conditions: [{ kind: "intent_score", operator: "gte", value: 0 }],
    actions: [
      {
        action: "create_recommendation",
        title: "High intent — pricing question",
        summary: "Prospect asked about pricing on the demo assistant.",
        priority: 1,
        actionKind: "meeting",
      },
      {
        action: "operator_notification",
        title: "Pricing question detected",
        summary: "Prospect asked about pricing — review and follow up.",
      },
      {
        action: "request_follow_up",
        title: "Schedule pricing follow-up",
        summary: "Prepare a pricing-oriented follow-up for operator approval.",
        actionKind: "email",
      },
    ],
  },
  {
    id: "video_completion",
    name: "Video completion",
    description: "Video watched → recommendation → follow-up prepared.",
    triggers: ["video_completed"],
    conditions: [{ kind: "intent_score", operator: "gte", value: 0 }],
    actions: [
      {
        action: "create_recommendation",
        title: "Video completed — call prospect",
        summary: "Prospect completed the personalized video.",
        priority: 2,
        actionKind: "call",
      },
      {
        action: "prepare_email",
        title: "Follow-up after video",
        summary: "Draft follow-up email referencing video completion.",
        draftContent: "Hi {{first_name}},\n\nThanks for watching the personalized overview. Happy to walk through next steps on a quick call.\n\nBest,",
      },
      {
        action: "queue_approval_item",
        title: "Review video follow-up",
        summary: "Prepared follow-up email awaiting operator approval.",
      },
    ],
  },
  {
    id: "booking_completed",
    name: "Booking completed",
    description: "Meeting booked → celebration/review recommendation → task created.",
    triggers: ["booking_completed"],
    conditions: [],
    actions: [
      {
        action: "create_recommendation",
        title: "Meeting booked — review prep",
        summary: "Prospect completed booking — prepare for the demo.",
        priority: 1,
        actionKind: "review",
      },
      {
        action: "create_task",
        title: "Prep for booked demo",
        summary: "Review lead timeline and personalize demo talking points before the meeting.",
      },
      {
        action: "operator_notification",
        title: "Demo booked",
        summary: "Prospect completed booking on personalized page.",
      },
    ],
  },
  {
    id: "inactivity_follow_up",
    name: "Inactivity follow-up",
    description: "No engagement → recommendation → suggested follow-up.",
    triggers: ["video_view_started", "cta_clicked", "email_opened"],
    conditions: [{ kind: "inactivity_duration", operator: "gte", value: 7 }],
    delay: { amount: 0, unit: "days" },
    actions: [
      {
        action: "create_recommendation",
        title: "Re-engage inactive prospect",
        summary: "No engagement in 7+ days after initial signal.",
        priority: 4,
        actionKind: "email",
      },
      {
        action: "request_follow_up",
        title: "Suggested follow-up",
        summary: "Consider a manual check-in or alternate channel.",
        actionKind: "email",
      },
      {
        action: "dashboard_card",
        title: "Inactive prospect",
        summary: "Prospect has gone quiet — review timeline for next step.",
      },
    ],
  },
  {
    id: "reply_received",
    name: "Reply received",
    description: "Inbound reply → elevate priority → operator notification.",
    triggers: ["reply_received"],
    conditions: [],
    actions: [
      {
        action: "elevate_recommendation",
        title: "Reply received — prioritize",
        summary: "Prospect replied to outreach — review and respond.",
        priority: 1,
        actionKind: "email",
      },
      {
        action: "operator_notification",
        title: "New reply",
        summary: "Prospect replied — human review required before next send.",
      },
      {
        action: "inbox_notification",
        title: "Reply in inbox",
        summary: "New reply thread activity detected.",
      },
    ],
  },
  {
    id: "demo_assistant_booking_offered",
    name: "Demo assistant booking offered",
    description: "Assistant offered booking → high intent recommendation.",
    triggers: ["booking_offered", "conversation_completed"],
    conditions: [{ kind: "intent_score", operator: "gte", value: 50 }],
    actions: [
      {
        action: "create_recommendation",
        title: "Demo assistant — booking offered",
        summary: "High buying intent detected in demo assistant conversation.",
        priority: 1,
        actionKind: "call",
      },
      {
        action: "operator_notification",
        title: "High intent demo conversation",
        summary: "Demo assistant offered booking — follow up promptly.",
      },
    ],
  },
  {
    id: "lead_created_welcome",
    name: "Lead created",
    description: "New lead → review recommendation for operator.",
    triggers: ["lead_created"],
    conditions: [],
    actions: [
      {
        action: "create_recommendation",
        title: "Review new lead",
        summary: "New lead entered Growth Engine — verify fit and next step.",
        priority: 5,
        actionKind: "review",
      },
    ],
  },
  {
    id: "video_attached",
    name: "Video attached to page",
    description: "Video attached → notify operator to launch campaign.",
    triggers: ["video_attached", "video_generated"],
    conditions: [],
    actions: [
      {
        action: "dashboard_card",
        title: "Video ready for launch",
        summary: "Personalized video attached — review before sending.",
      },
      {
        action: "create_recommendation",
        title: "Launch personalized page",
        summary: "Video asset ready — consider launching to prospect.",
        priority: 3,
        actionKind: "email",
      },
    ],
  },
]

export function matchGeV15Playbooks(input: {
  trigger: GeV15AutomationRuntimeTrigger
  triggerPayload?: Record<string, unknown>
}): GeV15AutomationPlaybook[] {
  return GE_V1_5_BUILTIN_PLAYBOOKS.filter((playbook) => {
    if (!playbook.triggers.includes(input.trigger)) return false
    if (playbook.intentMatch?.length) {
      const intent = String(input.triggerPayload?.intent ?? "")
      if (!playbook.intentMatch.includes(intent)) return false
    }
    return true
  })
}
