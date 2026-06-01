import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { evaluateVoiceBusinessHours } from "@/lib/voice/business-hours/business-hours-evaluator"
import {
  resolveInboundDialTargetsWithBrowser,
  resolveRoundRobinMemberUserId,
} from "@/lib/voice/browser-calling/inbound-browser-routing"
import { createInboundVoiceCallFromTwilio,
  provisionInboundBrowserWorkspaceOffers,
} from "@/lib/voice/browser-calling/workspace-bridge"
import { startAiReceptionistSessionForCall } from "@/lib/voice/ai-receptionist/receptionist-service"
import { isVoiceAiReceptionistEnabled } from "@/lib/voice/ai-receptionist/provider-types"
import { buildTwilioSayAndHangup } from "@/lib/voice/call-control/twilio-twiml"
import {
  mapInboundRouteToCallControlDecision,
  resolveDialNumbersFromRoute,
} from "@/lib/voice/call-control/inbound-call-control"
import {
  resolveEffectiveRecordingPolicy,
  shouldRecordCall,
} from "@/lib/voice/call-control/recording-policy"
import type { InboundCallControlDecision } from "@/lib/voice/call-control/types"
import { normalizePhoneNumber } from "@/lib/voice/phone-normalization"
import { createTwilioCallControlProvider, generateInboundCallResponse } from "@/lib/voice/providers/call-control/twilio-call-control"
import { resolveInboundVoiceRoute } from "@/lib/voice/routing/routing-resolver"
import {
  fetchVoiceCallControlSettings,
  fetchVoiceBusinessHoursById,
  fetchVoiceNumberByPhone,
  fetchVoiceRoutingProfileById,
  fetchVoiceRoutingProfileMembers,
  fetchVoiceVoicemailBoxes,
  mapNumber,
  pickRoundRobinMemberForwardNumber,
  upsertVoiceCallControlSettings,
} from "@/lib/voice/repository/voice-call-control-repository"
import { logVoiceInfrastructure } from "@/lib/voice/telemetry"
import { VOICE_CALL_CONTROL_QA_MARKER } from "@/lib/voice/call-control/types"
import { VoiceRouteTimer, withVoiceTimeout } from "@/lib/voice/performance/voice-route-timing"
import { runVoiceBackgroundTask } from "@/lib/voice/performance/run-voice-background-task"
import type { InboundVoiceRouteResolution } from "@/lib/voice/routing/routing-resolver"
import { buildVoiceMediaStreamTwilioWssUrl } from "@/lib/voice/call-control/urls"
import { shouldEnableInboundDialMediaStream } from "@/lib/voice/media-streaming/inbound-dial-media-stream-config"
import { VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER } from "@/lib/voice/media-streaming/voice-stream-lifecycle"
import {
  INBOUND_RING_DIAG_EVENTS,
  logInboundRingDiagnostic,
} from "@/lib/voice/browser-calling/inbound-ring-diagnostics"

export type HandleTwilioInboundCallInput = {
  admin: SupabaseClient
  payload: Record<string, unknown>
  recordingCallbackUrl: string
  statusCallbackUrl?: string
  /** Public HTTPS origin for Twilio media stream WSS URL construction. */
  mediaStreamOrigin?: string | null
}

export type HandleTwilioInboundCallResult =
  | {
      ok: true
      twiml: string
      decision: InboundCallControlDecision
      organizationId: string
      voiceNumberId: string
    }
  | {
      ok: false
      code: "number_not_found" | "org_not_found" | "configuration_error"
      message: string
      twiml: string
    }

function readToNumber(payload: Record<string, unknown>): string | null {
  const to = typeof payload.To === "string" ? payload.To : null
  return to ? normalizePhoneNumber(to) : null
}

function readFromNumber(payload: Record<string, unknown>): string {
  const from = typeof payload.From === "string" ? payload.From : ""
  return normalizePhoneNumber(from) || from
}

function readCallSid(payload: Record<string, unknown>): string | null {
  return typeof payload.CallSid === "string" ? payload.CallSid : null
}

async function resolveInboundCallControlBundle(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceNumberId: string
    fromNumber: string
    skipRoundRobinAdvance?: boolean
  },
): Promise<
  | {
      ok: true
      decision: InboundCallControlDecision
      route: InboundVoiceRouteResolution
      voiceNumberPhone: string
      browserTargetUserIds: string[]
    }
  | { ok: false; message: string }
