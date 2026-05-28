import { isVoiceAiReceptionistEnabled } from "@/lib/voice/ai-receptionist/provider-types"
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

export function resolveInboundVoiceRoute(input: ResolveInboundVoiceRouteInput): InboundVoiceRouteResolution {
  const warnings: string[] = []
  const businessHoursStatus = input.businessHoursStatus ?? "unknown"

  if (input.number.status !== "active") {
    return {
      routeStatus: "blocked",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: null,
      businessHoursStatus,
      fallbackReason: `Number status is ${input.number.status}`,
      warnings: ["Inbound route blocked until number is active."],
    }
  }

  if (!input.number.voiceEnabled) {
    return {
      routeStatus: "blocked",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: null,
      businessHoursStatus,
      fallbackReason: "Voice disabled on number",
      warnings: ["Voice is disabled for this number."],
    }
  }

  const effectiveMode = input.number.routingMode ?? input.routingProfile?.routingMode ?? null
  if (!effectiveMode) {
    return {
      routeStatus: "degraded",
      routingMode: null,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: "No routing mode configured",
      warnings: ["Assign a routing profile or routing mode to this number."],
    }
  }

  if (isFutureOnlyMode(effectiveMode)) {
    return {
      routeStatus: "blocked",
      routingMode: effectiveMode,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: "AI receptionist is not enabled — set VOICE_AI_RECEPTIONIST_ENABLED=true",
      warnings: [VOICE_ROUTING_MODE_LABELS.ai_receptionist_future],
    }
  }

  if (effectiveMode === "ai_receptionist_future" && isVoiceAiReceptionistEnabled()) {
    return {
      routeStatus: "resolved",
      routingMode: effectiveMode,
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: null,
      warnings: ["AI inbound receptionist — bounded, operator-overridable."],
    }
  }

  if (businessHoursStatus === "closed" || businessHoursStatus === "holiday") {
    const afterHoursMode = input.routingProfile?.fallbackMode ?? "voicemail_only"
    warnings.push(`After-hours routing (${businessHoursStatus}).`)
    if (afterHoursMode === "forward_to_number") {
      const forward =
        input.routingProfile?.fallbackPhoneNumber || input.number.defaultForwardingTarget || ""
      return {
        routeStatus: forward ? "resolved" : "degraded",
        routingMode: afterHoursMode,
        destinationUserIds: [],
        forwardingNumbers: forward ? [forward] : [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: forward ? null : "After-hours forwarding number missing",
        warnings,
      }
    }
    return {
      routeStatus: "resolved",
      routingMode: "voicemail_only",
      destinationUserIds: [],
      forwardingNumbers: [],
      voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
      businessHoursStatus,
      fallbackReason: null,
      warnings,
    }
  }

  switch (effectiveMode) {
    case "forward_to_number": {
      const forward = input.number.defaultForwardingTarget || input.routingProfile?.fallbackPhoneNumber || ""
      if (!forward) {
        return {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "Forwarding target not configured",
          warnings: [...warnings, "Set a default forwarding target on the number or routing profile."],
        }
      }
      return {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [forward],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }
    }
    case "assigned_user": {
      const userId = input.number.assignedUserId
      if (!userId) {
        return {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "No assigned user on number",
          warnings: [...warnings, "Assign a user to this number for assigned-user routing."],
        }
      }
      return {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [userId],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }
    }
    case "round_robin":
    case "simultaneous_ring": {
      const members = (input.routingMembers ?? []).filter((m) => m.isActive).sort((a, b) => a.priority - b.priority)
      if (members.length === 0) {
        return {
          routeStatus: "degraded",
          routingMode: effectiveMode,
          destinationUserIds: [],
          forwardingNumbers: [],
          voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
          businessHoursStatus,
          fallbackReason: "No active routing profile members",
          warnings: [...warnings, "Add active members to the routing profile."],
        }
      }
      return {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: members.map((m) => m.userId),
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }
    }
    case "voicemail_only":
      return {
        routeStatus: "resolved",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: null,
        warnings,
      }
    default:
      return {
        routeStatus: "degraded",
        routingMode: effectiveMode,
        destinationUserIds: [],
        forwardingNumbers: [],
        voicemailBoxId: input.routingProfile?.voicemailBoxId ?? null,
        businessHoursStatus,
        fallbackReason: "Unsupported routing mode",
        warnings,
      }
  }
}
