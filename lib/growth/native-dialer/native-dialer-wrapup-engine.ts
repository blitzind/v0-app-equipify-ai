import type {
  NativeCallWrapupOutcome,
  NativeCallWrapupPublicView,
} from "@/lib/growth/native-dialer/native-dialer-types"

export type NativeCallWrapupInput = {
  outcome: NativeCallWrapupOutcome
  leftVoicemail?: boolean
  noAnswer?: boolean
  connected?: boolean
  meetingBooked?: boolean
  followUpNeeded?: boolean
  objectionCategory?: string | null
  buyingSignals?: string[]
  competitorMentioned?: boolean
  timelineDetected?: boolean
  budgetDetected?: boolean
  championIdentified?: boolean
  decisionMakerPresent?: boolean
  notes?: string
}

export function buildSuggestedWrapupNextActions(input: NativeCallWrapupInput): string[] {
  const actions: string[] = []
  if (input.meetingBooked) {
    actions.push("Confirm meeting details with operator scheduling — no auto-scheduling.")
  }
  if (input.followUpNeeded || input.leftVoicemail || input.noAnswer) {
    actions.push("Schedule operator follow-up — recommendation only.")
  }
  if (input.objectionCategory?.trim()) {
    actions.push(`Address objection (${input.objectionCategory}) — operator task.`)
  }
  if ((input.buyingSignals?.length ?? 0) > 0) {
    actions.push("Capture buying signals in deal notes — operator controlled.")
  }
  if (input.competitorMentioned) {
    actions.push("Review competitor positioning — operator decision.")
  }
  if (input.championIdentified && input.decisionMakerPresent) {
    actions.push("Advance opportunity with executive alignment — recommendation only.")
  }
  if (input.connected && actions.length === 0) {
    actions.push("Log call outcome and plan next touch — operator controlled.")
  }
  return actions.slice(0, 6)
}

export function normalizeWrapupFlags(input: NativeCallWrapupInput): Pick<
  NativeCallWrapupPublicView,
  | "leftVoicemail"
  | "noAnswer"
  | "connected"
  | "meetingBooked"
  | "followUpNeeded"
  | "competitorMentioned"
  | "timelineDetected"
  | "budgetDetected"
  | "championIdentified"
  | "decisionMakerPresent"
> {
  return {
    leftVoicemail: input.leftVoicemail ?? input.outcome === "left_voicemail",
    noAnswer: input.noAnswer ?? input.outcome === "no_answer",
    connected: input.connected ?? (input.outcome === "connected" || input.outcome === "meeting_booked"),
    meetingBooked: input.meetingBooked ?? input.outcome === "meeting_booked",
    followUpNeeded: input.followUpNeeded ?? input.outcome === "follow_up_needed",
    competitorMentioned: input.competitorMentioned ?? false,
    timelineDetected: input.timelineDetected ?? false,
    budgetDetected: input.budgetDetected ?? false,
    championIdentified: input.championIdentified ?? false,
    decisionMakerPresent: input.decisionMakerPresent ?? false,
  }
}