> {
  const { data } = await admin
    .schema("voice")
    .from("voice_numbers")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("id", input.voiceNumberId)
    .maybeSingle()

  if (!data) return { ok: false, message: "Voice number not found." }

  const voiceNumber = mapNumber(data as Record<string, unknown>)
  const settings = await fetchVoiceCallControlSettings(admin, input.organizationId)
  const routingProfile = voiceNumber.routingProfileId
    ? await fetchVoiceRoutingProfileById(admin, input.organizationId, voiceNumber.routingProfileId)
    : null
  const members = routingProfile
    ? await fetchVoiceRoutingProfileMembers(admin, input.organizationId, routingProfile.id)
    : []
  const businessHours = routingProfile?.businessHoursId
    ? await fetchVoiceBusinessHoursById(admin, input.organizationId, routingProfile.businessHoursId)
    : null
  const businessHoursStatus = evaluateVoiceBusinessHours(businessHours)
  const memberForwardNumbers = members
    .filter((member) => member.isActive && member.forwardingPhoneNumber)
    .sort((a, b) => a.priority - b.priority)
    .map((member) => normalizePhoneNumber(member.forwardingPhoneNumber))
    .filter(Boolean)

  const roundRobinNumber =
    routingProfile && !input.skipRoundRobinAdvance
      ? await pickRoundRobinMemberForwardNumber(admin, input.organizationId, routingProfile.id, members)
      : memberForwardNumbers[0] ?? null

  const route = resolveInboundVoiceRoute({
    organizationId: input.organizationId,
    number: voiceNumber,
    fromNumber: input.fromNumber,
    routingProfile,
    routingMembers: members,
    businessHoursStatus,
  })

  const dialNumbers = resolveDialNumbersFromRoute({
    route,
    numberDefaultForward: normalizePhoneNumber(voiceNumber.defaultForwardingTarget),
    memberForwardNumbers,
    roundRobinNumber,
  })

  const roundRobinUserId = resolveRoundRobinMemberUserId({ members, roundRobinNumber })
  const browserTargets = await resolveInboundDialTargetsWithBrowser(admin, {
    organizationId: input.organizationId,
    route,
    pstnNumbers: dialNumbers,
    roundRobinUserId,
  })

  const recordingPolicy = resolveEffectiveRecordingPolicy({
    direction: "inbound",
    orgDefault: settings?.defaultRecordingPolicy ?? "disabled",
    numberOverride: voiceNumber.recordingPolicy ?? null,
  })

  let voicemailGreeting: string | null = null
  if (route.voicemailBoxId) {
    const boxes = await fetchVoiceVoicemailBoxes(admin, input.organizationId)
    const box = boxes.find((entry) => entry.id === route.voicemailBoxId)
    voicemailGreeting = box?.greetingText ?? null
  }

  const decision = mapInboundRouteToCallControlDecision({
    route,
    dialNumbers: browserTargets.pstnNumbers,
    dialClientIdentities: browserTargets.clientIdentities,
    recordingEnabled: shouldRecordCall({ policy: recordingPolicy, direction: "inbound" }),
    recordingDisclosureText: settings?.recordingDisclosureText ?? null,
    voicemailGreetingText: voicemailGreeting,
  })

  return {
    ok: true,
    decision,
    route,
    voiceNumberPhone: voiceNumber.phoneNumber,
    browserTargetUserIds: browserTargets.targetUserIds,
  }
}

export async function previewInboundCallControlDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    voiceNumberId: string
    fromNumber: string
    skipRoundRobinAdvance?: boolean
  },
): Promise<{ ok: true; decision: InboundCallControlDecision; route: InboundVoiceRouteResolution } | { ok: false; message: string }> {
  const bundle = await resolveInboundCallControlBundle(admin, input)
  if (!bundle.ok) return bundle
  return { ok: true, decision: bundle.decision, route: bundle.route }
}

