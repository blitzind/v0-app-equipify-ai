import { isVoiceAiReceptionistEnabled } from "@/lib/voice/ai-receptionist/provider-types"
import { logInboundRouteAudit } from "@/lib/voice/call-control/inbound-route-audit"
import type {
  VoiceBusinessHoursStatus,
  VoiceNumberRecord,
  VoiceRoutingMode,
  VoiceRoutingProfileMemberRecord,
  VoiceRoutingProfileRecord,
} from "@/lib/voice/types"
import { VOICE_ROUTING_MODE_LABELS } from "@/lib/voice/types"

export type InboundVoiceRouteResolution = {
  routeStatus: "resolved" | "degraded" | "blocked"
  routingMode: VoiceRoutingMode | null
  destinationUserIds: string[]
  forwardingNumbers: string[]
  voicemailBoxId: string | null
  businessHoursStatus: VoiceBusinessHoursStatus
  fallbackReason: string | null
  warnings: string[]
}

export type ResolveInboundVoiceRouteInput = {
  organizationId: string
  number: Pick<
    VoiceNumberRecord,
    "id" | "phoneNumber" | "status" | "voiceEnabled" | "assignedUserId" | "routingMode" | "defaultForwardingTarget" | "routingProfileId"
  >
  fromNumber: string
  now?: Date
  routingProfile?: VoiceRoutingProfileRecord | null
  routingMembers?: VoiceRoutingProfileMemberRecord[]
  businessHoursStatus?: VoiceBusinessHoursStatus
}

function isFutureOnlyMode(mode: VoiceRoutingMode | null | undefined): boolean {
  if (mode !== "ai_receptionist_future") return false
  return !isVoiceAiReceptionistEnabled()
}

function finishRouteResolution(
  input: ResolveInboundVoiceRouteInput,
  result: InboundVoiceRouteResolution,
  branch: string,
): InboundVoiceRouteResolution {
  const effectiveMode = input.number.routingMode ?? input.routingProfile?.routingMode ?? null
  logInboundRouteAudit("routing-resolver", {
    branch,
    routingMode: result.routingMode,
    routeStatus: result.routeStatus,
    businessHoursStatus: result.businessHoursStatus,
    assignedUserId: input.number.assignedUserId ?? null,
    routingProfileId: input.number.routingProfileId ?? input.routingProfile?.id ?? null,
    numberRoutingMode: input.number.routingMode ?? null,
    profileRoutingMode: input.routingProfile?.routingMode ?? null,
    effectiveRoutingMode: effectiveMode,
    destinationUserIds: result.destinationUserIds,
    voicemailBoxId: result.voicemailBoxId,
    fallbackReason: result.fallbackReason,
    warnings: result.warnings,
    voiceNumberId: input.number.id,
    phoneNumber: input.number.phoneNumber,
    fromNumber: input.fromNumber,
  })
  return result
}

export function resolveInboundVoiceRoute(input: ResolveInboundVoiceRouteInput): InboundVoiceRouteResolution {
  const warnings: string[] = []
  const businessHoursStatus = input.businessHoursStatus ?? "unknown"

  if (input.number.status !== "active") {
    return finishRouteResolution(input, {
      routeStatus: "blocked",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: null,
      businessHoursStatus,
      fallbackReason: `Number status is ${input.number.status}`,
      warnings: ["Inbound route blocked until number is active."],
    }, "number_not_active")
  }

  if (!input.number.voiceEnabled) {
    return finishRouteResolution(input, {
      routeStatus: "blocked",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: null,
      businessHoursStatus,
      fallbackReason: "Voice disabled on number",
      warnings: ["Voice is disabled for this number."],
    }, "voice_disabled")
  }

  const effectiveMode = input.number.routingMode ?? input.routingProfile?.routingMode ?? null
  if (!effectiveMode) {
    return finishRouteResolution(input, {
      routeStatus: "degraded",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: "No routing mode configured",
      warnings: ["Assign a routing profile or routing mode to this number."],
    }, "no_routing_mode")
  }

  if (isFutureOnlyMode(effectiveMode)) {
    return finishRouteResolution(input, {
      routeStatus: "blocked",
      routingMode: effectiveMode,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: "AI receptionist is not enabled — set VOICE_AI_RECEPTIONIST_ENABLED=true",
      warnings: [VOICE_ROUTING_MODE_LABELS.ai_receptionist_future],
    }, "ai_receptionist_future_disabled")
  }

  if (effectiveMode === "ai_receptionist_future" && isVoiceAiReceptionistEnabled()) {
    return finishRouteResolution(input, {
      routeStatus: "resolved",
      routingMode: effectiveMode,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: null,
      warnings: ["AI inbound receptionist — bounded, operator-overridable."],
    }, "ai_receptionist_future_enabled")
  }

  if (businessHoursStatus === "closed" || businessHoursStatus === "holiday") {
    const afterHoursMode = input.routingProfile?.fallbackMode ?? "voicemail_only"
    warnings.push(`After-hours routing (${businessHoursStatus}).`)
    if (afterHoursMode === "forward_to_number") {
      const forward =
        input.routingProfile?.fallbackPhoneNumber || input.number.defaultForwardingTarget || ""
      return finishRouteResolution(input, {
        routeStatus: forward ? "resolved" : "degraded",
        routingMode: afterHoursMode,
        destinationUserIds: [],
        forwardingNumbers: forward ? [forward] : [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: forward ? null : "After-hours forwarding number missing",
        warnings,
      }, "after_hours_forward")
    }
    return finishRouteResolution(input, {
      routeStatus: "resolved",
      routingMode: "voicemail_only",
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: null,
      warnings,
    }, "after_hours_voicemail_only")
  }

  switch (effectiveMode) {
    case "forward_to_number": {
      const forward = input.number.defaultForwardingTarget || input.routingProfile?.fallbackPhoneNumber || ""
      if (!forward) {
        return finishRouteResolution(input, {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "Forwarding target not configured",
          warnings: [...warnings, "Set a default forwarding target on the number or routing profile."],
        }, "forward_to_number_missing_target")
      }
      return finishRouteResolution(input, {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [forward],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }, "forward_to_number_resolved")
    }
    case "assigned_user": {
      const userId = input.number.assignedUserId
      if (!userId) {
        return finishRouteResolution(input, {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "No assigned user on number",
          warnings: [...warnings, "Assign a user to this number for assigned-user routing."],
        }, "assigned_user_missing")
      }
      return finishRouteResolution(input, {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [userId],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }, "assigned_user_resolved")
    }
    case "round_robin":
    case "simultaneous_ring": {
      const members = (input.routingMembers ?? []).filter((m) => m.isActive).sort((a, b) => a.priority - b.priority)
      if (members.length === 0) {
        return finishRouteResolution(input, {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "No active routing profile members",
          warnings: [...warnings, "Add active members to the routing profile."],
        }, "ring_group_no_members")
      }
      return finishRouteResolution(input, {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: members.map((m) => m.userId),
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }, "ring_group_resolved")
    }
    case "voicemail_only":
      return finishRouteResolution(input, {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }, "voicemail_only_resolved")
    default:
      return finishRouteResolution(input, {
        routeStatus: "degraded",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: "Unsupported routing mode",
        warnings,
      }, "unsupported_mode")
  }
}
