import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import { growthWorkspaceInboxHref } from "@/lib/growth/navigation/growth-workspace-operator-links"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"
import type {
  HumanExecutionReplyRoute,
  HumanExecutionReplyRoutingResult,
} from "@/lib/growth/human-execution/human-execution-types"
import { HUMAN_EXECUTION_REPLY_ROUTE_LABELS } from "@/lib/growth/human-execution/human-execution-types"

export function routeHumanExecutionReply(input: {
  intent: GrowthReplyIntent | string | null | undefined
  leadId: string
  replyId?: string | null
}): HumanExecutionReplyRoutingResult {
  const intent = input.intent ?? "unknown"

  if (intent === "positive_interest" || intent === "meeting_request") {
    return {
      route: "meeting_queue",
      routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.meeting_queue,
      requiresHumanApproval: false,
      recommendation: "Route to meeting queue — operator confirms scheduling.",
      ctaHref: "/admin/growth/meetings?view=proposed",
    }
  }

  if (
    intent === "pricing_question" ||
    intent === "support_request" ||
    intent === "competitor_mention" ||
    intent === "referral" ||
    intent === "unknown"
  ) {
    return {
      route: "operator_queue",
      routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.operator_queue,
      requiresHumanApproval: false,
      recommendation: "Route to operator reply inbox for human response.",
      ctaHref: growthWorkspaceInboxHref({
        leadId: input.leadId,
        replyId: input.replyId ?? undefined,
        view: "needs_action",
      }),
    }
  }

  if (intent === "not_interested" || intent === "unsubscribe" || intent === "wrong_contact") {
    return {
      route: "suppression_suggestion",
      routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.suppression_suggestion,
      requiresHumanApproval: true,
      recommendation: "Suggest suppression — operator must approve before any suppression action.",
      ctaHref: commandLeadFocusHref(input.leadId, "outbound"),
    }
  }

  if (intent === "out_of_office" || intent === "timing_delay") {
    return {
      route: "resume_recommendation",
      routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.resume_recommendation,
      requiresHumanApproval: false,
      recommendation: "Recommend resuming sequence after return window — operator sets timing.",
      ctaHref: commandLeadFocusHref(input.leadId, "sequence"),
    }
  }

  if (intent === "objection") {
    return {
      route: "operator_queue",
      routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.operator_queue,
      requiresHumanApproval: false,
      recommendation: "Objection detected — pause sequence and route to operator queue.",
      ctaHref: commandLeadFocusHref(input.leadId, "command"),
    }
  }

  return {
    route: "no_route",
    routeLabel: HUMAN_EXECUTION_REPLY_ROUTE_LABELS.no_route,
    requiresHumanApproval: false,
    recommendation: "No automatic routing — operator review recommended.",
    ctaHref: commandLeadFocusHref(input.leadId, "command"),
  }
}

export function humanExecutionReplyRouteFromString(value: string | null | undefined): HumanExecutionReplyRoute | null {
  if (!value) return null
  if (value in HUMAN_EXECUTION_REPLY_ROUTE_LABELS) return value as HumanExecutionReplyRoute
  return null
}
