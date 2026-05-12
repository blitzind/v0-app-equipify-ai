/** Short UX label for the “next step” column in the AIden Action Center. */
export function nextStepLabelForPreparedActionStatus(status: string): string {
  switch (status) {
    case "prepared":
      return "Review preview and confirm"
    case "ready_for_confirmation":
      return "Confirm when ready"
    case "needs_clarification":
      return "Answer AIden follow-ups in chat"
    case "confirmed":
      return "Execute from the original context"
    case "executing":
      return "Execution in progress"
    case "completed":
      return "—"
    case "canceled":
      return "—"
    case "failed":
      return "Inspect error and retry"
    default:
      return "—"
  }
}
