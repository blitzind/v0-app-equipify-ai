/** Callback workflow helpers — Phase 4B. Operator-initiated only. */

import type { VoiceCallbackTaskPriority } from "@/lib/voice/missed-call-recovery/types"

export type CallbackWorkflowDraft = {
  phoneNumber: string
  contactName: string | null
  priority: VoiceCallbackTaskPriority
  dueAt: string
  handoffSummary: string
  relationshipContext: string | null
  preferredWindowStart: string | null
  preferredWindowEnd: string | null
}

export function buildCallbackWorkflowDraft(input: {
  phoneNumber: string
  contactName?: string | null
  priority: VoiceCallbackTaskPriority
  dueAt: Date
  handoffSummary: string
  relationshipContext?: string | null
  preferredWindowHours?: { startHour: number; endHour: number }
}): CallbackWorkflowDraft {
  let preferredWindowStart: string | null = null
  let preferredWindowEnd: string | null = null

  if (input.preferredWindowHours) {
    const start = new Date(input.dueAt)
    start.setHours(input.preferredWindowHours.startHour, 0, 0, 0)
    const end = new Date(input.dueAt)
    end.setHours(input.preferredWindowHours.endHour, 0, 0, 0)
    preferredWindowStart = start.toISOString()
    preferredWindowEnd = end.toISOString()
  }

  return {
    phoneNumber: input.phoneNumber,
    contactName: input.contactName ?? null,
    priority: input.priority,
    dueAt: input.dueAt.toISOString(),
    handoffSummary: input.handoffSummary,
    relationshipContext: input.relationshipContext ?? null,
    preferredWindowStart,
    preferredWindowEnd,
  }
}

export function canOperatorInitiateCallback(status: string): boolean {
  return ["recommended", "assigned"].includes(status)
}

export function callbackWorkflowOperatorMessage(): string {
  return "Callback recommended — operator must dial manually. No autonomous outbound calling."
}