export async function handleTwilioInboundCall(
  input: HandleTwilioInboundCallInput,
): Promise<HandleTwilioInboundCallResult> {
  const timer = new VoiceRouteTimer("voice_inbound_twilio")
  const provider = createTwilioCallControlProvider()
  const toNumber = readToNumber(input.payload)
  if (!toNumber) {
    const twiml = provider.rejectCall().body
    timer.finish({ outcome: "missing_to" })
    return { ok: false, code: "number_not_found", message: "Missing To number.", twiml }
  }

  const voiceNumber = await timer.measure("voice_number_lookup", () =>
    fetchVoiceNumberByPhone(input.admin, toNumber),
  )
  if (!voiceNumber) {
    const twiml = provider.rejectCall().body
    timer.finish({ outcome: "number_not_found" })
    return { ok: false, code: "number_not_found", message: "Voice number not registered.", twiml }
  }

  const organizationId = voiceNumber.organizationId
  const callSid = readCallSid(input.payload)
  const fromNumber = readFromNumber(input.payload)

  logInboundRingDiagnostic(INBOUND_RING_DIAG_EVENTS.TWILIO_WEBHOOK_RECEIVED, {
    provider_call_id: callSid,
    from_number: fromNumber,
    to_number: toNumber,
    organization_id: organizationId,
    voice_number_id: voiceNumber.id,
  })

  const bundle = await timer.measure("routing_bundle", () =>
    withVoiceTimeout(
      "voice_inbound_routing_bundle",
      1500,
      () =>
        resolveInboundCallControlBundle(input.admin, {
          organizationId,
          voiceNumberId: voiceNumber.id,
          fromNumber: readFromNumber(input.payload),
        }),
      null,
    ),
  )
  if (!bundle) {
    timer.finish({ outcome: "routing_timeout", callSid })
    const twiml = buildTwilioSayAndHangup("We are unable to connect your call right now.")
    return {
      ok: false,
      code: "configuration_error",
      message: "Inbound routing timed out.",
      twiml,
    }
  }
  if (!bundle.ok) {
    timer.finish({ outcome: "routing_failed", callSid })
    const twiml = provider.rejectCall().body
    return { ok: false, code: "configuration_error", message: bundle.message, twiml }
  }

  const { decision, browserTargetUserIds } = bundle

  logVoiceInfrastructure("voice_inbound_route_decision", {
    qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
    organizationId,
    voiceNumberId: voiceNumber.id,
    routeStatus: decision.routeStatus,
    routingMode: decision.routingMode,
    action: decision.action,
    dialNumbers: decision.dialNumbers,
    dialClientIdentities: decision.dialClientIdentities ?? [],
    warnings: decision.warnings,
    businessHoursStatus: bundle.route.businessHoursStatus,
  })

  const mediaStreamEnabled =
    Boolean(callSid) &&
    shouldEnableInboundDialMediaStream() &&
    (decision.action === "dial" || decision.action === "forward")
  const mediaStream = mediaStreamEnabled
    ? {
        wssUrl: buildVoiceMediaStreamTwilioWssUrl(input.mediaStreamOrigin ?? null),
        callSid,
      }
    : null

  if (mediaStream) {
    logVoiceInfrastructure("voice_inbound_dial_media_stream_twiml", {
      qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
      foundationMarker: VOICE_MEDIA_STREAMING_FOUNDATION_QA_MARKER,
      organizationId,
      callSid,
      action: decision.action,
      wssUrl: mediaStream.wssUrl,
      dialClientIdentities: decision.dialClientIdentities ?? [],
    })
  }

  const response = generateInboundCallResponse(provider, {
    decision,
    callerId: voiceNumber.phoneNumber,
    recordingCallbackUrl: input.recordingCallbackUrl,
    statusCallbackUrl: input.statusCallbackUrl,
    mediaStream,
  })

  if (
    callSid &&
    decision.action === "dial" &&
    (decision.dialClientIdentities?.length ?? 0) > 0
  ) {
    runVoiceBackgroundTask("inbound_browser_provision", async () => {
      try {
        const voiceCallId = await createInboundVoiceCallFromTwilio(input.admin, {
          organizationId,
          providerCallId: callSid,
          fromNumber,
          toNumber,
          assignedUserId: browserTargetUserIds[0] ?? voiceNumber.assignedUserId,
        })
        await provisionInboundBrowserWorkspaceOffers(input.admin, {
          organizationId,
          voiceCallId,
          targetUserIds: browserTargetUserIds,
          fromNumber,
          toNumber,
        })
      } catch (error) {
        logVoiceInfrastructure("voice_inbound_browser_provision_failed", {
          qaMarker: VOICE_CALL_CONTROL_QA_MARKER,
          organizationId,
          callSid,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    })
  }

  if (callSid && decision.action === "ai_receptionist" && isVoiceAiReceptionistEnabled()) {
    runVoiceBackgroundTask("inbound_ai_receptionist", async () => {
      const voiceCallId = await createInboundVoiceCallFromTwilio(input.admin, {
        organizationId,
        providerCallId: callSid,
        fromNumber,
        toNumber,
        assignedUserId: voiceNumber.assignedUserId,
      })
      await startAiReceptionistSessionForCall(input.admin, {
        organizationId,
        voiceCallId,
        afterHours: bundle.route.businessHoursStatus === "closed",
        callerNumber: fromNumber,
      })
    })
  }

  runVoiceBackgroundTask("inbound_call_control_settings", async () => {
    await upsertVoiceCallControlSettings(input.admin, organizationId, {
      inboundCallControlReady: true,
    })
  })

  timer.finish({ outcome: "twiml_ready", callSid, action: decision.action })

  return {
    ok: true,
    twiml: response.body,
    decision,
    organizationId,
    voiceNumberId: voiceNumber.id,
  }
}
