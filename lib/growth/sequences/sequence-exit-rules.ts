/** Deterministic sequence exit rules — no AI decisions. Client-safe. */

export type SequenceExitSignal =
  | "reply_detected"
  | "meeting_booked"
  | "positive_intent"
  | "manual_cancel"
  | "suppressed_lead"
  | "not_interested"

export type SequenceExitEvaluationInput = {
  reply_detected?: boolean
  meeting_booked?: boolean
  positive_intent?: boolean
  manual_cancel?: boolean
  suppressed_lead?: boolean
  not_interested?: boolean
  exit_on_reply?: boolean
  exit_on_meeting?: boolean
  exit_on_positive_intent?: boolean
}

export type SequenceExitEvaluation = {
  should_exit: boolean
  reason: string | null
  signal: SequenceExitSignal | null
}

export function evaluateSequenceExitRules(input: SequenceExitEvaluationInput): SequenceExitEvaluation {
  if (input.manual_cancel) {
    return { should_exit: true, reason: "Enrollment cancelled by operator.", signal: "manual_cancel" }
  }
  if (input.suppressed_lead) {
    return { should_exit: true, reason: "Lead is suppressed.", signal: "suppressed_lead" }
  }
  if (input.not_interested) {
    return { should_exit: true, reason: "Lead marked not interested.", signal: "not_interested" }
  }
  if (input.exit_on_reply !== false && input.reply_detected) {
    return { should_exit: true, reason: "Reply detected — sequence exit rule matched.", signal: "reply_detected" }
  }
  if (input.exit_on_meeting !== false && input.meeting_booked) {
    return { should_exit: true, reason: "Meeting booked — sequence exit rule matched.", signal: "meeting_booked" }
  }
  if (input.exit_on_positive_intent !== false && input.positive_intent) {
    return {
      should_exit: true,
      reason: "Positive intent detected — sequence exit rule matched.",
      signal: "positive_intent",
    }
  }
  return { should_exit: false, reason: null, signal: null }
}

export function sequenceExitSignalLabel(signal: SequenceExitSignal): string {
  switch (signal) {
    case "reply_detected":
      return "Reply detected"
    case "meeting_booked":
      return "Meeting booked"
    case "positive_intent":
      return "Positive intent"
    case "manual_cancel":
      return "Manual cancel"
    case "suppressed_lead":
      return "Suppressed lead"
    case "not_interested":
      return "Not interested"
  }
}
