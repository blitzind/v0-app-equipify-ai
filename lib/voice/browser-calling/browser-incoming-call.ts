import type { NativeCallWorkspaceSessionPublicView } from "@/lib/growth/native-dialer/native-dialer-types"
import type { VoiceInboundBrowserOfferView } from "@/lib/voice/browser-calling/types"

export type TwilioVoiceSdkCall = {
  parameters?: Record<string, string>
  accept?: () => void
  reject?: () => void
  disconnect?: () => void
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  status?: () => string
}

export type VoiceBrowserIncomingCallView = {
  callSid: string | null
  fromNumber: string | null
  toNumber: string | null
  receivedAt: string
}

export type VoiceBrowserIncomingLogEvent =
  | "incoming_received"
  | "incoming_cleared"
  | "answer_clicked"
  | "accept_succeeded"
  | "accept_failed"
  | "reject_clicked"
  | "reject_succeeded"
  | "reject_failed"
  | "hangup_clicked"
  | "hangup_succeeded"
  | "hangup_failed"

export function logBrowserIncomingCall(
  event: VoiceBrowserIncomingLogEvent,
  details: Record<string, unknown>,
): void {
  if (typeof console === "undefined") return
  console.info(
    JSON.stringify({
      source: "voice-browser-incoming",
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  )
}

export function extractVoiceBrowserIncomingCallView(call: TwilioVoiceSdkCall): VoiceBrowserIncomingCallView {
  const parameters = call.parameters ?? {}
  return {
    callSid: parameters.CallSid ?? parameters.callSid ?? null,
    fromNumber: parameters.From ?? parameters.from ?? null,
    toNumber: parameters.To ?? parameters.to ?? null,
    receivedAt: new Date().toISOString(),
  }
}

export function resolveInboundWorkspacePhase(input: {
  activeSessionStatus: NativeCallWorkspaceSessionPublicView["status"] | null | undefined
  sdkIncoming: boolean
}): "idle" | "incoming" | "bridge_pending" | "active" | "wrapup" {
  if (input.activeSessionStatus === "wrapping") return "wrapup"
  if (input.activeSessionStatus === "external_bridge_pending") return "bridge_pending"
  if (input.sdkIncoming || input.activeSessionStatus === "ringing") return "incoming"
  if (input.activeSessionStatus && ["active", "on_hold"].includes(input.activeSessionStatus)) return "active"
  return "idle"
}

export function buildInboundRingingSessionPlaceholder(input: {
  incomingCall: VoiceBrowserIncomingCallView
  inboundOffer?: VoiceInboundBrowserOfferView | null
  workspaceSessionId?: string | null
  voiceCallId?: string | null
}): NativeCallWorkspaceSessionPublicView {
  const sessionId =
    input.inboundOffer?.workspaceSessionId ??
    input.workspaceSessionId ??
    `pending-inbound-${input.incomingCall.callSid ?? "browser"}`
  return {
    id: sessionId,
    leadId: null,
    ownerUserId: null,
    provider: "twilio",
    fallbackProvider: null,
    dialMode: "inbound",
    direction: "inbound",
    status: "ringing",
    phoneNumber: input.inboundOffer?.fromNumber ?? input.incomingCall.fromNumber,
    contactName: input.inboundOffer?.contactLabel ?? null,
    companyName: "Incoming caller",
    startedAt: input.inboundOffer?.offeredAt ?? input.incomingCall.receivedAt,
    connectedAt: null,
    endedAt: null,
    durationSeconds: 0,
    recordingState: "pending",
    muted: false,
    onHold: false,
    transferTarget: null,
    notesDraft: "",
    realtimeSessionId: null,
    callCopilotSessionId: null,
    providerCallRef: input.incomingCall.callSid,
    safeSummary: "Inbound browser call ringing — answer to connect audio.",
    voiceCallId: input.inboundOffer?.voiceCallId ?? input.voiceCallId ?? null,
  }
}

export function shouldShowInboundAnswerControls(input: {
  sdkIncoming: boolean
  activeSessionStatus: NativeCallWorkspaceSessionPublicView["status"] | null | undefined
}): boolean {
  return input.sdkIncoming || input.activeSessionStatus === "ringing"
}
