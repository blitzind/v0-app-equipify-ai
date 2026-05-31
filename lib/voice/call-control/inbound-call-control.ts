import { logInboundRouteAudit } from "@/lib/voice/call-control/inbound-route-audit"
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

function auditCallControlDecision(
  input: MapInboundRouteToCallControlInput,
  decision: InboundCallControlDecision,
  branch: string,
): InboundCallControlDecision {
  logInboundRouteAudit("inbound-call-control", {
    branch,
    routingMode: decision.routingMode,
    routeStatus: decision.routeStatus,
    businessHoursStatus: input.route.businessHoursStatus,
    destinationUserIds: input.route.destinationUserIds,
    dialNumbers: decision.dialNumbers,
    dialClientIdentities: decision.dialClientIdentities ?? [],
    finalAction: decision.action,
    voicemailBoxId: decision.voicemailBoxId,
    fallbackReason: decision.fallbackReason,
    warnings: decision.warnings,
  })
  return decision
}

export function mapInboundRouteToCallControlDecision(
  input: MapInboundRouteToCallControlInput,
): InboundCallControlDecision {
  const { route, dialNumbers, dialClientIdentities = [] } = input

  if (route.routeStatus === "blocked") {
    if (route.routingMode === "ai_receptionist_future") {
      return auditCallControlDecision(input, {
        qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
        routeStatus: route.routeStatus,
        routingMode: route.routingMode,
        action: route.voicemailBoxId ? "voicemail" : "say_and_hangup",
        dialNumbers: [],
        dialClientIdentities: [],
        voicemailBoxId: route.voicemailBoxId,
        recordingEnabled: false,
        recordingDisclosureText: null,
        fallbackReason: route.fallbackReason ?? "AI receptionist is not enabled. Sending to voicemail or unavailable message.",
        warnings: route.warnings,
      }, "blocked_ai_receptionist_future")
    }
    return auditCallControlDecision(input, {
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
    }, "blocked_reject")
  }

  if (route.routingMode === "voicemail_only" || (route.routeStatus === "degraded" && route.voicemailBoxId && dialNumbers.length === 0 && dialClientIdentities.length === 0)) {
    return auditCallControlDecision(input, {
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
    }, route.routingMode === "voicemail_only" ? "voicemail_only_mode" : "degraded_empty_targets_with_voicemail_box")
  }

  if (route.routeStatus === "degraded" && dialNumbers.length === 0 && dialClientIdentities.length === 0) {
    return auditCallControlDecision(input, {
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
    }, "degraded_empty_targets_no_voicemail_box")
  }

  const action =
    route.routingMode === "ai_receptionist_future" && route.routeStatus === "resolved"
      ? "ai_receptionist"
      : route.routingMode === "forward_to_number"
        ? "forward"
        : "dial"

  return auditCallControlDecision(input, {
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
  }, action === "dial" ? "dial_resolved" : action === "forward" ? "forward_resolved" : "ai_receptionist_resolved")
}

export function resolveDialNumbersFromRoute(input: {
  route: InboundVoiceRouteResolution
  numberDefaultForward: string
  memberForwardNumbers: string[]
  roundRobinNumber?: string | null
}): string[] {
  let dialNumbers: string[]

  if (input.route.forwardingNumbers.length > 0) {
    dialNumbers = input.route.forwardingNumbers
  } else if (input.route.routingMode === "assigned_user") {
    dialNumbers = input.numberDefaultForward ? [input.numberDefaultForward] : []
  } else if (input.route.routingMode === "round_robin") {
    dialNumbers = input.roundRobinNumber ? [input.roundRobinNumber] : input.memberForwardNumbers.slice(0, 1)
  } else if (input.route.routingMode === "simultaneous_ring") {
    dialNumbers = input.memberForwardNumbers
  } else {
    dialNumbers = input.numberDefaultForward ? [input.numberDefaultForward] : []
  }

  logInboundRouteAudit("inbound-call-control", {
    branch: "resolveDialNumbersFromRoute",
    routingMode: input.route.routingMode,
    routeStatus: input.route.routeStatus,
    dialNumbers,
    numberDefaultForward: input.numberDefaultForward || null,
    memberForwardNumbers: input.memberForwardNumbers,
    roundRobinNumber: input.roundRobinNumber ?? null,
  })

  return dialNumbers
}
