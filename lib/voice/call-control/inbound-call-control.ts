import type { InboundVoiceRouteResolution } from "@/lib/voice/routing/routing-resolver"
import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"

export type MapInboundRouteToCallControlInput = {
  route: InboundVoiceRouteResolution
  dialNumbers: string[]
  dialClientIdentities?: string[]
  recordingEnabled: boolean
  recordingDisclosureText: string | null
  voicemailGreetingText?: string | null
}

export function mapInboundRouteToCallControlDecision(
  input: MapInboundRouteToCallControlInput,
): InboundCallControlDecision {
  const { route, dialNumbers, dialClientIdentities = [] } = input

  if (route.routeStatus === "blocked") {
    if (route.routingMode === "ai_receptionist_future") {
      return {
        qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
        routeStatus: route.routeStatus,
        routingMode: route.routingMode,
        action: route.voicemailBoxId ? "voicemail" : "say_and_hangup",
        dialNumbers: [],
        dialClientIdentities: [],
        voicemailBoxId: route.voicemailBoxId,
        recordingEnabled: false,
        recordingDisclosureText: null,
        fallbackReason: "AI receptionist is not enabled. Sending to voicemail or unavailable message.",
        warnings: route.warnings,
      }
    }
    return {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      routeStatus: route.routeStatus,
      routingMode: route.routingMode,
      action: "reject",
      dialNumbers: [],
      dialClientIdentities: [],
      voicemailBoxId: route.voicemailBoxId,
      recordingEnabled: false,
      recordingDisclosureText: null,
      fallbackReason: route.fallbackReason,
      warnings: route.warnings,
    }
  }

  if (route.routingMode === "voicemail_only" || (route.routeStatus === "degraded" && route.voicemailBoxId && dialNumbers.length === 0 && dialClientIdentities.length === 0)) {
    return {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      routeStatus: route.routeStatus,
      routingMode: route.routingMode,
      action: "voicemail",
      dialNumbers: [],
      dialClientIdentities: [],
      voicemailBoxId: route.voicemailBoxId,
      recordingEnabled: true,
      recordingDisclosureText: null,
      fallbackReason: input.voicemailGreetingText ?? route.fallbackReason ?? undefined,
      warnings: route.warnings,
    }
  }

  if (route.routeStatus === "degraded" && dialNumbers.length === 0 && dialClientIdentities.length === 0) {
    return {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      routeStatus: route.routeStatus,
      routingMode: route.routingMode,
      action: "say_and_hangup",
      dialNumbers: [],
      dialClientIdentities: [],
      voicemailBoxId: route.voicemailBoxId,
      recordingEnabled: false,
      recordingDisclosureText: null,
      fallbackReason: route.fallbackReason ?? "Routing is not fully configured.",
      warnings: route.warnings,
    }
  }

  const action = route.routingMode === "forward_to_number" ? "forward" : "dial"

  return {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    routeStatus: route.routeStatus,
    routingMode: route.routingMode,
    action,
    dialNumbers,
    dialClientIdentities,
    voicemailBoxId: route.voicemailBoxId,
    recordingEnabled: input.recordingEnabled,
    recordingDisclosureText: input.recordingEnabled ? input.recordingDisclosureText : null,
    fallbackReason: route.fallbackReason,
    warnings: route.warnings,
  }
}

export function resolveDialNumbersFromRoute(input: {
  route: InboundVoiceRouteResolution
  numberDefaultForward: string
  memberForwardNumbers: string[]
  roundRobinNumber?: string | null
}): string[] {
  if (input.route.forwardingNumbers.length > 0) {
    return input.route.forwardingNumbers
  }

  if (input.route.routingMode === "assigned_user") {
    return input.numberDefaultForward ? [input.numberDefaultForward] : []
  }

  if (input.route.routingMode === "round_robin") {
    if (input.roundRobinNumber) return [input.roundRobinNumber]
    return input.memberForwardNumbers.slice(0, 1)
  }

  if (input.route.routingMode === "simultaneous_ring") {
    return input.memberForwardNumbers
  }

  return input.numberDefaultForward ? [input.numberDefaultForward] : []
}
