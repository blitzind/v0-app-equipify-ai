/** Client-safe labels for unified inbox conversation timeline events. */

const EVENT_KIND_LABELS: Record<string, string> = {
  email_sent: "Email Sent",
  email_delivered: "Email Delivered",
  email_opened: "Email Opened",
  email_clicked: "Email Clicked",
  email_replied: "Reply Received",
  reply_received: "Reply Received",
  inbound_reply: "Reply Received",
  reply_classified: "Reply Classified",
  reply_buying_signal_detected: "Buying Signal",
  reply_objection_detected: "Objection Detected",
  reply_workflow_routed: "Workflow Action Created",
  reply_workflow_action: "Workflow Action Created",
  reply_suppression_applied: "Outreach Suppressed",
  reply_copilot_assisted: "Reply with Ava",
  reply_ingested: "Reply Ingested",
  reply_draft_generated: "Draft Generated",
  reply_draft_approved: "Draft Approved",
  follow_up_created: "Follow-up Created",
  email_suppressed: "Email Suppressed",
  sequence_enrollment_cancelled: "Sequence Stopped",
  sequence_step_skipped: "Sequence Step Skipped",
  sequence_paused: "Sequence Paused",
  opportunity_recommended: "Opportunity Recommended",
  call_completed: "Call Activity",
  call_logged: "Call Activity",
  meeting_scheduled: "Meeting Activity",
  meeting_completed: "Meeting Activity",
  thread_owner_assigned: "Assignment Changed",
  reply_assigned: "Assignment Changed",
  lead_assigned: "Assignment Changed",
}

export function inboxTimelineEventTypeLabel(eventKind: string): string {
  if (EVENT_KIND_LABELS[eventKind]) return EVENT_KIND_LABELS[eventKind]
  return eventKind.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}
